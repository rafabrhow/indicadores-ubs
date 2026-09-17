/**
 * C5 — Cuidado da pessoa com hipertensão
 *
 * Este módulo recebe os dados específicos do relatório PEC de Hipertensão.
 *
 * Importante:
 * - O relatório usado pelo Indicadores-UBS deve ser o relatório temático
 *   "Hipertensão", filtrado para "Somente problemas ativos na lista de
 *   problemas e condições".
 * - A elegibilidade não deve ser inferida apenas pelo nome do paciente.
 * - O cálculo das boas práticas segue a estrutura A/B/C/D de 25 pontos.
 */

export type DadosPEC_Hipertensao = Record<string, unknown>;

export type ResultadoPraticaC5 = {
  codigo: "A" | "B" | "C" | "D";
  titulo: string;
  pontos: number;
  atingida: boolean;
  detalhe: string;
};

export type ResultadoC5Hipertensao = {
  elegivel: boolean;
  motivoElegibilidade: string;
  pontuacao: number;
  classificacao: "Ótimo" | "Bom" | "Suficiente" | "Regular";
  praticas: ResultadoPraticaC5[];
};

function texto(dados: DadosPEC_Hipertensao, campo: string): string {
  const valor = dados[campo];
  return valor == null ? "" : String(valor).trim();
}

