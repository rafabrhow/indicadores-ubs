import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

function texto(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ uid: string; pacienteId: string }> }
) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json({ sucesso: false, mensagem: "Sessão não autenticada." }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(authorization.slice(7).trim());
    const { uid, pacienteId } = await context.params;
    const body = await request.json().catch(() => ({}));

    const usuarioSnap = await adminDb.collection("usuarios").doc(decoded.uid).get();
    const usuario = usuarioSnap.data();

    if (
      !usuarioSnap.exists ||
      usuario?.ativo !== true ||
      usuario?.perfil !== "acs" ||
      decoded.uid !== uid
    ) {
      return NextResponse.json({ sucesso: false, mensagem: "Acesso não autorizado." }, { status: 403 });
    }

    const ubsId = texto(usuario.ubsId);
    const ubsRef = adminDb.collection("ubs").doc(ubsId);
    const acsSnap = await ubsRef.collection("acs").doc(uid).get();
    const acs = acsSnap.data();

    if (!acsSnap.exists || acs?.ativo !== true) {
      return NextResponse.json({ sucesso: false, mensagem: "ACS inativo ou não encontrado." }, { status: 403 });
    }

    const pacienteRef = ubsRef.collection("pacientes").doc(pacienteId);
    const pacienteSnap = await pacienteRef.get();

    if (
      !pacienteSnap.exists ||
      texto(pacienteSnap.data()?.microareaId) !== texto(acs.microareaId)
    ) {
      return NextResponse.json({ sucesso: false, mensagem: "Paciente fora da microárea autorizada." }, { status: 403 });
    }

    const observacao = texto(body.observacao);

    if (!observacao) {
      return NextResponse.json({ sucesso: false, mensagem: "Informe uma observação da visita." }, { status: 400 });
    }

    await pacienteRef.collection("acompanhamentos").add({
      tipo: "visita_domiciliar",
      data: FieldValue.serverTimestamp(),
      observacao,
      acsUid: uid,
      acsNome: texto(acs.nome),
      microareaId: texto(acs.microareaId),
      criadoEm: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      sucesso: true,
      mensagem: "Visita domiciliar registrada com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao registrar visita:", error);

    return NextResponse.json(
      {
        sucesso: false,
        mensagem:
          error instanceof Error
            ? `Erro ao registrar visita: ${error.message}`
            : "Não foi possível registrar a visita.",
      },
      { status: 500 }
    );
  }
}
