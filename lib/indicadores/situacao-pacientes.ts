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

export type SituacaoPacientes = {
  totalPacientes: number;
  semNenhumRegistro: number;
  comIndicadoresPendentes: number;
  comIndicadoresConcluidos: number;
  comRegistroSemIndicadorAplicavel: number;
  indicadoresConcluidosPercentual: number;
  totalClassificado: number;
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

  const importacoesSnapshot = await ubsRef
    .collection("importacoesPEC")
    .get();

  const historicosPorPaciente = new Map<
    string,
    RegistroHistorico[]
  >();

  await Promise.all(
    importacoesSnapshot.docs.map(async (importacaoDoc) => {
      const importacao = importacaoDoc.data();

      const criadoEm =
        importacao.criadoEm?.toDate?.() ?? new Date(0);

      const registrosSnapshot = await importacaoDoc.ref
        .collection("registros")
        .get();

      for (const registroDoc of registrosSnapshot.docs) {
        const registro = registroDoc.data();

        const item: RegistroHistorico = {
          pacienteId: registroDoc.id,
          importacaoId: importacaoDoc.id,
          criadoEm,

          listaTematica: texto(
            registro.listaTematica ??
              importacao.listaTematica,
          ),

          grupoCondicoes: texto(
            registro.grupoCondicoes ??
              importacao.grupoCondicoes,
          ),

          filtroProblemas: texto(
            registro.filtroProblemas ??
              importacao.filtroProblemas,
          ),

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
          historicosPorPaciente.get(registroDoc.id) ?? [];

        lista.push(item);

        historicosPorPaciente.set(
          registroDoc.id,
          lista,
        );
      }
    }),
  );

  let semNenhumRegistro = 0;
  let comIndicadoresPendentes = 0;
  let comIndicadoresConcluidos = 0;
  let comRegistroSemIndicadorAplicavel = 0;

  for (const pacienteDoc of pacientesSnapshot.docs) {
    const paciente = pacienteDoc.data();

    const historicos =
      historicosPorPaciente.get(pacienteDoc.id) ?? [];

    const acompanhamentosSnapshot =
      await pacienteDoc.ref
        .collection("acompanhamentos")
        .limit(1)
        .get();

    const temAcompanhamento =
      !acompanhamentosSnapshot.empty;

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

    /*
     * C7
     *
     * Diferente dos demais indicadores, C7 pode trabalhar
     * com vários registros para montar o conjunto de mulheres.
     */
    const registrosC7 = historicos.filter((registro) =>
      temaContem(registro, [
        "mulher",
      ]),
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
     */
    const resultadoC7 =
      avaliarC7Situacao(
        registrosC7,
        referenciaInput,
      );

    let c7Paciente: any | null = null;

    if (resultadoC7) {
      c7Paciente =
        resultadoC7.pacientes.find(
          (item: any) =>
            String(item.id) ===
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
    }

    const temIndicadorAplicavel =
      resultados.length > 0;

    /*
     * Nenhum dos C2-C7 é aplicável ao paciente.
     */
    if (!temIndicadorAplicavel) {
      if (!temRegistroClinico) {
        semNenhumRegistro += 1;
      } else {
        comRegistroSemIndicadorAplicavel += 1;
      }

      continue;
    }

    /*
     * Verifica se existe pelo menos um indicador
     * aplicável ainda pendente.
     */
    let pendente = false;

    for (const item of resultados) {
      if (item.codigo === "C7") {
        if (
          pacienteC7Pendente(
            item.resultado.paciente,
          )
        ) {
          pendente = true;
          break;
        }

        continue;
      }

      if (
        possuiPraticaPendente(
          item.resultado,
        )
      ) {
        pendente = true;
        break;
      }
    }

    if (pendente) {
      comIndicadoresPendentes += 1;
      continue;
    }

    /*
     * Se chegou aqui, existe indicador aplicável
     * e nenhum está pendente.
     */
    let concluido = true;

    for (const item of resultados) {
      if (item.codigo === "C7") {
        if (
          !pacienteC7Concluido(
            item.resultado.paciente,
          )
        ) {
          concluido = false;
          break;
        }

        continue;
      }

      if (
        !possuiPraticasConcluidas(
          item.resultado,
        )
      ) {
        concluido = false;
        break;
      }
    }

    if (concluido) {
      comIndicadoresConcluidos += 1;
    } else {
      comRegistroSemIndicadorAplicavel += 1;
    }
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
  };
}