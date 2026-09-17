import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import {
  avaliarC4Diabetes,
  type ResultadoC4Diabetes,
} from "@/lib/indicadores/c4-diabetes";

export const runtime = "nodejs";

type Documento = FirebaseFirestore.DocumentData;

type ImportacaoC4 = Documento & {
  id: string;
};

function dataReferencia(valor: unknown, fallback: Date) {
  const texto = typeof valor === "string" ? valor : "";
  const match = texto.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return fallback;

  const [, dia, mes, ano] = match;
  const data = new Date(Number(ano), Number(mes) - 1, Number(dia));
  return Number.isNaN(data.getTime()) ? fallback : data;
}

function dadosBase(registro: Documento) {
  return registro.dadosBase && typeof registro.dadosBase === "object"
    ? registro.dadosBase
    : {};
}

function nomePaciente(registro: Documento) {
  const base = dadosBase(registro);
  return typeof base.Nome === "string" ? base.Nome : "Paciente sem nome";
}

function cpfPaciente(registro: Documento) {
  const base = dadosBase(registro);
  return typeof base.CPF === "string" ? base.CPF : "";
}

function microareaPaciente(registro: Documento) {
  const valor = registro.microareaId ?? dadosBase(registro).Microárea;
  return String(valor ?? "").replace(/^"+|"+$/g, "").trim();
}

export async function GET(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Sessão não autenticada." },
        { status: 401 }
      );
    }

    const token = authorization.slice("Bearer ".length).trim();
    const decoded = await adminAuth.verifyIdToken(token);
    const usuarioSnap = await adminDb.collection("usuarios").doc(decoded.uid).get();

    if (!usuarioSnap.exists) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Usuário não encontrado." },
        { status: 403 }
      );
    }

    const usuario = usuarioSnap.data();
    if (
      usuario?.perfil !== "enfermeira" ||
      usuario?.ativo !== true ||
      typeof usuario?.ubsId !== "string"
    ) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Somente a enfermeira ativa pode consultar o C4." },
        { status: 403 }
      );
    }

    const ubsRef = adminDb.collection("ubs").doc(usuario.ubsId);
    const importsSnapshot = await ubsRef.collection("importacoesPEC").get();

    const normalizar = (valor: unknown) =>
      String(valor ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

    const importacoesC4: ImportacaoC4[] = importsSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as ImportacaoC4)
      .filter((item) => {
        if (item.fonteC4DiabetesAtiva === true) return true;

        const lista = normalizar(item.listaTematica);
        const grupo = normalizar(item.grupoCondicoes);
        const filtro = normalizar(item.filtroProblemas);

        return (
          (lista.includes("diabetes") || grupo.includes("diabetes")) &&
          filtro.includes("somente problemas ativos")
        );
      })
      .sort((a, b) => {
        const aTime = a.criadoEm?.toMillis?.() ?? 0;
        const bTime = b.criadoEm?.toMillis?.() ?? 0;
        return bTime - aTime;
      });

    const importacao = importacoesC4[0];

    if (!importacao) {
      return NextResponse.json({
        sucesso: true,
        possuiDados: false,
        mensagem:
          "Ainda não existe uma importação de Diabetes com problemas ativos para calcular o C4.",
      });
    }

    const registrosSnapshot = await ubsRef
      .collection("importacoesPEC")
      .doc(importacao.id)
      .collection("registros")
      .get();

    const referencia = dataReferencia(
      importacao.geradoEm,
      importacao.criadoEm?.toDate?.() ?? new Date()
    );

    const pacientes = registrosSnapshot.docs.map((doc) => {
      const registro = doc.data();
      const resultado: ResultadoC4Diabetes = avaliarC4Diabetes(
        registro.dadosEspecificos ?? {},
        {
          referencia,
          metadados: {
            listaTematica: importacao.listaTematica,
            grupoCondicoes: importacao.grupoCondicoes,
            filtroProblemas: importacao.filtroProblemas,
          },
        }
      );

      return {
        id: doc.id,
        nome: nomePaciente(registro),
        cpf: cpfPaciente(registro),
        microarea: microareaPaciente(registro),
        ...resultado,
      };
    });

    const elegiveis = pacientes.filter((paciente) => paciente.elegivel);
    const totalElegiveis = elegiveis.length;
    const codigos = ["A", "B", "C", "D", "E", "F"] as const;

    const praticas = Object.fromEntries(
      codigos.map((codigo) => {
        const atingidos = elegiveis.filter((paciente) =>
          paciente.praticas.some(
            (pratica) => pratica.codigo === codigo && pratica.atingida
          )
        ).length;

        return [
          codigo,
          {
            atingidos,
            percentual:
              totalElegiveis > 0
                ? Number(((atingidos / totalElegiveis) * 100).toFixed(1))
                : 0,
          },
        ];
      })
    );

    const somaPontos = elegiveis.reduce(
      (total, paciente) => total + paciente.pontuacao,
      0
    );
    const pontuacao =
      totalElegiveis > 0
        ? Number((somaPontos / totalElegiveis).toFixed(1))
        : 0;

    const classificacao =
      pontuacao > 75
        ? "Ótimo"
        : pontuacao > 50
          ? "Bom"
          : pontuacao > 25
            ? "Suficiente"
            : "Regular";

    return NextResponse.json({
      sucesso: true,
      possuiDados: true,
      importacao: {
        id: importacao.id,
        arquivoNome: importacao.arquivoNome ?? "Relatório do PEC",
        listaTematica: importacao.listaTematica ?? "",
        grupoCondicoes: importacao.grupoCondicoes ?? "",
        filtroProblemas: importacao.filtroProblemas ?? "",
        geradoEm: importacao.geradoEm ?? "",
        quantidadeRegistros:
          importacao.quantidadeRegistros ?? registrosSnapshot.size,
      },
      referencia: referencia.toISOString(),
      resumo: {
        totalRegistros: pacientes.length,
        totalElegiveis,
        pontuacao,
        classificacao,
        praticas,
      },
      pacientes,
    });
  } catch (error) {
    console.error("Erro ao calcular relatório C4:", error);
    return NextResponse.json(
      { sucesso: false, mensagem: "Não foi possível calcular o C4." },
      { status: 500 }
    );
  }
}
