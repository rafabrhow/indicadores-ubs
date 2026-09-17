import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

function normalizar(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function tempo(valor: unknown): number {
  if (typeof valor === "number") return valor;
  if (valor instanceof Date) return valor.getTime();

  if (valor && typeof valor === "object") {
    const v = valor as {
      toMillis?: unknown;
      seconds?: unknown;
      _seconds?: unknown;
    };

    if (typeof v.toMillis === "function") {
      return (v.toMillis as () => number)();
    }

    if (typeof v.seconds === "number") return v.seconds * 1000;
    if (typeof v._seconds === "number") return v._seconds * 1000;
  }

  return 0;
}

function identificarTipo(dados: FirebaseFirestore.DocumentData): string {
  const codigo = normalizar(dados.codigoIndicadorOrigem);
  const lista = normalizar(dados.listaTematica);

  if (codigo.includes("c1") || lista.includes("mais acesso")) return "C1 - Mais acesso";
  if (codigo.includes("c2") || lista.includes("desenvolvimento infantil")) return "C2 - Infantil";
  if (codigo.includes("c3") || lista.includes("gestacao")) return "C3 - Gestação";
  if (codigo.includes("c4") || lista.includes("diabetes")) return "C4 - Diabetes";
  if (codigo.includes("c5") || lista.includes("hipertens")) return "C5 - Hipertensão";
  if (codigo.includes("c6") || lista.includes("pessoa idosa") || lista.includes("idoso")) return "C6 - Pessoa Idosa";
  if (codigo.includes("c7") || lista.includes("saude da mulher")) return "C7 - Saúde da Mulher";
  if (lista.includes("saude bucal")) return "Saúde Bucal";

  return "Pacientes";
}

export async function GET(request: Request) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Sessão não autenticada." },
        { status: 401 },
      );
    }

    const decoded = await adminAuth.verifyIdToken(
      authorization.slice("Bearer ".length).trim(),
    );

    const usuarioSnap = await adminDb
      .collection("usuarios")
      .doc(decoded.uid)
      .get();

    const usuario = usuarioSnap.data();

    if (
      !usuarioSnap.exists ||
      usuario?.perfil !== "enfermeira" ||
      usuario?.ativo !== true ||
      typeof usuario?.ubsId !== "string" ||
      !usuario.ubsId.trim()
    ) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Acesso não autorizado." },
        { status: 403 },
      );
    }

    const ubsRef = adminDb.collection("ubs").doc(usuario.ubsId);

    const snapshot = await ubsRef
      .collection("importacoesPEC")
      .get();

    const documentos = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        dados: doc.data(),
        criadoEm: tempo(doc.data().criadoEm),
      }))
      .sort((a, b) => b.criadoEm - a.criadoEm);

    // Recupera os e-mails dos usuários que realizaram as importações.
    const idsUsuarios = Array.from(
      new Set(
        documentos
          .map((item) => String(item.dados.criadoPor ?? ""))
          .filter(Boolean),
      ),
    );

    const emails = new Map<string, string>();

    await Promise.all(
      idsUsuarios.map(async (uid) => {
        const snap = await adminDb.collection("usuarios").doc(uid).get();
        const dados = snap.data();

        if (typeof dados?.email === "string") {
          emails.set(uid, dados.email);
        }
      }),
    );

    const importacoes = documentos.map((item) => {
      const dados = item.dados;

      const quantidadeRegistros = Number(
        dados.quantidadeRegistros ?? 0,
      );

      const processados = Number(
        dados.processados ?? 0,
      );

      const novosPacientes = Number(
        dados.novosPacientes ?? 0,
      );

      const pacientesAtualizados = Number(
        dados.pacientesAtualizados ?? 0,
      );

      const registrosIgnorados = Number(
        dados.registrosIgnorados ??
          Math.max(0, quantidadeRegistros - processados),
      );

      const criadoPor = String(dados.criadoPor ?? "");

      return {
        id: item.id,
        criadoEm: item.criadoEm,
        arquivoNome: String(
          dados.arquivoNome ?? "Arquivo não informado",
        ),
        tipo: identificarTipo(dados),
        codigoIndicadorOrigem: String(
          dados.codigoIndicadorOrigem ?? "",
        ),
        listaTematica: String(
          dados.listaTematica ?? "",
        ),
        grupoCondicoes: String(
          dados.grupoCondicoes ?? "",
        ),
        filtroProblemas: String(
          dados.filtroProblemas ?? "",
        ),
        quantidadeRegistros,
        novosPacientes,
        pacientesAtualizados,
        registrosIgnorados,
        processados,
        status: String(
          dados.status ?? "desconhecido",
        ),
        criadoPor,
        usuarioEmail:
          emails.get(criadoPor) ??
          (criadoPor === decoded.uid
            ? String(usuario.email ?? "")
            : "Usuário não identificado"),
        geradoEm: String(dados.geradoEm ?? ""),
      };
    });

    const concluida = importacoes.filter(
      (item) => normalizar(item.status) === "concluida",
    ).length;

    const comPendencias = importacoes.filter(
      (item) => normalizar(item.status) !== "concluida",
    ).length;

    const ultima = importacoes[0] ?? null;

    return NextResponse.json({
      sucesso: true,
      estatisticas: {
        totalImportacoes: importacoes.length,
        importacoesConcluidas: concluida,
        comPendencias,
        ultimaImportacao: ultima
          ? {
              data: ultima.criadoEm,
              arquivoNome: ultima.arquivoNome,
              status: ultima.status,
            }
          : null,
      },
      importacoes,
    });
  } catch (error) {
    console.error(
      "Erro ao carregar histórico de importações:",
      error,
    );

    return NextResponse.json(
      {
        sucesso: false,
        mensagem:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o histórico.",
      },
      { status: 500 },
    );
  }
}
