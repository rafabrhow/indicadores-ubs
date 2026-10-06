import "server-only";

import {
  FieldPath,
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import type { PacienteC7 } from "@/lib/indicadores/c7-mulher";

export type CacheC7Atual = {
  versaoDados: number;
  competencia: string | null;
  referencia: string | null;
  atualizadoEm: Timestamp | FieldValue | null;
  importacoesIds: string[];
  quantidadeImportacoesConsideradas: number;
  quantidadePacientes: number;
  resultado: Record<string, unknown>;
};

export type CacheC7Paciente = {
  pacienteId: string;
  dados: Record<string, unknown>;
  avaliacao: PacienteC7 | null;
  importacoesIds: string[];
  atualizadoEm: Timestamp | FieldValue | null;
};

function referenciaCacheC7(ubsId: string) {
  if (!ubsId.trim()) {
    throw new Error("ubsId obrigatório.");
  }

  return adminDb
    .collection("ubs")
    .doc(ubsId)
    .collection("cacheC7");
}

function referenciaCacheC7Atual(ubsId: string) {
  return referenciaCacheC7(ubsId).doc("atual");
}

function referenciaCacheC7Pacientes(ubsId: string) {
  return referenciaCacheC7Atual(ubsId).collection("pacientes");
}

/**
 * Lê o resumo consolidado do C7.
 *
 * Esta operação consulta somente um documento.
 */
export async function buscarCacheC7(
  ubsId: string,
): Promise<CacheC7Atual | null> {
  const snapshot = await referenciaCacheC7Atual(ubsId).get();

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
    referencia:
      typeof dados.referencia === "string"
        ? dados.referencia
        : null,
    atualizadoEm:
      dados.atualizadoEm instanceof Timestamp
        ? dados.atualizadoEm
        : null,
    importacoesIds: Array.isArray(dados.importacoesIds)
      ? dados.importacoesIds.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    quantidadeImportacoesConsideradas: Number(
      dados.quantidadeImportacoesConsideradas ?? 0,
    ),
    quantidadePacientes: Number(
      dados.quantidadePacientes ?? 0,
    ),
    resultado:
      dados.resultado &&
      typeof dados.resultado === "object" &&
      !Array.isArray(dados.resultado)
        ? (dados.resultado as Record<string, unknown>)
        : {},
  };
}

/**
 * Salva o resumo consolidado do C7.
 *
 * O documento "atual" guarda apenas o resumo e os metadados.
 * Os pacientes ficam separados na subcoleção "pacientes".
 */
export async function salvarCacheC7(
  ubsId: string,
  dados: {
    competencia: string | null;
    referencia: string | null;
    importacoesIds: string[];
    quantidadeImportacoesConsideradas: number;
    quantidadePacientes: number;
    resultado: Record<string, unknown>;
  },
): Promise<number> {
  const referencia = referenciaCacheC7Atual(ubsId);

  return adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(referencia);

    const versaoAnterior = snapshot.exists
      ? Number(snapshot.data()?.versaoDados ?? 0)
      : 0;

    const versao = versaoAnterior + 1;

    transaction.set(
      referencia,
      {
        versaoDados: versao,
        competencia: dados.competencia,
        referencia: dados.referencia,
        importacoesIds: dados.importacoesIds,
        quantidadeImportacoesConsideradas:
          dados.quantidadeImportacoesConsideradas,
        quantidadePacientes: dados.quantidadePacientes,
        resultado: dados.resultado,
        atualizadoEm: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return versao;
  });
}

/**
 * Busca somente os pacientes necessários para uma atualização incremental.
 *
 * O Firestore limita a consulta "in" a blocos de valores.
 * Os IDs são divididos em blocos de 30.
 */
export async function buscarPacientesCacheC7(
  ubsId: string,
  pacientesIds: string[],
): Promise<Map<string, CacheC7Paciente>> {
  const ids = Array.from(
    new Set(
      pacientesIds
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  );

  const resultado = new Map<string, CacheC7Paciente>();

  if (ids.length === 0) {
    return resultado;
  }

  const pacientesRef = referenciaCacheC7Pacientes(ubsId);

  for (let inicio = 0; inicio < ids.length; inicio += 30) {
    const blocoIds = ids.slice(inicio, inicio + 30);

    const snapshot = await pacientesRef
      .where(FieldPath.documentId(), "in", blocoIds)
      .get();

    for (const documento of snapshot.docs) {
      const dados = documento.data();

      resultado.set(documento.id, {
        pacienteId: documento.id,
        dados:
          dados.dados &&
          typeof dados.dados === "object" &&
          !Array.isArray(dados.dados)
            ? (dados.dados as Record<string, unknown>)
            : {},
        avaliacao:
          dados.avaliacao &&
          typeof dados.avaliacao === "object"
            ? (dados.avaliacao as PacienteC7)
            : null,
        importacoesIds: Array.isArray(dados.importacoesIds)
          ? dados.importacoesIds.filter(
              (item): item is string => typeof item === "string",
            )
          : [],
        atualizadoEm:
          dados.atualizadoEm instanceof Timestamp
            ? dados.atualizadoEm
            : null,
      });
    }
  }

  return resultado;
}

/**
 * Grava ou atualiza somente os pacientes afetados.
 *
 * Usa batches para evitar um commit por paciente.
 */
export async function salvarPacientesCacheC7(
  ubsId: string,
  pacientes: CacheC7Paciente[],
): Promise<void> {
  if (pacientes.length === 0) {
    return;
  }

  const pacientesRef = referenciaCacheC7Pacientes(ubsId);

  let batch = adminDb.batch();
  let operacoes = 0;

  async function confirmarBatch() {
    if (operacoes === 0) {
      return;
    }

    await batch.commit();

    batch = adminDb.batch();
    operacoes = 0;
  }

  for (const paciente of pacientes) {
    const pacienteId = paciente.pacienteId.trim();

    if (!pacienteId) {
      continue;
    }

    batch.set(
      pacientesRef.doc(pacienteId),
      {
        pacienteId,
        dados: paciente.dados,
        avaliacao: paciente.avaliacao ?? null,
        importacoesIds: paciente.importacoesIds,
        atualizadoEm: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    operacoes++;

    if (operacoes >= 450) {
      await confirmarBatch();
    }
  }

  await confirmarBatch();
}

/**
 * Remove somente pacientes que deixaram de fazer parte da janela
 * consolidada do C7.
 */
export async function removerPacientesCacheC7(
  ubsId: string,
  pacientesIds: string[],
): Promise<void> {
  const ids = Array.from(
    new Set(
      pacientesIds
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  );

  if (ids.length === 0) {
    return;
  }

  const pacientesRef = referenciaCacheC7Pacientes(ubsId);

  let batch = adminDb.batch();
  let operacoes = 0;

  async function confirmarBatch() {
    if (operacoes === 0) {
      return;
    }

    await batch.commit();

    batch = adminDb.batch();
    operacoes = 0;
  }

  for (const pacienteId of ids) {
    batch.delete(pacientesRef.doc(pacienteId));
    operacoes++;

    if (operacoes >= 450) {
      await confirmarBatch();
    }
  }

  await confirmarBatch();
}