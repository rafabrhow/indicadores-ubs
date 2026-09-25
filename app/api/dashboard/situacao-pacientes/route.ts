import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

import { avaliarC2Infantil } from "@/lib/indicadores/c2-infantil";
import { avaliarC3Gestacao } from "@/lib/indicadores/c3-gestacao";
import { avaliarC4Diabetes } from "@/lib/indicadores/c4-diabetes";
import { avaliarC5Hipertensao } from "@/lib/indicadores/c5-hipertensao";
import { avaliarC6 } from "@/lib/indicadores/c6-idoso";
import { avaliarC7 } from "@/lib/indicadores/c7-mulher";

export const runtime = "nodejs";

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

type IndicadorPaciente = {
  codigo: "C2" | "C3" | "C4" | "C5" | "C6" | "C7";
  status: "pendente" | "concluido";
};

type PacienteSituacao = {
  id: string;
  nome: string;
  indicadores: IndicadorPaciente[];
};


type RespostaSituacao = {
  sucesso: true;
  total: number;
  pacientes: PacienteSituacao[];
};

type CacheSituacao = {
  ultimaImportacaoId: string | null;
  resposta: RespostaSituacao;
};

// Mantém a situação detalhada em memória enquanto não houver nova importação PEC.
// Isso evita reconstruir todo o histórico a cada abertura/atualização do Dashboard.
const cacheSituacaoPorUbs = new Map<string, CacheSituacao>();

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

