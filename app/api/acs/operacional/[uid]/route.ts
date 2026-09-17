import { NextResponse } from "next/server";
import { FieldPath, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

type Registro = Record<string, unknown>;

type Situacao = "Em dia" | "Atenção";

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function normalizar(v: string): string {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function numero(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function dataFormatada(v: unknown): string | null {
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("pt-BR");
  }
  if (
    typeof v === "object" &&
    v !== null &&
    "toDate" in v &&
    typeof (v as { toDate?: unknown }).toDate === "function"
  ) {
    const d = (v as { toDate: () => Date }).toDate();
    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("pt-BR");
  }
  return null;
}

function nomePaciente(d: Registro): string {
  return texto(d.nome) || texto(d.nomePaciente) || texto(d.Nome) || "Paciente sem nome";
}

function idadePaciente(d: Registro): number | null {
  const idade = numero(d.idade ?? d.Idade);
  if (idade !== null) return idade;

  const nasc = texto(d.dataNascimento ?? d["Data de nascimento"]);
  if (!nasc) return null;

  const data = new Date(nasc);
  if (Number.isNaN(data.getTime())) return null;

  const hoje = new Date();
  let idadeCalc = hoje.getFullYear() - data.getFullYear();
  if (
    hoje.getMonth() < data.getMonth() ||
    (hoje.getMonth() === data.getMonth() && hoje.getDate() < data.getDate())
  ) {
    idadeCalc--;
  }

  return idadeCalc >= 0 ? idadeCalc : null;
}

function identificador(d: Registro): string {
  return texto(d.cns) || texto(d.CNS) || texto(d.cpf) || texto(d.CPF);
}

function ultimoAtendimento(d: Registro): string | null {
  const campos = [
    d.dataUltimoAtendimento,
    d.ultimoAtendimento,
    d.dataUltimaConsulta,
    d.ultimaConsulta,
    d.dataAtendimento,
  ];

  for (const campo of campos) {
    const data = dataFormatada(campo);
    if (data) return data;
  }

  const meses = numero(
    d.mesesDesdeUltimoAtendimento ??
      d.meses_desde_ultimo_atendimento ??
      d["Meses desde o último atendimento médico"]
  );

  if (meses === null) return null;
  if (meses === 0) return "Atendimento no último mês";
  return `Há ${meses} ${meses === 1 ? "mês" : "meses"}`;
}

function valorPorTermo(d: Registro, termos: string[]): string {
  for (const [chave, valor] of Object.entries(d)) {
    const chaveNormalizada = normalizar(chave);
    if (
      termos.some((termo) => chaveNormalizada.includes(normalizar(termo))) &&
      valor !== null &&
      valor !== undefined &&
      String(valor).trim() !== ""
    ) {
      return String(valor).trim();
    }
  }
  return "";
}

function temaImportacao(lista: string): string {
  const n = normalizar(lista);

  if (n.includes("diabet")) return "Diabetes";
  if (n.includes("hipertens")) return "Hipertensão";
  if (n.includes("gestacao") || n.includes("puerper")) return "Gestação/puerpério";
  if (n.includes("idos")) return "Pessoa idosa";
  if (n.includes("saude da mulher") || n === "mulher") return "Saúde da mulher";
  if (n.includes("saude bucal") || n.includes("odontolog")) return "Saúde bucal";
  if (n.includes("infantil") || n.includes("crianca")) return "Desenvolvimento infantil";

  return lista || "PEC";
}

function criarAcoes(tema: string, registro: Registro): { status: "Revisar" | "Registrado" }[] {
  const regras: Record<string, { termos: string[] }[]> = {
    Diabetes: [
      { termos: ["hba1c", "hemoglobina glicada"] },
      { termos: ["avaliacao dos pes", "pe diabetico"] },
    ],
    Hipertensão: [
      { termos: ["pressao arterial", "pressao"] },
    ],
    "Saúde da mulher": [
      { termos: ["citopatologico", "papanicolau", "hpv", "rastreamento"] },
      { termos: ["mamografia", "rastreamento de mama"] },
    ],
    "Saúde bucal": [
      { termos: ["primeira consulta", "consulta odontologica"] },
      { termos: ["tratamento odontologico concluido", "tratamento concluido"] },
    ],
    "Desenvolvimento infantil": [
      { termos: ["puericultura", "desenvolvimento", "consulta"] },
      { termos: ["vacina", "imunizacao"] },
    ],
    "Gestação/puerpério": [
      { termos: ["pre natal", "consulta prenatal"] },
      { termos: ["puerperio"] },
    ],
    "Pessoa idosa": [
      { termos: ["consulta", "peso", "altura", "influenza"] },
    ],
  };

  return (regras[tema] || []).map((regra) => ({
    status: valorPorTermo(registro, regra.termos) ? "Registrado" : "Revisar",
  }));
}

function situacaoPorRegistro(registros: { tema: string; registro: Registro }[]): Situacao {
  // A lista operacional usa a mesma regra da ficha individual:
  // se alguma ação esperada não foi localizada no registro do PEC,
  // o paciente entra em Atenção. Ter apenas a temática registrada
  // não é suficiente para marcar o paciente como pendente.
  for (const item of registros) {
    if (criarAcoes(item.tema, item.registro).some((acao) => acao.status === "Revisar")) {
      return "Atenção";
    }
  }
  return "Em dia";
}

function situacaoFallback(d: Registro): Situacao {
  const s = texto(d.situacao ?? d.statusAcompanhamento ?? d.situacaoAcompanhamento);
  if (s) return /atras|pend|risco|atenção|atencao/i.test(s) ? "Atenção" : "Em dia";

  const meses = numero(
    d.mesesDesdeUltimoAtendimento ??
      d.meses_desde_ultimo_atendimento ??
      d["Meses desde o último atendimento médico"]
  );

  return meses !== null && meses >= 6 ? "Atenção" : "Em dia";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ uid: string }> }
) {
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Sessão não autenticada." },
        { status: 401 }
      );
    }

    const decoded = await adminAuth.verifyIdToken(authorization.slice(7).trim());
    const { uid } = await context.params;

    const usuarioSnap = await adminDb.collection("usuarios").doc(decoded.uid).get();
    const usuario = usuarioSnap.data();

    if (
      !usuarioSnap.exists ||
      usuario?.ativo !== true ||
      !["enfermeira", "acs"].includes(usuario?.perfil)
    ) {
      return NextResponse.json({ sucesso: false, mensagem: "Acesso não autorizado." }, { status: 403 });
    }

    if (usuario.perfil === "acs" && decoded.uid !== uid) {
      return NextResponse.json({ sucesso: false, mensagem: "Você só pode acessar sua própria área." }, { status: 403 });
    }

    const ubsId = texto(usuario.ubsId);
    const ubsRef = adminDb.collection("ubs").doc(ubsId);
    const acsSnap = await ubsRef.collection("acs").doc(uid).get();

    if (!acsSnap.exists) {
      return NextResponse.json({ sucesso: false, mensagem: "ACS não encontrado." }, { status: 404 });
    }

    const acs = acsSnap.data() || {};
    const microareaId = texto(acs.microareaId);

    const pacientesSnap = microareaId
      ? await ubsRef.collection("pacientes").where("microareaId", "==", microareaId).get()
      : { docs: [] as QueryDocumentSnapshot[] };

    const pacientesBase = pacientesSnap.docs.map((doc) => ({
      id: doc.id,
      dados: doc.data() as Registro,
    }));

    // Busca os históricos PEC uma vez por importação e monta um mapa por paciente.
    // Isso evita uma consulta separada para cada paciente.
    const registrosPorPaciente = new Map<string, { tema: string; registro: Registro }[]>();
    const importacoesSnap = await ubsRef.collection("importacoesPEC").get();

    for (const importacaoDoc of importacoesSnap.docs) {
      const meta = importacaoDoc.data() || {};
      const tema = temaImportacao(texto(meta.listaTematica));
      const ids = pacientesBase.map((p) => p.id);

      for (let inicio = 0; inicio < ids.length; inicio += 30) {
        const bloco = ids.slice(inicio, inicio + 30);
        if (!bloco.length) continue;

        const registrosSnap = await importacaoDoc.ref
          .collection("registros")
          .where(FieldPath.documentId(), "in", bloco)
          .get();

        for (const registroDoc of registrosSnap.docs) {
          const registro = registroDoc.data() as Registro;
          const lista = registrosPorPaciente.get(registroDoc.id) || [];
          lista.push({ tema, registro });
          registrosPorPaciente.set(registroDoc.id, lista);
        }
      }
    }

    const pacientes = pacientesBase
      .map(({ id, dados }) => {
        const historicos = registrosPorPaciente.get(id) || [];
        const situacao = historicos.length
          ? situacaoPorRegistro(historicos)
          : situacaoFallback(dados);

        return {
          id,
          nome: nomePaciente(dados),
          idade: idadePaciente(dados),
          identificador: identificador(dados),
          ultimoAtendimento: ultimoAtendimento(dados),
          situacao,
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    const atencao = pacientes.filter((p) => p.situacao === "Atenção").length;

    return NextResponse.json({
      sucesso: true,
      acs: {
        uid,
        nome: texto(acs.nome) || "ACS",
        microareaId,
        ativo: acs.ativo === true,
        ultimoAcesso: texto(acs.ultimoAcesso) || null,
      },
      resumo: {
        pacientes: pacientes.length,
        atencao,
        emDia: pacientes.length - atencao,
      },
      pacientes,
    });
  } catch (error) {
    console.error("Erro ao carregar área operacional do ACS:", error);
    return NextResponse.json(
      { sucesso: false, mensagem: "Não foi possível carregar a área operacional do ACS." },
      { status: 500 }
    );
  }
}
