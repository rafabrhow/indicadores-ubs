import { adminDb } from "@/lib/firebase-admin";
import { avaliarC2Infantil } from "@/lib/indicadores/c2-infantil";
import { avaliarC3Gestacao } from "@/lib/indicadores/c3-gestacao";
import { avaliarC4Diabetes } from "@/lib/indicadores/c4-diabetes";
import { avaliarC5Hipertensao } from "@/lib/indicadores/c5-hipertensao";
import { avaliarC6 } from "@/lib/indicadores/c6-idoso";
import { avaliarC7 } from "@/lib/indicadores/c7-mulher";

type Dados = Record<string, any>;

type RegistroHistorico = {
  pacienteId: string;
  importacaoId: string;
  criadoEm: Date;
  listaTematica: string;
  grupoCondicoes: string;
  filtroProblemas: string;
  dadosBase: Dados;
  dadosEspecificos: Dados;
};

export type IndicadorSituacaoPaciente = {
  codigo: "C2" | "C3" | "C4" | "C5" | "C6" | "C7";
  status: "pendente" | "concluido";
};

export type PacienteSituacao = {
  id: string;
  nome: string;
  indicadores: IndicadorSituacaoPaciente[];
};

export type SituacaoPacientes = {
  totalPacientes: number;
  semNenhumRegistro: number;
  comIndicadoresPendentes: number;
  comIndicadoresConcluidos: number;
  comRegistroSemIndicadorAplicavel: number;
  indicadoresConcluidosPercentual: number;
  totalClassificado: number;
  pacientes: PacienteSituacao[];
};

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function normalizar(valor: unknown): string {
  return texto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function dadosCompletos(registro: RegistroHistorico): Dados {
  return {
    ...registro.dadosBase,
    ...registro.dadosEspecificos,
  };
}

function possuiValorClinico(registro: RegistroHistorico): boolean {
  const dados = dadosCompletos(registro);

  const camposClinicos = Object.entries(dados).filter(([chave]) => {
    const campo = normalizar(chave);

    return (
      campo.includes("atendimento") ||
      campo.includes("consulta") ||
      campo.includes("pressao") ||
      campo.includes("peso") ||
      campo.includes("altura") ||
      campo.includes("visita domiciliar") ||
      campo.includes("vacina") ||
      campo.includes("exame") ||
      campo.includes("hemoglobina") ||
      campo.includes("hba1c") ||
      campo.includes("odont") ||
      campo.includes("tratamento") ||
      campo.includes("procedimento") ||
      campo.includes("hpv") ||
      campo.includes("influenza") ||
      campo.includes("aleitamento") ||
      campo.includes("gestacao") ||
      campo.includes("puerper")
    );
  });

  return camposClinicos.some(([, valor]) => {
    if (valor === null || valor === undefined) {
      return false;
    }

    const valorTexto = texto(valor);

    return (
      valorTexto !== "" &&
      valorTexto !== "-" &&
      valorTexto.toLowerCase() !== "não"
    );
  });
}

function temaContem(
  registro: RegistroHistorico,
  termos: string[],
): boolean {
  const tema = normalizar(
    `${registro.listaTematica} ${registro.grupoCondicoes} ${registro.filtroProblemas}`,
  );

  return termos.some((termo) => tema.includes(normalizar(termo)));
}

function ultimoRegistro(
  registros: RegistroHistorico[],
  termos: string[],
): RegistroHistorico | null {
  const encontrados = registros.filter((registro) =>
    temaContem(registro, termos),
  );

  if (encontrados.length === 0) {
    return null;
  }

  return encontrados.reduce((maisRecente, atual) =>
    atual.criadoEm > maisRecente.criadoEm
      ? atual
      : maisRecente,
  );
}

function possuiPraticaPendente(resultado: any): boolean {
  if (!resultado) {
    return false;
  }

  /*
   * C3 possui status próprios:
   * - pendente
   * - nao_aplicavel
   * - atingida
   *
   * "não aplicável" não deve virar pendência.
   */
  if (Array.isArray(resultado.praticas)) {
    return resultado.praticas.some((pratica: any) => {
      if (pratica?.status === "nao_aplicavel") {
        return false;
      }

      return pratica?.atingida !== true;
    });
  }

  return false;
}

function possuiPraticasConcluidas(resultado: any): boolean {
  if (!resultado) {
    return false;
  }

  if (Array.isArray(resultado.praticas)) {
    if (resultado.praticas.length === 0) {
      return false;
    }

    return resultado.praticas.every((pratica: any) => {
      if (pratica?.status === "nao_aplicavel") {
        return true;
      }

      return pratica?.atingida === true;
    });
  }

  return false;
}

function avaliarIndicadorPadrao(
  registro: RegistroHistorico | null,
  avaliar: (dados: Dados, opcoes?: any) => any,
  referencia: Date,
): any | null {
  if (!registro) {
    return null;
  }

  const resultado = avaliar(dadosCompletos(registro), {
    referencia,
    metadados: {
      listaTematica: registro.listaTematica,
      grupoCondicoes: registro.grupoCondicoes,
      filtroProblemas: registro.filtroProblemas,
    },
  });

  if (!resultado?.elegivel) {
    return null;
  }

  return resultado;
}

function avaliarC6Situacao(
  registro: RegistroHistorico | null,
  referencia: Date,
): any | null {
  if (!registro) {
    return null;
  }

  const resultado = avaliarC6(
    dadosCompletos(registro),
    referencia,
  );

  if (!resultado) {
    return null;
  }

  if (
    !Array.isArray(resultado.praticas) ||
    resultado.praticas.length === 0
  ) {
    return null;
  }

  return resultado;
}

function avaliarC7Situacao(
  registros: RegistroHistorico[],
  referencia: Date,
): any | null {
  if (registros.length === 0) {
    return null;
  }

  const resultado = avaliarC7(
    registros.map((registro) => ({
      ...dadosCompletos(registro),
      id: registro.pacienteId,
      dadosBase: registro.dadosBase,
      dadosEspecificos: registro.dadosEspecificos,
    })),
    referencia,
  );

  if (!resultado || resultado.totalElegiveis <= 0) {
    return null;
  }

  return resultado;
}

function pacienteC7Concluido(
  paciente: any,
): boolean {
  if (!paciente?.praticas) {
    return false;
  }

  const idade = Number(paciente.idade ?? 0);

  const aplicaveis: boolean[] = [];

  if (idade >= 25 && idade <= 64) {
    aplicaveis.push(paciente.praticas.A === true);
  }

  if (idade >= 9 && idade <= 14) {
    aplicaveis.push(paciente.praticas.B === true);
  }

  if (idade >= 14 && idade <= 69) {
    aplicaveis.push(paciente.praticas.C === true);
  }

  if (idade >= 50 && idade <= 69) {
    aplicaveis.push(paciente.praticas.D === true);
  }

  return (
    aplicaveis.length > 0 &&
    aplicaveis.every(Boolean)
  );
}

function pacienteC7Pendente(
  paciente: any,
): boolean {
  if (!paciente?.praticas) {
    return false;
  }

  const idade = Number(paciente.idade ?? 0);

  const aplicaveis: boolean[] = [];

  if (idade >= 25 && idade <= 64) {
    aplicaveis.push(paciente.praticas.A === true);
  }

  if (idade >= 9 && idade <= 14) {
    aplicaveis.push(paciente.praticas.B === true);
  }

  if (idade >= 14 && idade <= 69) {
    aplicaveis.push(paciente.praticas.C === true);
  }

  if (idade >= 50 && idade <= 69) {
    aplicaveis.push(paciente.praticas.D === true);
  }

  return (
    aplicaveis.length > 0 &&
    aplicaveis.some((atingida) => !atingida)
  );
}

export async function calcularSituacaoPacientes(
  ubsId: string,
  referenciaInput = new Date(),
): Promise<SituacaoPacientes> {
  const ubsRef = adminDb.collection("ubs").doc(ubsId);

  const pacientesSnapshot = await ubsRef
    .collection("pacientes")
    .get();

  /*
   * Os documentos de "registros" já carregam os dados necessários
   * para reconstruir o histórico do paciente:
   * listaTematica, grupoCondicoes, filtroProblemas,
   * dadosBase, dadosEspecificos e criadoEm.
   *
   * Como "registros" é uma subcoleção presente em todas as
   * importações PEC, usamos Collection Group para fazer uma única
   * consulta em vez de consultar "importacoesPEC" e depois fazer
   * uma consulta "registros" para cada importação.
   */
  const registrosSnapshot = await adminDb
    .collectionGroup("registros")
    .where("ubsId", "==", ubsId)
    .get();

  const historicosPorPaciente = new Map<
    string,
    RegistroHistorico[]
  >();

  for (const registroDoc of registrosSnapshot.docs) {
    const registro = registroDoc.data();

    const importacaoRef = registroDoc.ref.parent.parent;
    const importacaoId = importacaoRef?.id ?? "";

    const criadoEm =
      registro.criadoEm?.toDate?.() ?? new Date(0);

    const pacienteId =
      texto(registro.pacienteId) || registroDoc.id;

    const item: RegistroHistorico = {
      pacienteId,
      importacaoId,
      criadoEm,

      listaTematica: texto(registro.listaTematica),

      grupoCondicoes: texto(registro.grupoCondicoes),

      filtroProblemas: texto(registro.filtroProblemas),

      dadosBase:
        registro.dadosBase &&
        typeof registro.dadosBase === "object"
          ? registro.dadosBase
          : {},

      dadosEspecificos:
        registro.dadosEspecificos &&
        typeof registro.dadosEspecificos === "object"
          ? registro.dadosEspecificos
          : {},
    };

    const lista =
      historicosPorPaciente.get(pacienteId) ?? [];

    lista.push(item);

    historicosPorPaciente.set(
      pacienteId,
      lista,
    );
  }

  let semNenhumRegistro = 0;
  let comIndicadoresPendentes = 0;
  let comIndicadoresConcluidos = 0;
  let comRegistroSemIndicadorAplicavel = 0;

  const pacientes: PacienteSituacao[] = [];

  /*
   * C7 é calculado uma única vez para toda a UBS.
   * O resultado é indexado por paciente para evitar:
   * - recalcular C7 para cada paciente;
   * - procurar o paciente com .find() repetidamente.
   */
  const registrosC7PorPaciente = new Map<
    string,
    RegistroHistorico[]
  >();

  for (const [pacienteId, historicos] of historicosPorPaciente) {
    const registrosC7 = historicos.filter((registro) =>
      temaContem(registro, ["mulher"]),
    );

    if (registrosC7.length > 0) {
      registrosC7PorPaciente.set(
        pacienteId,
        registrosC7,
      );
    }
  }

  const resultadoC7Geral = avaliarC7Situacao(
    [...registrosC7PorPaciente.values()].flat(),
    referenciaInput,
  );

  const pacientesC7PorId = new Map<string, any>();

  if (resultadoC7Geral) {
    for (const item of resultadoC7Geral.pacientes ?? []) {
      pacientesC7PorId.set(String(item.id), item);
    }
  }

  for (const pacienteDoc of pacientesSnapshot.docs) {
    const paciente = pacienteDoc.data();

    const historicos =
      historicosPorPaciente.get(pacienteDoc.id) ?? [];

    const temAcompanhamento =
      paciente.temAcompanhamento === true;

    const temRegistroClinico =
      historicos.some(possuiValorClinico) ||
      temAcompanhamento;

    /*
     * C2
     */
    const registroC2 = ultimoRegistro(
      historicos,
      [
        "infantil",
        "criança",
        "crianca",
        "desenvolvimento",
      ],
    );

    /*
     * C3
     */
    const registroC3 = ultimoRegistro(
      historicos,
      [
        "gestação",
        "gestacao",
        "puerpério",
        "puerperio",
      ],
    );

    /*
     * C4
     */
    const registroC4 = ultimoRegistro(
      historicos,
      [
        "diabetes",
      ],
    );

    /*
     * C5
     */
    const registroC5 = ultimoRegistro(
      historicos,
      [
        "hipertensão",
        "hipertensao",
        "hipertens",
      ],
    );

    /*
     * C6
     */
    const registroC6 = ultimoRegistro(
      historicos,
      [
        "idoso",
        "idos",
      ],
    );

    const resultados: any[] = [];

    const resultadoC2 =
      avaliarIndicadorPadrao(
        registroC2,
        avaliarC2Infantil,
        referenciaInput,
      );

    if (resultadoC2) {
      resultados.push({
        codigo: "C2",
        resultado: resultadoC2,
      });
    }

    const resultadoC3 =
      avaliarIndicadorPadrao(
        registroC3,
        avaliarC3Gestacao,
        referenciaInput,
      );

    if (resultadoC3) {
      resultados.push({
        codigo: "C3",
        resultado: resultadoC3,
      });
    }

    const resultadoC4 =
      avaliarIndicadorPadrao(
        registroC4,
        avaliarC4Diabetes,
        referenciaInput,
      );

    if (resultadoC4) {
      resultados.push({
        codigo: "C4",
        resultado: resultadoC4,
      });
    }

    const resultadoC5 =
      avaliarIndicadorPadrao(
        registroC5,
        avaliarC5Hipertensao,
        referenciaInput,
      );

    if (resultadoC5) {
      resultados.push({
        codigo: "C5",
        resultado: resultadoC5,
      });
    }

    const resultadoC6 =
      avaliarC6Situacao(
        registroC6,
        referenciaInput,
      );

    if (resultadoC6) {
      resultados.push({
        codigo: "C6",
        resultado: resultadoC6,
      });
    }

    /*
     * C7 é tratado separadamente porque o avaliador
     * retorna uma coleção de pacientes.
     *
     * O resultado já foi calculado uma única vez
     * antes do loop principal.
     */
    const c7Paciente =
      pacientesC7PorId.get(
        String(pacienteDoc.id),
      ) ?? null;

    if (c7Paciente) {
      const c7TemIndicadorAplicavel =
        pacienteC7Pendente(c7Paciente) ||
        pacienteC7Concluido(c7Paciente);

      if (c7TemIndicadorAplicavel) {
        resultados.push({
          codigo: "C7",
          resultado: {
            paciente: c7Paciente,
          },
        });
      }
    }

    const temIndicadorAplicavel =
      resultados.length > 0;

    const indicadores: IndicadorSituacaoPaciente[] = [];

    for (const item of resultados) {
      if (item.codigo === "C7") {
        if (
          pacienteC7Pendente(
            item.resultado.paciente,
          )
        ) {
          indicadores.push({
            codigo: "C7",
            status: "pendente",
          });
        } else if (
          pacienteC7Concluido(
            item.resultado.paciente,
          )
        ) {
          indicadores.push({
            codigo: "C7",
            status: "concluido",
          });
        }

        continue;
      }

      if (
        possuiPraticaPendente(
          item.resultado,
        )
      ) {
        indicadores.push({
          codigo: item.codigo,
          status: "pendente",
        });
      } else if (
        possuiPraticasConcluidas(
          item.resultado,
        )
      ) {
        indicadores.push({
          codigo: item.codigo,
          status: "concluido",
        });
      }
    }

    /*
     * Nenhum dos C2-C7 é aplicável ao paciente.
     */
    if (!temIndicadorAplicavel) {
      if (!temRegistroClinico) {
        semNenhumRegistro += 1;
      } else {
        comRegistroSemIndicadorAplicavel += 1;
      }

      pacientes.push({
        id: pacienteDoc.id,
        nome:
          texto(paciente.nome) ||
          "Paciente sem nome",
        indicadores: [],
      });

      continue;
    }

    /*
     * Verifica se existe pelo menos um indicador
     * aplicável ainda pendente.
     */
    const pendente = indicadores.some(
      (item) => item.status === "pendente",
    );

    if (pendente) {
      comIndicadoresPendentes += 1;

      pacientes.push({
        id: pacienteDoc.id,
        nome:
          texto(paciente.nome) ||
          "Paciente sem nome",
        indicadores,
      });

      continue;
    }

    /*
     * Se chegou aqui, existe indicador aplicável
     * e nenhum está pendente.
     */
    const concluido =
      indicadores.length > 0 &&
      indicadores.every(
        (item) => item.status === "concluido",
      );

    if (concluido) {
      comIndicadoresConcluidos += 1;
    } else {
      comRegistroSemIndicadorAplicavel += 1;
    }

    pacientes.push({
      id: pacienteDoc.id,
      nome:
        texto(paciente.nome) ||
        "Paciente sem nome",
      indicadores,
    });
  }

  const totalPacientes =
    pacientesSnapshot.size;

  const totalClassificado =
    semNenhumRegistro +
    comIndicadoresPendentes +
    comIndicadoresConcluidos +
    comRegistroSemIndicadorAplicavel;

  const indicadoresConcluidosPercentual =
    totalPacientes > 0
      ? Number(
          (
            (comIndicadoresConcluidos /
              totalPacientes) *
            100
          ).toFixed(1),
        )
      : 0;

  return {
    totalPacientes,
    semNenhumRegistro,
    comIndicadoresPendentes,
    comIndicadoresConcluidos,
    comRegistroSemIndicadorAplicavel,
    indicadoresConcluidosPercentual,
    totalClassificado,
    pacientes,
  };
}