import { NextResponse } from "next/server";
import {
  FieldPath,
  FieldValue,
  type DocumentReference,
} from "firebase-admin/firestore";

import { adminAuth, adminDb } from "@/lib/firebase-admin";

import {
  analisarCSVPEC,
  classificarOrigemTematica,
  ehFonteC5HipertensaoAtiva,
  identificarPaciente,
  separarDadosBase,
  type LinhaPEC,
} from "@/lib/pec/parser";

import { analisarRelatorioC1 } from "@/lib/indicadores/c1-relatorio";

import { salvarResultadoIndicadorMensal } from "@/lib/indicadores/persistencia-indicadores-mensais";

import {
  atualizarIndicadorCacheDashboard,
  buscarCacheSituacaoPacientes,
  salvarCacheSituacaoPacientes,
} from "@/lib/indicadores/cache-dashboard";

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

import {
  avaliarC7,
  type PraticaC7,
} from "@/lib/indicadores/c7-mulher";

import {
  buscarCacheC7,
  buscarPacientesCacheC7,
  removerPacientesCacheC7,
  salvarCacheC7,
  salvarPacientesCacheC7,
  type CacheC7Paciente,
} from "@/lib/indicadores/cache-c7";

import { avaliarBucal } from "@/lib/indicadores/bucal";

import {
  calcularSituacaoPacientes,
  calcularSituacaoPacientesAfetados,
} from "@/lib/indicadores/situacao-pacientes";
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


