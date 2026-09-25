import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { avaliarC7 } from "@/lib/indicadores/c7-mulher";

function dataMillis(valor: unknown): number {
  if (valor instanceof Date) return valor.getTime();
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;

  if (valor && typeof valor === "object") {
    const objeto = valor as {
      toMillis?: unknown;
      seconds?: unknown;
      _seconds?: unknown;
    };

    if (typeof objeto.toMillis === "function") {
      return objeto.toMillis();
    }

    if (typeof objeto.seconds === "number") {
      return objeto.seconds * 1000;
    }

    if (typeof objeto._seconds === "number") {
      return objeto._seconds * 1000;
    }
  }

  return 0;
}

function normalizar(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function juntarRegistro(
  registro: Record<string, unknown>,
): Record<string, unknown> {
  const dadosBase =
    registro.dadosBase && typeof registro.dadosBase === "object"
      ? (registro.dadosBase as Record<string, unknown>)
      : {};

  const dadosEspecificos =
    registro.dadosEspecificos &&
    typeof registro.dadosEspecificos === "object"
      ? (registro.dadosEspecificos as Record<string, unknown>)
      : {};

  return {
    ...dadosBase,
    ...dadosEspecificos,
    ...registro,
  };
}

function possuiValor(valor: unknown): boolean {
  return (
    valor !== undefined &&
    valor !== null &&
    String(valor).trim() !== ""
  );
}

/**
 * Une registros do mesmo paciente provenientes de relatórios diferentes.
 *
 * A ordem dos registros é do mais recente para o mais antigo.
 * Assim, para cada campo, preservamos o primeiro valor preenchido
 * encontrado (normalmente o dado mais recente), mas mantemos campos
 * complementares que só existam em outro relatório.
 */
function consolidarRegistros(
  registros: Array<{
    id: string;
    criadoEm: number;
    dados: Record<string, unknown>;
  }>,
): Record<string, unknown>[] {
  const grupos = new Map<string, Record<string, unknown>>();

  for (const item of registros) {
    const registro: Record<string, unknown> = {
  ...item.dados,
  id: item.id,
};

    const cpf = normalizar(
      registro.CPF ?? registro.cpf ?? "",
    );
    const cns = normalizar(
      registro.CNS ?? registro.cns ?? "",
    );
    const nome = normalizar(
      registro.Nome ?? registro.nome ?? "",
    );
    const nascimento = normalizar(
      registro["Data de nascimento"] ??
        registro.dataNascimento ??
        "",
    );

    const chave =
      item.id ||
      (cpf ? `cpf:${cpf}` : "") ||
      (cns ? `cns:${cns}` : "") ||
      (nome && nascimento
        ? `nome:${nome}|nasc:${nascimento}`
        : `registro:${nome}`);

    const existente = grupos.get(chave);

    if (!existente) {
      grupos.set(chave, { ...registro });
      continue;
    }

    for (const [campo, valor] of Object.entries(registro)) {
      if (!possuiValor(existente[campo]) && possuiValor(valor)) {
        existente[campo] = valor;
      }
    }
  }

  return Array.from(grupos.values());
}

export async function GET(request: NextRequest) {
  try {
    const autorizacao = request.headers.get("authorization");

    if (!autorizacao?.startsWith("Bearer ")) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Não autenticado." },
        { status: 401 },
      );
    }

    const token = autorizacao.substring("Bearer ".length);
    const decoded = await adminAuth.verifyIdToken(token);

    const usuarioSnap = await adminDb
      .collection("usuarios")
      .doc(decoded.uid)
      .get();

    if (!usuarioSnap.exists) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Usuário não encontrado." },
        { status: 403 },
      );
    }

    const usuario = usuarioSnap.data();

    if (usuario?.ativo !== true || usuario?.perfil !== "enfermeira") {
      return NextResponse.json(
        { sucesso: false, mensagem: "Acesso não autorizado." },
        { status: 403 },
      );
    }

    const ubsId = usuario.ubsId;

    if (!ubsId) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Usuário sem UBS vinculada." },
        { status: 403 },
      );
    }

    const ubsRef = adminDb.collection("ubs").doc(ubsId);

    /*
     * O C7 não pode depender apenas da importação "Saúde da mulher".
     *
     * A Nota Metodológica do C7 usa como denominador da prática B
     * as meninas de 9–14 anos vinculadas à equipe. No PEC, essa
     * população pode aparecer em relatórios de Acompanhamento de
     * Condições de Saúde com lista temática "Geral".
     *
     * Por isso, aqui reunimos os registros das importações PEC
     * disponíveis e consolidamos por paciente antes de calcular o C7.
     */
    const importacoesSnap = await ubsRef
      .collection("importacoesPEC")
      .orderBy("criadoEm", "desc")
      .limit(50)
      .get();

    if (importacoesSnap.empty) {
      return NextResponse.json({
        sucesso: true,
        possuiDados: false,
        mensagem: "Importe dados do e-SUS PEC para calcular o C7.",
      });
    }

    const registrosConsolidaveis: Array<{
      id: string;
      criadoEm: number;
      dados: Record<string, unknown>;
    }> = [];

    let referenciaMillis = 0;

    for (const importacao of importacoesSnap.docs) {
      const importacaoDados = importacao.data();
      const criadoEm = dataMillis(importacaoDados.criadoEm);

      if (criadoEm > referenciaMillis) {
        referenciaMillis = criadoEm;
      }

      const registrosSnap = await importacao.ref
        .collection("registros")
        .get();

      for (const registroDoc of registrosSnap.docs) {
        registrosConsolidaveis.push({
          id: registroDoc.id,
          criadoEm,
          dados: juntarRegistro(registroDoc.data()),
        });
      }
    }

    if (registrosConsolidaveis.length === 0) {
      return NextResponse.json({
        sucesso: true,
        possuiDados: false,
        mensagem: "As importações encontradas não possuem registros.",
      });
    }

    /*
     * As importações vieram ordenadas da mais recente para a mais antiga.
     * A consolidação preserva os dados preenchidos do relatório mais recente
     * e complementa com campos existentes em relatórios anteriores.
     */
    const registros = consolidarRegistros(registrosConsolidaveis);

    const referencia =
      referenciaMillis > 0
        ? new Date(referenciaMillis)
        : new Date();

    const resultado = avaliarC7(registros, referencia);

    /*
     * Mantemos a resposta compatível com a página atual do C7.
     * Nenhuma alteração na interface é necessária nesta etapa.
     */
    return NextResponse.json({
      ...resultado,
      possuiDados: true,
      importacao: {
        id: importacoesSnap.docs[0].id,
        criadoEm:
          importacoesSnap.docs[0].data().criadoEm ?? null,
        geradoEm:
          importacoesSnap.docs[0].data().geradoEm ?? null,
        quantidadeImportacoesConsideradas:
          importacoesSnap.docs.length,
        quantidadeRegistrosConsolidados:
          registros.length,
      },
    });
  } catch (error) {
    console.error("Erro ao calcular C7:", error);

    return NextResponse.json(
      {
        sucesso: false,
        mensagem: "Não foi possível calcular o C7.",
      },
      { status: 500 },
    );
  }
}