function numero(dados: DadosPEC_Hipertensao, campo: string): number | null {
  const valor = texto(dados, campo);
  if (!valor || valor === "-") return null;

  const n = Number(valor.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseDataBR(valor: string): Date | null {
  const match = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const [, dia, mes, ano] = match;
  const data = new Date(Number(ano), Number(mes) - 1, Number(dia));

  return Number.isNaN(data.getTime()) ? null : data;
}

function diasEntreMaisRecente(data: Date, referencia: Date): number {
  return Math.floor(
    (referencia.getTime() - data.getTime()) / 86400000
  );
}

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Identifica se o registro veio de um relatório de Hipertensão
 * com problema/condição ativo.
 */
export function pacienteElegivelC5(
  dados: DadosPEC_Hipertensao,
  metadados?: {
    listaTematica?: string;
    grupoCondicoes?: string;
    filtroProblemas?: string;
  }
): { elegivel: boolean; motivo: string } {
  const lista = normalizar(metadados?.listaTematica ?? "");
  const grupo = normalizar(metadados?.grupoCondicoes ?? "");
  const filtro = normalizar(metadados?.filtroProblemas ?? "");

  const condicaoDoRegistro = normalizar(
    texto(dados, "Incluído na lista de problemas e condições")
  );

  const temHipertensao =
    lista.includes("hipertens") || grupo.includes("hipertens");

  const problemasAtivos =
    filtro.includes("somente problemas ativos") ||
    filtro.includes("problemas ativos");

  const registroAtivo =
    condicaoDoRegistro === "sim" ||
    condicaoDoRegistro === "true" ||
    condicaoDoRegistro === "1";

  if (temHipertensao && problemasAtivos) {
    return {
      elegivel: true,
      motivo:
        "Registro proveniente do relatório de Hipertensão com filtro de problemas ativos.",
    };
  }

  if (temHipertensao && registroAtivo) {
    return {
      elegivel: true,
      motivo:
        "Registro identificado como Hipertensão e marcado como incluído na lista de problemas e condições.",
    };
  }

  return {
    elegivel: false,
    motivo:
      "O registro não possui evidência suficiente de condição de hipertensão ativa.",
  };
}

function praticaA(
  dados: DadosPEC_Hipertensao,
  referencia: Date
): ResultadoPraticaC5 {
  const medico = numero(dados, "Dias desde o último atendimento médico");
  const enfermagem = numero(
    dados,
    "Dias desde o último atendimento de enfermagem"
  );

  const atingida =
    (medico !== null && medico <= 180) ||
    (enfermagem !== null && enfermagem <= 180);

  return {
    codigo: "A",
    titulo: "Consulta médica ou de enfermagem nos últimos 6 meses",
    pontos: atingida ? 25 : 0,
    atingida,
    detalhe: atingida
      ? "Há atendimento médico ou de enfermagem dentro de 180 dias."
      : "Não há atendimento médico ou de enfermagem dentro de 180 dias.",
  };
}

function praticaB(
  dados: DadosPEC_Hipertensao,
  referencia: Date
): ResultadoPraticaC5 {
  const data = parseDataBR(
    texto(dados, "Data da última medição de pressão arterial")
  );

  const dias = data ? diasEntreMaisRecente(data, referencia) : null;
  const atingida = dias !== null && dias >= 0 && dias <= 180;

  return {
    codigo: "B",
    titulo: "Pressão arterial nos últimos 6 meses",
    pontos: atingida ? 25 : 0,
    atingida,
    detalhe: atingida
      ? `Medição realizada há ${dias} dia(s).`
      : "Não há medição de pressão arterial dentro de 180 dias.",
  };
}

function praticaC(
  dados: DadosPEC_Hipertensao,
  referencia: Date
): ResultadoPraticaC5 {
  const data = parseDataBR(
    texto(dados, "Data da última medição de peso e altura")
  );

  const dias = data ? diasEntreMaisRecente(data, referencia) : null;
  const atingida = dias !== null && dias >= 0 && dias <= 365;

  return {
    codigo: "C",
    titulo: "Peso e altura nos últimos 12 meses",
    pontos: atingida ? 25 : 0,
    atingida,
    detalhe: atingida
      ? `Peso e altura registrados há ${dias} dia(s).`
      : "Não há registro de peso e altura dentro de 365 dias.",
  };
}

function praticaD(
  dados: DadosPEC_Hipertensao,
  referencia: Date
): ResultadoPraticaC5 {
  const bruto = texto(dados, "Últimas visitas domiciliares");

  const datas = bruto
    .split(/\s+e\s+/i)
    .map(parseDataBR)
    .filter((data): data is Date => data !== null)
    .filter((data) => {
      const dias = diasEntreMaisRecente(data, referencia);
      return dias >= 0 && dias <= 365;
    })
    .sort((a, b) => a.getTime() - b.getTime());

  let atingida = false;

  for (let i = 1; i < datas.length; i++) {
    const intervalo = Math.floor(
      (datas[i].getTime() - datas[i - 1].getTime()) / 86400000
    );

    if (intervalo >= 30) {
      atingida = true;
      break;
    }
  }

  return {
    codigo: "D",
    titulo: "2 visitas domiciliares em 12 meses, com intervalo mínimo de 30 dias",
    pontos: atingida ? 25 : 0,
    atingida,
    detalhe: atingida
      ? "Foram encontradas duas visitas dentro dos últimos 12 meses com intervalo mínimo de 30 dias."
      : "Não foram encontradas duas visitas válidas com intervalo mínimo de 30 dias.",
  };
}

export function avaliarC5Hipertensao(
  dados: DadosPEC_Hipertensao,
  opcoes?: {
    referencia?: Date;
    metadados?: {
      listaTematica?: string;
      grupoCondicoes?: string;
      filtroProblemas?: string;
    };
  }
): ResultadoC5Hipertensao {
  const referencia = opcoes?.referencia ?? new Date();

  const elegibilidade = pacienteElegivelC5(
    dados,
    opcoes?.metadados
  );

  if (!elegibilidade.elegivel) {
    return {
      elegivel: false,
      motivoElegibilidade: elegibilidade.motivo,
      pontuacao: 0,
      classificacao: "Regular",
      praticas: [],
    };
  }

  const praticas = [
    praticaA(dados, referencia),
    praticaB(dados, referencia),
    praticaC(dados, referencia),
    praticaD(dados, referencia),
  ];

  const pontuacao = praticas.reduce(
    (total, pratica) => total + pratica.pontos,
    0
  );

  const classificacao =
    pontuacao > 75
      ? "Ótimo"
      : pontuacao > 50
        ? "Bom"
        : pontuacao > 25
          ? "Suficiente"
          : "Regular";

  return {
    elegivel: true,
    motivoElegibilidade: elegibilidade.motivo,
    pontuacao,
    classificacao,
    praticas,
  };
}

/**
 * Normaliza valores de microárea vindos do CSV.
 * Ex.: '"11"' -> '11'
 */
export function normalizarMicroarea(valor: unknown): string {
  return String(valor ?? "")
    .trim()
    .replace(/^"+|"+$/g, "")
    .trim();
}
