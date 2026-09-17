import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { avaliarC2Infantil } from "@/lib/indicadores/c2-infantil";

export const runtime = "nodejs";

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function dataParaTexto(valor: unknown): string {
  if (!valor) return "";

  if (
    typeof valor === "object" &&
    valor !== null &&
    "toDate" in valor &&
    typeof (valor as { toDate?: unknown }).toDate === "function"
  ) {
    const data = (valor as { toDate: () => Date }).toDate();
    return data.toLocaleDateString("pt-BR");
  }

  if (valor instanceof Date) {
    return valor.toLocaleDateString("pt-BR");
  }

  return texto(valor);
}

function mesmoPaciente(
  dados: Record<string, unknown>,
  paciente: Record<string, unknown>
): boolean {
  const cpfA = texto(dados.CPF || dados.cpf);
  const cpfB = texto(paciente.cpf);

  if (cpfA && cpfB) {
    const a = cpfA.replace(/\D/g, "");
    const b = cpfB.replace(/\D/g, "");
    if (a && b) return a === b;
  }

  const cnsA = texto(dados.CNS || dados.cns);
  const cnsB = texto(paciente.cns);

  if (cnsA && cnsB) {
    const a = cnsA.replace(/\D/g, "");
    const b = cnsB.replace(/\D/g, "");
    if (a && b) return a === b;
  }

  const nomeA = texto(dados.Nome || dados.nome).toLocaleLowerCase();
  const nomeB = texto(paciente.nome).toLocaleLowerCase();

  return Boolean(nomeA && nomeB && nomeA === nomeB);
}

function textoListaTematica(valor: unknown): string {
  if (Array.isArray(valor)) {
    return valor.filter((item) => typeof item === "string").join(", ");
  }

  return texto(valor);
}

type AcaoOperacional = {
  nome: string;
  status: "Registrado" | "Revisar";
  detalhe: string;
};

function normalizar(valor: unknown): string {
  return texto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
}

function valorPreenchido(valor: unknown): boolean {
  if (valor === null || valor === undefined) return false;

  if (typeof valor === "number") {
    return Number.isFinite(valor) && valor > 0;
  }

  if (typeof valor === "boolean") return valor;

  const v = texto(valor);

  if (!v) return false;

  const n = Number(v.replace(",", "."));
  if (Number.isFinite(n)) return n > 0;

  const normalizado = normalizar(v);

  return ![
    "-",
    "nao",
    "não",
    "n",
    "no",
    "nao informado",
    "não informado",
    "nenhum",
    "nenhuma",
    "0",
  ].includes(normalizado);
}

function encontrarValorPorCampo(
  registro: Record<string, unknown>,
  termosCampo: string[]
): unknown {
  const entradas = Object.entries(registro).filter(
    ([chave]) =>
      chave !== "__index" &&
      chave !== "dadosBase" &&
      chave !== "dadosEspecificos"
  );

  for (const termo of termosCampo) {
    const termoNormalizado = normalizar(termo);

    const encontrado = entradas.find(([chave]) =>
      normalizar(chave).includes(termoNormalizado)
    );

    if (encontrado && valorPreenchido(encontrado[1])) {
      return encontrado[1];
    }
  }

  return undefined;
}

