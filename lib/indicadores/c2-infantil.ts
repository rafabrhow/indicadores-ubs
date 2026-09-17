/**
 * C2 — Cuidado no desenvolvimento infantil.
 *
 * Baseado na Nota Metodológica C2 do Ministério da Saúde.
 * Cada boa prática vale 20 pontos, totalizando 100 pontos por criança.
 *
 * Esta implementação é operacional a partir do relatório temático do e-SUS PEC.
 * O CSV não expõe todos os CBO/CNS/vínculos usados no SIAPS, portanto o resultado
 * deve ser apresentado como cálculo operacional/preliminar.
 */

export type DadosPEC_C2 = Record<string, unknown>;
export type CodigoC2 = "A" | "B" | "C" | "D" | "E";
export type StatusPraticaC2 = "atingida" | "pendente";

export type ResultadoPraticaC2 = {
  codigo: CodigoC2;
  titulo: string;
  pontos: number;
  atingida: boolean;
  status: StatusPraticaC2;
  detalhe: string;
};

export type ResultadoC2Infantil = {
  elegivel: boolean;
  motivoElegibilidade: string;
  idadeMeses: number | null;
  pontuacao: number;
  classificacao: "Ótimo" | "Bom" | "Suficiente" | "Regular";
  situacaoAcompanhamento: "Em acompanhamento" | "Atenção";
  praticas: ResultadoPraticaC2[];
};

const pesos: Record<CodigoC2, number> = { A: 20, B: 20, C: 20, D: 20, E: 20 };

function texto(d: DadosPEC_C2, campo: string): string {
  const valor = d[campo];
  return valor == null ? "" : String(valor).trim();
}

