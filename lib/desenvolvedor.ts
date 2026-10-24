import "server-only";

import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function exigirDesenvolvedora(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("UNAUTHENTICATED");
  }

  const token = authorization.slice("Bearer ".length).trim();
  const decoded = await adminAuth.verifyIdToken(token);
  const permitidos = (process.env.DESENVOLVEDOR_UIDS ?? "")
    .split(",")
    .map((uid) => uid.trim())
    .filter(Boolean);

  if (!permitidos.includes(decoded.uid)) {
    throw new Error("FORBIDDEN");
  }

  const usuarioSnap = await adminDb.collection("usuarios").doc(decoded.uid).get();
  const usuario = usuarioSnap.data();
  if (!usuarioSnap.exists || usuario?.ativo !== true || usuario?.perfil !== "desenvolvedor") {
    throw new Error("FORBIDDEN");
  }

  return { uid: decoded.uid, nome: String(usuario.nome ?? "Desenvolvedor") };
}

export function respostaErroDesenvolvedora(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return Response.json({ sucesso: false, mensagem: "Faça login para continuar." }, { status: 401 });
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return Response.json({ sucesso: false, mensagem: "Acesso exclusivo da desenvolvedor." }, { status: 403 });
  }
  console.error("Erro no painel da desenvolvedor:", error);
  return Response.json({ sucesso: false, mensagem: "Não foi possível concluir a operação." }, { status: 500 });
}
