import "server-only";

export type PraticaC6 = "A" | "B" | "C" | "D";

export interface ResultadoPraticaC6 {
  codigo: PraticaC6;
  titulo: string;
  pontos: number;
  atingida: boolean;
  percentual: number;
  detalhe: string;
}

export interface ResultadoC6 {
  nome: string;
  cpf: string;
  cns: string;
  microarea: string;
  idade: string;
  praticas: ResultadoPraticaC6[];
  pontuacao: number;
  classificacao: "Ótimo" | "Bom" | "Suficiente" | "Regular";
}

function texto(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizar(v: unknown): string {
  return texto(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function numero(v: unknown): number | null {
  const n = Number(texto(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function dataBR(v: unknown): Date | null {
  const s = texto(v);
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function dentroDos12Meses(data: Date | null, referencia: Date): boolean {
  if (!data) return false;
  const dias = Math.floor((referencia.getTime() - data.getTime()) / 86400000);
  return dias >= 0 && dias <= 365;
}

function primeiroCampo(dados: Record<string, unknown>, aliases: string[]): unknown {
  const entradas = Object.entries(dados);
  for (const alias of aliases) {
    const alvo = normalizar(alias);
    const encontrado = entradas.find(([chave]) => normalizar(chave) === alvo);
    if (encontrado && texto(encontrado[1]) !== "") return encontrado[1];
  }
  return "";
}

function parseVisitas(valor: unknown): Date[] {
  const s = texto(valor);
  if (!s || s === "-") return [];
  return s
    .split(/\s+e\s+/i)
    .map(dataBR)
    .filter((d): d is Date => Boolean(d));
}

function duasVisitasValidas(valor: unknown, referencia: Date): boolean {
  const visitas = parseVisitas(valor)
    .filter((d) => dentroDos12Meses(d, referencia))
    .sort((a, b) => a.getTime() - b.getTime());

  for (let i = 0; i < visitas.length; i++) {
    for (let j = i + 1; j < visitas.length; j++) {
      const dias = Math.floor(
        (visitas[j].getTime() - visitas[i].getTime()) / 86400000,
      );
      if (dias >= 30) return true;
    }
  }

  return false;
}

function classificar(pontuacao: number): ResultadoC6["classificacao"] {
  if (pontuacao > 75) return "Ótimo";
  if (pontuacao > 50) return "Bom";
  if (pontuacao > 25) return "Suficiente";
  return "Regular";
}

/**
 * Calcula o C6 operacional a partir do relatório temático
 * "Pessoa idosa" do e-SUS PEC.
 *
 * Limitação: o CSV não informa CBO/CNS do profissional para cada evento.
 * Por isso A e B usam os últimos atendimentos e o registro de peso/altura
 * expostos pelo relatório como evidência operacional, sem afirmar que
 * reproduzem integralmente a apuração do SIAPS.
 */
export function avaliarC6(
  dados: Record<string, unknown>,
  referencia = new Date(),
): ResultadoC6 {
  const diasMedico = numero(
    primeiroCampo(dados, ["Dias desde o último atendimento médico"]),
  );
  const diasEnfermagem = numero(
    primeiroCampo(dados, ["Dias desde o último atendimento de enfermagem"]),
  );

  const dataPesoAltura = dataBR(
    primeiroCampo(dados, ["Data da última medição de peso e altura"]),
  );

  const visitas = primeiroCampo(dados, ["Últimas visitas domiciliares"]);

  const influenza = primeiroCampo(dados, ["Influenza (últimos 12 meses)"]);

  const a =
    (diasMedico !== null && diasMedico >= 0 && diasMedico <= 365) ||
    (diasEnfermagem !== null && diasEnfermagem >= 0 && diasEnfermagem <= 365);

  const b = dentroDos12Meses(dataPesoAltura, referencia);
  const c = duasVisitasValidas(visitas, referencia);

  const influenzaTexto = normalizar(influenza);
  const d =
    influenzaTexto !== "" &&
    influenzaTexto !== "-" &&
    influenzaTexto !== "nao" &&
    influenzaTexto !== "sem registro";

  const praticas: ResultadoPraticaC6[] = [
    {
      codigo: "A",
      titulo: "Consulta médica ou de enfermagem nos últimos 12 meses",
      pontos: a ? 25 : 0,
      atingida: a,
      percentual: a ? 100 : 0,
      detalhe: a
        ? "Há registro de atendimento médico ou de enfermagem nos últimos 12 meses."
        : "Não há registro de atendimento médico ou de enfermagem nos últimos 12 meses.",
    },
    {
      codigo: "B",
      titulo: "Peso + altura no mesmo dia nos últimos 12 meses",
      pontos: b ? 25 : 0,
      atingida: b,
      percentual: b ? 100 : 0,
      detalhe: b
        ? `Última medição simultânea registrada em ${texto(
            primeiroCampo(dados, ["Data da última medição de peso e altura"]),
          )}.`
        : "Não há registro simultâneo de peso e altura nos últimos 12 meses.",
    },
    {
      codigo: "C",
      titulo: "2 visitas domiciliares com intervalo mínimo de 30 dias",
      pontos: c ? 25 : 0,
      atingida: c,
      percentual: c ? 100 : 0,
      detalhe: c
        ? "Há pelo menos duas visitas domiciliares válidas, com intervalo mínimo de 30 dias."
        : "Não há duas visitas domiciliares válidas com intervalo mínimo de 30 dias nos últimos 12 meses.",
    },
    {
      codigo: "D",
      titulo: "Vacina contra influenza nos últimos 12 meses",
      pontos: d ? 25 : 0,
      atingida: d,
      percentual: d ? 100 : 0,
      detalhe: d
        ? `Há registro de influenza: ${texto(influenza)}.`
        : "Não há registro de vacina influenza nos últimos 12 meses no relatório.",
    },
  ];

  const pontuacao = praticas.reduce((soma, item) => soma + item.pontos, 0);

  return {
    nome: texto(primeiroCampo(dados, ["Nome"])),
    cpf: texto(primeiroCampo(dados, ["CPF"])),
    cns: texto(primeiroCampo(dados, ["CNS"])),
    microarea: texto(primeiroCampo(dados, ["Microárea"])).replace(/"/g, ""),
    idade: texto(primeiroCampo(dados, ["Idade"])),
    praticas,
    pontuacao,
    classificacao: classificar(pontuacao),
  };
}
