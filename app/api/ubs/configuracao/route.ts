import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

export async function PUT(request: Request) {
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

    const usuarioSnap = await adminDb
      .collection("usuarios")
      .doc(decoded.uid)
      .get();

    if (!usuarioSnap.exists) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Usuário não encontrado." },
        { status: 403 },
      );
    }

    const usuario = usuarioSnap.data();

    if (
      usuario?.perfil !== "enfermeira" ||
      usuario?.ativo !== true ||
      typeof usuario?.ubsId !== "string" ||
      !usuario.ubsId.trim()
    ) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem:
            "Somente a enfermeira gestora ativa pode alterar as informações da UBS.",
        },
        { status: 403 },
      );
    }

    const corpo = await request.json();

    const nome = texto(corpo?.nome);
    const municipio = texto(corpo?.municipio);
    const uf = texto(corpo?.uf).toUpperCase();

    if (!nome || !municipio || !uf) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem: "Nome da UBS, município e UF são obrigatórios.",
        },
        { status: 400 },
      );
    }

    if (uf.length !== 2) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem: "A UF deve conter exatamente 2 letras.",
        },
        { status: 400 },
      );
    }

    if (!/^[A-Z]{2}$/.test(uf)) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem: "A UF deve conter apenas letras.",
        },
        { status: 400 },
      );
    }

    const ubsRef = adminDb.collection("ubs").doc(usuario.ubsId);
    const ubsSnap = await ubsRef.get();

    if (!ubsSnap.exists) {
      return NextResponse.json(
        { sucesso: false, mensagem: "UBS não encontrada." },
        { status: 404 },
      );
    }

    await ubsRef.update({
      nome,
      municipio,
      uf,
      atualizadoEm: FieldValue.serverTimestamp(),
      atualizadoPor: decoded.uid,
    });

    return NextResponse.json({
      sucesso: true,
      mensagem: "Informações da UBS atualizadas com sucesso.",
      ubs: {
        id: usuario.ubsId,
        nome,
        municipio,
        uf,
      },
    });
  } catch (error) {
    console.error("Erro ao atualizar configuração da UBS:", error);

    return NextResponse.json(
      {
        sucesso: false,
        mensagem: "Não foi possível atualizar as informações da UBS.",
      },
      { status: 500 },
    );
  }
}
