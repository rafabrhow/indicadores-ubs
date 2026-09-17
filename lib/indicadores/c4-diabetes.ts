/**
 * C4 — Cuidado da pessoa com diabetes.
 *
 * Baseado na Ficha Técnica/Nota Metodológica C4 do Ministério da Saúde.
 *
 * Pesos oficiais:
 * A 20 | B 15 | C 15 | D 20 | E 15 | F 15 = 100 pontos.
 *
 * Limitação importante do relatório PEC usado pelo Indicadores-UBS:
 * ele não traz, em todas as colunas, o CBO do profissional nem todos os
 * critérios de vínculo/equipe usados pelo SIAPS. Por isso este módulo faz
 * uma avaliação operacional a partir do relatório temático Diabetes,
 * filtrado para problemas ativos. A tela deve deixar essa limitação clara.
 */

export type DadosPEC_Diabetes = Record<string, unknown>;

export type ResultadoPraticaC4 = {
  codigo: "A" | "B" | "C" | "D" | "E" | "F";
  titulo: string;
  pontos: number;
  atingida: boolean;
  detalhe: string;
};

export type ResultadoC4Diabetes = {
  elegivel: boolean;
  motivoElegibilidade: string;
  pontuacao: number;
  classificacao: "Ótimo" | "Bom" | "Suficiente" | "Regular";
  praticas: ResultadoPraticaC4[];
};

function texto(dados: DadosPEC_Diabetes, campo: string): string {
  const valor = dados[campo];
  return valor == null ? "" : String(valor).trim();
}

