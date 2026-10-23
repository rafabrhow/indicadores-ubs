import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

/**
 * Inativa um ACS sem excluir o cadastro, a microárea, pacientes ou visitas.
 * A microárea permanece disponível para um futuro responsável.
 */
export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : "";

    if (!token) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Sessão não encontrada." },
        { status: 401 }
      );
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const usuarioRef = adminDb.collection("usuarios").doc(decoded.uid);
    const usuarioSnap = await usuarioRef.get();
    const usuario = usuarioSnap.data();

    if (
      !usuarioSnap.exists ||
      usuario?.perfil !== "enfermeira" ||
      usuario?.ativo !== true ||
      typeof usuario?.ubsId !== "string" ||
      !usuario.ubsId
    ) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Você não possui permissão para inativar ACS." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const uid = typeof body.uid === "string" ? body.uid.trim() : "";

    if (!uid || uid === decoded.uid) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Informe um ACS válido para inativar." },
        { status: 400 }
      );
    }

    const acsRef = adminDb
      .collection("ubs")
      .doc(usuario.ubsId)
      .collection("acs")
      .doc(uid);
    const acsSnap = await acsRef.get();

    if (!acsSnap.exists) {
      return NextResponse.json(
        { sucesso: false, mensagem: "ACS não encontrado na sua UBS." },
        { status: 404 }
      );
    }

    const acs = acsSnap.data();
    if (acs?.uid !== uid || acs?.perfil !== "acs") {
      return NextResponse.json(
        { sucesso: false, mensagem: "Cadastro do ACS inválido." },
        { status: 409 }
      );
    }

    if (acs.ativo !== true) {
      return NextResponse.json({
        sucesso: true,
        mensagem: "Este ACS já está inativo.",
        uid,
        microareaId: typeof acs.microareaId === "string" ? acs.microareaId : "",
      });
    }

    const alvoUsuarioRef = adminDb.collection("usuarios").doc(uid);
    const alvoUsuarioSnap = await alvoUsuarioRef.get();
    const alvoUsuario = alvoUsuarioSnap.data();

    if (
      alvoUsuarioSnap.exists &&
      (alvoUsuario?.perfil !== "acs" || alvoUsuario?.ubsId !== usuario.ubsId)
    ) {
      return NextResponse.json(
        { sucesso: false, mensagem: "O cadastro de acesso não corresponde à UBS deste ACS." },
        { status: 409 }
      );
    }

    // Primeiro bloqueia no Firestore: login e rotas operacionais verificam
    // o estado ativo nesses documentos. Os dados históricos não são excluídos.
    const batch = adminDb.batch();
    batch.update(acsRef, {
      ativo: false,
      inativadoEm: FieldValue.serverTimestamp(),
      inativadoPor: decoded.uid,
    });

    if (alvoUsuarioSnap.exists) {
      batch.set(alvoUsuarioRef, {
        ativo: false,
        inativadoEm: FieldValue.serverTimestamp(),
        inativadoPor: decoded.uid,
      }, { merge: true });
    }

    await batch.commit();

    // Bloqueia também o Firebase Authentication e revoga refresh tokens.
    // Se essa etapa falhar, o estado inativo no Firestore continua bloqueando
    // o login pela rota da aplicação; o erro fica registrado para correção.
    try {
      await adminAuth.updateUser(uid, { disabled: true });
      await adminAuth.revokeRefreshTokens(uid);
    } catch (authError) {
      console.error("ACS inativado no Firestore, mas falhou o bloqueio/revogação no Firebase Auth:", authError);
    }

    return NextResponse.json({
      sucesso: true,
      mensagem: "ACS inativado. A microárea, os pacientes, os indicadores e o histórico foram preservados.",
      uid,
      microareaId: typeof acs.microareaId === "string" ? acs.microareaId : "",
    });
  } catch (error) {
    console.error("Erro ao inativar ACS:", error);
    return NextResponse.json(
      { sucesso: false, mensagem: "Não foi possível inativar o ACS." },
      { status: 500 }
    );
  }
}
