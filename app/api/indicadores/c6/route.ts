import { NextRequest, NextResponse } from "next/server";
import { DocumentData } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { avaliarC6 } from "@/lib/indicadores/c6-idoso";

function normalizar(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function dataImportacao(valor: unknown): number {
  if (valor instanceof Date) {
    return valor.getTime();
  }

  if (typeof valor === "number" && Number.isFinite(valor)) {
    return valor;
  }

  if (valor && typeof valor === "object") {
    const objeto = valor as {
      toMillis?: unknown;
      seconds?: unknown;
      _seconds?: unknown;
    };

    // Firestore Timestamp
    if (typeof objeto.toMillis === "function") {
      return objeto.toMillis();
    }

    // Timestamp serializado
    if (
      typeof objeto.seconds === "number" &&
      Number.isFinite(objeto.seconds)
    ) {
      return objeto.seconds * 1000;
    }

    // Formato alternativo de Timestamp serializado
    if (
      typeof objeto._seconds === "number" &&
      Number.isFinite(objeto._seconds)
    ) {
      return objeto._seconds * 1000;
    }
  }

  return 0;
}

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Sessão não autenticada." },
        { status: 401 },
      );
    }

    const token = authorization.replace("Bearer ", "");
    const usuarioAuth = await adminAuth.verifyIdToken(token);

    const usuarioSnap = await adminDb
      .collection("usuarios")
      .doc(usuarioAuth.uid)
      .get();

    if (!usuarioSnap.exists) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Usuário não encontrado." },
        { status: 403 },
      );
    }

    const usuario = usuarioSnap.data() as DocumentData;

    if (usuario.perfil !== "enfermeira" || usuario.ativo !== true) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Acesso não autorizado." },
        { status: 403 },
      );
    }

    const ubsId = String(usuario.ubsId || "");

    if (!ubsId) {
      return NextResponse.json(
        { sucesso: false, mensagem: "UBS não vinculada ao usuário." },
        { status: 400 },
      );
    }

    const importsSnap = await adminDb
      .collection("ubs")
      .doc(ubsId)
      .collection("importacoesPEC")
      .get();

    const importacoes = importsSnap.docs
      .map((doc) => {
        const dados = doc.data() as DocumentData;
        return {
          id: doc.id,
          dados,
          criadoEm: dataImportacao(dados.criadoEm),
        };
      })
      .filter((item) => {
        const lista = normalizar(item.dados.listaTematica);
        return lista.includes("pessoa idosa");
      })
      .sort((a, b) => b.criadoEm - a.criadoEm);

    if (importacoes.length === 0) {
      return NextResponse.json({
        sucesso: true,
        possuiDados: false,
        mensagem: "Ainda não há uma importação temática de Pessoa idosa.",
      });
    }

    const importacao = importacoes[0];

    const registrosSnap = await adminDb
      .collection("ubs")
      .doc(ubsId)
      .collection("importacoesPEC")
      .doc(importacao.id)
      .collection("registros")
      .get();

    const referenciaTexto = String(importacao.dados.geradoEm || "");
    const match = referenciaTexto.match(/(\d{2}\/\d{2}\/\d{4})/);
    const referencia = match
      ? (() => {
          const [dia, mes, ano] = match[1].split("/").map(Number);
          return new Date(ano, mes - 1, dia);
        })()
      : new Date();

    const pacientes = registrosSnap.docs
      .map((doc) => {
        const registro = doc.data() as DocumentData;
        const dadosBase =
          registro.dadosBase && typeof registro.dadosBase === "object"
            ? (registro.dadosBase as Record<string, unknown>)
            : {};
        const dadosEspecificos =
          registro.dadosEspecificos &&
          typeof registro.dadosEspecificos === "object"
            ? (registro.dadosEspecificos as Record<string, unknown>)
            : {};

        return avaliarC6(
          { ...dadosBase, ...dadosEspecificos },
          referencia,
        );
      })
      .filter((paciente) => {
        const idade = paciente.idade.toLowerCase();
        const anos = Number(idade.match(/\d+/)?.[0] || 0);
        return anos >= 60;
      });

    const total = pacientes.length;
    const pontuacao =
      total > 0
        ? pacientes.reduce((soma, paciente) => soma + paciente.pontuacao, 0) /
          total
        : 0;

    const praticas = {
      A: pacientes.filter((p) => p.praticas.find((x) => x.codigo === "A")?.atingida).length,
      B: pacientes.filter((p) => p.praticas.find((x) => x.codigo === "B")?.atingida).length,
      C: pacientes.filter((p) => p.praticas.find((x) => x.codigo === "C")?.atingida).length,
      D: pacientes.filter((p) => p.praticas.find((x) => x.codigo === "D")?.atingida).length,
    };

    const percentual = (n: number) => (total ? (n / total) * 100 : 0);

    return NextResponse.json({
      sucesso: true,
      possuiDados: total > 0,
      resumo: {
        pontuacao,
        classificacao:
          pontuacao > 75
            ? "Ótimo"
            : pontuacao > 50
              ? "Bom"
              : pontuacao > 25
                ? "Suficiente"
                : "Regular",
        totalElegiveis: total,
        praticas: {
          A: { atingidos: praticas.A, percentual: percentual(praticas.A) },
          B: { atingidos: praticas.B, percentual: percentual(praticas.B) },
          C: { atingidos: praticas.C, percentual: percentual(praticas.C) },
          D: { atingidos: praticas.D, percentual: percentual(praticas.D) },
        },
      },
      pacientes,
      fonte: {
        arquivoNome: importacao.dados.arquivoNome || "",
        geradoEm: referenciaTexto,
        listaTematica: importacao.dados.listaTematica || "",
      },
    });
  } catch (error) {
    console.error("Erro no C6:", error);

    return NextResponse.json(
      {
        sucesso: false,
        mensagem: "Não foi possível calcular o C6.",
      },
      { status: 500 },
    );
  }
}
