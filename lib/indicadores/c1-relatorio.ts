import "server-only";

export type TipoDemandaC1 =
  | "programada"
  | "espontanea"
  | "nao_informada";

export type RegistroRelatorioC1 = {
  tipo: TipoDemandaC1;
  descricao: string;
  quantidade: number;
};

export type RelatorioC1 = {
  tipoRelatorio: "atendimento-individual-analitico";
  periodo: string | null;
  competencia: string | null;
  equipe: string | null;
  profissional: string | null;
  cbo: string | null;
  filtrosPersonalizados: string | null;
  registrosIdentificados: number;
  registrosNaoIdentificados: number;
  atendimentosProgramados: number;
  atendimentosEspontaneos: number;
  atendimentosNaoInformados: number;
  totalDemandasC1: number;
  percentualProgramado: number | null;
  registros: RegistroRelatorioC1[];
};

/**
 * Normaliza texto do CSV do e-SUS PEC para permitir comparação
 * mesmo quando o relatório usa acentuação, maiúsculas ou espaços diferentes.
 */
function normalizar(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function numero(valor: unknown): number {
  const texto = String(valor ?? "")
    .trim()
    .replace(/\./g, "")
    .replace(",", ".");

  const resultado = Number(texto);
  return Number.isFinite(resultado) ? resultado : 0;
}

function extrairCompetencia(periodo: string | null): string | null {
  if (!periodo) return null;

  const datas = periodo.match(/(\d{2})\/(\d{2})\/(\d{4})/g);
  if (!datas?.length) return null;

  const primeiraData = datas[0];
  const partes = primeiraData.split("/");

  if (partes.length !== 3) return null;

  return `${partes[2]}-${partes[2] ? partes[1] : ""}`;
}

function encontrarValorFiltro(
  linhas: string[][],
  nomeCampo: string,
): string | null {
  const alvo = normalizar(nomeCampo);

  for (const linha of linhas) {
    if (normalizar(linha[0]) === alvo) {
      return String(linha[1] ?? "").trim() || null;
    }
  }

  return null;
}

function encontrarSecao(
  linhas: string[][],
  titulo: string,
): string[][] | null {
  const alvo = normalizar(titulo);

  const indice = linhas.findIndex(
    (linha) => normalizar(linha[0]) === alvo,
  );

  if (indice < 0) return null;

  const secao: string[][] = [];

  for (let i = indice + 1; i < linhas.length; i++) {
    const linha = linhas[i];

    if (!linha.length || !String(linha[0] ?? "").trim()) {
      continue;
    }

    const primeiraColuna = normalizar(linha[0]);

    // Uma nova seção normalmente aparece como uma única célula
    // sem "Descrição" e sem "Quantidade".
    if (
      linha.length === 1 &&
      primeiraColuna &&
      primeiraColuna !== "descricao"
    ) {
      break;
    }

    secao.push(linha);
  }

  return secao;
}

function extrairQuantidade(
  secao: string[][] | null,
  descricao: string,
): number {
  if (!secao) return 0;

  const alvo = normalizar(descricao);

  const linha = secao.find(
    (item) => normalizar(item[0]) === alvo,
  );

  return numero(linha?.[1]);
}

/**
 * Analisa o CSV "Relatório de atendimento individual - Analítico"
 * exportado pelo e-SUS PEC.
 *
 * O relatório é consolidado por tipo de atendimento, portanto não deve
 * ser tratado como uma lista de pacientes. Para C1 usamos somente a
 * seção "Tipo de atendimento".
 */
export function analisarRelatorioC1(csv: string): RelatorioC1 {
  const linhas = csv
    .replace(/^\uFEFF/, "")
    .replace(/\r/g, "")
    .split("\n")
    .map((linha) => linha.split(";").map((valor) => valor.trim()));

  const primeiraLinhaUtil = linhas.find(
    (linha) =>
      normalizar(linha[0]).includes("relatorio de atendimento individual") &&
      normalizar(linha[0]).includes("analitico"),
  );

  if (!primeiraLinhaUtil) {
    throw new Error(
      'CSV incompatível: não é o "Relatório de atendimento individual - Analítico" do e-SUS PEC.',
    );
  }

  const periodo = encontrarValorFiltro(linhas, "Período");
  const equipe = encontrarValorFiltro(linhas, "Equipe");
  const profissional = encontrarValorFiltro(linhas, "Profissional");
  const cbo = encontrarValorFiltro(linhas, "CBO");
  const filtrosPersonalizados = encontrarValorFiltro(
    linhas,
    "Filtros personalizados",
  );

  const resumo = encontrarSecao(linhas, "Resumo de produção");
  const registrosIdentificados = extrairQuantidade(
    resumo,
    "Registros identificados",
  );
  const registrosNaoIdentificados = extrairQuantidade(
    resumo,
    "Registros não identificados",
  );

  const secaoTipoAtendimento = encontrarSecao(
    linhas,
    "Tipo de atendimento",
  );

  const registros: RegistroRelatorioC1[] = [];

  const descricoesProgramadas = new Set([
    "consulta agendada",
    "consulta agendada programada / cuidado continuado",
  ]);

  const descricoesEspontaneas = new Set([
    "atendimento de urgencia",
    "consulta no dia",
    "escuta inicial / orientacao",
  ]);

  for (const linha of secaoTipoAtendimento ?? []) {
    const descricaoOriginal = String(linha[0] ?? "").trim();
    const descricao = normalizar(descricaoOriginal);

    if (!descricao || descricao === "descricao") continue;

    const quantidade = numero(linha[1]);

    if (descricoesProgramadas.has(descricao)) {
      registros.push({
        tipo: "programada",
        descricao: descricaoOriginal,
        quantidade,
      });
      continue;
    }

    if (descricoesEspontaneas.has(descricao)) {
      registros.push({
        tipo: "espontanea",
        descricao: descricaoOriginal,
        quantidade,
      });
      continue;
    }

    if (descricao === "nao informado") {
      registros.push({
        tipo: "nao_informada",
        descricao: descricaoOriginal,
        quantidade,
      });
    }
  }

  const atendimentosProgramados = registros
    .filter((registro) => registro.tipo === "programada")
    .reduce((total, registro) => total + registro.quantidade, 0);

  const atendimentosEspontaneos = registros
    .filter((registro) => registro.tipo === "espontanea")
    .reduce((total, registro) => total + registro.quantidade, 0);

  const atendimentosNaoInformados = registros
    .filter((registro) => registro.tipo === "nao_informada")
    .reduce((total, registro) => total + registro.quantidade, 0);

  const totalDemandasC1 =
    atendimentosProgramados + atendimentosEspontaneos;

  const percentualProgramado =
    totalDemandasC1 > 0
      ? (atendimentosProgramados / totalDemandasC1) * 100
      : null;

  return {
    tipoRelatorio: "atendimento-individual-analitico",
    periodo,
    competencia: extrairCompetencia(periodo),
    equipe,
    profissional,
    cbo,
    filtrosPersonalizados,
    registrosIdentificados,
    registrosNaoIdentificados,
    atendimentosProgramados,
    atendimentosEspontaneos,
    atendimentosNaoInformados,
    totalDemandasC1,
    percentualProgramado,
    registros,
  };
}
