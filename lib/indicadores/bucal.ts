/**
 * Saúde Bucal — B1 a B6.
 *
 * O relatório temático do PEC já é armazenado no histórico das importações.
 * Este motor apenas lê os campos odontológicos existentes, sem criar uma
 * segunda base de pacientes.
 *
 * Quando o CSV não contém o denominador necessário para uma nota metodológica,
 * o indicador fica como "Indisponível" em vez de ser transformado em 0%.
 */

export type StatusBucal = "Disponível" | "Indisponível";

export type PraticaBucal = {
  codigo: "B1" | "B2" | "B3" | "B4" | "B5" | "B6";
  titulo: string;
  peso: number;
  numerador: number;
  denominador: number | null;
  percentual: number | null;
  status: StatusBucal;
  descricao: string;
  motivo?: string;
};

export type PacienteBucal = {
  id: string;
  nome: string;
  cpf?: string;
  cns?: string;
  idade?: number;
  microarea?: string;
  b1: boolean;
  b2: boolean;
  b3: boolean;
  b4: boolean;
  b5: boolean;
  b6: boolean;
  detalhes: Record<string, string>;
};

export type ResultadoBucal = {
  sucesso: true;
  totalRegistros: number;
  praticas: Record<PraticaBucal["codigo"], PraticaBucal>;
  pacientes: PacienteBucal[];
};

function normalizar(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function campo(registro: Record<string, unknown>, aliases: string[]): string {
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

function temValor(valor: string): boolean {
  return valor.trim() !== "" && valor.trim() !== "-";
}

function parseIdade(valor: string): number | null {
  const m = valor.match(/\d+/);
  return m ? Number(m[0]) : null;
}

function percentual(n: number, d: number | null): number | null {
  if (d === null || d <= 0) return null;
  return Number(((n / d) * 100).toFixed(1));
}

export function avaliarBucal(
  registrosEntrada: Record<string, unknown>[]
): ResultadoBucal {
  const registros = registrosEntrada.map((registro, index) => {
    const dadosBase =
      registro.dadosBase && typeof registro.dadosBase === "object"
        ? (registro.dadosBase as Record<string, unknown>)
        : {};
    const dadosEspecificos =
      registro.dadosEspecificos && typeof registro.dadosEspecificos === "object"
        ? (registro.dadosEspecificos as Record<string, unknown>)
        : {};
    return { ...dadosBase, ...dadosEspecificos, ...registro, __index: index };
  });

  const pacientes: PacienteBucal[] = registros.map((registro, index) => {
    const nome = campo(registro, ["Nome"]) || "Paciente sem nome";
    const idade = parseIdade(campo(registro, ["Idade"]));
    const microarea = campo(registro, ["Microárea", "Microarea"]);
    const primeira = campo(registro, ["Primeira Consulta"]);
    const concluido = campo(registro, ["Tratamento odontológico concluído"]);
    const art = campo(registro, ["Último tratamento restaurador atraumático"]);
    const escovacao = campo(registro, ["Registro de escovação supervisionada em atividade coletiva"]);
    const exodontias = campo(registro, ["Exodontias de dentes realizadas (decíduos e permanentes)"]);
    const preventivos = campo(registro, ["Procedimento odontológicos preventivos"]);

    return {
      id: String(
  (registro as Record<string, unknown>).id ??
  registro.__index ??
  index
),
      nome,
      cpf: campo(registro, ["CPF"]) || undefined,
      cns: campo(registro, ["CNS"]) || undefined,
      idade: idade ?? undefined,
      microarea: microarea || undefined,
      b1: temValor(primeira),
      b2: temValor(concluido),
      b3: temValor(exodontias),
      b4: temValor(escovacao),
      b5: temValor(preventivos),
      b6: temValor(art),
      detalhes: {
        B1: primeira,
        B2: concluido,
        B3: exodontias,
        B4: escovacao,
        B5: preventivos,
        B6: art,
      },
    };
  });

  const total = pacientes.length;
  const faixaB4 = pacientes.filter((p) => p.idade !== undefined && p.idade >= 6 && p.idade <= 12);
  const b1n = pacientes.filter((p) => p.b1).length;
  const b4n = faixaB4.filter((p) => p.b4).length;
  const b2n = pacientes.filter((p) => p.b2).length;
  const b3n = pacientes.filter((p) => p.b3).length;
  const b5n = pacientes.filter((p) => p.b5).length;
  const b6n = pacientes.filter((p) => p.b6).length;

  const indisponivel = (codigo: PraticaBucal["codigo"], titulo: string, peso: number, n: number, motivo: string): PraticaBucal => ({
    codigo,
    titulo,
    peso,
    numerador: n,
    denominador: null,
    percentual: null,
    status: "Indisponível",
    descricao: titulo,
    motivo,
  });

  return {
    sucesso: true,
    totalRegistros: total,
    pacientes,
    praticas: {
      B1: {
        codigo: "B1",
        titulo: "Primeira consulta programada",
        peso: 2,
        numerador: b1n,
        denominador: total,
        percentual: percentual(b1n, total),
        status: total > 0 ? "Disponível" : "Indisponível",
        descricao: "Pessoas vinculadas que realizaram primeira consulta odontológica programada.",
      },
      B2: indisponivel("B2", "Tratamento concluído", 2, b2n, "O relatório temático não fornece, de forma suficiente, o denominador de primeiras consultas necessário para o cálculo oficial."),
      B3: indisponivel("B3", "Taxa de exodontia", 2, b3n, "O relatório não traz o total de procedimentos clínicos individuais necessário para o denominador oficial."),
      B4: {
        codigo: "B4",
        titulo: "Escovação supervisionada",
        peso: 2,
        numerador: b4n,
        denominador: faixaB4.length,
        percentual: percentual(b4n, faixaB4.length),
        status: faixaB4.length > 0 ? "Disponível" : "Indisponível",
        descricao: "Crianças de 6 a 12 anos beneficiadas por escovação dental supervisionada.",
      },
      B5: indisponivel("B5", "Procedimentos preventivos", 1, b5n, "O relatório mostra os procedimentos preventivos registrados, mas não fornece o total de procedimentos odontológicos individuais para o denominador oficial."),
      B6: indisponivel("B6", "Tratamento restaurador atraumático", 1, b6n, "O relatório não traz o total de procedimentos restauradores necessário para o denominador oficial."),
    },
  };
}