function temaContem(
  registro: RegistroHistorico,
  termos: string[],
): boolean {
  const tema = normalizar(
    `${registro.listaTematica} ${registro.grupoCondicoes} ${registro.filtroProblemas}`,
  );

  return termos.some((termo) =>
    tema.includes(normalizar(termo)),
  );
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

export async function GET(request: Request) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem: "Sessão não autenticada.",
        },
        { status: 401 },
      );
    }

    const token = authorization
      .slice("Bearer ".length)
      .trim();

    const decoded = await adminAuth.verifyIdToken(token);

    const usuarioSnap = await adminDb
      .collection("usuarios")
      .doc(decoded.uid)
      .get();

    if (!usuarioSnap.exists) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem: "Usuário não encontrado.",
        },
        { status: 403 },
      );
    }

    const usuario = usuarioSnap.data();

    if (
      usuario?.perfil !== "enfermeira" ||
      usuario?.ativo !== true ||
      typeof usuario?.ubsId !== "string" ||
      !usuario.ubsId.trim()
    ) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem:
            "Somente a enfermeira ativa pode consultar esta informação.",
        },
        { status: 403 },
      );
    }

    const ubsId = usuario.ubsId.trim();

    const ubsRef = adminDb
      .collection("ubs")
      .doc(ubsId);

    // Antes de reconstruir todo o histórico, verificamos apenas qual é a
    // importação PEC mais recente. Se ela não mudou, reutilizamos o resultado
    // já calculado em memória e evitamos milhares de leituras do Firestore.
    const ultimaImportacaoSnapshot = await ubsRef
      .collection("importacoesPEC")
      .orderBy("criadoEm", "desc")
      .limit(1)
      .get();

    const ultimaImportacaoId =
      ultimaImportacaoSnapshot.docs[0]?.id ?? null;

    const cacheAtual = cacheSituacaoPorUbs.get(ubsId);

    if (
      cacheAtual &&
      cacheAtual.ultimaImportacaoId === ultimaImportacaoId
    ) {
      return NextResponse.json(cacheAtual.resposta);
    }

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
      importacoesSnapshot.docs.map(
        async (importacaoDoc) => {
          const importacao = importacaoDoc.data();

          const criadoEm =
            importacao.criadoEm?.toDate?.() ??
            new Date(0);

          const registrosSnapshot =
            await importacaoDoc.ref
              .collection("registros")
              .get();

          for (
            const registroDoc of registrosSnapshot.docs
          ) {
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
                typeof registro.dadosEspecificos ===
                  "object"
                  ? registro.dadosEspecificos
                  : {},
            };

            const lista =
              historicosPorPaciente.get(
                registroDoc.id,
              ) ?? [];

            lista.push(item);

            historicosPorPaciente.set(
              registroDoc.id,
              lista,
            );
          }
        },
      ),
    );

    const referencia = new Date();

    const pacientes: PacienteSituacao[] = [];

    for (
      const pacienteDoc of pacientesSnapshot.docs
    ) {
      const paciente = pacienteDoc.data();

      const historicos =
        historicosPorPaciente.get(
          pacienteDoc.id,
        ) ?? [];

      const registroC2 = ultimoRegistro(
        historicos,
        [
          "infantil",
          "criança",
          "crianca",
          "desenvolvimento",
        ],
      );

      const registroC3 = ultimoRegistro(
        historicos,
        [
          "gestação",
          "gestacao",
          "puerpério",
          "puerperio",
        ],
      );

      const registroC4 = ultimoRegistro(
        historicos,
        ["diabetes"],
      );

      const registroC5 = ultimoRegistro(
        historicos,
        [
          "hipertensão",
          "hipertensao",
          "hipertens",
        ],
      );

      const registroC6 = ultimoRegistro(
        historicos,
        [
          "idoso",
          "idos",
        ],
      );

      const registrosC7 =
        historicos.filter((registro) =>
          temaContem(registro, ["mulher"]),
        );

      const indicadores: IndicadorPaciente[] = [];

      const resultadoC2 =
        avaliarIndicadorPadrao(
          registroC2,
          avaliarC2Infantil,
          referencia,
        );

      if (resultadoC2) {
        indicadores.push({
          codigo: "C2",
          status:
            possuiPraticaPendente(resultadoC2)
              ? "pendente"
              : possuiPraticasConcluidas(
                    resultadoC2,
                  )
                ? "concluido"
                : "pendente",
        });
      }

      const resultadoC3 =
        avaliarIndicadorPadrao(
          registroC3,
          avaliarC3Gestacao,
          referencia,
        );

      if (resultadoC3) {
        indicadores.push({
          codigo: "C3",
          status:
            possuiPraticaPendente(resultadoC3)
              ? "pendente"
              : possuiPraticasConcluidas(
                    resultadoC3,
                  )
                ? "concluido"
                : "pendente",
        });
      }

      const resultadoC4 =
        avaliarIndicadorPadrao(
          registroC4,
          avaliarC4Diabetes,
          referencia,
        );

      if (resultadoC4) {
        indicadores.push({
          codigo: "C4",
          status:
            possuiPraticaPendente(resultadoC4)
              ? "pendente"
              : possuiPraticasConcluidas(
                    resultadoC4,
                  )
                ? "concluido"
                : "pendente",
        });
      }

      const resultadoC5 =
        avaliarIndicadorPadrao(
          registroC5,
          avaliarC5Hipertensao,
          referencia,
        );

      if (resultadoC5) {
        indicadores.push({
          codigo: "C5",
          status:
            possuiPraticaPendente(resultadoC5)
              ? "pendente"
              : possuiPraticasConcluidas(
                    resultadoC5,
                  )
                ? "concluido"
                : "pendente",
        });
      }

      const resultadoC6 =
        avaliarC6Situacao(
          registroC6,
          referencia,
        );

      if (resultadoC6) {
        indicadores.push({
          codigo: "C6",
          status:
            possuiPraticaPendente(resultadoC6)
              ? "pendente"
              : possuiPraticasConcluidas(
                    resultadoC6,
                  )
                ? "concluido"
                : "pendente",
        });
      }

      const resultadoC7 =
        avaliarC7Situacao(
          registrosC7,
          referencia,
        );

      if (resultadoC7) {
        const c7Paciente =
          resultadoC7.pacientes?.find(
            (item: any) =>
              String(item.id) ===
              String(pacienteDoc.id),
          ) ?? null;

        if (c7Paciente) {
          if (pacienteC7Pendente(c7Paciente)) {
            indicadores.push({
              codigo: "C7",
              status: "pendente",
            });
          } else if (
            pacienteC7Concluido(c7Paciente)
          ) {
            indicadores.push({
              codigo: "C7",
              status: "concluido",
            });
          }
        }
      }

      /*
       * Quando nenhum dos indicadores C2–C7 é aplicável ao paciente,
       * mantemos o paciente na resposta com a lista de indicadores vazia.
       *
       * O Dashboard usa essa lista para montar a categoria
       * "Sem indicador C2–C7 aplicável".
       */
      if (indicadores.length === 0) {
        pacientes.push({
          id: pacienteDoc.id,
          nome:
            texto(paciente.nome) ||
            "Paciente sem nome",
          indicadores: [],
        });

        continue;
      }

      const possuiPendencia =
        indicadores.some(
          (item) => item.status === "pendente",
        );

      const possuiConclusao =
        indicadores.some(
          (item) => item.status === "concluido",
        );

      if (!possuiPendencia && !possuiConclusao) {
        continue;
      }

      pacientes.push({
        id: pacienteDoc.id,
        nome:
          texto(paciente.nome) ||
          "Paciente sem nome",
        indicadores,
      });
    }

    pacientes.sort((a, b) =>
      a.nome.localeCompare(
        b.nome,
        "pt-BR",
      ),
    );

    const resposta: RespostaSituacao = {
      sucesso: true,
      total: pacientes.length,
      pacientes,
    };

    cacheSituacaoPorUbs.set(ubsId, {
      ultimaImportacaoId,
      resposta,
    });

    return NextResponse.json(resposta);
  } catch (error) {
    console.error(
      "Erro ao consultar situação detalhada dos pacientes:",
      error,
    );

    return NextResponse.json(
      {
        sucesso: false,
        mensagem:
          "Não foi possível consultar a situação detalhada dos pacientes.",
      },
      { status: 500 },
    );
  }
}