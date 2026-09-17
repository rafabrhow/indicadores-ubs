import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import {
  buscarResultadoIndicadorMensal,
  listarCompetenciasIndicador,
} from "@/lib/indicadores/persistencia-indicadores-mensais";

export const runtime = "nodejs";

type DadosC2Persistidos = {
  totalRegistros?: number;
  totalElegiveis?: number;
  totalForaDoC2?: number;
  pontuacao?: number;
  classificacao?: string;
  praticas?: Record<
    string,
    {
      atingidos?: number;
      percentual?: number;
    }
  >;
  importacao?: Record<string, unknown>;
  pacientes?: unknown[];
};

function competenciaAtual(): string {
  const agora = new Date();

  return `${agora.getFullYear()}-${String(
    agora.getMonth() + 1,
  ).padStart(2, "0")}`;
}

function competenciaValida(valor: string | null): boolean {
  return !!valor && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor);
}

function numero(valor: unknown, padrao = 0): number {
  return typeof valor === "number" && Number.isFinite(valor)
    ? valor
    : padrao;
}

function praticasC2(dados: DadosC2Persistidos) {
  const resultado: Record<
    string,
    { atingidos: number; percentual: number }
  > = {};

  for (const codigo of ["A", "B", "C", "D", "E"]) {
    const pratica = dados.praticas?.[codigo];

    resultado[codigo] = {
      atingidos: numero(pratica?.atingidos),
      percentual: numero(pratica?.percentual),
    };
  }

  return resultado;
}

export async function GET(request: Request) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem: "Sessão não autenticada.",
        },
        { status: 401 },
      );
    }

    const token = authorization.slice("Bearer ".length).trim();
    const decoded = await adminAuth.verifyIdToken(token);

    const usuarioSnap = await adminDb
      .collection("usuarios")
      .doc(decoded.uid)
      .get();

    if (!usuarioSnap.exists) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem: "Usuário não encontrado.",
        },
        { status: 403 },
      );
    }

    const usuario = usuarioSnap.data();

    if (
      usuario?.perfil !== "enfermeira" ||
      usuario?.ativo !== true ||
      typeof usuario?.ubsId !== "string"
    ) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem: "Somente a enfermeira ativa pode consultar o C2.",
        },
        { status: 403 },
      );
    }

    const url = new URL(request.url);
    const competenciaInformada = url.searchParams.get("competencia");

    /*
     * Primeiro tentamos a competência solicitada.
     * Sem competência explícita, se o mês atual ainda não possuir resultado,
     * usamos o resultado mais recente já importado.
     *
     * Assim o Dashboard não fica vazio no início de um novo mês.
     */
    let competencia = competenciaValida(competenciaInformada)
      ? competenciaInformada!
      : competenciaAtual();

    let resultado = await buscarResultadoIndicadorMensal(
      usuario.ubsId,
      "C2",
      competencia,
    );

    if (!resultado && !competenciaInformada) {
      const competencias = await listarCompetenciasIndicador(
        usuario.ubsId,
        "C2",
      );

      if (competencias.length > 0) {
        competencia = competencias[0];

        resultado = await buscarResultadoIndicadorMensal(
          usuario.ubsId,
          "C2",
          competencia,
        );
      }
    }

    if (!resultado) {
      return NextResponse.json({
        sucesso: true,
        possuiDados: false,
        competencia,
        mensagem:
          "Ainda não existe resultado mensal do C2 para esta competência.",
        resumo: {
          totalRegistros: 0,
          totalElegiveis: 0,
          totalForaDoC2: 0,
          pontuacao: 0,
          classificacao: "Regular",
          praticas: praticasC2({}),
        },
        pacientes: [],
      });
    }

    /*
     * O importador salva o resumo diretamente dentro de dados:
     * pontuacao, classificacao, totalElegiveis, praticas etc.
     *
     * Não usamos dados.resumo porque essa propriedade não faz parte
     * da estrutura persistida atual.
     */
    const dados = (resultado.dados ?? {}) as DadosC2Persistidos;

    const resumo = {
      totalRegistros: numero(dados.totalRegistros),
      totalElegiveis: numero(dados.totalElegiveis),
      totalForaDoC2: numero(dados.totalForaDoC2),
      pontuacao: numero(dados.pontuacao),
      classificacao:
        typeof dados.classificacao === "string"
          ? dados.classificacao
          : "Regular",
      praticas: praticasC2(dados),
    };

    return NextResponse.json({
      sucesso: true,
      possuiDados: true,
      competencia:
        typeof resultado.competencia === "string"
          ? resultado.competencia
          : competencia,
      importacao:
        dados.importacao &&
        typeof dados.importacao === "object" &&
        !Array.isArray(dados.importacao)
          ? dados.importacao
          : null,
      resumo,
      pacientes: Array.isArray(dados.pacientes) ? dados.pacientes : [],
    });
  } catch (error) {
    console.error("Erro ao consultar C2 persistido:", error);

    return NextResponse.json(
      {
        sucesso: false,
        mensagem: "Não foi possível consultar o C2.",
      },
      { status: 500 },
    );
  }
}