function numero(d: DadosPEC_C2, campo: string): number {
  const valor = texto(d, campo).replace(",", ".");
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function normalizar(valor: string) {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function classificacao(pontuacao: number): ResultadoC2Infantil["classificacao"] {
  if (pontuacao > 75) return "Ótimo";
  if (pontuacao > 50) return "Bom";
  if (pontuacao > 25) return "Suficiente";
  return "Regular";
}

function dataBR(valor: string): Date | null {
  const match = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const data = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  return Number.isNaN(data.getTime()) ? null : data;
}

function idadeEmMeses(d: DadosPEC_C2, referencia: Date): number | null {
  const nascimento = dataBR(texto(d, "Data de nascimento"));
  if (!nascimento) return null;
  let meses =
    (referencia.getFullYear() - nascimento.getFullYear()) * 12 +
    (referencia.getMonth() - nascimento.getMonth());
  if (referencia.getDate() < nascimento.getDate()) meses -= 1;
  return Math.max(0, meses);
}

function quantidadeDoses(textoVacina: string): number {
  if (!textoVacina || textoVacina === "-") return 0;
  return (textoVacina.match(/(?:^|\s)D\d+\s*-/gi) ?? []).length;
}

function pratica(
  codigo: CodigoC2,
  titulo: string,
  atingida: boolean,
  detalhe: string
): ResultadoPraticaC2 {
  return {
    codigo,
    titulo,
    pontos: atingida ? pesos[codigo] : 0,
    atingida,
    status: atingida ? "atingida" : "pendente",
    detalhe,
  };
}

/** Avalia uma criança do relatório temático de Desenvolvimento infantil. */
export function avaliarC2Infantil(
  dados: DadosPEC_C2,
  opcoes: {
    referencia?: Date;
    metadados?: {
      listaTematica?: string;
    };
  } = {}
): ResultadoC2Infantil {
  const referencia = opcoes.referencia ?? new Date();
  // A rota já seleciona a última importação temática de Desenvolvimento infantil.
  // Aqui a elegibilidade deve depender do critério etário do C2, sem exigir
  // que a metadada da lista temática esteja repetida dentro de cada registro.
  const idadeMeses = idadeEmMeses(dados, referencia);
  const elegivel = idadeMeses !== null && idadeMeses <= 24;

  const idadePrimeira = texto(dados, "Idade na primeira consulta");
  const primeiraConsultaAte30Dias =
    /^(?:0|[12]\d|30)\s*dias?/i.test(idadePrimeira) ||
    /^(?:0|[12]\d|30)\s*d/i.test(idadePrimeira);

  const consultas = numero(dados, "Quantidade de consultas até 24 meses");
  const pesosAlturas = numero(
    dados,
    "Quantidade de medições de peso/altura simultâneas até 24 meses"
  );

  const primeiraVisita = texto(dados, "Data da primeira visita domiciliar");
  const segundaVisita = texto(dados, "Data da segunda visita domiciliar");
  const nascimento = dataBR(texto(dados, "Data de nascimento"));
  const primeiraVisitaData = dataBR(primeiraVisita) ?? (nascimento && /^\d{4}-\d{2}-\d{2}$/.test(primeiraVisita) ? new Date(`${primeiraVisita}T00:00:00`) : null);
  const segundaVisitaData = dataBR(segundaVisita) ?? (nascimento && /^\d{4}-\d{2}-\d{2}$/.test(segundaVisita) ? new Date(`${segundaVisita}T00:00:00`) : null);

  const primeiraAte30 =
    !!nascimento && !!primeiraVisitaData &&
    (primeiraVisitaData.getTime() - nascimento.getTime()) / 86400000 >= 0 &&
    (primeiraVisitaData.getTime() - nascimento.getTime()) / 86400000 <= 30;

  const segundaAte6Meses =
    !!nascimento && !!segundaVisitaData &&
    (segundaVisitaData.getTime() - nascimento.getTime()) / 86400000 >= 0 &&
    (segundaVisitaData.getTime() - nascimento.getTime()) / 86400000 <= 183;

  const visitas = numero(dados, "Quantidade de visitas domiciliares até os 24 meses de idade");

  // Para o C2, o esquema considerado no documento é:
  // penta 3 doses, pólio injetável 3 doses, SCR/SCRV 2 doses após 12 meses,
  // pneumocócica 2 doses. A avaliação usa somente o que o CSV expõe.
  const penta = quantidadeDoses(
    texto(dados, "Difteria, Tétano, Pertusis, Hepatite B, Haemophilus Influenza B")
  );
  const polio = quantidadeDoses(texto(dados, "Poliomielite"));
  const mmr = quantidadeDoses(texto(dados, "Sarampo, Caxumba, Rubéola"));
  const pneumo = quantidadeDoses(texto(dados, "Pneumocócica"));
  const vacinaCompleta = penta >= 3 && polio >= 3 && mmr >= 2 && pneumo >= 2;

  const praticas: ResultadoPraticaC2[] = [
    pratica(
      "A",
      "1ª consulta presencial até o 30º dia de vida",
      primeiraConsultaAte30Dias,
      primeiraConsultaAte30Dias
        ? `Primeira consulta registrada aos ${idadePrimeira}.`
        : `Primeira consulta registrada aos ${idadePrimeira || "idade não informada"}; não há evidência de consulta até 30 dias.`
    ),
    pratica(
      "B",
      "Pelo menos 9 consultas até 2 anos",
      consultas >= 9,
      `Consultas até 24 meses: ${consultas}/9.`
    ),
    pratica(
      "C",
      "Pelo menos 9 registros simultâneos de peso + altura",
      pesosAlturas >= 9,
      `Registros simultâneos de peso/altura: ${pesosAlturas}/9.`
    ),
    pratica(
      "D",
      "2 visitas domiciliares: 1ª até 30 dias e 2ª até 6 meses",
      primeiraAte30 && segundaAte6Meses,
      `Visitas registradas: ${visitas}. Primeira até 30 dias: ${primeiraAte30 ? "sim" : "não"}. Segunda até 6 meses: ${segundaAte6Meses ? "sim" : "não"}.`
    ),
    pratica(
      "E",
      "Esquema vacinal completo conforme doses recomendadas",
      vacinaCompleta,
      `Doses identificadas no relatório — penta: ${penta}/3; pólio: ${polio}/3; SCR/SCRV: ${mmr}/2; pneumocócica: ${pneumo}/2.`
    ),
  ];

  const pontuacao = praticas.reduce((total, item) => total + item.pontos, 0);
  const quantidadePendencias = praticas.filter((item) => !item.atingida).length;

  return {
    elegivel,
    motivoElegibilidade: elegivel
      ? "Criança do relatório temático de Desenvolvimento infantil e com até 2 anos no período."
      : "Registro fora do critério operacional de elegibilidade do C2.",
    idadeMeses,
    pontuacao,
    classificacao: classificacao(pontuacao),
    situacaoAcompanhamento: quantidadePendencias >= 3 ? "Atenção" : "Em acompanhamento",
    praticas,
  };
}
