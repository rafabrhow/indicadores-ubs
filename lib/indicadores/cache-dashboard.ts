import "server-only";

import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";

/**
 * Snapshot consolidado usado pelo Dashboard.
 *
 * O Dashboard poderá ler este único documento em vez de
 * consultar individualmente todos os indicadores.
 *
 * A versaoDados muda quando uma nova importação for processada.
 * O navegador poderá comparar essa versão com seu cache local.
 */
export type CacheDashboard = {
  versaoDados: number;
  competencia: string | null;
  atualizadoEm: Timestamp | FieldValue | null;
  dados: Record<string, unknown>;
};

function referenciaCacheDashboard(ubsId: string) {
  if (!ubsId.trim()) {
    throw new Error("ubsId obrigatório.");
  }

  return adminDb
    .collection("ubs")
    .doc(ubsId)
    .collection("cacheDashboard")
    .doc("atual");
}

/**
 * Lê o snapshot consolidado do Dashboard.
 * Esta operação consulta somente um documento.
 */
export async function buscarCacheDashboard(
  ubsId: string,
): Promise<CacheDashboard | null> {
  const snapshot = await referenciaCacheDashboard(ubsId).get();

  if (!snapshot.exists) {
    return null;
  }

  const dados = snapshot.data() ?? {};

  return {
    versaoDados: Number(dados.versaoDados ?? 0),
    competencia:
      typeof dados.competencia === "string"
        ? dados.competencia
        : null,
    atualizadoEm:
      dados.atualizadoEm instanceof Timestamp
        ? dados.atualizadoEm
        : null,
    dados:
      dados.dados &&
      typeof dados.dados === "object" &&
      !Array.isArray(dados.dados)
        ? (dados.dados as Record<string, unknown>)
        : {},
  };
}

/**
 * Salva o snapshot completo.
 *
 * Use esta função quando já tivermos todos os dados consolidados
 * que precisam ser gravados de uma vez.
 */
export async function salvarCacheDashboard(
  ubsId: string,
  competencia: string | null,
  dados: Record<string, unknown>,
): Promise<number> {
  const referencia = referenciaCacheDashboard(ubsId);

  const novaVersao = await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(referencia);

    const versaoAnterior = snapshot.exists
      ? Number(snapshot.data()?.versaoDados ?? 0)
      : 0;

    const versao = versaoAnterior + 1;

    transaction.set(
      referencia,
      {
        versaoDados: versao,
        competencia: competencia ?? null,
        dados,
        atualizadoEm: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return versao;
  });

  return novaVersao;
}

/**
 * Atualiza somente um indicador dentro do snapshot.
 *
 * O restante do cache é preservado.
 */
export async function atualizarIndicadorCacheDashboard(
  ubsId: string,
  indicador: string,
  dadosIndicador: Record<string, unknown>,
  competencia: string | null,
): Promise<number> {
  const indicadorNormalizado = indicador.trim().toLowerCase();

  if (!indicadorNormalizado) {
    throw new Error("Indicador obrigatório.");
  }

  const referencia = referenciaCacheDashboard(ubsId);

  const novaVersao = await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(referencia);
    const snapshotDados = snapshot.exists ? snapshot.data() : {};

    const dadosAtuais =
      snapshotDados?.dados &&
      typeof snapshotDados.dados === "object" &&
      !Array.isArray(snapshotDados.dados)
        ? (snapshotDados.dados as Record<string, unknown>)
        : {};

    const versaoAnterior = snapshot.exists
      ? Number(snapshotDados?.versaoDados ?? 0)
      : 0;

    const versao = versaoAnterior + 1;

    transaction.set(
      referencia,
      {
        versaoDados: versao,
        competencia: competencia ?? null,
        dados: {
          ...dadosAtuais,
          [indicadorNormalizado]: dadosIndicador,
        },
        atualizadoEm: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return versao;
  });

  return novaVersao;
}
