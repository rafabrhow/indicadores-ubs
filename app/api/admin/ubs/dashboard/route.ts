import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import {
  buscarCacheDashboard,
  buscarCacheSituacaoPacientes,
} from "@/lib/indicadores/cache-dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CHAVES_SENSIVEIS = /(^|[\s_])(nome|cpf|cns|cartao sus|prontuario|usuario|uid|email|telefone|celular|endereco|logradouro|nascimento|data nascimento|mae|responsavel|documento|id paciente|paciente id|paciente nome|paciente|pacientes)([\s_]|$)/i;

/** Remove listas e campos identificáveis antes de entregar snapshots à administração. */
function filtrarDadosAgregados(valor: unknown, chaveAtual = ""): unknown {
  if (CHAVES_SENSIVEIS.test(chaveAtual.replace(/[.-]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2"))) return undefined;
  if (Array.isArray(valor)) return undefined;
  if (valor && typeof valor === "object") {
    const resultado: Record<string, unknown> = {};
    for (const [chave, item] of Object.entries(valor as Record<string, unknown>)) {
      const filtrado = filtrarDadosAgregados(item, chave);
      if (filtrado !== undefined) resultado[chave] = filtrado;
    }
    return resultado;
  }
  if (typeof valor === "string" && valor.length > 180) return undefined;
  if (typeof valor === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) return undefined;
  return valor;
}

/**
 * Consulta administrativa dos dados consolidados de uma UBS.
 * A autorização é limitada às unidades do município do administrador.
 * Esta rota lê snapshots existentes e não recalcula indicadores.
 */
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
    const usuarioSnap = await adminDb.collection("usuarios").doc(decoded.uid).get();

    if (!usuarioSnap.exists) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Usuário não encontrado." },
        { status: 403 },
      );
    }

    const usuario = usuarioSnap.data();

    if (
      usuario?.perfil !== "administrador_municipal" ||
      usuario?.ativo !== true ||
      typeof usuario?.municipio !== "string" ||
      typeof usuario?.uf !== "string"
    ) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Acesso restrito ao administrador municipal ativo." },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const ubsId = searchParams.get("ubsId")?.trim();

    if (!ubsId) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Informe a UBS que deseja consultar." },
        { status: 400 },
      );
    }

    const ubsRef = adminDb.collection("ubs").doc(ubsId);
    const ubsSnap = await ubsRef.get();

    if (!ubsSnap.exists) {
      return NextResponse.json(
        { sucesso: false, mensagem: "UBS não encontrada." },
        { status: 404 },
      );
    }

    const ubs = ubsSnap.data();

    // A validação ocorre no servidor; não confiamos na UBS escolhida pelo navegador.
    if (ubs?.municipio !== usuario.municipio || ubs?.uf !== usuario.uf) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Você não tem autorização para consultar esta UBS." },
        { status: 403 },
      );
    }

    if (ubs?.ativo !== true) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Esta UBS está inativa." },
        { status: 403 },
      );
    }

    const [cache, cacheSituacaoPacientes, acsSnapshot] = await Promise.all([
      buscarCacheDashboard(ubsId),
      buscarCacheSituacaoPacientes(ubsId),
      ubsRef.collection("acs").where("ativo", "==", true).get(),
    ]);

    const pacientes = Number(ubs?.totalPacientes ?? 0);
    const acsAtivos = acsSnapshot.size;

    if (!cache) {
      return NextResponse.json({
        sucesso: true,
        possuiDados: false,
        versaoDados: 0,
        competencia: null,
        atualizadoEm: null,
        dados: {},
        acsAtivos,
        pacientes,
        mensagem:
          pacientes > 0
            ? "Esta UBS possui pacientes registrados, mas ainda não tem snapshot consolidado. Os indicadores não serão tratados como desempenho zero."
            : "Esta UBS ainda aguarda a primeira importação do PEC e não possui snapshot consolidado.",
      });
    }

    let atualizadoEm: string | null = null;
    const dataCache = cache.atualizadoEm;

    if (
      dataCache &&
      typeof dataCache === "object" &&
      "toDate" in dataCache &&
      typeof dataCache.toDate === "function"
    ) {
      atualizadoEm = dataCache.toDate().toISOString();
    } else if (typeof dataCache === "string") {
      atualizadoEm = dataCache;
    }

    const situacaoCache = cacheSituacaoPacientes?.dados;
    const situacaoPacientes =
      situacaoCache &&
      typeof situacaoCache === "object" &&
      !Array.isArray(situacaoCache)
        ? {
            totalPacientes: Number(situacaoCache.totalPacientes ?? pacientes),
            semNenhumRegistro: Number(situacaoCache.semNenhumRegistro ?? 0),
            comIndicadoresPendentes: Number(situacaoCache.comIndicadoresPendentes ?? 0),
            comIndicadoresConcluidos: Number(situacaoCache.comIndicadoresConcluidos ?? 0),
            comRegistroSemIndicadorAplicavel: Number(
              situacaoCache.comRegistroSemIndicadorAplicavel ?? 0,
            ),
            indicadoresConcluidosPercentual: Number(
              situacaoCache.indicadoresConcluidosPercentual ?? 0,
            ),
          }
        : null;

    const dadosCompletos = {
      ...cache.dados,
      ...(situacaoPacientes ? { situacaopacientes: situacaoPacientes } : {}),
    };
    const dados = (filtrarDadosAgregados(dadosCompletos) ?? {}) as Record<string, unknown>;

    return NextResponse.json({
      sucesso: true,
      possuiDados: true,
      versaoDados: cache.versaoDados,
      competencia: cache.competencia,
      atualizadoEm,
      dados,
      acsAtivos,
      pacientes,
    });
  } catch (error) {
    console.error("Erro ao consultar dados administrativos da UBS:", error);
    return NextResponse.json(
      { sucesso: false, mensagem: "Não foi possível consultar os dados desta UBS." },
      { status: 500 },
    );
  }
}
