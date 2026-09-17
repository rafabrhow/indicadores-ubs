/**
 * C7 — Cuidado da mulher na prevenção do câncer.
 *
 * Implementação operacional baseada na Nota Metodológica C7 do Ministério da Saúde.
 *
 * IMPORTANTE:
 * O relatório temático do PEC usado para esta primeira versão foi exportado com
 * faixa etária de 14 a 69 anos. Por isso, a prática B (HPV, 9–14 anos) não possui
 * denominador nesse arquivo. O motor NÃO transforma denominador zero em 0%.
 * Ele marca B como indisponível e informa que o indicador completo depende de
 * um relatório que inclua a faixa de 9 a 14 anos.
 */

export type ClassificacaoC7 = "Ótimo" | "Bom" | "Suficiente" | "Regular";

export type PraticaC7 = {
  codigo: "A" | "B" | "C" | "D";
  titulo: string;
  peso: number;
  elegiveis: number;
  atingidos: number;
  percentual: number | null;
  pontos: number | null;
  disponivel: boolean;
  descricao: string;
};

export type PacienteC7 = {
  id: string;
  nome: string;
  cpf?: string;
  cns?: string;
  dataNascimento?: string;
  idade?: number;
  sexo?: string;
  identidadeGenero?: string;
  microarea?: string;
  praticas: {
    A: boolean;
    B: boolean;
    C: boolean;
    D: boolean;
  };
  detalhes: {
    A?: string;
    B?: string;
    C?: string;
    D?: string;
  };
  pontuacaoDisponivel: number;
};

export type ResultadoC7 = {
  sucesso: true;
  completo: boolean;
  motivoIncompleto?: string;
  referencia: string;
  totalElegiveis: number;
  pontuacao: number | null;
  pontuacaoParcial: number;
  pontosDisponiveis: number;
  classificacao: ClassificacaoC7 | "Indisponível";
  praticas: Record<"A" | "B" | "C" | "D", PraticaC7>;
  pacientes: PacienteC7[];
};

