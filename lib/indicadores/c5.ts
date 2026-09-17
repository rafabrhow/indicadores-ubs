/**
 * Motor do indicador C5 — Cuidado da pessoa com hipertensão.
 *
 * Este arquivo contém somente regra de negócio e não depende do React/Firebase.
 * Isso permite reutilizar o cálculo depois no dashboard, relatórios e telas do ACS.
 *
 * Fonte da regra: Ficha Técnica de Qualificação C5 do Ministério da Saúde.
 * Cada boa prática vale 25 pontos:
 * A) consulta médica/enfermagem nos últimos 6 meses;
 * B) aferição de pressão nos últimos 6 meses;
 * C) peso + altura nos últimos 12 meses;
 * D) 2 visitas domiciliares nos últimos 12 meses, com intervalo mínimo de 30 dias.
 */

export type PraticaC5 = {
  codigo: "A" | "B" | "C" | "D";
  titulo: string;
  pontos: number;
  atingida: boolean;
  detalhe: string;
};

export type ResultadoC5 = {
  pontuacao: number;
  classificacao: "Ótimo" | "Bom" | "Suficiente" | "Regular";
  praticas: PraticaC5[];
};

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/**
 * Converte datas do relatório PEC no formato DD/MM/AAAA.
 * Usamos UTC para evitar que o fuso horário altere o dia.
 */
function dataBR(valor: unknown): Date | null {
  const textoData = texto(valor);

  const match = textoData.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) return null;

  const [, dia, mes, ano] = match;

  const data = new Date(
    Date.UTC(Number(ano), Number(mes) - 1, Number(dia))
  );

  if (
    data.getUTCFullYear() !== Number(ano) ||
    data.getUTCMonth() !== Number(mes) - 1 ||
    data.getUTCDate() !== Number(dia)
  ) {
    return null;
  }

  return data;
}

function diferencaDiasMaisRecente(
  dataAvaliacao: Date,
  dataEvento: Date
): number {
  const avaliacaoUTC = Date.UTC(
    dataAvaliacao.getFullYear(),
    dataAvaliacao.getMonth(),
    dataAvaliacao.getDate()
  );

  const eventoUTC = dataEvento.getTime();

  return Math.floor((avaliacaoUTC - eventoUTC) / 86400000);
}

function dentroDoPeriodo(
  valor: unknown,
  dataAvaliacao: Date,
  diasMaximos: number
): boolean {
  const data = dataBR(valor);

  if (!data) return false;

  const dias = diferencaDiasMaisRecente(dataAvaliacao, data);

  return dias >= 0 && dias <= diasMaximos;
}

function numero(valor: unknown): number | null {
  const convertido = Number(texto(valor).replace(",", "."));

  return Number.isFinite(convertido) ? convertido : null;
}

/**
 * Verifica se existem pelo menos duas visitas nos últimos 12 meses
 * com intervalo mínimo de 30 dias.
 *
 * O PEC apresenta esse campo como:
 * "17/07/2026 e 11/08/2026"
 */
function possuiDuasVisitasComIntervalo(
  valor: unknown,
  dataAvaliacao: Date
): boolean {
  const bruto = texto(valor);

  if (!bruto || bruto === "-") return false;

  const datas = bruto
    .split(/\s+e\s+/i)
    .map((item) => dataBR(item))
    .filter((item): item is Date => item !== null)
    .filter((data) => {
      const dias = diferencaDiasMaisRecente(dataAvaliacao, data);
      return dias >= 0 && dias <= 365;
    })
    .sort((a, b) => a.getTime() - b.getTime());

  if (datas.length < 2) return false;

  for (let i = 0; i < datas.length; i++) {
    for (let j = i + 1; j < datas.length; j++) {
      const intervalo = Math.floor(
        (datas[j].getTime() - datas[i].getTime()) / 86400000
      );

      if (intervalo >= 30) {
        return true;
      }
    }
  }

  return false;
}

function classificar(pontuacao: number): ResultadoC5["classificacao"] {
  if (pontuacao > 75) return "Ótimo";
  if (pontuacao > 50) return "Bom";
  if (pontuacao > 25) return "Suficiente";
  return "Regular";
}

export function avaliarC5(
  dados: Record<string, unknown>,
  dataAvaliacao: Date
): ResultadoC5 {
  /**
   * A — Consulta médica ou de enfermagem.
   *
   * O relatório do PEC separa os dias desde o último atendimento médico
   * e os dias desde o último atendimento de enfermagem. Consideramos
   * a prática atendida quando pelo menos um dos dois está dentro de
   * 6 meses (180 dias).
   */
  const diasMedico = numero(
    dados["Dias desde o último atendimento médico"]
  );

  const diasEnfermagem = numero(
    dados["Dias desde o último atendimento de enfermagem"]
  );

  const consulta = [diasMedico, diasEnfermagem]
    .filter((valor): valor is number => valor !== null)
    .some((dias) => dias >= 0 && dias <= 180);

  /**
   * B — Aferição de pressão arterial nos últimos 6 meses.
   */
  const pressao = dentroDoPeriodo(
    dados["Data da última medição de pressão arterial"],
    dataAvaliacao,
    180
  );

  /**
   * C — Peso e altura registrados simultaneamente nos últimos 12 meses.
   *
   * O PEC fornece uma única coluna de "Data da última medição de peso e altura",
   * que representa exatamente o registro simultâneo necessário para esta regra.
   */
  const pesoAltura = dentroDoPeriodo(
    dados["Data da última medição de peso e altura"],
    dataAvaliacao,
    365
  );

  /**
   * D — Pelo menos duas visitas domiciliares, com intervalo mínimo de 30 dias,
   * dentro dos últimos 12 meses.
   */
  const visitas = possuiDuasVisitasComIntervalo(
    dados["Últimas visitas domiciliares"],
    dataAvaliacao
  );

  const praticas: PraticaC5[] = [
    {
      codigo: "A",
      titulo: "Consulta médica ou de enfermagem",
      pontos: 25,
      atingida: consulta,
      detalhe: consulta
        ? "Há atendimento médico ou de enfermagem registrado nos últimos 6 meses."
        : "Não foi localizado atendimento médico ou de enfermagem dentro dos últimos 6 meses.",
    },
    {
      codigo: "B",
      titulo: "Aferição de pressão arterial",
      pontos: 25,
      atingida: pressao,
      detalhe: pressao
        ? "Há registro de pressão arterial nos últimos 6 meses."
        : "Não foi localizado registro de pressão arterial dentro dos últimos 6 meses.",
    },
    {
      codigo: "C",
      titulo: "Peso e altura",
      pontos: 25,
      atingida: pesoAltura,
      detalhe: pesoAltura
        ? "Há registro simultâneo de peso e altura nos últimos 12 meses."
        : "Não foi localizado registro simultâneo de peso e altura dentro dos últimos 12 meses.",
    },
    {
      codigo: "D",
      titulo: "Visitas domiciliares",
      pontos: 25,
      atingida: visitas,
      detalhe: visitas
        ? "Há pelo menos 2 visitas nos últimos 12 meses com intervalo mínimo de 30 dias."
        : "Não foram identificadas 2 visitas nos últimos 12 meses com intervalo mínimo de 30 dias.",
    },
  ];

  const pontuacao = praticas.reduce(
    (total, pratica) => total + (pratica.atingida ? pratica.pontos : 0),
    0
  );

  return {
    pontuacao,
    classificacao: classificar(pontuacao),
    praticas,
  };
}
