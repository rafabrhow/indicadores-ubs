import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import {
  analisarCSVPEC,
  classificarOrigemTematica,
  ehFonteC5HipertensaoAtiva,
  identificarPaciente,
  separarDadosBase,
} from "@/lib/pec/parser";
import { analisarRelatorioC1 } from "@/lib/indicadores/c1-relatorio";
import { salvarResultadoIndicadorMensal } from "@/lib/indicadores/persistencia-indicadores-mensais";
import { atualizarIndicadorCacheDashboard } from "@/lib/indicadores/cache-dashboard";
import {
  avaliarC2Infantil,
  type ResultadoC2Infantil,
} from "@/lib/indicadores/c2-infantil";
import {
  avaliarC3Gestacao,
  type ResultadoC3Gestacao,
  type CodigoC3,
} from "@/lib/indicadores/c3-gestacao";
import {
  avaliarC4Diabetes,
  type ResultadoC4Diabetes,
} from "@/lib/indicadores/c4-diabetes";
import {
  avaliarC5Hipertensao,
  type ResultadoC5Hipertensao,
} from "@/lib/indicadores/c5-hipertensao";
import { avaliarC6 } from "@/lib/indicadores/c6-idoso";
import { avaliarC7 } from "@/lib/indicadores/c7-mulher";
import { avaliarBucal } from "@/lib/indicadores/bucal";

export const runtime = "nodejs";

function normalizarTextoC1(valor: string): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function limparData(valor: string) {
  return valor || null;
}

function normalizarMicroarea(valor: string) {
  return (valor || "").replace(/^"+|"+$/g, "").trim();
}

/**
 * Converte a primeira data DD/MM/AAAA encontrada em um valor
 * do relatório para uso como referência do indicador.
 */
function dataReferenciaC2(valor: unknown): Date {
  const texto = typeof valor === "string" ? valor : "";
  const match = texto.match(/(\d{2})\/(\d{2})\/(\d{4})/);

  if (!match) return new Date();

  const data = new Date(
    Number(match[3]),
    Number(match[2]) - 1,
    Number(match[1]),
  );

  return Number.isNaN(data.getTime()) ? new Date() : data;
}

/**
 * Converte a data de referência para a competência mensal YYYY-MM.
 */
function competenciaC2(valor: unknown): string {
  const data = dataReferenciaC2(valor);

  return `${data.getFullYear()}-${String(
    data.getMonth() + 1,
  ).padStart(2, "0")}`;
}

/**
 * Converte a primeira data DD/MM/AAAA encontrada em um valor
 * do relatório para uso como referência do C3.
 */
function dataReferenciaC3(valor: unknown, fallback = new Date()): Date {
  const texto = typeof valor === "string" ? valor : "";
  const match = texto.match(/(\d{2})\/(\d{2})\/(\d{4})/);

  if (!match) return fallback;

  const data = new Date(
    Number(match[3]),
    Number(match[2]) - 1,
    Number(match[1]),
  );

  return Number.isNaN(data.getTime()) ? fallback : data;
}

/**
 * Converte a data de referência para a competência mensal YYYY-MM.
 */
function competenciaC3(valor: unknown): string {
  const data = dataReferenciaC3(valor);

  return `${data.getFullYear()}-${String(
    data.getMonth() + 1,
  ).padStart(2, "0")}`;
}

function dataReferenciaC4(valor: unknown, fallback = new Date()): Date {
  const texto = typeof valor === "string" ? valor : "";
  const match = texto.match(/(\d{2})\/(\d{2})\/(\d{4})/);

  if (!match) return fallback;

  const data = new Date(
    Number(match[3]),
    Number(match[2]) - 1,
    Number(match[1]),
  );

  return Number.isNaN(data.getTime()) ? fallback : data;
}

function competenciaC4(valor: unknown): string {
  const data = dataReferenciaC4(valor);

  return `${data.getFullYear()}-${String(
    data.getMonth() + 1,
  ).padStart(2, "0")}`;
}

function dataReferenciaC5(valor: unknown, fallback = new Date()): Date {
  const texto = typeof valor === "string" ? valor : "";
  const match = texto.match(/(\d{2})\/(\d{2})\/(\d{4})/);

  if (!match) return fallback;

  const data = new Date(
    Number(match[3]),
    Number(match[2]) - 1,
    Number(match[1]),
  );

  return Number.isNaN(data.getTime()) ? fallback : data;
}

function competenciaC5(valor: unknown): string {
  const data = dataReferenciaC5(valor);

  return `${data.getFullYear()}-${String(
    data.getMonth() + 1,
  ).padStart(2, "0")}`;
}