function numero(dados: DadosPEC_Diabetes, campo: string): number | null {
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

function diasEntre(data: Date, referencia: Date): number {
  return Math.floor((referencia.getTime() - data.getTime()) / 86400000);
}

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function pacienteElegivelC4(
  dados: DadosPEC_Diabetes,
  metadados?: {
    listaTematica?: string;
    grupoCondicoes?: string;
    filtroProblemas?: string;
  }
): { elegivel: boolean; motivo: string } {
  const lista = normalizar(metadados?.listaTematica ?? "");
  const grupo = normalizar(metadados?.grupoCondicoes ?? "");
  const filtro = normalizar(metadados?.filtroProblemas ?? "");
  const incluido = normalizar(
    texto(dados, "Incluído na lista de problemas e condições")
  );

  const temDiabetes = lista.includes("diabetes") || grupo.includes("diabetes");
  const problemasAtivos =
    filtro.includes("somente problemas ativos") || filtro.includes("problemas ativos");
  const registroAtivo = ["sim", "true", "1"].includes(incluido);

  if (temDiabetes && problemasAtivos) {
    return {
      elegivel: true,
      motivo: "Registro proveniente do relatório de Diabetes com filtro de problemas ativos.",
    };
  }

  if (temDiabetes && registroAtivo) {
    return {
      elegivel: true,
      motivo: "Registro identificado como Diabetes e marcado como incluído na lista de problemas e condições.",
    };
  }

  return {
    elegivel: false,
    motivo: "O registro não possui evidência suficiente de condição de diabetes ativa.",
  };
}

function praticaA(dados: DadosPEC_Diabetes): ResultadoPraticaC4 {
  const medico = numero(dados, "Dias desde o último atendimento médico");
  const enfermagem = numero(dados, "Dias desde o último atendimento de enfermagem");
  const atingida =
    (medico !== null && medico >= 0 && medico <= 180) ||
    (enfermagem !== null && enfermagem >= 0 && enfermagem <= 180);

  return {
    codigo: "A",
    titulo: "Consulta médica ou de enfermagem nos últimos 6 meses",
    pontos: atingida ? 20 : 0,
    atingida,
    detalhe: atingida
      ? "Há atendimento médico ou de enfermagem dentro de 180 dias."
      : "Não há atendimento médico ou de enfermagem dentro de 180 dias.",
  };
}

function praticaB(dados: DadosPEC_Diabetes, referencia: Date): ResultadoPraticaC4 {
  const data = parseDataBR(texto(dados, "Data da última medição de pressão arterial"));
  const dias = data ? diasEntre(data, referencia) : null;
  const atingida = dias !== null && dias >= 0 && dias <= 180;

  return {
    codigo: "B",
    titulo: "Pressão arterial nos últimos 6 meses",
    pontos: atingida ? 15 : 0,
    atingida,
    detalhe: atingida
      ? `Medição realizada há ${dias} dia(s).`
      : "Não há medição de pressão arterial dentro de 180 dias.",
  };
}

function praticaC(dados: DadosPEC_Diabetes, referencia: Date): ResultadoPraticaC4 {
  const data = parseDataBR(texto(dados, "Data da última medição de peso e altura"));
  const dias = data ? diasEntre(data, referencia) : null;
  const atingida = dias !== null && dias >= 0 && dias <= 365;

  return {
    codigo: "C",
    titulo: "Peso e altura nos últimos 12 meses",
    pontos: atingida ? 15 : 0,
    atingida,
    detalhe: atingida
      ? `Peso e altura registrados há ${dias} dia(s).`
      : "Não há registro simultâneo de peso e altura dentro de 365 dias.",
  };
}

function praticaD(dados: DadosPEC_Diabetes, referencia: Date): ResultadoPraticaC4 {
  const bruto = texto(dados, "Últimas visitas domiciliares");
  const datas = bruto
    .split(/\s+e\s+/i)
    .map(parseDataBR)
    .filter((data): data is Date => data !== null)
    .filter((data) => {
      const dias = diasEntre(data, referencia);
      return dias >= 0 && dias <= 365;
    })
    .sort((a, b) => a.getTime() - b.getTime());

  for (let i = 1; i < datas.length; i++) {
    const intervalo = Math.floor(
      (datas[i].getTime() - datas[i - 1].getTime()) / 86400000
    );
    if (intervalo >= 30) {
      return {
        codigo: "D",
        titulo: "2 visitas domiciliares em 12 meses, com intervalo mínimo de 30 dias",
        pontos: 20,
        atingida: true,
        detalhe: `Foram encontradas visitas com intervalo de ${intervalo} dia(s).`,
      };
    }
  }

  return {
    codigo: "D",
    titulo: "2 visitas domiciliares em 12 meses, com intervalo mínimo de 30 dias",
    pontos: 0,
    atingida: false,
    detalhe: "Não foram encontradas duas visitas válidas com intervalo mínimo de 30 dias.",
  };
}

function praticaE(dados: DadosPEC_Diabetes, referencia: Date): ResultadoPraticaC4 {
  const avaliacao = parseDataBR(
    texto(dados, "Data da última avaliação de hemoglobina glicada")
  );
  const solicitacao = parseDataBR(
    texto(dados, "Data da última solicitação de hemoglobina glicada")
  );

  const datas = [avaliacao, solicitacao]
    .filter((data): data is Date => data !== null)
    .map((data) => diasEntre(data, referencia))
    .filter((dias) => dias >= 0 && dias <= 365);

  const atingida = datas.length > 0;

  return {
    codigo: "E",
    titulo: "Hemoglobina glicada solicitada ou avaliada nos últimos 12 meses",
    pontos: atingida ? 15 : 0,
    atingida,
    detalhe: atingida
      ? "Existe solicitação ou avaliação de hemoglobina glicada dentro de 365 dias."
      : "Não há solicitação ou avaliação de hemoglobina glicada dentro de 365 dias.",
  };
}

function praticaF(dados: DadosPEC_Diabetes, referencia: Date): ResultadoPraticaC4 {
  const data = parseDataBR(texto(dados, "Data da avaliação dos pés"));
  const dias = data ? diasEntre(data, referencia) : null;
  const atingida = dias !== null && dias >= 0 && dias <= 365;

  return {
    codigo: "F",
    titulo: "Avaliação dos pés nos últimos 12 meses",
    pontos: atingida ? 15 : 0,
    atingida,
    detalhe: atingida
      ? `Avaliação registrada há ${dias} dia(s).`
      : "Não há avaliação dos pés dentro de 365 dias.",
  };
}

export function avaliarC4Diabetes(
  dados: DadosPEC_Diabetes,
  opcoes?: {
    referencia?: Date;
    metadados?: {
      listaTematica?: string;
      grupoCondicoes?: string;
      filtroProblemas?: string;
    };
  }
): ResultadoC4Diabetes {
  const referencia = opcoes?.referencia ?? new Date();
  const elegibilidade = pacienteElegivelC4(dados, opcoes?.metadados);

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
    praticaA(dados),
    praticaB(dados, referencia),
    praticaC(dados, referencia),
    praticaD(dados, referencia),
    praticaE(dados, referencia),
    praticaF(dados, referencia),
  ];

  const pontuacao = praticas.reduce((total, pratica) => total + pratica.pontos, 0);
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

export function normalizarMicroareaC4(valor: unknown): string {
  return String(valor ?? "")
    .trim()
    .replace(/^"+|"+$/g, "")
    .trim();
}