function dataMillisC7(valor: unknown): number {
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

function normalizarC7(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function possuiValorC7(valor: unknown): boolean {
  return (
    valor !== undefined &&
    valor !== null &&
    String(valor).trim() !== ""
  );
}
const CAMPOS_ORIGEM_C7 = {
  nome: [
    "Nome",
  ],

  sexo: [
    "Sexo",
  ],

  identidadeGenero: [
    "Identidade de gênero",
    "Identidade genero",
  ],

  dataNascimento: [
    "Data de nascimento",
  ],

  idade: [
    "Idade",
  ],

  coloSolicitacao: [
    "Exame de rastreamento de câncer de colo de útero data última solicitação",
  ],

  coloAvaliacao: [
    "Exame de rastreamento de câncer de colo de útero data última avaliação",
  ],

  hpv: [
    "HPV",
  ],

  consultaSaudeSexual: [
    "Data da última consulta de saúde sexual e reprodutiva",
  ],

  mamaSolicitacao: [
    "Exame de rastreamento de câncer de mama data Última solicitação",
  ],

  mamaRealizacao: [
    "Exame de rastreamento de câncer de mama data Última realização",
  ],

  mamaAvaliacao: [
    "Exame de rastreamento de câncer de mama data Última avaliação",
  ],
} as const;

type OrigemC7 = Partial<
  Record<keyof typeof CAMPOS_ORIGEM_C7, string>
>;

function normalizarChaveC7(valor: string): string {
  return normalizarC7(valor);
}

function encontrarValorC7(
  registro: Record<string, unknown>,
  aliases: readonly string[],
): unknown {
  const entradas = Object.entries(registro);

  for (const alias of aliases) {
    const aliasNormalizado =
      normalizarChaveC7(alias);

    const entrada = entradas.find(
      ([chave]) =>
        normalizarChaveC7(chave) ===
        aliasNormalizado,
    );

    if (
      entrada &&
      possuiValorC7(entrada[1])
    ) {
      return entrada[1];
    }
  }

  return undefined;
}

function juntarRegistroC7(
  registro: Record<string, unknown>,
): Record<string, unknown> {
  const dadosBase =
    registro.dadosBase &&
    typeof registro.dadosBase === "object"
      ? (registro.dadosBase as Record<string, unknown>)
      : {};

  const dadosEspecificos =
    registro.dadosEspecificos &&
    typeof registro.dadosEspecificos === "object"
      ? (registro.dadosEspecificos as Record<string, unknown>)
      : {};

  return {
    ...dadosBase,
    ...dadosEspecificos,
    ...registro,
  };
}

 function consolidarRegistrosC7(
  registros: Array<{
    id: string;
    criadoEm: number;
    importacaoId?: string;
    dados: Record<string, unknown>;
  }>,
): Record<string, unknown>[] {
  const grupos = new Map<
    string,
    Record<string, unknown>
  >();

  const origens = new Map<
    string,
    OrigemC7
  >();

  for (const item of registros) {
    const registro: Record<string, unknown> = {
      ...item.dados,
      id: item.id,
    };

    const cpf = normalizarC7(
      registro.CPF ?? registro.cpf ?? "",
    );

    const cns = normalizarC7(
      registro.CNS ?? registro.cns ?? "",
    );

    const nome = normalizarC7(
      registro.Nome ?? registro.nome ?? "",
    );

    const nascimento = normalizarC7(
      registro["Data de nascimento"] ??
        registro.dataNascimento ??
        "",
    );

    const chave =
      item.id ||
      (cpf ? `cpf:${cpf}` : "") ||
      (cns ? `cns:${cns}` : "") ||
      (nome && nascimento
        ? `nome:${nome}|nasc:${nascimento}`
        : `registro:${nome}`);

    const existente = grupos.get(chave);

    if (!existente) {
      grupos.set(chave, {
        ...registro,
      });

      origens.set(chave, {});

    } else {
      for (const [
        campo,
        valor,
      ] of Object.entries(registro)) {
        if (
          !possuiValorC7(
            existente[campo],
          ) &&
          possuiValorC7(valor)
        ) {
          existente[campo] = valor;
        }
      }
    }

    /*
     * A origem segue a mesma regra da consolidação:
     *
     * o primeiro valor preenchido encontrado,
     * começando pela importação mais nova,
     * passa a ser a origem daquele campo.
     */
    const origemAtual =
      origens.get(chave) ?? {};

    for (const [
      campoOrigem,
      aliases,
    ] of Object.entries(
      CAMPOS_ORIGEM_C7,
    ) as Array<
      [
        keyof typeof CAMPOS_ORIGEM_C7,
        readonly string[],
      ]
    >) {
      if (
        origemAtual[campoOrigem]
      ) {
        continue;
      }

      const valor =
        encontrarValorC7(
          registro,
          aliases,
        );

      if (
        possuiValorC7(valor) &&
        item.importacaoId
      ) {
        origemAtual[campoOrigem] =
          item.importacaoId;
      }
    }

    origens.set(
      chave,
      origemAtual,
    );
  }

  for (const [
    chave,
    registro,
  ] of grupos.entries()) {
    const origem =
      origens.get(chave);

    if (origem) {
      registro.__c7Origem = origem;
    }
  }

  return Array.from(
    grupos.values(),
  );
}

async function calcularC7Consolidado(
  ubsRef: DocumentReference,
): Promise<{
  resultado: ReturnType<typeof avaliarC7>;
  competencia: string;
  quantidadeImportacoesConsideradas: number;
  quantidadeRegistrosConsolidados: number;
  registrosConsolidados: Record<string, unknown>[];
  importacoesPorPaciente: Map<string, string[]>;
} | null> {
  const importacoesSnap = await ubsRef
    .collection("importacoesPEC")
    .orderBy("criadoEm", "desc")
    .limit(50)
    .get();

  if (importacoesSnap.empty) {
    return null;
  }

  const registrosConsolidaveis: Array<{
    id: string;
    criadoEm: number;
    importacaoId: string;
    dados: Record<string, unknown>;
  }> = [];

  let referenciaMillis = 0;

  for (const importacao of importacoesSnap.docs) {
    const importacaoDados = importacao.data();
    const criadoEm = dataMillisC7(importacaoDados.criadoEm);

    if (criadoEm > referenciaMillis) {
      referenciaMillis = criadoEm;
    }

    const registrosSnap = await importacao.ref
      .collection("registros")
      .get();

    for (const registroDoc of registrosSnap.docs) {
      registrosConsolidaveis.push({
        id: registroDoc.id,
        criadoEm,
        importacaoId: importacao.id,
        dados: juntarRegistroC7(registroDoc.data()),
      });
    }
  }

  if (registrosConsolidaveis.length === 0) {
    return null;
  }

  const registros = consolidarRegistrosC7(registrosConsolidaveis);

  const importacoesPorPaciente = new Map<string, Set<string>>();

  for (const item of registrosConsolidaveis) {
    if (!item.importacaoId) continue;

    const atual = importacoesPorPaciente.get(item.id) ?? new Set<string>();
    atual.add(item.importacaoId);
    importacoesPorPaciente.set(item.id, atual);
  }

  const referencia =
    referenciaMillis > 0
      ? new Date(referenciaMillis)
      : new Date();

  const resultado = avaliarC7(registros, referencia);

  return {
    resultado,
    competencia: competenciaC7(referencia),
    quantidadeImportacoesConsideradas: importacoesSnap.docs.length,
    quantidadeRegistrosConsolidados: registros.length,
    registrosConsolidados: registros,
    importacoesPorPaciente: new Map(
      Array.from(importacoesPorPaciente.entries()).map(([id, ids]) => [
        id,
        Array.from(ids),
      ]),
    ),
  };
}

function mesclarRegistroC7(
  anterior: Record<string, unknown>,
  novo: Record<string, unknown>,
  importacaoId?: string,
): Record<string, unknown> {
  const resultado = { ...anterior };

  const origensAnteriores =
    anterior.__c7Origem &&
    typeof anterior.__c7Origem === "object" &&
    !Array.isArray(anterior.__c7Origem)
      ? {
          ...(anterior.__c7Origem as OrigemC7),
        }
      : {};

  for (const [campo, valor] of Object.entries(novo)) {
    if (campo === "__c7Origem") {
      continue;
    }

    if (possuiValorC7(valor)) {
      resultado[campo] = valor;

      /*
       * Se o campo pertence ao conjunto usado pelo C7,
       * a importação atual passa a ser sua origem.
       */
      for (const [
        campoOrigem,
        aliases,
      ] of Object.entries(
        CAMPOS_ORIGEM_C7,
      ) as Array<
        [
          keyof typeof CAMPOS_ORIGEM_C7,
          readonly string[],
        ]
      >) {
        const campoNormalizado =
          normalizarChaveC7(campo);

        const corresponde =
          aliases.some(
            (alias) =>
              normalizarChaveC7(alias) ===
              campoNormalizado,
          );

        if (
          corresponde &&
          importacaoId
        ) {
          origensAnteriores[
            campoOrigem
          ] = importacaoId;

          break;
        }
      }
    }
  }

  resultado.__c7Origem =
    origensAnteriores;

  return resultado;
}

const PESOS_C7 = {
  A: 20,
  B: 30,
  C: 30,
  D: 20,
} as const;

function contribuicaoPacienteC7(avaliacao: any | null) {
  if (!avaliacao || typeof avaliacao !== "object") {
    return {
      elegivel: false,
      praticas: {
        A: { elegivel: false, atingida: false },
        B: { elegivel: false, atingida: false },
        C: { elegivel: false, atingida: false },
        D: { elegivel: false, atingida: false },
      },
    };
  }

  const idade = Number(avaliacao.idade ?? 0);
  const elegivel = idade >= 9 && idade <= 69;

  return {
    elegivel,
    praticas: {
      A: { elegivel: idade >= 25 && idade <= 64, atingida: Boolean(avaliacao.praticas?.A) },
      B: { elegivel: idade >= 9 && idade <= 14, atingida: Boolean(avaliacao.praticas?.B) },
      C: { elegivel: idade >= 14 && idade <= 69, atingida: Boolean(avaliacao.praticas?.C) },
      D: { elegivel: idade >= 50 && idade <= 69, atingida: Boolean(avaliacao.praticas?.D) },
    },
  };
}

function atualizarResumoAgregadoC7(
  resultadoAnterior: Record<string, unknown>,
  alteracoes: Array<{ anterior: any | null; atual: any | null }>,
) {
  const praticasEntrada =
    resultadoAnterior.praticas &&
    typeof resultadoAnterior.praticas === "object"
      ? (resultadoAnterior.praticas as Record<string, any>)
      : {};

  let totalElegiveis = Number(resultadoAnterior.totalElegiveis ?? 0);
  const contadores = {} as Record<"A" | "B" | "C" | "D", { elegiveis: number; atingidos: number }>;

  for (const codigo of ["A", "B", "C", "D"] as const) {
    const pratica = praticasEntrada[codigo] ?? {};
    contadores[codigo] = {
      elegiveis: Number(pratica.elegiveis ?? 0),
      atingidos: Number(pratica.atingidos ?? 0),
    };
  }

  for (const alteracao of alteracoes) {
    const anterior = contribuicaoPacienteC7(alteracao.anterior);
    const atual = contribuicaoPacienteC7(alteracao.atual);

    if (anterior.elegivel) totalElegiveis--;
    if (atual.elegivel) totalElegiveis++;

    for (const codigo of ["A", "B", "C", "D"] as const) {
      if (anterior.praticas[codigo].elegivel) contadores[codigo].elegiveis--;
      if (atual.praticas[codigo].elegivel) contadores[codigo].elegiveis++;
      if (anterior.praticas[codigo].elegivel && anterior.praticas[codigo].atingida) contadores[codigo].atingidos--;
      if (atual.praticas[codigo].elegivel && atual.praticas[codigo].atingida) contadores[codigo].atingidos++;
    }
  }

  totalElegiveis = Math.max(0, totalElegiveis);

  const praticas = {} as Record<"A" | "B" | "C" | "D", PraticaC7>;

  for (const codigo of ["A", "B", "C", "D"] as const) {
    const base = praticasEntrada[codigo] ?? {};
    const { elegiveis, atingidos } = contadores[codigo];
    const disponivel = elegiveis > 0;
    const percentual = disponivel
      ? (atingidos / elegiveis) * 100
      : null;
    const pontos = disponivel
      ? (atingidos / elegiveis) * PESOS_C7[codigo]
      : null;

    praticas[codigo] = {
      ...base,
      codigo,
      peso: PESOS_C7[codigo],
      elegiveis,
      atingidos,
      percentual,
      pontos,
      disponivel,
    } as PraticaC7;
  }

  const praticasDisponiveis = Object.values(praticas).filter((p: any) => p.disponivel);
  const completo = praticasDisponiveis.length === 4;
  const pontuacaoParcial = praticasDisponiveis.reduce(
    (soma: number, pratica: any) => soma + (pratica.pontos ?? 0),
    0,
  );
  const pontosDisponiveis = praticasDisponiveis.reduce(
    (soma: number, pratica: any) => soma + pratica.peso,
    0,
  );

  return {
    ...resultadoAnterior,
    totalElegiveis,
    pontuacao: completo ? pontuacaoParcial : null,
    pontuacaoParcial,
    pontosDisponiveis,
    classificacao: completo
      ? pontuacaoParcial > 75
        ? "Ótimo"
        : pontuacaoParcial > 50
          ? "Bom"
          : pontuacaoParcial > 25
            ? "Suficiente"
            : "Regular"
      : "Indisponível",
    completo,
    praticas,
  };
}


async function atualizarC7ComCache(
  ubsId: string,
  ubsRef: DocumentReference,
  importacaoAtualId: string,
  novaReferencia: Date,
  linhasImportacao: LinhaPEC[],
  pacientesIdsImportacao: string[],
): Promise<{
  resultado: ReturnType<typeof avaliarC7>;
  competencia: string;
  quantidadeImportacoesConsideradas: number;
  quantidadeRegistrosConsolidados: number;
}> {   const inicioC7Detalhado = Date.now();

  const marcarC7 = (etapa: string) => {
    console.log(
      `[C7 DETALHE] ${etapa}: ${Date.now() - inicioC7Detalhado}ms`,
    );
  };
  const cacheAtual = await buscarCacheC7(ubsId);

marcarC7(
  `Cache principal carregado (${cacheAtual ? "existe" : "não existe"})`,
);

const importacoesIdsAtuais = cacheAtual
  ? [
      importacaoAtualId,
      ...cacheAtual.importacoesIds.filter(
        (id) => id !== importacaoAtualId,
      ),
    ].slice(0, 50)
  : [importacaoAtualId];

  

  if (!cacheAtual) {
  const consolidadoInicial = await calcularC7Consolidado(ubsRef);

  if (!consolidadoInicial) {
    throw new Error("Não foi possível consolidar o C7 inicial.");
  }

  const avaliacoesPorId = new Map(
    consolidadoInicial.resultado.pacientes.map((paciente) => [
      String(paciente.id),
      paciente,
    ]),
  );

  const pacientesCache: CacheC7Paciente[] =
    consolidadoInicial.registrosConsolidados.map((registro) => {
      const pacienteId = String(registro.id ?? "").trim();

      return {
        pacienteId,
        dados: registro,
        avaliacao: avaliacoesPorId.get(pacienteId) ?? null,
        importacoesIds:
          consolidadoInicial.importacoesPorPaciente.get(pacienteId) ?? [],
        atualizadoEm: null,
      };
    });

  await salvarPacientesCacheC7(ubsId, pacientesCache);

  const resultadoCache = Object.fromEntries(
    Object.entries({
      ...consolidadoInicial.resultado,
      pacientes: [],
    }).filter(([, valor]) => valor !== undefined),
  );

  await salvarCacheC7(ubsId, {
    competencia: consolidadoInicial.competencia,
    referencia: consolidadoInicial.resultado.referencia,
    importacoesIds: importacoesIdsAtuais,
    quantidadeImportacoesConsideradas:
      consolidadoInicial.quantidadeImportacoesConsideradas,
    quantidadePacientes:
      consolidadoInicial.resultado.pacientes.length,
    resultado: resultadoCache,
  });

  return consolidadoInicial;
}

  const novasImportacoes = importacoesIdsAtuais.filter(
    (id) => !cacheAtual.importacoesIds.includes(id),
  );

  const importacoesRemovidas = cacheAtual.importacoesIds.filter(
    (id) => !importacoesIdsAtuais.includes(id),
  );
  console.log(
  `[C7 JANELA] atuais=${importacoesIdsAtuais.length}, ` +
    `novas=${novasImportacoes.length}, ` +
    `removidas=${importacoesRemovidas.length}`,
);

  if (novasImportacoes.length === 0 && importacoesRemovidas.length === 0) {
    const resultadoCache = {
      ...(cacheAtual.resultado as ReturnType<typeof avaliarC7>),
      pacientes: [],
    };

    return {
      resultado: resultadoCache,
      competencia: cacheAtual.competencia ?? competenciaC7(new Date()),
      quantidadeImportacoesConsideradas:
        cacheAtual.quantidadeImportacoesConsideradas,
      quantidadeRegistrosConsolidados: cacheAtual.quantidadePacientes,
    };
  }

  

  const novosRegistrosPorPaciente = new Map<
    string,
    Record<string, unknown>
  >();

  for (const linha of linhasImportacao) {
    const pacienteId = identificarPaciente(linha);
    const { base, especificos } = separarDadosBase(linha);

    novosRegistrosPorPaciente.set(pacienteId, {
      ...base,
      ...especificos,
      ...linha,
      dadosBase: base,
      dadosEspecificos: especificos,
      id: pacienteId,
    });
  }

  const idsAfetados = new Set(pacientesIdsImportacao);

const cachePacientes = new Map<string, CacheC7Paciente>();

if (importacoesRemovidas.length > 0) {
  const pacientesRef = ubsRef
    .collection("cacheC7")
    .doc("atual")
    .collection("pacientes");

  for (const importacaoId of importacoesRemovidas) {
    const snapshot = await pacientesRef
      .where("importacoesIds", "array-contains", importacaoId)
      .get();

    for (const documento of snapshot.docs) {
      const dados = documento.data();

      idsAfetados.add(documento.id);

      cachePacientes.set(documento.id, {
        pacienteId: documento.id,
        dados:
          dados.dados &&
          typeof dados.dados === "object" &&
          !Array.isArray(dados.dados)
            ? (dados.dados as Record<string, unknown>)
            : {},
        avaliacao:
          dados.avaliacao &&
          typeof dados.avaliacao === "object"
            ? dados.avaliacao
            : null,
        importacoesIds: Array.isArray(dados.importacoesIds)
          ? dados.importacoesIds.filter(
              (id): id is string =>
                typeof id === "string",
            )
          : [],
        atualizadoEm: null,
      });
    }
  }
}

const idsAfetadosArray = Array.from(idsAfetados);

const idsCacheAindaNecessarios =
  idsAfetadosArray.filter(
    (pacienteId) =>
      !cachePacientes.has(pacienteId),
  );

if (idsCacheAindaNecessarios.length > 0) {
  const cacheRestante =
    await buscarPacientesCacheC7(
      ubsId,
      idsCacheAindaNecessarios,
    );

  for (const [
    pacienteId,
    paciente,
  ] of cacheRestante) {
    cachePacientes.set(
      pacienteId,
      paciente,
    );
  }
}

marcarC7(
  `Pacientes do cache carregados (${cachePacientes.size} documentos de ${idsAfetadosArray.length} afetados)`,
);

  const pacientesAtualizados: CacheC7Paciente[] = [];
  const alteracoes: Array<{ anterior: any | null; atual: any | null }> = [];

  if (importacoesRemovidas.length === 0) {
    for (const pacienteId of idsAfetadosArray) {
      const cachePaciente = cachePacientes.get(pacienteId);
      const novoRegistro = novosRegistrosPorPaciente.get(pacienteId);

      if (!novoRegistro) continue;

      const dadosAnteriores = cachePaciente?.dados ?? {};
      const dadosNovos = mesclarRegistroC7(
        dadosAnteriores,
        novoRegistro,
         importacaoAtualId,
      );

      const avaliacaoAnterior = cachePaciente?.avaliacao ?? null;
      const avaliacaoNova = avaliarC7(
        [dadosNovos],
        novaReferencia,
      ).pacientes[0] ?? null;

      const importacoesPaciente = Array.from(
        new Set([
          ...(cachePaciente?.importacoesIds ?? []),
          ...novasImportacoes,
        ]),
      ).filter((id) => importacoesIdsAtuais.includes(id));

      pacientesAtualizados.push({
        pacienteId,
        dados: dadosNovos,
        avaliacao: avaliacaoNova,
        importacoesIds: importacoesPaciente,
        atualizadoEm: null,
      });

      alteracoes.push({
        anterior: avaliacaoAnterior,
        atual: avaliacaoNova,
      });
    }
} else {
  /*
   * Quando uma importação sai da janela das 50,
   * somente os pacientes que realmente possuíam
   * aquela importação no histórico precisam ser
   * reconstruídos.
   *
   * Os demais pacientes afetados pertencem apenas
   * à importação nova e podem seguir o caminho
   * incremental normal, sem reler o histórico.
   */

  const importacoesRemovidasSet =
    new Set(importacoesRemovidas);

  const pacientesQuePrecisamReconstituicao =
    new Set<string>();

  const pacientesAtualizacaoSimples =
    new Set<string>();

  for (const pacienteId of idsAfetadosArray) {
  const cachePaciente =
    cachePacientes.get(pacienteId);

  const importacoesPaciente =
    cachePaciente?.importacoesIds ?? [];

  const possuiImportacaoRemovida =
    importacoesPaciente.some(
      (id) =>
        importacoesRemovidasSet.has(id),
    );

  /*
   * Se o paciente não possui nenhuma das
   * importações removidas, não existe motivo
   * para reconstruir o histórico.
   */
  if (!possuiImportacaoRemovida) {
    pacientesAtualizacaoSimples.add(
      pacienteId,
    );

    continue;
  }

  /*
   * Pacientes de cache antigo ainda não possuem
   * a informação de origem dos campos C7.
   *
   * Nesse caso mantemos o comportamento anterior
   * por segurança e reconstruímos o histórico.
   */
  const origensC7 =
    cachePaciente?.dados?.__c7Origem;

  if (
    !origensC7 ||
    typeof origensC7 !== "object" ||
    Array.isArray(origensC7)
  ) {
    pacientesQuePrecisamReconstituicao.add(
      pacienteId,
    );

    continue;
  }

  /*
   * Verifica se alguma informação relevante
   * para o C7 veio de uma importação que está
   * sendo removida da janela das 50.
   */
  const algumaOrigemRemovida =
    Object.values(
      origensC7 as Record<string, unknown>,
    ).some(
      (importacaoId) =>
        typeof importacaoId === "string" &&
        importacoesRemovidasSet.has(
          importacaoId,
        ),
    );

  if (algumaOrigemRemovida) {
    /*
     * Pelo menos um campo relevante do C7
     * dependia da importação removida.
     *
     * Precisamos reconstruir o paciente.
     */
    pacientesQuePrecisamReconstituicao.add(
      pacienteId,
    );
  } else {
    /*
     * A importação removida fazia parte do
     * histórico do paciente, mas nenhum campo
     * relevante atualmente consolidado veio dela.
     *
     * Portanto podemos continuar usando o cache
     * sem reler o histórico.
     */
    pacientesAtualizacaoSimples.add(
      pacienteId,
    );
  }
}

  /*
   * --------------------------------------------------
   * 1. PACIENTES QUE NÃO DEPENDEM DA IMPORTAÇÃO REMOVIDA
   * --------------------------------------------------
   *
   * Para esses pacientes, usamos o cache atual +
   * os dados da importação nova.
   *
   * Nenhuma leitura histórica adicional.
   */
for (
  const pacienteId of
    pacientesAtualizacaoSimples
) {
  const cachePaciente =
    cachePacientes.get(
      pacienteId,
    );

  const novoRegistro =
    novosRegistrosPorPaciente.get(
      pacienteId,
    );

  const dadosAnteriores =
    cachePaciente?.dados ?? {};

  /*
   * Se existe uma importação nova para este
   * paciente, ela é incorporada ao cache.
   *
   * Se não existe, mantemos exatamente os
   * dados já consolidados, sem nenhuma
   * leitura histórica.
   */
  const dadosNovos =
    novoRegistro
      ? mesclarRegistroC7(
          dadosAnteriores,
          novoRegistro,
          importacaoAtualId,
        )
      : dadosAnteriores;

  const avaliacaoAnterior =
    cachePaciente?.avaliacao ??
    null;

  /*
   * Mesmo sem novos dados, precisamos
   * recalcular a avaliação porque a referência
   * do C7 mudou.
   */
  const avaliacaoNova =
    avaliarC7(
      [dadosNovos],
      novaReferencia,
    ).pacientes[0] ??
    null;

  /*
   * Mantém somente as importações que ainda
   * fazem parte da janela atual das 50.
   *
   * A importação removida é retirada sem
   * necessidade de consultar o histórico.
   */
  const importacoesPaciente =
    Array.from(
      new Set([
        ...(cachePaciente?.importacoesIds ??
          []),
        ...novasImportacoes,
      ]),
    ).filter((id) =>
      importacoesIdsAtuais.includes(
        id,
      ),
    );

  pacientesAtualizados.push({
    pacienteId,
    dados: dadosNovos,
    avaliacao:
      avaliacaoNova,
    importacoesIds:
      importacoesPaciente,
    atualizadoEm: null,
  });

  alteracoes.push({
    anterior:
      avaliacaoAnterior,
    atual:
      avaliacaoNova,
  });
}

  /*
   * --------------------------------------------------
   * 2. PACIENTES QUE REALMENTE DEPENDEM DA IMPORTAÇÃO
   *    REMOVIDA
   * --------------------------------------------------
   */
  const registrosHistoricosPorPaciente =
    new Map<
      string,
      Array<{
        id: string;
        criadoEm: number;
        importacaoId: string;
        dados: Record<string, unknown>;
      }>
    >();

  const importacoesHistoricasIds =
    new Set<string>();

  /*
   * A importação atual já está em memória.
   */
  for (
    const pacienteId of
      pacientesQuePrecisamReconstituicao
  ) {
    const novoRegistro =
      novosRegistrosPorPaciente.get(
        pacienteId,
      );

    if (!novoRegistro) {
      continue;
    }

    const registros =
      registrosHistoricosPorPaciente.get(
        pacienteId,
      ) ?? [];

    registros.push({
      id: pacienteId,
      criadoEm:
        novaReferencia.getTime(),
      importacaoId:
        importacaoAtualId,
      dados:
        novoRegistro,
    });

    registrosHistoricosPorPaciente.set(
      pacienteId,
      registros,
    );

    importacoesHistoricasIds.add(
      importacaoAtualId,
    );
  }

  /*
   * Descobrimos somente as importações que os
   * pacientes realmente reconstruídos possuem
   * no cache.
   */
  const importacoesHistoricasNecessarias =
  new Set<string>();

for (
  const pacienteId of
    pacientesQuePrecisamReconstituicao
) {
  const cachePaciente =
    cachePacientes.get(
      pacienteId,
    );

  /*
   * Para pacientes que já possuem __c7Origem,
   * só precisamos consultar as importações que
   * realmente fornecem algum campo utilizado
   * pelo C7.
   */
  const origensC7 =
    cachePaciente?.dados?.__c7Origem;

  if (
    origensC7 &&
    typeof origensC7 === "object" &&
    !Array.isArray(origensC7)
  ) {
    for (const importacaoId of Object.values(
      origensC7 as Record<string, unknown>,
    )) {
      if (
        typeof importacaoId !== "string" ||
        !importacaoId ||
        importacaoId === importacaoAtualId
      ) {
        continue;
      }

      if (
        importacoesIdsAtuais.includes(
          importacaoId,
        )
      ) {
        importacoesHistoricasNecessarias.add(
          importacaoId,
        );
      }
    }

    continue;
  }

  /*
   * Cache antigo sem __c7Origem:
   * mantemos o comportamento anterior para
   * não correr risco de perder dados.
   */
  for (
    const importacaoId of
      cachePaciente?.importacoesIds ??
      []
  ) {
    if (
      importacaoId !==
        importacaoAtualId &&
      importacoesIdsAtuais.includes(
        importacaoId,
      )
    ) {
      importacoesHistoricasNecessarias.add(
        importacaoId,
      );
    }
  }
}

  /*
   * Lê somente o histórico necessário para os
   * pacientes que realmente perderam uma importação.
   */
   /*
   * Lê somente o histórico dos pacientes que
   * realmente possuem cada importação necessária.
   *
   * Antes, cada importação era consultada contra
   * todos os pacientes que precisavam de reconstrução.
   *
   * Agora usamos importacoesIds do cache para descobrir
   * exatamente quais pacientes precisam ser procurados
   * naquela importação.
   */
  for (
    const importacaoId of
      importacoesHistoricasNecessarias
  ) {
    const pacientesDaImportacao: string[] = [];

    for (
      const pacienteId of
        pacientesQuePrecisamReconstituicao
    ) {
      const cachePaciente =
        cachePacientes.get(
          pacienteId,
        );

      const origensC7 =
  cachePaciente?.dados?.__c7Origem;

if (
  origensC7 &&
  typeof origensC7 === "object" &&
  !Array.isArray(origensC7)
) {
  const possuiOrigemNestaImportacao =
    Object.values(
      origensC7 as Record<string, unknown>,
    ).some(
      (origem) =>
        origem === importacaoId,
    );

  if (possuiOrigemNestaImportacao) {
    pacientesDaImportacao.push(
      pacienteId,
    );
  }
} else if (
  cachePaciente?.importacoesIds?.includes(
    importacaoId,
  )
) {
  /*
   * Cache antigo sem __c7Origem:
   * mantém o comportamento anterior
   * por segurança.
   */
  pacientesDaImportacao.push(
    pacienteId,
  );
}
    }

    if (
      pacientesDaImportacao.length === 0
    ) {
      continue;
    }

    for (
      let inicio = 0;
      inicio <
        pacientesDaImportacao.length;
      inicio += 30
    ) {
      const blocoIds =
        pacientesDaImportacao.slice(
          inicio,
          inicio + 30,
        );

      if (
        blocoIds.length === 0
      ) {
        continue;
      }

      const snapshot =
        await ubsRef
          .collection(
            "importacoesPEC",
          )
          .doc(importacaoId)
          .collection(
            "registros",
          )
          .where(
            "pacienteId",
            "in",
            blocoIds,
          )
          .get();

      if (
        snapshot.empty
      ) {
        continue;
      }

      importacoesHistoricasIds.add(
        importacaoId,
      );

      for (
        const documento of
          snapshot.docs
      ) {
        const pacienteId =
          documento.id;

        const dados =
          juntarRegistroC7(
            documento.data(),
          );

        const registros =
          registrosHistoricosPorPaciente.get(
            pacienteId,
          ) ?? [];

        registros.push({
          id: pacienteId,
          criadoEm: 0,
          importacaoId,
          dados,
        });

        registrosHistoricosPorPaciente.set(
          pacienteId,
          registros,
        );
      }

      console.log(
        `[C7 RECONSTRUÇÃO] ` +
          `importacao=${importacaoId}, ` +
          `pacientes=${blocoIds.length}, ` +
          `registrosLidos=${snapshot.size}`,
      );
    }
  }

  /*
   * A importação atual já possui sua referência.
   * Para as demais, usamos a posição na janela
   * cronológica, evitando leituras extras.
   */
  const criadoEmPorImportacao =
    new Map<string, number>();

  for (
    const importacaoId of
      importacoesHistoricasIds
  ) {
    if (
      importacaoId ===
      importacaoAtualId
    ) {
      criadoEmPorImportacao.set(
        importacaoId,
        novaReferencia.getTime(),
      );

      continue;
    }

    const indice =
      importacoesIdsAtuais.indexOf(
        importacaoId,
      );

    if (indice < 0) {
      continue;
    }

    criadoEmPorImportacao.set(
      importacaoId,
      -indice,
    );
  }

  /*
   * Preenche a referência cronológica.
   */
  for (
    const registros of
      registrosHistoricosPorPaciente.values()
  ) {
    for (
      const registro of
        registros
    ) {
      registro.criadoEm =
        criadoEmPorImportacao.get(
          registro.importacaoId,
        ) ??
        registro.criadoEm;
    }
  }

  /*
   * Reconstrói somente os pacientes que realmente
   * dependiam da importação removida.
   */
  for (
    const pacienteId of
      pacientesQuePrecisamReconstituicao
  ) {
    const cachePaciente =
      cachePacientes.get(
        pacienteId,
      );

    const registros =
      registrosHistoricosPorPaciente.get(
        pacienteId,
      ) ?? [];

    registros.sort(
      (a, b) =>
        b.criadoEm -
        a.criadoEm,
    );

    const dadosConsolidados =
      consolidarRegistrosC7(
        registros,
      )[0] ??
      null;

    const avaliacaoAnterior =
      cachePaciente?.avaliacao ??
      null;

    const avaliacaoNova =
      dadosConsolidados
        ? avaliarC7(
            [dadosConsolidados],
            novaReferencia,
          ).pacientes[0] ??
          null
        : null;

    const importacoesFinais =
      Array.from(
        new Set(
          registros
            .map(
              (registro) =>
                registro.importacaoId,
            )
            .filter((id) =>
              importacoesIdsAtuais.includes(
                id,
              ),
            ),
        ),
      );

    if (dadosConsolidados) {
      pacientesAtualizados.push({
        pacienteId,
        dados:
          dadosConsolidados,
        avaliacao:
          avaliacaoNova,
        importacoesIds:
          importacoesFinais,
        atualizadoEm:
          null,
      });
    }

    alteracoes.push({
      anterior:
        avaliacaoAnterior,
      atual:
        avaliacaoNova,
    });
  }
}
    marcarC7(
    `Pacientes recalculados (${pacientesAtualizados.length})`,
  );

  const resultadoAnterior = cacheAtual.resultado ?? {};
  const resultadoAtualizado = atualizarResumoAgregadoC7(
    resultadoAnterior,
    alteracoes,
  );
    marcarC7("Agregado C7 recalculado");
  const resultadoParaCache = Object.fromEntries(
  Object.entries({
    sucesso: true,
    ...resultadoAtualizado,
    referencia: novaReferencia.toISOString(),
    pacientes: [],
  }).filter(([, valor]) => valor !== undefined),
);

  const idsParaRemover = new Set<string>();
  for (const paciente of pacientesAtualizados) {
    if (paciente.avaliacao === null && paciente.dados) {
      continue;
    }
  }

  const idsExistentes = new Set(pacientesAtualizados.map((item) => item.pacienteId));
  for (const id of idsAfetadosArray) {
    if (importacoesRemovidas.length > 0 && !idsExistentes.has(id)) {
      idsParaRemover.add(id);
    }
  }

  if (idsParaRemover.size > 0) {
    await removerPacientesCacheC7(ubsId, Array.from(idsParaRemover));
  }

  await salvarPacientesCacheC7(ubsId, pacientesAtualizados);
    marcarC7(
    `Cache dos pacientes salvo (${pacientesAtualizados.length} documentos)`,
  );

  const competencia = competenciaC7(novaReferencia);

await salvarCacheC7(ubsId, {
  competencia,
  referencia: novaReferencia.toISOString(),
  importacoesIds: importacoesIdsAtuais,
  quantidadeImportacoesConsideradas: importacoesIdsAtuais.length,
  quantidadePacientes: Number(resultadoAtualizado.totalElegiveis ?? 0),
  resultado: resultadoParaCache,
});
  marcarC7("Cache principal salvo");
return {
  resultado: {
    sucesso: true,
    ...resultadoAtualizado,
    referencia: novaReferencia.toISOString(),
    pacientes: [],
  } as ReturnType<typeof avaliarC7>,
  competencia,
  quantidadeImportacoesConsideradas: importacoesIdsAtuais.length,
  quantidadeRegistrosConsolidados: Number(
    resultadoAtualizado.totalElegiveis ?? 0,
  ),
};
}


function idadeEmAnosC6(valor: unknown): number {
  const texto = String(valor ?? "").trim().toLowerCase();
  const match = texto.match(/\d+/);

  if (!match) return 0;

  return Number(match[0]) || 0;
}

type PacienteC6Importacao = ReturnType<typeof avaliarC6> & {
  id: string;
};


export async function POST(request: Request) {
  try {

    const inicioPerformance = Date.now();

    const leiturasFirestore = {
  usuario: 0,
  ubs: 0,
  pacientesExistentes: 0,
};

const registrarLeitura = (
  origem: keyof typeof leiturasFirestore,
  quantidade: number,
) => {
  leiturasFirestore[origem] += quantidade;

  console.log(
    `[LEITURAS ROTA] ${origem}: +${quantidade} | total=${leiturasFirestore[origem]}`,
  );
};

const marcarPerformance = (etapa: string) => {
  console.log(
    `[PERFORMANCE] ${etapa}: ${Date.now() - inicioPerformance}ms`,
  );
};
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
      registrarLeitura(
  "usuario",
  usuarioSnap.exists ? 1 : 0,
);

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

    marcarPerformance("CSV analisado");

    const ubsId = usuario.ubsId;
    const ubsRef = adminDb.collection("ubs").doc(ubsId);
    const ubsSnap = await ubsRef.get();
    registrarLeitura(
  "ubs",
  ubsSnap.exists ? 1 : 0,
);

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
   const ehFonteC2 = codigoIndicadorOrigem === "C2";

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
      pacientes: Array<
        ResultadoC2Infantil & {
          id: string;
          nome: string;
          cpf: string;
          microarea: string;
          idade: string;
        }
      >;
    } | null = null;

    const ehFonteC3 = codigoIndicadorOrigem === "C3";

    const ehFonteC4 = codigoIndicadorOrigem === "C4";

    const filtroC4 = normalizarTextoC1(resultado.filtroProblemas);

    const ehFonteC4Diabetes =
      ehFonteC4 && filtroC4.includes("somente problemas ativos");

    const ehFonteC6 = codigoIndicadorOrigem === "C6";

    const ehFonteC7 = codigoIndicadorOrigem === "C7";

    const ehFonteBucal =
  String(resultado.listaTematica ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .includes("saude bucal");

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
          nome: string;
          cpf: string;
          microarea: string;
          idade: string;
        }
      > = resultado.linhas.map((registro) => {
        /*
         * Os campos de identificação vêm diretamente da linha original
         * do CSV. Isso evita que uma separação/mapeamento dos campos base
         * deixe nome, CPF, microárea ou idade vazios na tela do C2.
         *
         * O cálculo do C2 continua recebendo o registro original.
         */

        const { base } = separarDadosBase(registro);

        return {
          id: identificarPaciente(registro),
          nome: String(base.Nome ?? ""),
          cpf: String(base.CPF ?? ""),
          microarea: normalizarMicroarea(base.Microárea || ""),
          idade: String(base.Idade ?? ""),
          ...avaliarC2Infantil(registro, {
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
        pacientes: avaliadosC2,
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

/*
 * Carrega previamente os pacientes que já existem na UBS.
 *
 * O Firestore permite no máximo 30 valores em uma consulta
 * "in" por vez. Por isso dividimos os IDs em blocos de 30.
 *
 * Assim evitamos fazer um .get() individual para cada linha
 * do CSV durante o processamento.
 */
const pacientesIdsImportacao = Array.from(
  new Set(
    resultado.linhas.map((registro) =>
      identificarPaciente(registro),
    ),
  ),
);

const pacientesExistentes = new Map<
  string,
  FirebaseFirestore.DocumentSnapshot
>();

const pacientesCollection = ubsRef.collection("pacientes");

for (
  let inicio = 0;
  inicio < pacientesIdsImportacao.length;
  inicio += 30
) {
  const blocoIds = pacientesIdsImportacao.slice(
    inicio,
    inicio + 30,
  );

  if (blocoIds.length === 0) continue;

  const pacientesSnap = await pacientesCollection
    .where(FieldPath.documentId(), "in", blocoIds)
    .get();
registrarLeitura(
  "pacientesExistentes",
  pacientesSnap.size,
);
  for (const pacienteDoc of pacientesSnap.docs) {
    pacientesExistentes.set(
      pacienteDoc.id,
      pacienteDoc,
    );
  }
}

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
  const pacienteSnap = pacientesExistentes.get(pacienteId);
  const pacienteExiste = Boolean(pacienteSnap?.exists);

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

      if (!pacienteExiste) {
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
        importacaoId: importacaoRef.id,
        novoNaImportacao: !pacienteExiste,
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

    marcarPerformance("Pacientes e registros gravados");

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
          pacientes: resumoC2.pacientes,
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
    }

    /*
     * O card C7 do Dashboard precisa usar a mesma base consolidada
     * da tela detalhada do C7.
     *
     * Isso é importante porque pacientes de 9–14 anos podem aparecer
     * em outros relatórios do PEC (por exemplo, lista temática Geral),
     * e não somente no arquivo Saúde da Mulher.
     *
     * O resultado mensal acima continua representando o arquivo C7
     * que foi importado. Já o cache do Dashboard representa a visão
     * consolidada das importações PEC, mantendo Dashboard e tela C7
     * com a mesma fotografia dos pacientes.
     */
    const c7Consolidado = await atualizarC7ComCache(
      ubsId,
  ubsRef,
  importacaoRef.id,
  new Date(),
  resultado.linhas,
  pacientesIdsImportacao,
    );

    if (c7Consolidado) {
  const resultadoC7Consolidado =
    c7Consolidado.resultado;

  console.log(
    "[C7 DASHBOARD] Valores enviados para o cache:",
    {
      competencia:
        c7Consolidado.competencia,
      totalElegiveis:
        resultadoC7Consolidado.totalElegiveis ?? 0,
      pontuacao:
        resultadoC7Consolidado.pontuacao ?? null,
      pontuacaoParcial:
        resultadoC7Consolidado.pontuacaoParcial ?? 0,
      pontosDisponiveis:
        resultadoC7Consolidado.pontosDisponiveis ?? 0,
      classificacao:
        resultadoC7Consolidado.classificacao ??
        "Indisponível",
    },
  );

  const versaoDashboard =
    await atualizarIndicadorCacheDashboard(
      ubsId,
      "c7",
      {
        competencia:
          c7Consolidado.competencia,

        totalRegistros:
          c7Consolidado
            .quantidadeRegistrosConsolidados,

        totalElegiveis:
          resultadoC7Consolidado
            .totalElegiveis ?? 0,

        pontuacao:
          resultadoC7Consolidado
            .pontuacao ?? null,

        pontuacaoParcial:
          resultadoC7Consolidado
            .pontuacaoParcial ?? 0,

        pontosDisponiveis:
          resultadoC7Consolidado
            .pontosDisponiveis ?? 0,

        classificacao:
          resultadoC7Consolidado
            .classificacao ??
          "Indisponível",

        completo:
          resultadoC7Consolidado
            .completo === true,

        motivoIncompleto:
          resultadoC7Consolidado
            .motivoIncompleto ?? null,

        praticas:
          resultadoC7Consolidado
            .praticas ?? {},
      },
      c7Consolidado.competencia,
    );

  console.log(
    "[C7 DASHBOARD] Cache atualizado:",
    {
      versaoDashboard,
      totalElegiveis:
        resultadoC7Consolidado
          .totalElegiveis ?? 0,
      pontuacao:
        resultadoC7Consolidado
          .pontuacao ?? null,
    },
  );
}
     marcarPerformance("C7 consolidado concluído");

        const cacheSituacao =
  await buscarCacheSituacaoPacientes(ubsId);

const dadosCache =
  cacheSituacao?.dados &&
  typeof cacheSituacao.dados === "object"
    ? cacheSituacao.dados
    : null;

const pacientesCache = Array.isArray(
  dadosCache?.pacientes,
)
  ? [...dadosCache.pacientes]
  : [];

const categoriasCache =
  dadosCache?._categoriasPorPaciente &&
  typeof dadosCache._categoriasPorPaciente === "object"
    ? {
        ...(dadosCache._categoriasPorPaciente as Record<
          string,
          string
        >),
      }
    : null;

/*
 * Se o cache ainda não possui as categorias internas,
 * fazemos um cálculo completo uma única vez.
 *
 * Isso prepara o cache antigo para as próximas importações
 * incrementais.
 */
if (!dadosCache || !categoriasCache) {
  console.log("[DEBUG SITUAÇÃO] ENTROU NO CÁLCULO COMPLETO");
  const situacaoPacientes =
    await calcularSituacaoPacientes(ubsId);

  await salvarCacheSituacaoPacientes(
    ubsId,
    situacaoPacientes,
  );
  
} else {
  /*
   * O cache já está preparado.
   * Recalculamos somente os pacientes envolvidos
   * nesta importação.
   */
  const avaliacoesAfetadas =
    await calcularSituacaoPacientesAfetados(
      ubsId,
      pacientesIdsImportacao,
    );

  const pacientesPorId = new Map(
    pacientesCache.map((paciente: any) => [
      String(paciente.id),
      paciente,
    ]),
  );

  const categoriasPorPaciente = {
    ...categoriasCache,
  };

  let semNenhumRegistro =
    Number(dadosCache.semNenhumRegistro ?? 0);

  let comIndicadoresPendentes =
    Number(dadosCache.comIndicadoresPendentes ?? 0);

  let comIndicadoresConcluidos =
    Number(dadosCache.comIndicadoresConcluidos ?? 0);

  let comRegistroSemIndicadorAplicavel =
    Number(
      dadosCache.comRegistroSemIndicadorAplicavel ?? 0,
    );

  const removerCategoria = (
    categoria: string | undefined,
  ) => {
    switch (categoria) {
      case "sem_nenhum_registro":
        semNenhumRegistro--;
        break;

      case "indicadores_pendentes":
        comIndicadoresPendentes--;
        break;

      case "indicadores_concluidos":
        comIndicadoresConcluidos--;
        break;

      case "registro_sem_indicador_aplicavel":
        comRegistroSemIndicadorAplicavel--;
        break;
    }
  };

  const adicionarCategoria = (
    categoria: string,
  ) => {
    switch (categoria) {
      case "sem_nenhum_registro":
        semNenhumRegistro++;
        break;

      case "indicadores_pendentes":
        comIndicadoresPendentes++;
        break;

      case "indicadores_concluidos":
        comIndicadoresConcluidos++;
        break;

      case "registro_sem_indicador_aplicavel":
        comRegistroSemIndicadorAplicavel++;
        break;
    }
  };

  for (const avaliacao of avaliacoesAfetadas) {
    const pacienteId = String(
      avaliacao.situacao.id,
    );

    const categoriaAnterior =
      categoriasPorPaciente[pacienteId];

    if (categoriaAnterior) {
      removerCategoria(categoriaAnterior);
    } else {
      /*
       * Paciente novo: ainda não fazia parte
       * dos contadores anteriores.
       */
    }

    pacientesPorId.set(
      pacienteId,
      avaliacao.situacao,
    );

    categoriasPorPaciente[pacienteId] =
      avaliacao.categoria;

    adicionarCategoria(
      avaliacao.categoria,
    );
  }

  const pacientesAtualizados =
    Array.from(pacientesPorId.values());

  const totalPacientes =
    pacientesAtualizados.length;

  const totalClassificado =
    semNenhumRegistro +
    comIndicadoresPendentes +
    comIndicadoresConcluidos +
    comRegistroSemIndicadorAplicavel;

  const indicadoresConcluidosPercentual =
    totalPacientes > 0
      ? Number(
          (
            (comIndicadoresConcluidos /
              totalPacientes) *
            100
          ).toFixed(1),
        )
      : 0;

  await salvarCacheSituacaoPacientes(
    ubsId,
    {
      totalPacientes,
      semNenhumRegistro,
      comIndicadoresPendentes,
      comIndicadoresConcluidos,
      comRegistroSemIndicadorAplicavel,
      indicadoresConcluidosPercentual,
      totalClassificado,
      pacientes: pacientesAtualizados,
      _categoriasPorPaciente:
        categoriasPorPaciente,
    },
  ); marcarPerformance("Situação dos pacientes concluída");
}
marcarPerformance("IMPORTAÇÃO TOTAL");
  console.log(
  `[LEITURAS ROTA] TOTAL DIRETO: ${Object.values(leiturasFirestore).reduce(
    (total, quantidade) => total + quantidade,
    0,
  )}`,
);

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
