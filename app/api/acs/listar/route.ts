import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function dataIso(valor: unknown): string | undefined {
  if (
    typeof valor === "object" &&
    valor !== null &&
    "toDate" in valor &&
    typeof (valor as { toDate?: unknown }).toDate === "function"
  ) {
    const data = (valor as { toDate: () => Date }).toDate();
    return Number.isNaN(data.getTime()) ? undefined : data.toISOString();
  }
  if (typeof valor === "string") {
    const data = new Date(valor);
    return Number.isNaN(data.getTime()) ? undefined : data.toISOString();
  }
  return undefined;
}

/** Retorna somente os campos necessários à tela Equipe; nunca envia senhaHash. */
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
    if (!token) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Sessão não autenticada." },
        { status: 401 },
      );
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const usuarioSnap = await adminDb.collection("usuarios").doc(decoded.uid).get();
    const usuario = usuarioSnap.data();

    if (
      !usuarioSnap.exists ||
      usuario?.perfil !== "enfermeira" ||
      usuario?.ativo !== true ||
      typeof usuario?.ubsId !== "string" ||
      !usuario.ubsId.trim()
    ) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Somente a enfermeira ativa da UBS pode consultar a equipe." },
        { status: 403 },
      );
    }

    const ubsId = usuario.ubsId.trim();
    const acsSnapshot = await adminDb.collection("ubs").doc(ubsId).collection("acs").get();

    const lista = await Promise.all(acsSnapshot.docs.map(async (doc) => {
      const dados = doc.data();
      const microareaId = texto(dados.microareaId);
      let quantidadePacientes = 0;

      if (microareaId) {
        const contagem = await adminDb
          .collection("ubs").doc(ubsId)
          .collection("pacientes")
          .where("microareaId", "==", microareaId)
          .count()
          .get();
        quantidadePacientes = contagem.data().count;
      }

      return {
        id: doc.id,
        uid: texto(dados.uid) || doc.id,
        nome: texto(dados.nome) || "ACS sem nome",
        microareaId,
        ativo: dados.ativo === true,
        // O código é mostrado somente à enfermeira autenticada pela API.
        codigoAcesso: texto(dados.codigoAcesso) || undefined,
        ultimoAcesso: dataIso(dados.ultimoAcesso),
        quantidadePacientes,
      };
    }));

    return NextResponse.json({ sucesso: true, acs: lista }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Erro ao listar equipe ACS:", error);
    return NextResponse.json(
      { sucesso: false, mensagem: "Não foi possível carregar a equipe." },
      { status: 500 },
    );
  }
}