function normalizarTextoC6(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function dataReferenciaC6(valor: unknown, fallback = new Date()): Date {
  const texto = typeof valor === "string" ? valor : "";
  const match = texto.match(/(\d{2})\/(\d{2})\/(\d{4})/);

  if (!match) return fallback;

  const data = new Date(
    Number(match[3]),
    Number(match[2]) - 1,
    Number(match[1]),
  );

  return Number.isNaN(data.getTime()) ? fallback : data;
}

function competenciaC6(valor: unknown): string {
  const data = dataReferenciaC6(valor);

  return `${data.getFullYear()}-${String(
    data.getMonth() + 1,
  ).padStart(2, "0")}`;
}

function dataReferenciaC7(valor: unknown, fallback = new Date()): Date {
  const texto = typeof valor === "string" ? valor : "";
  const match = texto.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return fallback;
  const data = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  return Number.isNaN(data.getTime()) ? fallback : data;
}

function competenciaC7(valor: unknown): string {
  const data = dataReferenciaC7(valor);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

function normalizarTextoC7(valor: unknown): string {
  return String(valor ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function idadeEmAnosC6(valor: unknown): number {
  const texto = String(valor ?? "").trim().toLowerCase();
  const match = texto.match(/\\d+/);

  if (!match) return 0;

  return Number(match[0]) || 0;
}

type PacienteC6Importacao = ReturnType<typeof avaliarC6> & {
  id: string;
};

function normalizarTextoC3(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Sessão não autenticada." },
        { status: 401 }
      );
    }

    const idToken = authorization.slice("Bearer ".length).trim();
    const decoded = await adminAuth.verifyIdToken(idToken);

    const usuarioRef = adminDb.collection("usuarios").doc(decoded.uid);
    const usuarioSnap = await usuarioRef.get();

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
          mensagem:
            "Somente a enfermeira ativa pode importar dados do PEC.",
        },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const arquivo = formData.get("arquivo");

    if (!(arquivo instanceof File)) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Selecione um arquivo CSV." },
        { status: 400 }
      );
    }

    if (!arquivo.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem: "O arquivo precisa estar no formato CSV.",
        },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await arquivo.arrayBuffer());
    const conteudoLatin1 = bytes.toString("latin1");
    const conteudoUTF8 = bytes.toString("utf8");
    const conteudo = conteudoLatin1.includes("e-SUS")
      ? conteudoLatin1
      : conteudoUTF8;

    /*
     * O relatório "Atendimento Individual - Analítico" é consolidado por
     * tipo de atendimento e não deve passar pelo parser de pacientes.
     *
     * Para o C1, processamos esse CSV separadamente e salvamos somente
     * o resultado mensal consolidado. Assim o Dashboard não precisa reler
     * toda a coleção histórica a cada abertura.
     */
    const pareceRelatorioC1 =
      normalizarTextoC1(conteudo).includes(
        "relatorio de atendimento individual",
      ) &&
      normalizarTextoC1(conteudo).includes("analitico");

    if (pareceRelatorioC1) {
      const relatorioC1 = analisarRelatorioC1(conteudo);

      if (!relatorioC1.competencia) {
        return NextResponse.json(
          {
            sucesso: false,
            mensagem:
              "Não foi possível identificar a competência do relatório de Atendimento Individual.",
          },
          { status: 400 },
        );
      }

      if (relatorioC1.totalDemandasC1 === 0) {
        return NextResponse.json(
          {
            sucesso: false,
            mensagem:
              "O relatório de Atendimento Individual não possui demandas programadas ou espontâneas para calcular o C1.",
            relatorioC1,
          },
          { status: 400 },
        );
      }

      const percentualProgramado = relatorioC1.percentualProgramado;
      const classificacao =
        percentualProgramado === null
          ? "Indisponível"
          : percentualProgramado > 50 && percentualProgramado <= 70
            ? "Ótimo"
            : percentualProgramado > 30 && percentualProgramado <= 50
              ? "Bom"
              : percentualProgramado > 10 && percentualProgramado <= 30
                ? "Suficiente"
                : "Regular";

      await salvarResultadoIndicadorMensal({
        codigo: "C1",
        competencia: relatorioC1.competencia,
        ubsId: usuario.ubsId,
        dados: {
          periodo: relatorioC1.periodo,
          equipe: relatorioC1.equipe,
          profissional: relatorioC1.profissional,
          cbo: relatorioC1.cbo,
          registrosIdentificados: relatorioC1.registrosIdentificados,
          registrosNaoIdentificados: relatorioC1.registrosNaoIdentificados,
          atendimentosProgramados: relatorioC1.atendimentosProgramados,
          atendimentosEspontaneos: relatorioC1.atendimentosEspontaneos,
          atendimentosNaoInformados: relatorioC1.atendimentosNaoInformados,
          totalDemandasC1: relatorioC1.totalDemandasC1,
          percentualProgramado,
          classificacao,
          registros: relatorioC1.registros,
        },
      });

      /*
       * O C1 acabou de ser importado. Atualizamos somente o campo
       * "c1" do snapshot consolidado do Dashboard.
       *
       * Os demais indicadores permanecem preservados no snapshot.
       * A mesma função será reutilizada quando migrarmos C2-C7
       * e Bucal para o cache.
       */
      await atualizarIndicadorCacheDashboard(
        usuario.ubsId,
        "c1",
        {
          competencia: relatorioC1.competencia,
          periodo: relatorioC1.periodo,
          equipe: relatorioC1.equipe,
          profissional: relatorioC1.profissional,
          cbo: relatorioC1.cbo,
          registrosIdentificados:
            relatorioC1.registrosIdentificados,
          registrosNaoIdentificados:
            relatorioC1.registrosNaoIdentificados,
          atendimentosProgramados:
            relatorioC1.atendimentosProgramados,
          atendimentosEspontaneos:
            relatorioC1.atendimentosEspontaneos,
          atendimentosNaoInformados:
            relatorioC1.atendimentosNaoInformados,
          totalDemandasC1: relatorioC1.totalDemandasC1,
          percentualProgramado,
          classificacao,
          registros: relatorioC1.registros,
        },
        relatorioC1.competencia,
      );

      return NextResponse.json({
        sucesso: true,
        tipoImportacao: "C1",
        competencia: relatorioC1.competencia,
        percentualProgramado,
        classificacao,
        atendimentosProgramados: relatorioC1.atendimentosProgramados,
        atendimentosEspontaneos: relatorioC1.atendimentosEspontaneos,
        atendimentosNaoInformados: relatorioC1.atendimentosNaoInformados,
        totalAtendimentos: relatorioC1.totalDemandasC1,
        registrosIdentificados: relatorioC1.registrosIdentificados,
        registrosNaoIdentificados: relatorioC1.registrosNaoIdentificados,
      });
    }

    const resultado = analisarCSVPEC(conteudo);

    if (resultado.linhas.length === 0) {
      return NextResponse.json(
        { sucesso: false, mensagem: "O CSV não possui pacientes." },
        { status: 400 }
      );
    }

    const ubsId = usuario.ubsId;
    const ubsRef = adminDb.collection("ubs").doc(ubsId);
    const ubsSnap = await ubsRef.get();

    if (!ubsSnap.exists) {
      return NextResponse.json(
        { sucesso: false, mensagem: "UBS não encontrada." },
        { status: 404 }
      );
    }

    const importacaoRef = ubsRef.collection("importacoesPEC").doc();

    const codigoIndicadorOrigem = classificarOrigemTematica(
      resultado.listaTematica
    );

    const fonteC5HipertensaoAtiva = ehFonteC5HipertensaoAtiva(
      resultado.listaTematica,
      resultado.grupoCondicoes,
      resultado.filtroProblemas
    );

    await importacaoRef.set({
      id: importacaoRef.id,
      ubsId,
      arquivoNome: arquivo.name,
      listaTematica: resultado.listaTematica,
      grupoCondicoes: resultado.grupoCondicoes,
      filtroProblemas: resultado.filtroProblemas,
      equipeResponsavel: resultado.equipeResponsavel,
      microareas: resultado.microareas,
      periodoAtendimento: resultado.periodoAtendimento,
      geradoEm: resultado.geradoEm,
      geradoPor: resultado.por,
      quantidadeRegistros: resultado.linhas.length,
      codigoIndicadorOrigem,
      fonteC5HipertensaoAtiva,
      status: "processando",
      criadoEm: FieldValue.serverTimestamp(),
      criadoPor: decoded.uid,
    });

    /*
     * O C2 é calculado diretamente das linhas do CSV recém-importado.
     *
     * Isso é importante para o novo modelo: não fazemos uma nova leitura
     * da coleção de importações para descobrir os mesmos dados que já estão
     * disponíveis em resultado.linhas.
     */
    const ehFonteC2 =
      String(resultado.listaTematica ?? "")
        .normalize("NFD")
        .replace(/[\\u0300-\\u036f]/g, "")
        .toLowerCase()
        .includes("desenvolvimento infantil");

    let resumoC7: {
      competencia: string;
      arquivoNome: string;
      listaTematica: string;
      grupoCondicoes: string;
      filtroProblemas: string;
      geradoEm: string;
      quantidadeRegistros: number;
      totalRegistros: number;
      totalElegiveis: number;
      pontuacao: number | null;
      pontuacaoParcial: number;
      pontosDisponiveis: number;
      classificacao: string;
      completo: boolean;
      motivoIncompleto: string | null;
      praticas: Record<string, unknown>;
      pacientes: Array<Record<string, unknown>>;
    } | null = null;

    let resumoBucal: {
      competencia: string;
      arquivoNome: string;
      listaTematica: string;
      grupoCondicoes: string;
      filtroProblemas: string;
      geradoEm: string;
      quantidadeRegistros: number;
      totalRegistros: number;
      praticas: Record<string, unknown>;
      pacientes: Array<Record<string, unknown>>;
    } | null = null;

    let resumoC6: {
      competencia: string;
      arquivoNome: string;
      listaTematica: string;
      grupoCondicoes: string;
      filtroProblemas: string;
      geradoEm: string;
      quantidadeRegistros: number;
      totalRegistros: number;
      totalElegiveis: number;
      pontuacao: number;
      classificacao: "Ótimo" | "Bom" | "Suficiente" | "Regular";
      praticas: Record<
        string,
        { atingidos: number; percentual: number }
      >;
      pacientes: PacienteC6Importacao[];
    } | null = null;

    let resumoC5: {
      competencia: string;
      arquivoNome: string;
      listaTematica: string;
      grupoCondicoes: string;
      filtroProblemas: string;
      geradoEm: string;
      quantidadeRegistros: number;
      totalRegistros: number;
      totalElegiveis: number;
      pontuacao: number;
      classificacao: ResultadoC5Hipertensao["classificacao"];
      praticas: Record<
        string,
        { atingidos: number; percentual: number }
      >;
      pacientes: Array<
        ResultadoC5Hipertensao & {
          id: string;
          nome: string;
          cpf: string;
          microarea: string;
        }
      >;
    } | null = null;

    let resumoC4: {
      competencia: string;
      arquivoNome: string;
      listaTematica: string;
      grupoCondicoes: string;
      filtroProblemas: string;
      geradoEm: string;
      quantidadeRegistros: number;
      totalRegistros: number;
      totalElegiveis: number;
      pontuacao: number;
      classificacao: ResultadoC4Diabetes["classificacao"];
      praticas: Record<
        string,
        {
          atingidos: number;
          percentual: number;
        }
      >;
      pacientes: Array<
        ResultadoC4Diabetes & {
          id: string;
          nome: string;
          cpf: string;
          microarea: string;
        }
      >;
    } | null = null;

    let resumoC3: {
      competencia: string;
      arquivoNome: string;
      listaTematica: string;
      grupoCondicoes: string;
      filtroProblemas: string;
      geradoEm: string;
      quantidadeRegistros: number;
      totalRegistros: number;
      totalElegiveis: number;
      pontuacao: number;
      classificacao: ResultadoC3Gestacao["classificacao"];
      praticas: Record<
        string,
        {
          atingidos: number;
          pendentes: number;
          naoAplicaveis: number;
          percentual: number;
        }
      >;
      pacientes: Array<
        ResultadoC3Gestacao & {
          id: string;
          nome: string;
          cpf: string;
          microarea: string;
        }
      >;
    } | null = null;

    let resumoC2: {
      competencia: string;
      arquivoNome: string;
      listaTematica: string;
      geradoEm: string;
      quantidadeRegistros: number;
      totalRegistros: number;
      totalElegiveis: number;
      totalForaDoC2: number;
      pontuacao: number;
      classificacao: string;
      praticas: Record<
        string,
        { atingidos: number; percentual: number }
      >;
    } | null = null;

    const ehFonteC3 =
      normalizarTextoC3(resultado.listaTematica).includes("gestacao") ||
      normalizarTextoC3(resultado.grupoCondicoes).includes("gestacao") ||
      normalizarTextoC3(resultado.filtroProblemas).includes("gestacao");

    const normalizarTextoC4 = (valor: unknown): string =>
      String(valor ?? "")
        .normalize("NFD")
        .replace(/[\\u0300-\\u036f]/g, "")
        .toLowerCase()
        .trim();

    const ehFonteC4 =
      normalizarTextoC4(resultado.listaTematica).includes("diabetes") ||
      normalizarTextoC4(resultado.grupoCondicoes).includes("diabetes");

    const filtroC4 = normalizarTextoC4(resultado.filtroProblemas);

    const ehFonteC4Diabetes =
      ehFonteC4 && filtroC4.includes("somente problemas ativos");

    const ehFonteC6 =
      normalizarTextoC6(resultado.listaTematica).includes("pessoa idosa") ||
      normalizarTextoC6(resultado.grupoCondicoes).includes("pessoa idosa") ||
      normalizarTextoC6(resultado.listaTematica).includes("idoso");

    const ehFonteC7 =
      normalizarTextoC7(resultado.listaTematica).includes("saude da mulher") ||
      normalizarTextoC7(resultado.grupoCondicoes).includes("saude da mulher") ||
      normalizarTextoC7(resultado.listaTematica).includes("mulher");

    const ehFonteBucal = /sa[uú]de\\s+bucal/i.test(
      String(resultado.listaTematica ?? "")
    );

    if (ehFonteC4Diabetes) {
      const referenciaC4 = dataReferenciaC4(resultado.geradoEm);

      const avaliadosC4: Array<
        ResultadoC4Diabetes & {
          id: string;
          nome: string;
          cpf: string;
          microarea: string;
        }
      > = resultado.linhas.map((registro) => {
        const { base, especificos } = separarDadosBase(registro);

        return {
          id: identificarPaciente(registro),
          nome: String(base.Nome ?? ""),
          cpf: String(base.CPF ?? ""),
          microarea: normalizarMicroarea(base.Microárea || ""),
          ...avaliarC4Diabetes(especificos, {
            referencia: referenciaC4,
            metadados: {
              listaTematica: String(resultado.listaTematica ?? ""),
              grupoCondicoes: String(resultado.grupoCondicoes ?? ""),
              filtroProblemas: String(resultado.filtroProblemas ?? ""),
            },
          }),
        };
      });

      const elegiveisC4 = avaliadosC4.filter(
        (paciente) => paciente.elegivel,
      );

      const totalElegiveisC4 = elegiveisC4.length;
      const codigosC4 = ["A", "B", "C", "D", "E", "F"] as const;

      const praticasC4 = Object.fromEntries(
        codigosC4.map((codigo) => {
          const atingidos = elegiveisC4.filter((paciente) =>
            paciente.praticas.some(
              (item) =>
                item.codigo === codigo && item.atingida,
            ),
          ).length;

          return [
            codigo,
            {
              atingidos,
              percentual: totalElegiveisC4
                ? Number(
                    (
                      (atingidos / totalElegiveisC4) *
                      100
                    ).toFixed(1),
                  )
                : 0,
            },
          ];
        }),
      ) as Record<
        string,
        { atingidos: number; percentual: number }
      >;

      const somaPontosC4 = elegiveisC4.reduce(
        (total, paciente) => total + paciente.pontuacao,
        0,
      );

      const pontuacaoC4 = totalElegiveisC4
        ? Number(
            (somaPontosC4 / totalElegiveisC4).toFixed(1),
          )
        : 0;

      const classificacaoC4 =
        pontuacaoC4 > 75
          ? "Ótimo"
          : pontuacaoC4 > 50
            ? "Bom"
            : pontuacaoC4 > 25
              ? "Suficiente"
              : "Regular";

      resumoC4 = {
        competencia: competenciaC4(resultado.geradoEm),
        arquivoNome: arquivo.name,
        listaTematica: String(resultado.listaTematica ?? ""),
        grupoCondicoes: String(resultado.grupoCondicoes ?? ""),
        filtroProblemas: String(resultado.filtroProblemas ?? ""),
        geradoEm: String(resultado.geradoEm ?? ""),
        quantidadeRegistros: resultado.linhas.length,
        totalRegistros: avaliadosC4.length,
        totalElegiveis: totalElegiveisC4,
        pontuacao: pontuacaoC4,
        classificacao: classificacaoC4,
        praticas: praticasC4,
        pacientes: avaliadosC4,
      };
    }

    if (ehFonteC3) {
      const referenciaC3 = dataReferenciaC3(resultado.geradoEm);
      const avaliadosC3: Array<
        ResultadoC3Gestacao & {
          id: string;
          nome: string;
          cpf: string;
          microarea: string;
        }
      > = resultado.linhas.map((registro) => {
        const { base, especificos } = separarDadosBase(registro);

        return {
          id: identificarPaciente(registro),
          nome: String(base.Nome ?? ""),
          cpf: String(base.CPF ?? ""),
          microarea: normalizarMicroarea(base.Microárea || ""),
          ...avaliarC3Gestacao(especificos, {
            referencia: referenciaC3,
            metadados: {
              listaTematica: String(resultado.listaTematica ?? ""),
              grupoCondicoes: String(resultado.grupoCondicoes ?? ""),
              filtroProblemas: String(resultado.filtroProblemas ?? ""),
            },
          }),
        };
      });

      const elegiveisC3 = avaliadosC3.filter(
        (paciente) => paciente.elegivel,
      );

      const codigosC3: CodigoC3[] = [
        "A",
        "B",
        "C",
        "D",
        "E",
        "F",
        "G",
        "H",
        "I",
        "J",
        "K",
      ];

      const praticasC3 = Object.fromEntries(
        codigosC3.map((codigo) => {
          const atingidos = elegiveisC3.filter((paciente) =>
            paciente.praticas.some(
              (item) => item.codigo === codigo && item.atingida,
            ),
          ).length;

          const pendentes = elegiveisC3.filter((paciente) =>
            paciente.praticas.some(
              (item) => item.codigo === codigo && item.status === "pendente",
            ),
          ).length;

          const naoAplicaveis = elegiveisC3.filter((paciente) =>
            paciente.praticas.some(
              (item) =>
                item.codigo === codigo &&
                item.status === "nao_aplicavel",
            ),
          ).length;

          return [
            codigo,
            {
              atingidos,
              pendentes,
              naoAplicaveis,
              percentual: elegiveisC3.length
                ? Number(
                    ((atingidos / elegiveisC3.length) * 100).toFixed(1),
                  )
                : 0,
            },
          ];
        }),
      ) as Record<
        string,
        {
          atingidos: number;
          pendentes: number;
          naoAplicaveis: number;
          percentual: number;
        }
      >;

      const somaPontosC3 = elegiveisC3.reduce(
        (total, paciente) => total + paciente.pontuacao,
        0,
      );

      const pontuacaoC3 = elegiveisC3.length
        ? Number(
            (somaPontosC3 / elegiveisC3.length).toFixed(1),
          )
        : 0;

      const classificacaoC3 =
        pontuacaoC3 > 75
          ? "Ótimo"
          : pontuacaoC3 > 50
            ? "Bom"
            : pontuacaoC3 > 25
              ? "Suficiente"
              : "Regular";

      resumoC3 = {
        competencia: competenciaC3(resultado.geradoEm),
        arquivoNome: arquivo.name,
        listaTematica: String(resultado.listaTematica ?? ""),
        grupoCondicoes: String(resultado.grupoCondicoes ?? ""),
        filtroProblemas: String(resultado.filtroProblemas ?? ""),
        geradoEm: String(resultado.geradoEm ?? ""),
        quantidadeRegistros: resultado.linhas.length,
        totalRegistros: avaliadosC3.length,
        totalElegiveis: elegiveisC3.length,
        pontuacao: pontuacaoC3,
        classificacao: classificacaoC3,
        praticas: praticasC3,
        pacientes: avaliadosC3,
      };
    }

    if (ehFonteC2) {
      const referenciaC2 = dataReferenciaC2(resultado.geradoEm);

      const avaliadosC2: Array<
        ResultadoC2Infantil & {
          id: string;
        }
      > = resultado.linhas.map((registro) => {
        const dadosAvaliacao = {
          ...registro,
        };

        return {
          id: identificarPaciente(registro),
          ...avaliarC2Infantil(dadosAvaliacao, {
            referencia: referenciaC2,
            metadados: {
              listaTematica: resultado.listaTematica,
            },
          }),
        };
      });

      const elegiveisC2 = avaliadosC2.filter(
        (paciente) => paciente.elegivel,
      );

      const totalElegiveisC2 = elegiveisC2.length;

      const codigosC2 = ["A", "B", "C", "D", "E"] as const;

      const praticasC2 = Object.fromEntries(
        codigosC2.map((codigo) => {
          const atingidos = elegiveisC2.filter((paciente) =>
            paciente.praticas.some(
              (item) =>
                item.codigo === codigo && item.atingida,
            ),
          ).length;

          return [
            codigo,
            {
              atingidos,
              percentual: totalElegiveisC2
                ? Number(
                    (
                      (atingidos / totalElegiveisC2) *
                      100
                    ).toFixed(1),
                  )
                : 0,
            },
          ];
        }),
      ) as Record<
        string,
        { atingidos: number; percentual: number }
      >;

      const somaPontosC2 = elegiveisC2.reduce(
        (total, paciente) => total + paciente.pontuacao,
        0,
      );

      const pontuacaoC2 = totalElegiveisC2
        ? Number(
            (somaPontosC2 / totalElegiveisC2).toFixed(1),
          )
        : 0;

      const classificacaoC2 =
        pontuacaoC2 > 75
          ? "Ótimo"
          : pontuacaoC2 > 50
            ? "Bom"
            : pontuacaoC2 > 25
              ? "Suficiente"
              : "Regular";

      resumoC2 = {
        competencia: competenciaC2(resultado.geradoEm),
        arquivoNome: arquivo.name,
        listaTematica: String(resultado.listaTematica ?? ""),
        geradoEm: String(resultado.geradoEm ?? ""),
        quantidadeRegistros: resultado.linhas.length,
        totalRegistros: avaliadosC2.length,
        totalElegiveis: totalElegiveisC2,
        totalForaDoC2:
          avaliadosC2.length - totalElegiveisC2,
        pontuacao: pontuacaoC2,
        classificacao: classificacaoC2,
        praticas: praticasC2,
      };
    }

    if (ehFonteC6) {
      const referenciaC6 = dataReferenciaC6(resultado.geradoEm);

      const avaliadosC6: PacienteC6Importacao[] = resultado.linhas
        .map((registro) => ({
          id: identificarPaciente(registro),
          ...avaliarC6(registro, referenciaC6),
        }))
        .filter((paciente) => idadeEmAnosC6(paciente.idade) >= 60);

      const totalElegiveisC6 = avaliadosC6.length;
      const codigosC6 = ["A", "B", "C", "D"] as const;

      const praticasC6 = Object.fromEntries(
        codigosC6.map((codigo) => {
          const atingidos = avaliadosC6.filter((paciente) =>
            paciente.praticas.some(
              (item) => item.codigo === codigo && item.atingida,
            ),
          ).length;

          return [
            codigo,
            {
              atingidos,
              percentual: totalElegiveisC6
                ? Number(
                    ((atingidos / totalElegiveisC6) * 100).toFixed(1),
                  )
                : 0,
            },
          ];
        }),
      ) as Record<
        string,
        { atingidos: number; percentual: number }
      >;

      const pontuacaoC6 = totalElegiveisC6
        ? Number(
            (
              avaliadosC6.reduce(
                (total, paciente) => total + paciente.pontuacao,
                0,
              ) / totalElegiveisC6
            ).toFixed(1),
          )
        : 0;

      const classificacaoC6 =
        pontuacaoC6 > 75
          ? "Ótimo"
          : pontuacaoC6 > 50
            ? "Bom"
            : pontuacaoC6 > 25
              ? "Suficiente"
              : "Regular";

      resumoC6 = {
        competencia: competenciaC6(resultado.geradoEm),
        arquivoNome: arquivo.name,
        listaTematica: String(resultado.listaTematica ?? ""),
        grupoCondicoes: String(resultado.grupoCondicoes ?? ""),
        filtroProblemas: String(resultado.filtroProblemas ?? ""),
        geradoEm: String(resultado.geradoEm ?? ""),
        quantidadeRegistros: resultado.linhas.length,
        totalRegistros: avaliadosC6.length,
        totalElegiveis: totalElegiveisC6,
        pontuacao: pontuacaoC6,
        classificacao: classificacaoC6,
        praticas: praticasC6,
        pacientes: avaliadosC6,
      };
    }

    if (ehFonteC7) {
      const referenciaC7 = dataReferenciaC7(resultado.geradoEm);
      const registrosC7 = resultado.linhas.map((registro) => {
        const { base, especificos } = separarDadosBase(registro);
        return { ...base, ...especificos, ...registro, dadosBase: base, dadosEspecificos: especificos };
      });
      const resultadoC7 = avaliarC7(registrosC7, referenciaC7);
      resumoC7 = {
        competencia: competenciaC7(resultado.geradoEm),
        arquivoNome: arquivo.name,
        listaTematica: String(resultado.listaTematica ?? ""),
        grupoCondicoes: String(resultado.grupoCondicoes ?? ""),
        filtroProblemas: String(resultado.filtroProblemas ?? ""),
        geradoEm: String(resultado.geradoEm ?? ""),
        quantidadeRegistros: resultado.linhas.length,
        totalRegistros: Number(resultadoC7.pacientes?.length ?? 0),
        totalElegiveis: Number(resultadoC7.totalElegiveis ?? 0),
        pontuacao: resultadoC7.pontuacao ?? null,
        pontuacaoParcial: Number(resultadoC7.pontuacaoParcial ?? 0),
        pontosDisponiveis: Number(resultadoC7.pontosDisponiveis ?? 0),
        classificacao: String(resultadoC7.classificacao ?? "Indisponível"),
        completo: resultadoC7.completo === true,
        motivoIncompleto: resultadoC7.motivoIncompleto ?? null,
        praticas: resultadoC7.praticas ?? {},
        pacientes: resultadoC7.pacientes ?? [],
      };
    }

    if (ehFonteBucal) {
      const registrosBucal = resultado.linhas.map((registro) => {
        const { base, especificos } = separarDadosBase(registro);

        return {
          ...base,
          ...especificos,
          ...registro,
          dadosBase: base,
          dadosEspecificos: especificos,
        };
      });

      const resultadoBucal = avaliarBucal(registrosBucal);

      resumoBucal = {
        competencia: competenciaC7(resultado.geradoEm),
        arquivoNome: arquivo.name,
        listaTematica: String(resultado.listaTematica ?? ""),
        grupoCondicoes: String(resultado.grupoCondicoes ?? ""),
        filtroProblemas: String(resultado.filtroProblemas ?? ""),
        geradoEm: String(resultado.geradoEm ?? ""),
        quantidadeRegistros: resultado.linhas.length,
        totalRegistros: resultadoBucal.totalRegistros,
        praticas: resultadoBucal.praticas,
        pacientes: resultadoBucal.pacientes,
      };
    }

    let novos = 0;
    let atualizados = 0;
    let processados = 0;

    // IDs realmente novos nesta importação.
    // Evita contar duas vezes o mesmo paciente se ele aparecer no CSV.
    const novosPacientesIds = new Set<string>();

    let batch = adminDb.batch();
    let operacoes = 0;

    async function confirmarBatch() {
      if (operacoes === 0) return;
      await batch.commit();
      batch = adminDb.batch();
      operacoes = 0;
    }

    for (const registro of resultado.linhas) {
      const pacienteId = identificarPaciente(registro);
      const pacienteRef = ubsRef.collection("pacientes").doc(pacienteId);
      const pacienteSnap = await pacienteRef.get();

      const { base, especificos } = separarDadosBase(registro);
      const microareaId = normalizarMicroarea(base.Microárea || "");

      const pacienteAtual = {
        id: pacienteId,
        ubsId,
        nome: base.Nome || "",
        dataNascimento: limparData(base["Data de nascimento"]),
        idade: base.Idade || "",
        sexo: base.Sexo || "",
        cpf: base.CPF || "",
        cns: base.CNS || "",
        telefoneCelular: base["Telefone celular"] || "",
        telefoneContato: base["Telefone de contato"] || "",
        microareaId,
        endereco: {
          rua: base.Rua || "",
          numero: base.Número || "",
          complemento: base.Complemento || "",
          bairro: base.Bairro || "",
          municipio: base.Município || "",
          uf: base.UF || "",
          cep: base.CEP || "",
        },
        tematicasPEC: FieldValue.arrayUnion(resultado.listaTematica),
        ...(codigoIndicadorOrigem
          ? {
              indicadoresOrigemPEC:
                FieldValue.arrayUnion(codigoIndicadorOrigem),
            }
          : {}),
        ...(fonteC5HipertensaoAtiva
          ? {
              fontesIndicadoresPEC:
                FieldValue.arrayUnion("C5_HIPERTENSAO"),
            }
          : {}),
        atualizadoEm: FieldValue.serverTimestamp(),
        ultimaImportacaoPECId: importacaoRef.id,
      };

      if (!pacienteSnap.exists) {
        novos++;
        novosPacientesIds.add(pacienteId);
        batch.set(pacienteRef, {
          ...pacienteAtual,
          criadoEm: FieldValue.serverTimestamp(),
        });
      } else {
        atualizados++;
        batch.set(pacienteRef, pacienteAtual, { merge: true });
      }

      operacoes++;

      const historicoRef = importacaoRef
        .collection("registros")
        .doc(pacienteId);

      batch.set(historicoRef, {
        pacienteId,
        ubsId,
        listaTematica: resultado.listaTematica,
        grupoCondicoes: resultado.grupoCondicoes,
        filtroProblemas: resultado.filtroProblemas,
        codigoIndicadorOrigem,
        fonteC5HipertensaoAtiva,
        dadosBase: base,
        dadosEspecificos: especificos,
        microareaId,
        criadoEm: FieldValue.serverTimestamp(),
      });

      operacoes++;
      processados++;

      if (operacoes >= 450) {
        await confirmarBatch();
      }
    }

    await confirmarBatch();

    /*
     * Mantém o total persistente de pacientes da UBS.
     * Não precisamos reler toda a coleção de pacientes.
     * A migração inicial do total existente será feita separadamente.
     */
    if (novosPacientesIds.size > 0) {
      await ubsRef.update({
        totalPacientes: FieldValue.increment(novosPacientesIds.size),
      });
    }

    await importacaoRef.update({
      status: "concluida",
      processados,
      novosPacientes: novos,
      pacientesAtualizados: atualizados,
      finalizadoEm: FieldValue.serverTimestamp(),
    });

    /*
     * O CSV de Desenvolvimento Infantil já foi processado acima.
     * Persistimos apenas o resultado consolidado do C2 e atualizamos
     * o campo C2 do cache do Dashboard.
     *
     * Não fazemos nenhuma nova leitura dos pacientes para isso.
     */
    if (fonteC5HipertensaoAtiva) {
      const referenciaC5 = dataReferenciaC5(resultado.geradoEm);

      const avaliadosC5: Array<
        ResultadoC5Hipertensao & {
          id: string;
          nome: string;
          cpf: string;
          microarea: string;
        }
      > = resultado.linhas.map((registro) => {
        const { base, especificos } = separarDadosBase(registro);

        return {
          id: identificarPaciente(registro),
          nome: String(base.Nome ?? ""),
          cpf: String(base.CPF ?? ""),
          microarea: normalizarMicroarea(base.Microárea || ""),
          ...avaliarC5Hipertensao(especificos, {
            referencia: referenciaC5,
            metadados: {
              listaTematica: String(resultado.listaTematica ?? ""),
              grupoCondicoes: String(resultado.grupoCondicoes ?? ""),
              filtroProblemas: String(resultado.filtroProblemas ?? ""),
            },
          }),
        };
      });

      const elegiveisC5 = avaliadosC5.filter(
        (paciente) => paciente.elegivel,
      );

      const totalElegiveisC5 = elegiveisC5.length;
      const codigosC5 = ["A", "B", "C", "D"] as const;

      const praticasC5 = Object.fromEntries(
        codigosC5.map((codigo) => {
          const atingidos = elegiveisC5.filter((paciente) =>
            paciente.praticas.some(
              (item) => item.codigo === codigo && item.atingida,
            ),
          ).length;

          return [
            codigo,
            {
              atingidos,
              percentual: totalElegiveisC5
                ? Number(
                    (
                      (atingidos / totalElegiveisC5) *
                      100
                    ).toFixed(1),
                  )
                : 0,
            },
          ];
        }),
      ) as Record<
        string,
        { atingidos: number; percentual: number }
      >;

      const somaPontosC5 = elegiveisC5.reduce(
        (total, paciente) => total + paciente.pontuacao,
        0,
      );

      const pontuacaoC5 = totalElegiveisC5
        ? Number(
            (somaPontosC5 / totalElegiveisC5).toFixed(1),
          )
        : 0;

      const classificacaoC5 =
        pontuacaoC5 > 75
          ? "Ótimo"
          : pontuacaoC5 > 50
            ? "Bom"
            : pontuacaoC5 > 25
              ? "Suficiente"
              : "Regular";

      resumoC5 = {
        competencia: competenciaC5(resultado.geradoEm),
        arquivoNome: arquivo.name,
        listaTematica: String(resultado.listaTematica ?? ""),
        grupoCondicoes: String(resultado.grupoCondicoes ?? ""),
        filtroProblemas: String(resultado.filtroProblemas ?? ""),
        geradoEm: String(resultado.geradoEm ?? ""),
        quantidadeRegistros: resultado.linhas.length,
        totalRegistros: avaliadosC5.length,
        totalElegiveis: totalElegiveisC5,
        pontuacao: pontuacaoC5,
        classificacao: classificacaoC5,
        praticas: praticasC5,
        pacientes: avaliadosC5,
      };
    }

    if (resumoC5) {
      await salvarResultadoIndicadorMensal({
        codigo: "C5",
        competencia: resumoC5.competencia,
        ubsId,
        dados: {
          importacao: {
            arquivoNome: resumoC5.arquivoNome,
            listaTematica: resumoC5.listaTematica,
            grupoCondicoes: resumoC5.grupoCondicoes,
            filtroProblemas: resumoC5.filtroProblemas,
            geradoEm: resumoC5.geradoEm,
            quantidadeRegistros: resumoC5.quantidadeRegistros,
          },
          totalRegistros: resumoC5.totalRegistros,
          totalElegiveis: resumoC5.totalElegiveis,
          pontuacao: resumoC5.pontuacao,
          classificacao: resumoC5.classificacao,
          praticas: resumoC5.praticas,
          pacientes: resumoC5.pacientes,
        },
      });

      await atualizarIndicadorCacheDashboard(
        ubsId,
        "c5",
        {
          competencia: resumoC5.competencia,
          totalRegistros: resumoC5.totalRegistros,
          totalElegiveis: resumoC5.totalElegiveis,
          pontuacao: resumoC5.pontuacao,
          classificacao: resumoC5.classificacao,
          praticas: resumoC5.praticas,
        },
        resumoC5.competencia,
      );
    }

    if (resumoC6) {
      await salvarResultadoIndicadorMensal({
        codigo: "C6",
        competencia: resumoC6.competencia,
        ubsId,
        dados: {
          importacao: {
            arquivoNome: resumoC6.arquivoNome,
            listaTematica: resumoC6.listaTematica,
            grupoCondicoes: resumoC6.grupoCondicoes,
            filtroProblemas: resumoC6.filtroProblemas,
            geradoEm: resumoC6.geradoEm,
            quantidadeRegistros: resumoC6.quantidadeRegistros,
          },
          totalRegistros: resumoC6.totalRegistros,
          totalElegiveis: resumoC6.totalElegiveis,
          pontuacao: resumoC6.pontuacao,
          classificacao: resumoC6.classificacao,
          praticas: resumoC6.praticas,
          pacientes: resumoC6.pacientes,
        },
      });

      await atualizarIndicadorCacheDashboard(
        ubsId,
        "c6",
        {
          competencia: resumoC6.competencia,
          totalRegistros: resumoC6.totalRegistros,
          totalElegiveis: resumoC6.totalElegiveis,
          pontuacao: resumoC6.pontuacao,
          classificacao: resumoC6.classificacao,
          praticas: resumoC6.praticas,
        },
        resumoC6.competencia,
      );
    }

    if (resumoC4) {
      await salvarResultadoIndicadorMensal({
        codigo: "C4",
        competencia: resumoC4.competencia,
        ubsId,
        dados: {
          importacao: {
            arquivoNome: resumoC4.arquivoNome,
            listaTematica: resumoC4.listaTematica,
            grupoCondicoes: resumoC4.grupoCondicoes,
            filtroProblemas: resumoC4.filtroProblemas,
            geradoEm: resumoC4.geradoEm,
            quantidadeRegistros: resumoC4.quantidadeRegistros,
          },
          totalRegistros: resumoC4.totalRegistros,
          totalElegiveis: resumoC4.totalElegiveis,
          pontuacao: resumoC4.pontuacao,
          classificacao: resumoC4.classificacao,
          praticas: resumoC4.praticas,
          pacientes: resumoC4.pacientes,
        },
      });

      await atualizarIndicadorCacheDashboard(
        ubsId,
        "c4",
        {
          competencia: resumoC4.competencia,
          totalRegistros: resumoC4.totalRegistros,
          totalElegiveis: resumoC4.totalElegiveis,
          pontuacao: resumoC4.pontuacao,
          classificacao: resumoC4.classificacao,
          praticas: resumoC4.praticas,
        },
        resumoC4.competencia,
      );
    }

    if (resumoC3) {
      await salvarResultadoIndicadorMensal({
        codigo: "C3",
        competencia: resumoC3.competencia,
        ubsId,
        dados: {
          importacao: {
            arquivoNome: resumoC3.arquivoNome,
            listaTematica: resumoC3.listaTematica,
            grupoCondicoes: resumoC3.grupoCondicoes,
            filtroProblemas: resumoC3.filtroProblemas,
            geradoEm: resumoC3.geradoEm,
            quantidadeRegistros: resumoC3.quantidadeRegistros,
          },
          totalRegistros: resumoC3.totalRegistros,
          totalElegiveis: resumoC3.totalElegiveis,
          pontuacao: resumoC3.pontuacao,
          classificacao: resumoC3.classificacao,
          praticas: resumoC3.praticas,
          pacientes: resumoC3.pacientes,
        },
      });

      /*
       * O cache recebe somente o resumo necessário para o Dashboard.
       * A lista detalhada permanece no resultado mensal do C3.
       */
      await atualizarIndicadorCacheDashboard(
        ubsId,
        "c3",
        {
          competencia: resumoC3.competencia,
          totalRegistros: resumoC3.totalRegistros,
          totalElegiveis: resumoC3.totalElegiveis,
          pontuacao: resumoC3.pontuacao,
          classificacao: resumoC3.classificacao,
          praticas: resumoC3.praticas,
        },
        resumoC3.competencia,
      );
    }

    if (resumoC2) {
      await salvarResultadoIndicadorMensal({
        codigo: "C2",
        competencia: resumoC2.competencia,
        ubsId,
        dados: {
          arquivoNome: resumoC2.arquivoNome,
          listaTematica: resumoC2.listaTematica,
          geradoEm: resumoC2.geradoEm,
          quantidadeRegistros:
            resumoC2.quantidadeRegistros,
          totalRegistros: resumoC2.totalRegistros,
          totalElegiveis: resumoC2.totalElegiveis,
          totalForaDoC2: resumoC2.totalForaDoC2,
          pontuacao: resumoC2.pontuacao,
          classificacao: resumoC2.classificacao,
          praticas: resumoC2.praticas,
        },
      });

      await atualizarIndicadorCacheDashboard(
        ubsId,
        "c2",
        {
          competencia: resumoC2.competencia,
          pontuacao: resumoC2.pontuacao,
          classificacao: resumoC2.classificacao,
          totalRegistros: resumoC2.totalRegistros,
          totalElegiveis: resumoC2.totalElegiveis,
          totalForaDoC2: resumoC2.totalForaDoC2,
          praticas: resumoC2.praticas,
        },
        resumoC2.competencia,
      );
    }

    if (resumoBucal) {
      await salvarResultadoIndicadorMensal({
        codigo: "BUCAL",
        competencia: resumoBucal.competencia,
        ubsId,
        dados: {
          importacao: {
            arquivoNome: resumoBucal.arquivoNome,
            listaTematica: resumoBucal.listaTematica,
            grupoCondicoes: resumoBucal.grupoCondicoes,
            filtroProblemas: resumoBucal.filtroProblemas,
            geradoEm: resumoBucal.geradoEm,
            quantidadeRegistros: resumoBucal.quantidadeRegistros,
          },
          totalRegistros: resumoBucal.totalRegistros,
          praticas: resumoBucal.praticas,
          pacientes: resumoBucal.pacientes,
        },
      });

      await atualizarIndicadorCacheDashboard(
        ubsId,
        "bucal",
        {
          competencia: resumoBucal.competencia,
          totalRegistros: resumoBucal.totalRegistros,
          praticas: resumoBucal.praticas,
        },
        resumoBucal.competencia,
      );
    }

    if (resumoC7) {
      await salvarResultadoIndicadorMensal({
        codigo: "C7",
        competencia: resumoC7.competencia,
        ubsId,
        dados: {
          importacao: {
            arquivoNome: resumoC7.arquivoNome,
            listaTematica: resumoC7.listaTematica,
            grupoCondicoes: resumoC7.grupoCondicoes,
            filtroProblemas: resumoC7.filtroProblemas,
            geradoEm: resumoC7.geradoEm,
            quantidadeRegistros: resumoC7.quantidadeRegistros,
          },
          totalRegistros: resumoC7.totalRegistros,
          totalElegiveis: resumoC7.totalElegiveis,
          pontuacao: resumoC7.pontuacao,
          pontuacaoParcial: resumoC7.pontuacaoParcial,
          pontosDisponiveis: resumoC7.pontosDisponiveis,
          classificacao: resumoC7.classificacao,
          completo: resumoC7.completo,
          motivoIncompleto: resumoC7.motivoIncompleto,
          praticas: resumoC7.praticas,
          pacientes: resumoC7.pacientes,
        },
      });
      await atualizarIndicadorCacheDashboard(ubsId, "c7", {
        competencia: resumoC7.competencia,
        totalRegistros: resumoC7.totalRegistros,
        totalElegiveis: resumoC7.totalElegiveis,
        pontuacao: resumoC7.pontuacao,
        pontuacaoParcial: resumoC7.pontuacaoParcial,
        pontosDisponiveis: resumoC7.pontosDisponiveis,
        classificacao: resumoC7.classificacao,
        completo: resumoC7.completo,
        motivoIncompleto: resumoC7.motivoIncompleto,
        praticas: resumoC7.praticas,
      }, resumoC7.competencia);
    }

    return NextResponse.json({
      sucesso: true,
      importacao: {
        id: importacaoRef.id,
        arquivoNome: arquivo.name,
        listaTematica: resultado.listaTematica,
        grupoCondicoes: resultado.grupoCondicoes,
        filtroProblemas: resultado.filtroProblemas,
        fonteC5HipertensaoAtiva,
        quantidadeRegistros: resultado.linhas.length,
        novosPacientes: novos,
        pacientesAtualizados: atualizados,
        processados,
        codigoIndicadorOrigem,
        c6: resumoC6
          ? {
              competencia: resumoC6.competencia,
              totalRegistros: resumoC6.totalRegistros,
              totalElegiveis: resumoC6.totalElegiveis,
              pontuacao: resumoC6.pontuacao,
              classificacao: resumoC6.classificacao,
            }
          : null,
        bucal: resumoBucal
          ? {
              competencia: resumoBucal.competencia,
              totalRegistros: resumoBucal.totalRegistros,
              praticas: resumoBucal.praticas,
            }
          : null,
        c7: resumoC7
          ? {
              competencia: resumoC7.competencia,
              totalRegistros: resumoC7.totalRegistros,
              totalElegiveis: resumoC7.totalElegiveis,
              pontuacao: resumoC7.pontuacao,
              pontuacaoParcial: resumoC7.pontuacaoParcial,
              pontosDisponiveis: resumoC7.pontosDisponiveis,
              classificacao: resumoC7.classificacao,
              completo: resumoC7.completo,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Erro na importação do PEC:", error);

    return NextResponse.json(
      {
        sucesso: false,
        mensagem:
          error instanceof Error
            ? error.message
            : "Não foi possível importar o CSV do PEC.",
      },
      { status: 500 }
    );
  }
}
