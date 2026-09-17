import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import {
  buscarResultadoIndicadorMensal,
  listarCompetenciasIndicador,
} from "@/lib/indicadores/persistencia-indicadores-mensais";

export const runtime = "nodejs";

type ResultadoC1Persistido = {
  codigo?: string;
  competencia?: string;
  periodo?: string | null;
  equipe?: string | null;
  atendimentosProgramados?: number;
  atendimentosEspontaneos?: number;
  atendimentosNaoInformados?: number;
  totalDemandasC1?: number;
  percentualProgramado?: number | null;
  classificacao?: string;
  [chave: string]: unknown;
};

function classificacaoC1(percentual: number | null): string {
  if (percentual === null || !Number.isFinite(percentual)) {
    return "Indisponível";
  }

  if (percentual > 50 && percentual <= 70) return "Ótimo";
  if (percentual > 30 && percentual <= 50) return "Bom";
  if (percentual > 10 && percentual <= 30) return "Suficiente";

  return "Regular";
}

function competenciaAtual(): string {
  const agora = new Date();

  return `${agora.getFullYear()}-${String(
    agora.getMonth() + 1,
  ).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Sessão não autenticada." },
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
        { sucesso: false, mensagem: "Usuário não encontrado." },
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
          mensagem: "Somente a enfermeira ativa pode consultar o C1.",
        },
        { status: 403 },
      );
    }

    const url = new URL(request.url);
    const competenciaInformada = url.searchParams.get("competencia");

    /*
     * Se a competência foi informada explicitamente, consultamos exatamente
     * aquele mês. Sem competência informada, tentamos primeiro o mês atual
     * e, se ainda não houver resultado, usamos a competência mais recente
     * já importada. Isso permite que setembro mostre o resultado de agosto
     * enquanto setembro ainda não possui uma importação.
     */
    let competencia = competenciaInformada || competenciaAtual();

    let resultado = await buscarResultadoIndicadorMensal(
      usuario.ubsId,
      "C1",
      competencia,
    );

    if (!resultado && !competenciaInformada) {
      const competencias = await listarCompetenciasIndicador(
        usuario.ubsId,
        "C1",
      );

      if (competencias.length > 0) {
        competencia = competencias[0];

        resultado = await buscarResultadoIndicadorMensal(
          usuario.ubsId,
          "C1",
          competencia,
        );
      }
    }

    if (!resultado) {
      return NextResponse.json({
        sucesso: true,
        possuiDados: false,
        pontuacao: null,
        percentualProgramado: null,
        classificacao: "Indisponível",
        atendimentosProgramados: 0,
        atendimentosEspontaneos: 0,
        atendimentosNaoInformados: 0,
        totalAtendimentos: 0,
        competencias: [],
        competencia,
        mensagem:
          "Ainda não existe resultado consolidado do C1 para esta competência.",
      });
    }

    const dados = (resultado.dados ?? resultado) as ResultadoC1Persistido;

    const percentual =
      typeof dados.percentualProgramado === "number"
        ? dados.percentualProgramado
        : null;

    const classificacao =
      typeof dados.classificacao === "string"
        ? dados.classificacao
        : classificacaoC1(percentual);

    const atendimentosProgramados = Number(
      dados.atendimentosProgramados ?? 0,
    );

    const atendimentosEspontaneos = Number(
      dados.atendimentosEspontaneos ?? 0,
    );

    return NextResponse.json({
      sucesso: true,
      possuiDados: percentual !== null,
      pontuacao: percentual,
      percentualProgramado: percentual,
      classificacao,
      atendimentosProgramados,
      atendimentosEspontaneos,
      atendimentosNaoInformados: Number(
        dados.atendimentosNaoInformados ?? 0,
      ),
      totalAtendimentos: Number(
        dados.totalDemandasC1 ??
          atendimentosProgramados + atendimentosEspontaneos,
      ),
      competencias: [competencia],
      competencia,
      periodo: dados.periodo ?? null,
      equipe: dados.equipe ?? null,
    });
  } catch (error) {
    console.error("Erro ao consultar resultado consolidado do C1:", error);

    return NextResponse.json(
      {
        sucesso: false,
        mensagem: "Não foi possível consultar o C1.",
      },
      { status: 500 },
    );
  }
}
