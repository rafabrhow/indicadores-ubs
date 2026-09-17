import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import {
  gerarCodigoAcesso,
  gerarSenhaProvisoria,
  gerarHashSenha,
} from "@/lib/seguranca";

async function gerarCodigoUnico(ubsId: string): Promise<string> {
  for (let tentativa = 0; tentativa < 10; tentativa++) {
    const codigo = gerarCodigoAcesso();

    const existente = await adminDb
      .collection("ubs")
      .doc(ubsId)
      .collection("acs")
      .where("codigoAcesso", "==", codigo)
      .limit(1)
      .get();

    if (existente.empty) {
      return codigo;
    }
  }

  throw new Error("Não foi possível gerar um código de acesso único.");
}

export async function POST(request: Request) {
  let uidCriado: string | null = null;

  try {
    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    if (!token) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Sessão não encontrada." },
        { status: 401 }
      );
    }

    const usuarioAuth = await adminAuth.verifyIdToken(token);

    const usuarioSnapshot = await adminDb
      .collection("usuarios")
      .doc(usuarioAuth.uid)
      .get();

    if (!usuarioSnapshot.exists) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem: "Usuário do sistema não encontrado.",
        },
        { status: 403 }
      );
    }

    const usuario = usuarioSnapshot.data();

    if (
      usuario?.perfil !== "enfermeira" ||
      usuario?.ativo !== true ||
      !usuario?.ubsId
    ) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem: "Você não possui permissão para cadastrar ACS.",
        },
        { status: 403 }
      );
    }

    const ubsId = usuario.ubsId;
    const body = await request.json();

    const nome =
      typeof body.nome === "string" ? body.nome.trim() : "";

    const microareaId =
      typeof body.microareaId === "string"
        ? body.microareaId.trim()
        : "";

    if (!nome) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Informe o nome do ACS." },
        { status: 400 }
      );
    }

    if (!microareaId) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem: "Informe o código da microárea.",
        },
        { status: 400 }
      );
    }

    const ubsRef = adminDb.collection("ubs").doc(ubsId);
    const ubsSnapshot = await ubsRef.get();

    if (!ubsSnapshot.exists) {
      return NextResponse.json(
        { sucesso: false, mensagem: "UBS não encontrada." },
        { status: 404 }
      );
    }

    const codigoAcesso = await gerarCodigoUnico(ubsId);
    const senhaProvisoria = gerarSenhaProvisoria();
    const senhaHash = await gerarHashSenha(senhaProvisoria);

    const novoUsuario = await adminAuth.createUser({
      displayName: nome,
      disabled: false,
    });

    uidCriado = novoUsuario.uid;

    await adminAuth.setCustomUserClaims(novoUsuario.uid, {
      perfil: "acs",
      ubsId,
      microareaId,
    });

    await ubsRef.collection("acs").doc(novoUsuario.uid).set({
      uid: novoUsuario.uid,
      nome,
      microareaId,
      ubsId,
      perfil: "acs",
      ativo: true,
      primeiroAcesso: true,
      codigoAcesso,
      senhaHash,
      criadoEm: FieldValue.serverTimestamp(),
      criadoPor: usuarioAuth.uid,
    });

    // Documento compatível com o AuthContext atual.
    await adminDb.collection("usuarios").doc(novoUsuario.uid).set({
      uid: novoUsuario.uid,
      nome,
      email: "",
      perfil: "acs",
      ubsId,
      ativo: true,
      criadoEm: FieldValue.serverTimestamp(),
      criadoPor: usuarioAuth.uid,
    });

    return NextResponse.json({
      sucesso: true,
      mensagem: "ACS cadastrado com sucesso.",
      acs: {
        uid: novoUsuario.uid,
        nome,
        microareaId,
        codigoAcesso,
        senhaProvisoria,
      },
    });
  } catch (error) {
    console.error("Erro ao cadastrar ACS:", error);

    // Evita deixar um usuário órfão no Firebase Auth se o Firestore falhar.
    if (uidCriado) {
      try {
        await adminAuth.deleteUser(uidCriado);
      } catch (cleanupError) {
        console.error(
          "Erro ao desfazer usuário do Firebase Auth:",
          cleanupError
        );
      }
    }

    return NextResponse.json(
      {
        sucesso: false,
        mensagem: "Não foi possível cadastrar o ACS.",
      },
      { status: 500 }
    );
  }
}
