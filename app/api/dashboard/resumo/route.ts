import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

/**
 * Retorna os números dos cards principais do Dashboard.
 *
 * Pacientes:
 * - Usa o contador persistido em ubs/{ubsId}.totalPacientes.
 * - Não consulta mais a coleção completa de pacientes.
 *
 * ACS:
 * - Continua sendo consultado diretamente, pois a coleção é pequena.
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
        { status: 401 }
      );
    }

    const token = authorization
      .slice("Bearer ".length)
      .trim();

    const decoded = await adminAuth.verifyIdToken(token);

    const usuarioSnap = await adminDb
      .collection("usuarios")
      .doc(decoded.uid)
      .get();

    const usuario = usuarioSnap.data();

    if (
      !usuarioSnap.exists ||
      usuario?.ativo !== true ||
      typeof usuario?.ubsId !== "string"
    ) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem: "Acesso não autorizado.",
        },
        { status: 403 }
      );
    }

    const ubsRef = adminDb
      .collection("ubs")
      .doc(usuario.ubsId);

    // A UBS é uma leitura simples e já contém o contador
    // persistido de pacientes.
    const ubsSnap = await ubsRef.get();

    if (!ubsSnap.exists) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem: "UBS não encontrada.",
        },
        { status: 404 }
      );
    }

    const ubs = ubsSnap.data();

    // O total foi inicializado pela migração e, a partir de agora,
    // é incrementado automaticamente durante a importação PEC.
    const pacientes = Number(ubs?.totalPacientes ?? 0);

    // ACS continua sendo consultado diretamente.
    const acsSnapshot = await ubsRef
      .collection("acs")
      .get();

    const acsAtivos = acsSnapshot.docs.filter(
      (doc) => {
        const dados = doc.data();

        return dados.ativo === true;
      }
    ).length;

    return NextResponse.json({
      sucesso: true,
      acsAtivos,
      pacientes,
    });
  } catch (error) {
    console.error(
      "Erro ao carregar resumo do dashboard:",
      error
    );

    return NextResponse.json(
      {
        sucesso: false,
        mensagem:
          "Não foi possível carregar o resumo do Dashboard.",
      },
      { status: 500 }
    );
  }
}