import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { verificarSenha } from "@/lib/seguranca";
import { verificarLimiteLoginAcs } from "@/lib/seguranca/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const codigoAcesso =
      typeof body.codigoAcesso === "string"
        ? body.codigoAcesso.trim().toUpperCase()
        : "";

    const senha = typeof body.senha === "string" ? body.senha : "";

    if (!codigoAcesso || !senha) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Informe o código de acesso e a senha." },
        { status: 400 }
      );
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip")?.trim() ||
      "";

    const limiteLogin = await verificarLimiteLoginAcs(ip);

    if (!limiteLogin.permitido) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem:
            "Muitas tentativas de login. Aguarde alguns minutos e tente novamente.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(limiteLogin.retryAfterSeconds),
          },
        }
      );
    }

    const resultado = await adminDb
      .collectionGroup("acs")
      .where("codigoAcesso", "==", codigoAcesso)
      .limit(2)
      .get();

    if (resultado.empty) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Código de acesso ou senha incorretos." },
        { status: 401 }
      );
    }

    if (resultado.size > 1) {
      console.error("Código de acesso duplicado cadastrado para ACS.");
      return NextResponse.json(
        { sucesso: false, mensagem: "Não foi possível validar o cadastro. Procure a administração." },
        { status: 409 }
      );
    }

    const acsDoc = resultado.docs[0];
    const acs = acsDoc.data();

    if (acs.perfil !== "acs" || acs.ativo !== true || !acs.uid) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Acesso do ACS inválido ou desativado." },
        { status: 403 }
      );
    }

    const senhaValida = await verificarSenha(
      senha,
      typeof acs.senhaHash === "string" ? acs.senhaHash : ""
    );

    if (!senhaValida) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Código de acesso ou senha incorretos." },
        { status: 401 }
      );
    }

    const ubsId =
      typeof acs.ubsId === "string" && acs.ubsId
        ? acs.ubsId
        : acsDoc.ref.parent.parent?.id;

    if (!ubsId) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Não foi possível identificar a UBS do ACS." },
        { status: 500 }
      );
    }

    const usuarioAuth = await adminAuth.getUser(acs.uid);

    if (usuarioAuth.disabled) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Seu acesso está desativado." },
        { status: 403 }
      );
    }

    // Não permita que o login reative uma conta desativada pela administração.
    // Um documento ausente pode ser inicializado para cadastros legados, mas
    // um documento existente precisa estar ativo e vinculado à mesma UBS.
    const usuarioRef = adminDb.collection("usuarios").doc(acs.uid);
    const usuarioSnap = await usuarioRef.get();
    const usuarioExistente = usuarioSnap.data();
    if (
      !usuarioSnap.exists ||
      usuarioExistente?.ativo !== true ||
      usuarioExistente?.perfil !== "acs" ||
      usuarioExistente?.ubsId !== ubsId
    ) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Seu acesso está desativado ou precisa ser validado pela administração." },
        { status: 403 }
      );
    }

    const primeiroAcesso = acs.primeiroAcesso === true;

    // Registra o último acesso real do ACS no próprio cadastro da equipe.
    // Assim, a tela Equipe consegue mostrar a última entrada sem depender
    // de dados temporários do navegador.
    await acsDoc.ref.update({
      ultimoAcesso: FieldValue.serverTimestamp(),
    });

    await usuarioRef.set(
      {
        uid: acs.uid,
        nome: acs.nome,
        email: "",
        perfil: "acs",
        ubsId,
        primeiroAcesso,
        atualizadoEm: new Date(),
      },
      { merge: true }
    );

    // Mantém o primeiro acesso no token para impedir que o ACS pule a troca de senha.
    await adminAuth.setCustomUserClaims(acs.uid, {
      perfil: "acs",
      ubsId,
      microareaId: acs.microareaId,
      primeiroAcesso,
    });

    const customToken = await adminAuth.createCustomToken(acs.uid, {
      perfil: "acs",
      ubsId,
      microareaId: acs.microareaId,
      primeiroAcesso,
    });

    return NextResponse.json({
      sucesso: true,
      customToken,
      primeiroAcesso,
      acs: {
        uid: acs.uid,
        nome: acs.nome,
        microareaId: acs.microareaId,
      },
    });
  } catch (error) {
    console.error("Erro no login do ACS:", error);

    return NextResponse.json(
      { sucesso: false, mensagem: "Não foi possível realizar o login." },
      { status: 500 }
    );
  }
}