function numeroC6(valor: unknown): number | null {
  const n = Number(texto(valor).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function dataBRC6(valor: unknown): Date | null {
  const s = texto(valor);
  const match = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const data = new Date(
    Number(match[3]),
    Number(match[2]) - 1,
    Number(match[1]),
  );

  return Number.isNaN(data.getTime()) ? null : data;
}

function dentro12MesesC6(
  data: Date | null,
  referencia: Date,
): boolean {
  if (!data) return false;

  const dias = Math.floor(
    (referencia.getTime() - data.getTime()) / 86400000,
  );

  return dias >= 0 && dias <= 365;
}

function primeiroCampoC6(
  dados: Record<string, unknown>,
  aliases: string[],
): unknown {
  const entradas = Object.entries(dados);

  for (const alias of aliases) {
    const alvo = normalizar(alias);

    const encontrado = entradas.find(
      ([chave]) => normalizar(chave) === alvo,
    );

    if (encontrado && valorPreenchido(encontrado[1])) {
      return encontrado[1];
    }
  }

  return "";
}

function visitasC6(valor: unknown): Date[] {
  const s = texto(valor);

  if (!s || normalizar(s) === "-") return [];

  return s
    .split(/\s+e\s+/i)
    .map(dataBRC6)
    .filter((data): data is Date => Boolean(data));
}

function duasVisitasValidasC6(
  valor: unknown,
  referencia: Date,
): boolean {
  const datas = visitasC6(valor)
    .filter((data) => dentro12MesesC6(data, referencia))
    .sort((a, b) => a.getTime() - b.getTime());

  for (let i = 0; i < datas.length; i++) {
    for (let j = i + 1; j < datas.length; j++) {
      const intervalo = Math.floor(
        (datas[j].getTime() - datas[i].getTime()) / 86400000,
      );

      if (intervalo >= 30) return true;
    }
  }

  return false;
}

function criarAcoesC6(
  registro: Record<string, unknown>,
  referencia = new Date(),
): AcaoOperacional[] {
  /*
   * C6 — Pessoa Idosa
   *
   * O relatório "Pessoa idosa" do e-SUS já entrega campos específicos:
   * - Dias desde o último atendimento médico/enfermagem
   * - Data da última medição de peso e altura
   * - Últimas visitas domiciliares
   * - Quantidade de visitas domiciliares
   * - Registros de peso e altura simultâneos nos últimos 12 meses
   * - Influenza (últimos 12 meses)
   *
   * A ficha usa esses campos diretamente. A existência da coluna não é
   * considerada evidência de realização: o valor precisa estar preenchido.
   */

  const diasMedico = numeroC6(
    primeiroCampoC6(registro, [
      "Dias desde o último atendimento médico",
    ]),
  );

  const diasEnfermagem = numeroC6(
    primeiroCampoC6(registro, [
      "Dias desde o último atendimento de enfermagem",
    ]),
  );

  const dataPesoAltura = dataBRC6(
    primeiroCampoC6(registro, [
      "Data da última medição de peso e altura",
    ]),
  );

  const quantidadePesoAltura = numeroC6(
    primeiroCampoC6(registro, [
      "Registros de peso e altura simultâneos nos últimos 12 meses",
    ]),
  );

  const ultimasVisitas = primeiroCampoC6(registro, [
    "Últimas visitas domiciliares",
  ]);

  const quantidadeVisitas = numeroC6(
    primeiroCampoC6(registro, [
      "Quantidade de visitas domiciliares",
    ]),
  );

  const influenza = primeiroCampoC6(registro, [
    "Influenza (últimos 12 meses)",
  ]);

  // A) Consulta médica OU de enfermagem nos últimos 12 meses.
  const consulta =
    (diasMedico !== null && diasMedico >= 0 && diasMedico <= 365) ||
    (diasEnfermagem !== null &&
      diasEnfermagem >= 0 &&
      diasEnfermagem <= 365);

  // B) O relatório informa a quantidade de registros simultâneos.
  // Exigimos pelo menos um e uma data dentro dos últimos 12 meses.
  const pesoAltura =
    quantidadePesoAltura !== null &&
    quantidadePesoAltura > 0 &&
    dentro12MesesC6(dataPesoAltura, referencia);

  // C) O relatório informa tanto a quantidade quanto as duas últimas datas.
  // A quantidade deve ser >= 2 e as duas datas precisam estar no período,
  // com intervalo mínimo de 30 dias.
  const visitas =
    quantidadeVisitas !== null &&
    quantidadeVisitas >= 2 &&
    duasVisitasValidasC6(ultimasVisitas, referencia);

  // D) O próprio relatório é filtrado por "Influenza (últimos 12 meses)".
  // Qualquer valor real/preenchido é evidência; "-" e valores equivalentes não.
  const influenzaTexto = normalizar(influenza);
  const influenzaRegistrada =
    valorPreenchido(influenza) &&
    influenzaTexto !== "sem registro";

  return [
    {
      nome: "Consulta",
      status: consulta ? "Registrado" : "Revisar",
      detalhe: consulta
        ? "Há atendimento médico ou de enfermagem registrado nos últimos 12 meses."
        : "Não há atendimento médico ou de enfermagem registrado nos últimos 12 meses.",
    },
    {
      nome: "Peso + altura",
      status: pesoAltura ? "Registrado" : "Revisar",
      detalhe: pesoAltura
        ? `Há ${quantidadePesoAltura} registro(s) simultâneo(s) de peso e altura nos últimos 12 meses.`
        : "Não há registro simultâneo de peso e altura nos últimos 12 meses.",
    },
    {
      nome: "Visita domiciliar",
      status: visitas ? "Registrado" : "Revisar",
      detalhe: visitas
        ? "Há pelo menos 2 visitas domiciliares nos últimos 12 meses, com intervalo mínimo de 30 dias."
        : `Há ${
            quantidadeVisitas ?? 0
          } visita(s) domiciliar(es) registrada(s), mas não foram encontradas 2 visitas válidas com intervalo mínimo de 30 dias nos últimos 12 meses.`,
    },
    {
      nome: "Influenza",
      status: influenzaRegistrada ? "Registrado" : "Revisar",
      detalhe: influenzaRegistrada
        ? `Há registro de influenza no período de 12 meses: ${texto(influenza)}.`
        : "Não há registro de vacina influenza nos últimos 12 meses no relatório.",
    },
  ];
}

function criarAcoesC5(
  registro: Record<string, unknown>,
  referencia = new Date(),
): AcaoOperacional[] {
  /*
   * C5 — Hipertensão
   *
   * A) Consulta nos últimos 6 meses.
   * B) Pressão arterial nos últimos 6 meses.
   * C) Peso + altura simultâneos nos últimos 12 meses.
   * D) Pelo menos 2 visitas domiciliares nos últimos 12 meses,
   *    com intervalo mínimo de 30 dias.
   *
   * A ficha operacional não considera a existência da coluna como evidência.
   * O valor/data precisa estar preenchido e dentro da janela correspondente.
   */

  const diasMedico = numeroC6(
    primeiroCampoC6(registro, [
      "Dias desde o último atendimento médico",
    ]),
  );

  const diasEnfermagem = numeroC6(
    primeiroCampoC6(registro, [
      "Dias desde o último atendimento de enfermagem",
    ]),
  );

  const diasPressao = numeroC6(
    primeiroCampoC6(registro, [
      "Dias desde a última medição de pressão arterial",
    ]),
  );

  const dataPesoAltura = dataBRC6(
    primeiroCampoC6(registro, [
      "Data da última medição de peso e altura",
    ]),
  );

  const quantidadePesoAltura = numeroC6(
    primeiroCampoC6(registro, [
      "Registros de peso e altura simultâneos nos últimos 12 meses",
    ]),
  );

  const ultimasVisitas = primeiroCampoC6(registro, [
    "Últimas visitas domiciliares",
  ]);

  const quantidadeVisitas = numeroC6(
    primeiroCampoC6(registro, [
      "Quantidade de visitas domiciliares",
    ]),
  );

  const consulta =
    (diasMedico !== null && diasMedico >= 0 && diasMedico <= 180) ||
    (diasEnfermagem !== null &&
      diasEnfermagem >= 0 &&
      diasEnfermagem <= 180);

  const pressao =
    diasPressao !== null &&
    diasPressao >= 0 &&
    diasPressao <= 180;

  const pesoAltura =
    quantidadePesoAltura !== null &&
    quantidadePesoAltura > 0 &&
    dentro12MesesC6(dataPesoAltura, referencia);

  const visitas =
    quantidadeVisitas !== null &&
    quantidadeVisitas >= 2 &&
    duasVisitasValidasC6(ultimasVisitas, referencia);

  return [
    {
      nome: "Consulta",
      status: consulta ? "Registrado" : "Revisar",
      detalhe: consulta
        ? "Há atendimento médico ou de enfermagem registrado nos últimos 6 meses."
        : "Não há atendimento médico ou de enfermagem registrado nos últimos 6 meses.",
    },
    {
      nome: "Pressão arterial",
      status: pressao ? "Registrado" : "Revisar",
      detalhe: pressao
        ? "Há medição de pressão arterial registrada nos últimos 6 meses."
        : "Não há medição de pressão arterial registrada nos últimos 6 meses.",
    },
    {
      nome: "Peso + altura",
      status: pesoAltura ? "Registrado" : "Revisar",
      detalhe: pesoAltura
        ? `Há ${quantidadePesoAltura} registro(s) simultâneo(s) de peso e altura nos últimos 12 meses.`
        : "Não há registro simultâneo de peso e altura nos últimos 12 meses.",
    },
    {
      nome: "Visita domiciliar",
      status: visitas ? "Registrado" : "Revisar",
      detalhe: visitas
        ? "Há pelo menos 2 visitas domiciliares nos últimos 12 meses, com intervalo mínimo de 30 dias."
        : `Há ${
            quantidadeVisitas ?? 0
          } visita(s) domiciliar(es) registrada(s), mas não foram encontradas 2 visitas válidas com intervalo mínimo de 30 dias nos últimos 12 meses.`,
    },
  ];
}

function criarAcoesC4(
  registro: Record<string, unknown>,
  referencia = new Date(),
): AcaoOperacional[] {
  /*
   * C4 — Diabetes
   *
   * A) Consulta médica ou de enfermagem nos últimos 6 meses.
   * B) Pressão arterial nos últimos 6 meses.
   * C) Peso + altura simultâneos nos últimos 12 meses.
   * D) Pelo menos 2 visitas domiciliares nos últimos 12 meses,
   *    com intervalo mínimo de 30 dias.
   * E) HbA1c solicitada ou avaliada nos últimos 12 meses.
   * F) Avaliação dos pés nos últimos 12 meses.
   *
   * A existência de uma coluna não é considerada realização.
   * O valor/data precisa fornecer evidência real no registro do PEC.
   */

  const diasMedico = numeroC6(
    primeiroCampoC6(registro, [
      "Dias desde o último atendimento médico",
    ]),
  );

  const diasEnfermagem = numeroC6(
    primeiroCampoC6(registro, [
      "Dias desde o último atendimento de enfermagem",
    ]),
  );

  const diasPressao = numeroC6(
    primeiroCampoC6(registro, [
      "Dias desde a última medição de pressão arterial",
    ]),
  );

  const dataPesoAltura = dataBRC6(
    primeiroCampoC6(registro, [
      "Data da última medição de peso e altura",
    ]),
  );

  const quantidadePesoAltura = numeroC6(
    primeiroCampoC6(registro, [
      "Registros de peso e altura simultâneos nos últimos 12 meses",
    ]),
  );

  const ultimasVisitas = primeiroCampoC6(registro, [
    "Últimas visitas domiciliares",
  ]);

  const quantidadeVisitas = numeroC6(
    primeiroCampoC6(registro, [
      "Quantidade de visitas domiciliares",
    ]),
  );

  const dataHbA1cAvaliacao = dataBRC6(
    primeiroCampoC6(registro, [
      "Data da última avaliação de hemoglobina glicada",
      "Data da última avaliação de hemoglobina glicosilada",
      "Última avaliação de hemoglobina glicada",
      "Última avaliação de hemoglobina glicosilada",
    ]),
  );

  const dataHbA1cSolicitacao = dataBRC6(
    primeiroCampoC6(registro, [
      "Data da última solicitação de hemoglobina glicada",
      "Data da última solicitação de hemoglobina glicosilada",
      "Última solicitação de hemoglobina glicada",
      "Última solicitação de hemoglobina glicosilada",
    ]),
  );

  const dataPes = dataBRC6(
    primeiroCampoC6(registro, [
      "Data da última avaliação dos pés",
      "Data da última avaliação de pé diabético",
      "Última avaliação dos pés",
      "Última avaliação de pé diabético",
    ]),
  );

  const consulta =
    (diasMedico !== null && diasMedico >= 0 && diasMedico <= 180) ||
    (diasEnfermagem !== null &&
      diasEnfermagem >= 0 &&
      diasEnfermagem <= 180);

  const pressao =
    diasPressao !== null &&
    diasPressao >= 0 &&
    diasPressao <= 180;

  const pesoAltura =
    quantidadePesoAltura !== null &&
    quantidadePesoAltura > 0 &&
    dentro12MesesC6(dataPesoAltura, referencia);

  const visitas =
    quantidadeVisitas !== null &&
    quantidadeVisitas >= 2 &&
    duasVisitasValidasC6(ultimasVisitas, referencia);

  const hba1c =
    dentro12MesesC6(dataHbA1cAvaliacao, referencia) ||
    dentro12MesesC6(dataHbA1cSolicitacao, referencia);

  const pes =
    dentro12MesesC6(dataPes, referencia);

  return [
    {
      nome: "Consulta",
      status: consulta ? "Registrado" : "Revisar",
      detalhe: consulta
        ? "Há atendimento médico ou de enfermagem registrado nos últimos 6 meses."
        : "Não há atendimento médico ou de enfermagem registrado nos últimos 6 meses.",
    },
    {
      nome: "Pressão arterial",
      status: pressao ? "Registrado" : "Revisar",
      detalhe: pressao
        ? "Há medição de pressão arterial registrada nos últimos 6 meses."
        : "Não há medição de pressão arterial registrada nos últimos 6 meses.",
    },
    {
      nome: "Peso + altura",
      status: pesoAltura ? "Registrado" : "Revisar",
      detalhe: pesoAltura
        ? "Há registro simultâneo de peso e altura nos últimos 12 meses."
        : "Não há registro simultâneo de peso e altura nos últimos 12 meses.",
    },
    {
      nome: "Visita domiciliar",
      status: visitas ? "Registrado" : "Revisar",
      detalhe: visitas
        ? "Há pelo menos 2 visitas domiciliares nos últimos 12 meses, com intervalo mínimo de 30 dias."
        : `Há ${
            quantidadeVisitas ?? 0
          } visita(s) domiciliar(es) registrada(s), mas não foram encontradas 2 visitas válidas com intervalo mínimo de 30 dias nos últimos 12 meses.`,
    },
    {
      nome: "HbA1c",
      status: hba1c ? "Registrado" : "Revisar",
      detalhe: hba1c
        ? "Há solicitação ou avaliação de hemoglobina glicada registrada nos últimos 12 meses."
        : "Não foi localizada solicitação ou avaliação de hemoglobina glicada nos últimos 12 meses.",
    },
    {
      nome: "Avaliação dos pés",
      status: pes ? "Registrado" : "Revisar",
      detalhe: pes
        ? "Há avaliação dos pés registrada nos últimos 12 meses."
        : "Não foi localizada avaliação dos pés nos últimos 12 meses.",
    },
  ];
}

function criarAcoes(
  indicador: string,
  registro: Record<string, unknown>,
): AcaoOperacional[] {
  if (indicador === "C6") {
    return criarAcoesC6(registro);
  }

  if (indicador === "C5") {
    return criarAcoesC5(registro);
  }

  if (indicador === "C4") {
    return criarAcoesC4(registro);
  }

  const regras: Record<
    string,
    Array<{ nome: string; campos: string[] }>
  > = {
    C4: [],
    C5: [],
    C6: [],

    C7: [
      {
        nome: "Rastreamento do colo do útero",
        campos: [
          "exame de rastreamento de câncer de colo de útero data última avaliação",
          "exame de rastreamento de câncer de colo de útero última avaliação",
          "exame de rastreamento de câncer de colo de útero última solicitação",
          "hpv",
        ],
      },
      {
        nome: "Saúde sexual e reprodutiva",
        campos: [
          "data da última consulta de saúde sexual e reprodutiva",
        ],
      },
      {
        nome: "Rastreamento de mama",
        campos: [
          "exame de rastreamento de câncer de mama data última realização",
          "exame de rastreamento de câncer de mama data última avaliação",
          "exame de rastreamento de câncer de mama data última solicitação",
        ],
      },
    ],

    "B1–B6": [
      {
        nome: "Primeira consulta odontológica",
        campos: ["primeira consulta"],
      },
      {
        nome: "Tratamento odontológico concluído",
        campos: ["tratamento odontológico concluído"],
      },
      {
        nome: "Procedimentos preventivos",
        campos: ["procedimento odontológicos preventivos"],
      },
      {
        nome: "Tratamento restaurador atraumático",
        campos: ["último tratamento restaurador atraumático"],
      },
      {
        nome: "Exodontias",
        campos: ["exodontias de dentes realizadas"],
      },
      {
        nome: "Escovação supervisionada",
        campos: ["registro de escovação supervisionada em atividade coletiva"],
      },
    ],

    C2: [
      {
        nome: "Acompanhamento infantil",
        campos: [
          "data da primeira consulta",
          "quantidade de consultas até 24 meses",
        ],
      },
      {
        nome: "Peso + altura",
        campos: [
          "quantidade de medições de peso/altura simultâneas até 24 meses",
          "data da última medição de peso e altura",
        ],
      },
      {
        nome: "Visitas domiciliares",
        campos: [
          "quantidade de visitas domiciliares até os 24 meses de idade",
          "data da primeira visita domiciliar",
          "data da segunda visita domiciliar",
        ],
      },
      {
        nome: "Vacinas recomendadas",
        campos: [
          "difteria, tétano, pertusis, hepatite b, haemophilus influenza b",
          "poliomielite",
          "sarampo, caxumba, rubéola",
          "pneumocócica",
        ],
      },
    ],

    C3: [
      {
        nome: "Pré-natal",
        campos: [
          "quantidade de atendimentos no pré-natal",
          "última consulta de pré-natal",
          "quantidade de atendimentos até 12 semanas no pré-natal",
        ],
      },
      {
        nome: "Pressão arterial",
        campos: ["quantidade de medições de pressão arterial"],
      },
      {
        nome: "Peso + altura",
        campos: ["quantidade de medições simultâneas de peso e altura"],
      },
      {
        nome: "Visitas domiciliares",
        campos: ["quantidade de visitas domiciliares no pré-natal"],
      },
      {
        nome: "dTpa",
        campos: ["dtpa"],
      },
      {
        nome: "Exames do pré-natal",
        campos: [
          "exame de hiv no primeiro trimestre",
          "exame de sífilis no primeiro trimestre",
          "exame de hepatite b no primeiro trimestre",
          "exame de hepatite c no primeiro trimestre",
          "exame de hiv no terceiro trimestre",
          "exame de sifilis no terceiro trimestre",
        ],
      },
      {
        nome: "Puerpério",
        campos: [
          "quantidade de atendimentos no puerpério",
          "última consulta de puerpério",
          "quantidade de visitas domiciliares no puerpério",
        ],
      },
      {
        nome: "Saúde bucal no pré-natal",
        campos: ["quantidade de atendimentos odontológicos no pré-natal"],
      },
    ],
  };

  const selecionadas = regras[indicador] || [];

  return selecionadas.map((regra) => {
    const valor = encontrarValorPorCampo(registro, regra.campos);
    const registrado = valorPreenchido(valor);

    return {
      nome: regra.nome,
      status: registrado ? "Registrado" : "Revisar",
      detalhe: registrado
        ? "Há dado preenchido correspondente no histórico importado do PEC."
        : "Não foi localizado dado preenchido correspondente no histórico importado. Conferir acompanhamento.",
    };
  });
}

function identificarTematicas(
  registros: Record<string, unknown>[]
): Array<{
  nome: string;
  indicador: string;
  status: "Registrado" | "Revisar";
  detalhe: string;
  acoes: AcaoOperacional[];
}> {
  const resultado: Array<{
    nome: string;
    indicador: string;
    status: "Registrado" | "Revisar";
    detalhe: string;
    acoes: AcaoOperacional[];
  }> = [];

  const regrasTematicas = [
    { termos: ["infantil", "crianca"], nome: "Desenvolvimento infantil", indicador: "C2" },
    { termos: ["gestante", "gestacao", "puerperio"], nome: "Gestação e puerpério", indicador: "C3" },
    { termos: ["diabetes"], nome: "Diabetes", indicador: "C4" },
    { termos: ["hipertens"], nome: "Hipertensão", indicador: "C5" },
    { termos: ["idos"], nome: "Pessoa idosa", indicador: "C6" },
    { termos: ["mulher"], nome: "Saúde da mulher", indicador: "C7" },
    { termos: ["bucal"], nome: "Saúde bucal", indicador: "B1–B6" },
  ];

  for (const registro of registros) {
    const base =
      registro.dadosBase && typeof registro.dadosBase === "object"
        ? (registro.dadosBase as Record<string, unknown>)
        : {};

    const especificos =
      registro.dadosEspecificos &&
      typeof registro.dadosEspecificos === "object"
        ? (registro.dadosEspecificos as Record<string, unknown>)
        : {};

    const combinado: Record<string, unknown> = {
      ...base,
      ...especificos,
      ...registro,
    };

    const lista = textoListaTematica(
      registro.listaTematica || combinado.listaTematica
    );

    const origem = normalizar(lista);
    const regra = regrasTematicas.find((item) =>
      item.termos.some((termo) => origem.includes(normalizar(termo)))
    );

    if (!regra) continue;

    // C2 só pode aparecer para crianças elegíveis (até 24 meses).
    // Reutilizamos o motor oficial/operacional do próprio indicador C2 para
    // evitar que a ficha da ACS mantenha uma regra de idade diferente.
    if (regra.indicador === "C2") {
      const resultadoC2 = avaliarC2Infantil(combinado, {
        referencia: new Date(),
        metadados: { listaTematica: lista },
      });

      if (!resultadoC2.elegivel) {
        continue;
      }
    }

    const acoes = criarAcoes(regra.indicador, combinado);
    const temRevisar = acoes.some((acao) => acao.status === "Revisar");

    resultado.push({
      nome: regra.nome,
      indicador: regra.indicador,
      status: temRevisar ? "Revisar" : "Registrado",
      detalhe: `Paciente encontrado no relatório temático ${lista || "do PEC"}.`,
      acoes,
    });
  }

  const unicos = new Map<string, (typeof resultado)[number]>();

  for (const item of resultado) {
    const anterior = unicos.get(item.indicador);

    if (!anterior) {
      unicos.set(item.indicador, item);
      continue;
    }

    const acoesMap = new Map<string, AcaoOperacional>();

    for (const acao of [...anterior.acoes, ...item.acoes]) {
      const existente = acoesMap.get(acao.nome);

      // Se qualquer registro possuir evidência, a ação fica registrada.
      // Só fica "Revisar" quando nenhum registro trouxe evidência.
      if (!existente || acao.status === "Registrado") {
        acoesMap.set(acao.nome, acao);
      }
    }

    const acoes = Array.from(acoesMap.values());

    unicos.set(item.indicador, {
      ...anterior,
      status: acoes.some((acao) => acao.status === "Revisar")
        ? "Revisar"
        : "Registrado",
      acoes,
    });
  }

  return Array.from(unicos.values());
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{ uid: string; pacienteId: string }>;
  }
) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Sessão não autenticada." },
        { status: 401 }
      );
    }

    const token = authorization.slice("Bearer ".length).trim();
    const decoded = await adminAuth.verifyIdToken(token);

    const { uid, pacienteId } = await context.params;

    const usuarioSnap = await adminDb
      .collection("usuarios")
      .doc(decoded.uid)
      .get();

    if (!usuarioSnap.exists) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Usuário não encontrado." },
        { status: 403 }
      );
    }

    const usuario = usuarioSnap.data();

    if (
      usuario?.ativo !== true ||
      usuario?.perfil !== "acs" ||
      typeof usuario?.ubsId !== "string"
    ) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Acesso permitido somente para ACS ativo." },
        { status: 403 }
      );
    }

    if (uid !== decoded.uid) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Você não pode acessar outro ACS." },
        { status: 403 }
      );
    }

    const ubsRef = adminDb.collection("ubs").doc(usuario.ubsId);
    const acsSnap = await ubsRef.collection("acs").doc(uid).get();

    if (!acsSnap.exists) {
      return NextResponse.json(
        { sucesso: false, mensagem: "ACS não encontrado." },
        { status: 404 }
      );
    }

    const acs = acsSnap.data();

    if (acs?.ativo !== true) {
      return NextResponse.json(
        { sucesso: false, mensagem: "ACS inativo." },
        { status: 403 }
      );
    }

    const pacienteRef = ubsRef.collection("pacientes").doc(pacienteId);
    const pacienteSnap = await pacienteRef.get();

    if (!pacienteSnap.exists) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Paciente não encontrado." },
        { status: 404 }
      );
    }

    const paciente = pacienteSnap.data() || {};

    if (texto(paciente.microareaId) !== texto(acs.microareaId)) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Paciente fora da microárea deste ACS." },
        { status: 403 }
      );
    }

    const pacientePublico = {
      id: pacienteSnap.id,
      nome: texto(paciente.nome),
      cpf: texto(paciente.cpf),
      cns: texto(paciente.cns),
      idade: paciente.idade ?? "",
      sexo: texto(paciente.sexo),
      dataNascimento: texto(paciente.dataNascimento),
      microareaId: texto(paciente.microareaId),
      telefoneCelular: texto(paciente.telefoneCelular),
      telefoneContato: texto(paciente.telefoneContato),
      endereco:
        paciente.endereco && typeof paciente.endereco === "object"
          ? paciente.endereco
          : {},
    };

    const registros: Record<string, unknown>[] = [];

    const importacoesSnap = await ubsRef.collection("importacoesPEC").get();

    for (const importacaoDoc of importacoesSnap.docs) {
      const registroSnap = await importacaoDoc.ref
        .collection("registros")
        .doc(pacienteSnap.id)
        .get();

      if (!registroSnap.exists) continue;

      const registro = registroSnap.data() || {};

      if (
        mesmoPaciente(
          registro.dadosBase && typeof registro.dadosBase === "object"
            ? (registro.dadosBase as Record<string, unknown>)
            : {},
          pacientePublico
        )
      ) {
        registros.push({
          ...registro,
          listaTematica:
            registro.listaTematica || importacaoDoc.data().listaTematica || "",
        });
      }
    }

    const acompanhamentosSnap = await pacienteRef
      .collection("acompanhamentos")
      .orderBy("criadoEm", "desc")
      .limit(30)
      .get()
      .catch(async () => pacienteRef.collection("acompanhamentos").limit(30).get());

    const acompanhamentos = acompanhamentosSnap.docs.map((doc) => {
      const dados = doc.data();

      return {
        id: doc.id,
        tipo: texto(dados.tipo),
        data: dataParaTexto(dados.data || dados.criadoEm),
        observacao: texto(dados.observacao),
        acsNome: texto(dados.acsNome),
      };
    });

    return NextResponse.json({
      sucesso: true,
      paciente: {
        ...pacientePublico,
        tematicas: identificarTematicas(registros),
        acompanhamentos,
      },
    });
  } catch (error) {
    console.error("Erro ao carregar ficha operacional do paciente:", error);

    return NextResponse.json(
      {
        sucesso: false,
        mensagem:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar a ficha do paciente.",
      },
      { status: 500 }
    );
  }
}
