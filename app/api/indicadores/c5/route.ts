import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { DocumentData } from "firebase-admin/firestore";
import {
  avaliarC5Hipertensao,
  type ResultadoC5Hipertensao,
} from "@/lib/indicadores/c5-hipertensao";

export const runtime = "nodejs";

function dataReferencia(valor: unknown, fallback: Date) {
  const texto = typeof valor === "string" ? valor : "";
  const match = texto.match(/(\d{2})\/(\d{2})\/(\d{4})/);

  if (!match) return fallback;

  const [, dia, mes, ano] = match;
  const data = new Date(
    Number(ano),
    Number(mes) - 1,
    Number(dia)
  );

  return Number.isNaN(data.getTime()) ? fallback : data;
}

function nomePaciente(registro: FirebaseFirestore.DocumentData) {
  const dadosBase =
    registro.dadosBase &&
    typeof registro.dadosBase === "object"
      ? registro.dadosBase
      : {};

  return typeof dadosBase.Nome === "string"
    ? dadosBase.Nome
    : "Paciente sem nome";
}

function cpfPaciente(registro: FirebaseFirestore.DocumentData) {
  const dadosBase =
    registro.dadosBase &&
    typeof registro.dadosBase === "object"
      ? registro.dadosBase
      : {};

  return typeof dadosBase.CPF === "string" ? dadosBase.CPF : "";
}

function microareaPaciente(registro: FirebaseFirestore.DocumentData) {
  if (typeof registro.microareaId === "string") {
    return registro.microareaId.replace(/^"+|"+$/g, "").trim();
  }

  return "";
}

export async function GET(request: Request) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Sessão não autenticada." },
        { status: 401 }
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
        { status: 403 }
      );
    }

    const usuario = usuarioSnap.data();

    if (
      usuario?.perfil !== "enfermeira" ||
      usuario?.ativo !== true ||
      typeof usuario?.ubsId !== "string"
    ) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem: "Somente a enfermeira ativa pode consultar o C5.",
        },
        { status: 403 }
      );
    }

    const ubsRef = adminDb.collection("ubs").doc(usuario.ubsId);

    // Não dependemos de índice composto: buscamos as importações da UBS
    // e selecionamos em memória a importação C5 mais recente.
    const importsSnapshot = await ubsRef
      .collection("importacoesPEC")
      .get();

   type ImportacaoC5 = {
  id: string;
  fonteC5HipertensaoAtiva?: boolean;
  criadoEm?: {
    toMillis?: () => number;
    toDate?: () => Date;
  };
  geradoEm?: string;
  listaTematica?: string;
  grupoCondicoes?: string;
  filtroProblemas?: string;
  arquivoNome?: string;
  quantidadeRegistros?: number;
};

