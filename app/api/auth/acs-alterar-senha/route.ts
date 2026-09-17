import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { gerarHashSenha } from "@/lib/seguranca";

export const runtime = "nodejs";

/**
 * Finaliza o primeiro acesso do ACS.
 *
 * A nova senha é armazenada somente como hash no Firestore.
 * O claim primeiroAcesso também é atualizado para impedir que uma
 * sessão antiga volte a acessar a tela de troca de senha.
 */
export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Sessão não encontrada." },
        { status: 401 }
      );
    }

    const token = authorization.slice("Bearer ".length).trim();
    const decoded = await adminAuth.verifyIdToken(token);

    if (decoded.perfil !== "acs") {
      return NextResponse.json(
        { sucesso: false, mensagem: "Acesso permitido somente para ACS." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const novaSenha =
      typeof body.novaSenha === "string" ? body.novaSenha : "";

    if (novaSenha.length < 6) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem: "A nova senha deve ter pelo menos 6 caracteres.",
        },
        { status: 400 }
      );
    }

    const resultado = await adminDb
      .collectionGroup("acs")
      .where("uid", "==", decoded.uid)
      .limit(1)
      .get();

    if (resultado.empty) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Cadastro do ACS não encontrado." },
        { status: 404 }
      );
    }

    const acsRef = resultado.docs[0].ref;
    const acs = resultado.docs[0].data();

    if (acs.ativo !== true) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Seu acesso está desativado." },
        { status: 403 }
      );
    }

    if (acs.primeiroAcesso !== true) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem: "A senha provisória já foi substituída.",
        },
        { status: 409 }
      );
    }

    const senhaHash = await gerarHashSenha(novaSenha);

    await acsRef.update({
      senhaHash,
      primeiroAcesso: false,
      senhaAlteradaEm: new Date(),
    });

    const ubsId =
      typeof acs.ubsId === "string" && acs.ubsId
        ? acs.ubsId
        : acsRef.parent.parent?.id;

    await adminDb.collection("usuarios").doc(decoded.uid).set(
      {
        uid: decoded.uid,
        nome: typeof acs.nome === "string" ? acs.nome : "",
        email: "",
        perfil: "acs",
        ubsId: ubsId || "",
        ativo: true,
        primeiroAcesso: false,
        atualizadoEm: new Date(),
      },
      { merge: true }
    );

    // Atualiza o claim usado pelas páginas para impedir o bypass.
    await adminAuth.setCustomUserClaims(decoded.uid, {
      perfil: "acs",
      ubsId: ubsId || "",
      microareaId:
        typeof acs.microareaId === "string" ? acs.microareaId : "",
      primeiroAcesso: false,
    });

    return NextResponse.json({
      sucesso: true,
      mensagem: "Senha alterada com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao alterar senha do ACS:", error);

    return NextResponse.json(
      {
        sucesso: false,
        mensagem: "Não foi possível alterar a senha.",
      },
      { status: 500 }
    );
  }
}
