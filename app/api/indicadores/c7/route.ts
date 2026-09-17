import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { avaliarC7 } from "@/lib/indicadores/c7-mulher";

function dataMillis(valor: unknown): number {
  if (valor instanceof Date) return valor.getTime();
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;

  if (valor && typeof valor === "object") {
    const objeto = valor as {
      toMillis?: unknown;
      seconds?: unknown;
      _seconds?: unknown;
    };

    if (typeof objeto.toMillis === "function") {
      return objeto.toMillis();
    }

    if (typeof objeto.seconds === "number") {
      return objeto.seconds * 1000;
    }

    if (typeof objeto._seconds === "number") {
      return objeto._seconds * 1000;
    }
  }

  return 0;
}

function juntarRegistro(
  registro: Record<string, unknown>
): Record<string, unknown> {
  const dadosBase =
    registro.dadosBase && typeof registro.dadosBase === "object"
      ? (registro.dadosBase as Record<string, unknown>)
      : {};

  const dadosEspecificos =
    registro.dadosEspecificos && typeof registro.dadosEspecificos === "object"
      ? (registro.dadosEspecificos as Record<string, unknown>)
      : {};

  return {
    ...dadosBase,
    ...dadosEspecificos,
    ...registro,
  };
}

export async function GET(request: NextRequest) {
  try {
    const autorizacao = request.headers.get("authorization");

    if (!autorizacao?.startsWith("Bearer ")) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Não autenticado." },
        { status: 401 }
      );
    }

    const token = autorizacao.substring("Bearer ".length);
    const decoded = await adminAuth.verifyIdToken(token);

    const usuarioSnap = await adminDb
      .collection("usuarios")
      .doc(decoded.uid)
      .get();

    if (!usuarioSnap.exists) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Usuário não encontrado." },
        { status: 403 }
      );
    }

    const usuario = usuarioSnap.data();

    if (usuario?.ativo !== true || usuario?.perfil !== "enfermeira") {
      return NextResponse.json(
        { sucesso: false, mensagem: "Acesso não autorizado." },
        { status: 403 }
      );
    }

    const ubsId = usuario.ubsId;

    if (!ubsId) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Usuário sem UBS vinculada." },
        { status: 403 }
      );
    }

    const importacoesSnap = await adminDb
      .collection("ubs")
      .doc(ubsId)
      .collection("importacoesPEC")
      .orderBy("criadoEm", "desc")
      .limit(50)
      .get();

    const importacao = importacoesSnap.docs.find((doc) => {
      const dados = doc.data();
      const texto = JSON.stringify(dados).toLowerCase();
      return (
        texto.includes("saúde da mulher") ||
        texto.includes("saude da mulher")
      );
    });

    if (!importacao) {
      return NextResponse.json({
        sucesso: true,
        possuiDados: false,
        mensagem: "Importe o relatório temático Saúde da mulher do e-SUS PEC.",
      });
    }

    const importacaoDados = importacao.data();
    const registrosSnap = await importacao.ref
      .collection("registros")
      .get();

    const registros = registrosSnap.docs.map((doc) => ({
      id: doc.id,
      ...juntarRegistro(doc.data()),
    }));

    if (registros.length === 0) {
      return NextResponse.json({
        sucesso: true,
        possuiDados: false,
        mensagem: "A importação foi encontrada, mas não possui registros.",
      });
    }

    const criadoEm = dataMillis(importacaoDados.criadoEm);
    const referencia = criadoEm > 0 ? new Date(criadoEm) : new Date();

    const resultado = avaliarC7(registros, referencia);

    return NextResponse.json({
      ...resultado,
      possuiDados: true,
      importacao: {
        id: importacao.id,
        criadoEm: importacaoDados.criadoEm ?? null,
        geradoEm: importacaoDados.geradoEm ?? null,
      },
    });
  } catch (error) {
    console.error("Erro ao calcular C7:", error);

    return NextResponse.json(
      {
        sucesso: false,
        mensagem: "Não foi possível calcular o C7.",
      },
      { status: 500 }
    );
  }
}