function normalizar(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function valorCampo(registro: Record<string, unknown>, aliases: string[]): string {
  const mapa = new Map<string, unknown>();
  for (const [chave, valor] of Object.entries(registro)) {
    mapa.set(normalizar(chave), valor);
  }

  for (const alias of aliases) {
    const valor = mapa.get(normalizar(alias));
    if (valor !== undefined && valor !== null && String(valor).trim() !== "") {
      return String(valor).trim();
    }
  }

  return "";
}

function parseData(valor: unknown): Date | null {
  const texto = String(valor ?? "");
  const match = texto.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;

  const [, dia, mes, ano] = match;
  const data = new Date(Number(ano), Number(mes) - 1, Number(dia));

  if (Number.isNaN(data.getTime())) return null;
  return data;
}

function inicioJanela(referencia: Date, meses: number): Date {
  const inicio = new Date(referencia);
  inicio.setMonth(inicio.getMonth() - meses);
  return inicio;
}

function dentroDaJanela(valor: unknown, referencia: Date, meses: number): boolean {
  const data = parseData(valor);
  if (!data) return false;

  const inicio = inicioJanela(referencia, meses);
  return data >= inicio && data <= referencia;
}

function idadeNaData(dataNascimento: unknown, referencia: Date): number | null {
  const nascimento = parseData(dataNascimento);
  if (!nascimento) return null;

  let idade = referencia.getFullYear() - nascimento.getFullYear();
  const aniversarioAindaNaoChegou =
    referencia.getMonth() < nascimento.getMonth() ||
    (referencia.getMonth() === nascimento.getMonth() &&
      referencia.getDate() < nascimento.getDate());

  if (aniversarioAindaNaoChegou) idade -= 1;
  return idade;
}

function parseIdade(valor: string): number | null {
  const match = valor.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function extrairDataHPV(valor: string): Date | null {
  if (!valor || valor === "-") return null;
  const data = parseData(valor);
  return data;
}

function classificacao(pontuacao: number): ClassificacaoC7 {
  if (pontuacao > 75) return "Ótimo";
  if (pontuacao > 50) return "Bom";
  if (pontuacao > 25) return "Suficiente";
  return "Regular";
}

function boolData(
  registro: Record<string, unknown>,
  aliases: string[],
  referencia: Date,
  meses: number
): boolean {
  return dentroDaJanela(valorCampo(registro, aliases), referencia, meses);
}

export function avaliarC7(
  registrosEntrada: Record<string, unknown>[],
  referenciaInput?: Date
): ResultadoC7 {
  const referencia = referenciaInput ?? new Date();

  const registros: Record<string, unknown>[] = registrosEntrada.map(
  (registro, index): Record<string, unknown> => {
    const dadosBase =
      registro.dadosBase && typeof registro.dadosBase === "object"
        ? (registro.dadosBase as Record<string, unknown>)
        : {};

    const dadosEspecificos =
      registro.dadosEspecificos &&
      typeof registro.dadosEspecificos === "object"
        ? (registro.dadosEspecificos as Record<string, unknown>)
        : {};

    const combinado: Record<string, unknown> = {
      ...dadosBase,
      ...dadosEspecificos,
      ...registro,
      __index: index,
    };

    return combinado;
  }
);

  const pessoas = registros
    .map((registro, index) => {
      const nome = valorCampo(registro, ["Nome"]);
      const sexo = valorCampo(registro, ["Sexo"]);
      const identidadeGenero = valorCampo(registro, ["Identidade de gênero", "Identidade genero"]);
      const dataNascimento = valorCampo(registro, ["Data de nascimento"]);
      const idade =
        idadeNaData(dataNascimento, referencia) ??
        parseIdade(valorCampo(registro, ["Idade"]));

      if (!nome || idade === null) return null;

      // C7: sexo feminino ou sexo masculino + homem transgênero.
      // Sexo feminino + mulher transgênero fica fora das boas práticas.
      const feminino = normalizar(sexo) === "feminino";
      const homemTrans =
        normalizar(sexo) === "masculino" &&
        normalizar(identidadeGenero).includes("homem transgenero");
      const mulherTrans =
        feminino && normalizar(identidadeGenero).includes("mulher transgenero");

      if ((!feminino && !homemTrans) || mulherTrans || idade < 9 || idade > 69) {
        return null;
      }

      const cpf = valorCampo(registro, ["CPF"]);
      const cns = valorCampo(registro, ["CNS"]);
      const microarea = valorCampo(registro, ["Microárea", "Microarea"]);

      const aElegivel = idade >= 25 && idade <= 64;
      const bElegivel = idade >= 9 && idade <= 14;
      const cElegivel = idade >= 14 && idade <= 69;
      const dElegivel = idade >= 50 && idade <= 69;

      const a =
        aElegivel &&
        (boolData(
          registro,
          [
            "Exame de rastreamento de câncer de colo de útero data última solicitação",
            "Exame de rastreamento de câncer de colo de útero data última avaliação",
          ],
          referencia,
          36
        ) ||
          // O campo de HPV molecular não vem separado neste relatório.
          false);

      const b =
        bElegivel &&
        (() => {
          const data = extrairDataHPV(
            valorCampo(registro, ["HPV"])
          );
          return Boolean(data);
        })();

      const c =
        cElegivel &&
        dentroDaJanela(
          valorCampo(registro, ["Data da última consulta de saúde sexual e reprodutiva"]),
          referencia,
          12
        );

      const d =
        dElegivel &&
        (boolData(
          registro,
          ["Exame de rastreamento de câncer de mama data Última solicitação"],
          referencia,
          24
        ) ||
          boolData(
            registro,
            ["Exame de rastreamento de câncer de mama data Última realização"],
            referencia,
            24
          ) ||
          boolData(
            registro,
            ["Exame de rastreamento de câncer de mama data Última avaliação"],
            referencia,
            24
          ));

      const pontuacaoDisponivel =
        (a ? 20 : 0) +
        (b ? 30 : 0) +
        (c ? 30 : 0) +
        (d ? 20 : 0);

      return {
        id: String(registro.id ?? `c7-${index}`),
        nome,
        cpf,
        cns,
        dataNascimento,
        idade,
        sexo,
        identidadeGenero,
        microarea,
        praticas: { A: a, B: b, C: c, D: d },
        detalhes: {
          A: a
            ? "Rastreamento de colo do útero dentro da janela de 36 meses."
            : aElegivel
              ? "Sem registro elegível de rastreamento de colo do útero."
              : "Fora da faixa de 25 a 64 anos.",
          B: b
            ? "Registro de vacina HPV encontrado."
            : bElegivel
              ? "Sem registro de vacina HPV."
              : "Fora da faixa de 9 a 14 anos.",
          C: c
            ? "Atendimento de saúde sexual e reprodutiva nos últimos 12 meses."
            : cElegivel
              ? "Sem atendimento registrado nos últimos 12 meses."
              : "Fora da faixa de 14 a 69 anos.",
          D: d
            ? "Rastreamento de câncer de mama dentro da janela de 24 meses."
            : dElegivel
              ? "Sem registro elegível de rastreamento de câncer de mama."
              : "Fora da faixa de 50 a 69 anos.",
        },
        pontuacaoDisponivel,
      };
    })
    .filter(Boolean) as PacienteC7[];

  const aElegiveis = pessoas.filter((p) => (p.idade ?? 0) >= 25 && (p.idade ?? 0) <= 64);
  const bElegiveis = pessoas.filter((p) => (p.idade ?? 0) >= 9 && (p.idade ?? 0) <= 14);
  const cElegiveis = pessoas.filter((p) => (p.idade ?? 0) >= 14 && (p.idade ?? 0) <= 69);
  const dElegiveis = pessoas.filter((p) => (p.idade ?? 0) >= 50 && (p.idade ?? 0) <= 69);

  function montarPratica(
    codigo: "A" | "B" | "C" | "D",
    titulo: string,
    peso: number,
    elegiveis: PacienteC7[],
    descricao: string
  ): PraticaC7 {
    const atingidos = elegiveis.filter((p) => p.praticas[codigo]).length;
    const disponivel = elegiveis.length > 0;
    const percentual = disponivel ? (atingidos / elegiveis.length) * 100 : null;
    const pontos = disponivel ? (atingidos / elegiveis.length) * peso : null;

    return {
      codigo,
      titulo,
      peso,
      elegiveis: elegiveis.length,
      atingidos,
      percentual,
      pontos,
      disponivel,
      descricao,
    };
  }

  const praticas = {
    A: montarPratica(
      "A",
      "Rastreamento do câncer do colo do útero",
      20,
      aElegiveis,
      "25–64 anos; exame nos últimos 36 meses."
    ),
    B: montarPratica(
      "B",
      "Vacinação contra HPV",
      30,
      bElegiveis,
      "9–14 anos; pelo menos uma dose."
    ),
    C: montarPratica(
      "C",
      "Saúde sexual e reprodutiva",
      30,
      cElegiveis,
      "14–69 anos; atendimento nos últimos 12 meses."
    ),
    D: montarPratica(
      "D",
      "Rastreamento do câncer de mama",
      20,
      dElegiveis,
      "50–69 anos; exame nos últimos 24 meses."
    ),
  };

  const praticasDisponiveis = Object.values(praticas).filter((p) => p.disponivel);
  const completo = praticasDisponiveis.length === 4;
  const pontuacaoParcial = praticasDisponiveis.reduce(
    (soma, pratica) => soma + (pratica.pontos ?? 0),
    0
  );
  const pontosDisponiveis = praticasDisponiveis.reduce(
    (soma, pratica) => soma + pratica.peso,
    0
  );

  return {
    sucesso: true,
    completo,
    motivoIncompleto: completo
      ? undefined
      : "A prática B não possui denominador no relatório importado. Exporte o C7 incluindo a faixa etária de 9 a 69 anos para calcular o indicador completo.",
    referencia: referencia.toISOString(),
    totalElegiveis: pessoas.length,
    pontuacao: completo ? pontuacaoParcial : null,
    pontuacaoParcial,
    pontosDisponiveis,
    classificacao: completo ? classificacao(pontuacaoParcial) : "Indisponível",
    praticas,
    pacientes: pessoas,
  };
}
