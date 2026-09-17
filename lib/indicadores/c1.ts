/**
 * Motor do indicador C1 — Mais Acesso à APS.
 *
 * Metodologia oficial do Ministério da Saúde:
 * numerador = atendimentos de demanda programada;
 * denominador = atendimentos de demanda programada + espontânea.
 *
 * Importante:
 * - O cálculo oficial usa o Modelo de Informação de Atendimento Individual.
 * - Só contamos registros que tenham tipo de demanda explicitamente informado.
 * - Também exigimos um CBO profissional compatível com a nota metodológica.
 * - Relatórios temáticos de pacientes, que possuem apenas "último atendimento",
 *   não são transformados artificialmente em C1.
 */

export type ClassificacaoC1 =
  | "Ótimo"
  | "Bom"
  | "Suficiente"
  | "Regular"
  | "Indisponível";

export type TipoDemandaC1 =
  | "programada"
  | "espontanea"
  | "desconhecida";

export interface RegistroC1 {
  dados?: Record<string, unknown>;
  dadosBase?: Record<string, unknown>;
  dadosEspecificos?: Record<string, unknown>;
}

export interface ResultadoC1 {
  possuiDados: boolean;
  pontuacao: number | null;
  classificacao: ClassificacaoC1;
  atendimentosProgramados: number;
  atendimentosEspontaneos: number;
  totalAtendimentos: number;
  percentualProgramado: number | null;
  registrosIgnoradosSemTipoDemanda: number;
  registrosIgnoradosSemCboValido: number;
}

const CBOS_C1 = new Set([
  "2251-42",
  "2251-70",
  "2251-30",
  "2251-25",
  "2252-50",
  "2235-65",
  "2235-05",
]);

const TIPOS_PROGRAMADOS = [
  "consulta agendada programada",
  "cuidado continuado",
  "consulta agendada",
];

const TIPOS_ESPONTANEOS = [
  "escuta inicial",
  "escuta inicial orientacao",
  "escuta inicial/orientacao",
  "consulta no dia",
  "atendimento de urgencia",
  "atendimento de urgência",
];

function normalizar(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function textoPreenchido(valor: unknown): boolean {
  return normalizar(valor) !== "" && normalizar(valor) !== "-";
}

function encontrarValor(
  registro: Record<string, unknown>,
  nomesCampo: string[],
): unknown {
  const entradas = Object.entries(registro);

  for (const nome of nomesCampo) {
    const alvo = normalizar(nome);

    const encontrado = entradas.find(([chave]) => {
      const normalizada = normalizar(chave);
      return normalizada === alvo || normalizada.includes(alvo);
    });

    if (encontrado && textoPreenchido(encontrado[1])) {
      return encontrado[1];
    }
  }

  return undefined;
}

function classificarDemanda(valor: unknown): TipoDemandaC1 {
  const texto = normalizar(valor);

  if (!texto) return "desconhecida";

  if (
    TIPOS_PROGRAMADOS.some((tipo) => {
      const alvo = normalizar(tipo);
      return texto === alvo || texto.includes(alvo);
    })
  ) {
    return "programada";
  }

  if (
    TIPOS_ESPONTANEOS.some((tipo) => {
      const alvo = normalizar(tipo);
      return texto === alvo || texto.includes(alvo);
    })
  ) {
    return "espontanea";
  }

  return "desconhecida";
}

function cboValido(valor: unknown): boolean {
  const texto = String(valor ?? "").trim();

  if (!texto) return false;

  // Alguns relatórios podem trazer mais de um código no mesmo campo.
  return texto
    .split(/[;,|/]+/)
    .map((item) => item.trim())
    .some((item) => CBOS_C1.has(item));
}

export function classificarC1(percentual: number): Exclude<ClassificacaoC1, "Indisponível"> {
  if (percentual > 50 && percentual <= 70) return "Ótimo";
  if (percentual > 30 && percentual <= 50) return "Bom";
  if (percentual > 10 && percentual <= 30) return "Suficiente";
  return "Regular";
}

export function avaliarC1(registros: RegistroC1[]): ResultadoC1 {
  let atendimentosProgramados = 0;
  let atendimentosEspontaneos = 0;
  let registrosIgnoradosSemTipoDemanda = 0;
  let registrosIgnoradosSemCboValido = 0;

  for (const registro of registros) {
    const dados = {
      ...(registro.dadosBase ?? {}),
      ...(registro.dadosEspecificos ?? {}),
      ...(registro.dados ?? {}),
    };

    const cbo = encontrarValor(dados, [
      "CBO",
      "CBO profissional",
      "CBO do profissional",
      "Código CBO",
    ]);

    if (!cboValido(cbo)) {
      registrosIgnoradosSemCboValido++;
      continue;
    }

    const tipoDemanda = encontrarValor(dados, [
      "Tipo de atendimento",
      "Tipo de Atendimento",
      "Tipo de demanda",
      "Tipo de Demanda",
      "Demanda",
    ]);

    const demanda = classificarDemanda(tipoDemanda);

    if (demanda === "programada") {
      atendimentosProgramados++;
      continue;
    }

    if (demanda === "espontanea") {
      atendimentosEspontaneos++;
      continue;
    }

    registrosIgnoradosSemTipoDemanda++;
  }

  const totalAtendimentos =
    atendimentosProgramados + atendimentosEspontaneos;

  if (totalAtendimentos === 0) {
    return {
      possuiDados: false,
      pontuacao: null,
      classificacao: "Indisponível",
      atendimentosProgramados,
      atendimentosEspontaneos,
      totalAtendimentos,
      percentualProgramado: null,
      registrosIgnoradosSemTipoDemanda,
      registrosIgnoradosSemCboValido,
    };
  }

  const percentualProgramado =
    (atendimentosProgramados / totalAtendimentos) * 100;

  return {
    possuiDados: true,
    pontuacao: percentualProgramado,
    classificacao: classificarC1(percentualProgramado),
    atendimentosProgramados,
    atendimentosEspontaneos,
    totalAtendimentos,
    percentualProgramado,
    registrosIgnoradosSemTipoDemanda,
    registrosIgnoradosSemCboValido,
  };
}