const importacoesC5: ImportacaoC5[] = importsSnapshot.docs
  .map((doc) => {
    const dados = doc.data() as DocumentData;

    return {
      id: doc.id,
      fonteC5HipertensaoAtiva:
        dados.fonteC5HipertensaoAtiva === true,
      criadoEm: dados.criadoEm,
      geradoEm: dados.geradoEm,
      listaTematica: dados.listaTematica,
      grupoCondicoes: dados.grupoCondicoes,
      filtroProblemas: dados.filtroProblemas,
      arquivoNome: dados.arquivoNome,
      quantidadeRegistros: dados.quantidadeRegistros,
    };
  })
  .filter((item) => item.fonteC5HipertensaoAtiva === true)
  .sort((a, b) => {
    const aTime = a.criadoEm?.toMillis?.() ?? 0;
    const bTime = b.criadoEm?.toMillis?.() ?? 0;

    return bTime - aTime;
  });

    const importacao = importacoesC5[0];

    if (!importacao) {
      return NextResponse.json({
        sucesso: true,
        possuiDados: false,
        mensagem:
          "Ainda não existe uma importação de Hipertensão com problemas ativos para calcular o C5.",
      });
    }

    const registrosSnapshot = await ubsRef
      .collection("importacoesPEC")
      .doc(importacao.id)
      .collection("registros")
      .get();

    const referencia = dataReferencia(
      importacao.geradoEm,
      importacao.criadoEm?.toDate?.() ?? new Date()
    );

    const pacientes = registrosSnapshot.docs.map((doc) => {
      const registro = doc.data();

      const resultado: ResultadoC5Hipertensao = avaliarC5Hipertensao(
        registro.dadosEspecificos ?? {},
        {
          referencia,
          metadados: {
            listaTematica: importacao.listaTematica,
            grupoCondicoes: importacao.grupoCondicoes,
            filtroProblemas: importacao.filtroProblemas,
          },
        }
      );

      return {
        id: doc.id,
        nome: nomePaciente(registro),
        cpf: cpfPaciente(registro),
        microarea: microareaPaciente(registro),
        ...resultado,
      };
    });

    const elegiveis = pacientes.filter((item) => item.elegivel);
    const totalElegiveis = elegiveis.length;

    const quantidadePratica = {
      A: elegiveis.filter((p) =>
        p.praticas.some((item) => item.codigo === "A" && item.atingida)
      ).length,
      B: elegiveis.filter((p) =>
        p.praticas.some((item) => item.codigo === "B" && item.atingida)
      ).length,
      C: elegiveis.filter((p) =>
        p.praticas.some((item) => item.codigo === "C" && item.atingida)
      ).length,
      D: elegiveis.filter((p) =>
        p.praticas.some((item) => item.codigo === "D" && item.atingida)
      ).length,
    };

    const somaPontos = elegiveis.reduce(
      (total, paciente) => total + paciente.pontuacao,
      0
    );

    const pontuacaoMedia =
      totalElegiveis > 0
        ? Number((somaPontos / totalElegiveis).toFixed(1))
        : 0;

    const classificacao =
      pontuacaoMedia > 75
        ? "Ótimo"
        : pontuacaoMedia > 50
          ? "Bom"
          : pontuacaoMedia > 25
            ? "Suficiente"
            : "Regular";

    return NextResponse.json({
      sucesso: true,
      possuiDados: true,
      importacao: {
        id: importacao.id,
        arquivoNome: importacao.arquivoNome ?? "Relatório do PEC",
        listaTematica: importacao.listaTematica ?? "",
        grupoCondicoes: importacao.grupoCondicoes ?? "",
        filtroProblemas: importacao.filtroProblemas ?? "",
        geradoEm: importacao.geradoEm ?? "",
        quantidadeRegistros: importacao.quantidadeRegistros ?? registrosSnapshot.size,
      },
      referencia: referencia.toISOString(),
      resumo: {
        totalRegistros: pacientes.length,
        totalElegiveis,
        pontuacao: pontuacaoMedia,
        classificacao,
        praticas: {
          A: {
            atingidos: quantidadePratica.A,
            percentual:
              totalElegiveis > 0
                ? Number(((quantidadePratica.A / totalElegiveis) * 100).toFixed(1))
                : 0,
          },
          B: {
            atingidos: quantidadePratica.B,
            percentual:
              totalElegiveis > 0
                ? Number(((quantidadePratica.B / totalElegiveis) * 100).toFixed(1))
                : 0,
          },
          C: {
            atingidos: quantidadePratica.C,
            percentual:
              totalElegiveis > 0
                ? Number(((quantidadePratica.C / totalElegiveis) * 100).toFixed(1))
                : 0,
          },
          D: {
            atingidos: quantidadePratica.D,
            percentual:
              totalElegiveis > 0
                ? Number(((quantidadePratica.D / totalElegiveis) * 100).toFixed(1))
                : 0,
          },
        },
      },
      pacientes,
    });
  } catch (error) {
    console.error("Erro ao calcular relatório C5:", error);

    return NextResponse.json(
      {
        sucesso: false,
        mensagem:
          error instanceof Error
            ? error.message
            : "Não foi possível calcular o relatório C5.",
      },
      { status: 500 }
    );
  }
}
