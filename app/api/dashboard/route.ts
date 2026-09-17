import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { buscarCacheDashboard } from "@/lib/indicadores/cache-dashboard";

export const runtime = "nodejs";

/**
 * Endpoint único do Dashboard.
 *
 * Esta rota não recalcula indicadores e não varre pacientes.
 * Ela lê somente o snapshot consolidado do Dashboard.
 *
 * Enquanto a migração estiver acontecendo, as APIs antigas
 * continuam funcionando separadamente.
 */
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
          mensagem:
            "Somente a enfermeira ativa pode consultar o Dashboard.",
        },
        { status: 403 },
      );
    }

    const cache = await buscarCacheDashboard(usuario.ubsId);

    if (!cache) {
      return NextResponse.json({
        sucesso: true,
        possuiDados: false,
        versaoDados: 0,
        competencia: null,
        atualizadoEm: null,
        dados: {},
        mensagem:
          "Ainda não existe um snapshot consolidado do Dashboard. Ele será criado após o processamento das importações.",
      });
    }

    /**
     * O cache pode estar sendo retornado com Timestamp quando
     * já foi salvo pelo Firestore. Porém, durante a tipagem,
     * atualizadoEm também pode representar FieldValue.
     *
     * Como a função de leitura já transforma somente Timestamp
     * em valor retornável, aqui tratamos o campo de forma segura.
     */
    let atualizadoEm: string | null = null;

    if (
      cache.atualizadoEm &&
      typeof cache.atualizadoEm === "object" &&
      "toDate" in cache.atualizadoEm &&
      typeof cache.atualizadoEm.toDate === "function"
    ) {
      atualizadoEm = cache.atualizadoEm.toDate().toISOString();
    }

    return NextResponse.json({
      sucesso: true,
      possuiDados: true,
      versaoDados: cache.versaoDados,
      competencia: cache.competencia,
      atualizadoEm,
      dados: cache.dados,
    });
  } catch (error) {
    console.error(
      "Erro ao consultar cache consolidado do Dashboard:",
      error,
    );

    return NextResponse.json(
      {
        sucesso: false,
        mensagem: "Não foi possível consultar o Dashboard.",
      },
      { status: 500 },
    );
  }
}