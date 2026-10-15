import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function normalizarMunicipio(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
}

export async function POST(request: Request) {
  let uidCriado: string | null = null;

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

    const administradorSnap = await adminDb
      .collection("usuarios")
      .doc(decoded.uid)
      .get();

    if (!administradorSnap.exists) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Usuário não encontrado." },
        { status: 403 },
      );
    }

    const administrador = administradorSnap.data();
    const municipioAdmin = texto(administrador?.municipio);
    const ufAdmin = texto(administrador?.uf).toUpperCase();

    if (
      administrador?.perfil !== "administrador_municipal" ||
      administrador?.ativo !== true ||
      !municipioAdmin ||
      !/^[A-Z]{2}$/.test(ufAdmin)
    ) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Somente administradores municipais ativos podem cadastrar enfermeiras." },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => null);
    const nome = texto(body?.nome);
    const email = texto(body?.email).toLowerCase();
    const ubsId = texto(body?.ubsId);

    if (!nome || nome.length > 160) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Informe o nome completo (até 160 caracteres)." },
        { status: 400 },
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Informe um e-mail válido." },
        { status: 400 },
      );
    }

    if (!ubsId) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Selecione a UBS da enfermeira." },
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
    if (
      ubs?.ativo !== true ||
      normalizarMunicipio(texto(ubs?.municipio)) !== normalizarMunicipio(municipioAdmin) ||
      texto(ubs?.uf).toUpperCase() !== ufAdmin
    ) {
      return NextResponse.json(
        { sucesso: false, mensagem: "A UBS selecionada não pertence ao município autorizado para este administrador." },
        { status: 403 },
      );
    }

    // Não definimos senha. A enfermeira poderá usar "Esqueci minha senha"
    // na tela de login para receber do Firebase o link de definição/recuperação.
    const novoUsuario = await adminAuth.createUser({
      email,
      displayName: nome,
      emailVerified: false,
      disabled: false,
    });
    uidCriado = novoUsuario.uid;

    await adminDb.collection("usuarios").doc(novoUsuario.uid).create({
      uid: novoUsuario.uid,
      nome,
      email,
      perfil: "enfermeira",
      ubsId,
      ativo: true,
      criadoEm: FieldValue.serverTimestamp(),
      criadoPor: decoded.uid,
      primeiroAcesso: true,
    });

    return NextResponse.json(
      {
        sucesso: true,
        mensagem: "Enfermeira cadastrada com sucesso.",
        enfermeira: {
          uid: novoUsuario.uid,
          nome,
          email,
          ubsId,
          ubsNome: texto(ubs?.nome),
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error("Erro ao cadastrar enfermeira:", error);

    if (uidCriado) {
      try {
        await adminDb.collection("usuarios").doc(uidCriado).delete();
      } catch (cleanupError) {
        console.error("Erro ao remover documento parcial da enfermeira:", cleanupError);
      }
      try {
        await adminAuth.deleteUser(uidCriado);
      } catch (cleanupError) {
        console.error("Erro ao remover conta parcial do Authentication:", cleanupError);
      }
    }

    const code = typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";

    if (code === "auth/email-already-exists") {
      return NextResponse.json(
        { sucesso: false, mensagem: "Já existe uma conta no Firebase Authentication com esse e-mail." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { sucesso: false, mensagem: "Não foi possível cadastrar a enfermeira. Verifique os dados e tente novamente." },
      { status: 500 },
    );
  }
}
