import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";

export type ResultadoIndicadorMensal = {
  codigo: string;
  competencia: string;
  ubsId: string;
  dados: Record<string, unknown>;
};

/**
 * Salva o resultado consolidado de um indicador por competência.
 *
 * A estrutura usa um documento por indicador e mês, evitando que o
 * Dashboard precise recalcular toda a base histórica a cada abertura.
 *
 * Exemplo:
 * ubs/{ubsId}/resultadosIndicadores/2026-08_C1
 */
export async function salvarResultadoIndicadorMensal(
  resultado: ResultadoIndicadorMensal,
): Promise<void> {
  const competenciaNormalizada = normalizarCompetencia(
    resultado.competencia,
  );

  if (!competenciaNormalizada) {
    throw new Error(
      "Competência inválida. Use o formato YYYY-MM.",
    );
  }

  const codigoNormalizado = resultado.codigo
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");

  if (!codigoNormalizado) {
    throw new Error("Código do indicador inválido.");
  }

  if (!resultado.ubsId.trim()) {
    throw new Error("ubsId obrigatório.");
  }

  const docId = `${competenciaNormalizada}_${codigoNormalizado}`;

  const referencia = adminDb
    .collection("ubs")
    .doc(resultado.ubsId)
    .collection("resultadosIndicadores")
    .doc(docId);

  await referencia.set(
    {
      codigo: codigoNormalizado,
      competencia: competenciaNormalizada,
      ubsId: resultado.ubsId,
      dados: resultado.dados,
      atualizadoEm: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Recupera o resultado consolidado de um indicador em uma competência.
 *
 * É uma única leitura de documento, adequada para o Dashboard.
 */
export async function buscarResultadoIndicadorMensal(
  ubsId: string,
  codigo: string,
  competencia: string,
): Promise<Record<string, unknown> | null> {
  const competenciaNormalizada = normalizarCompetencia(competencia);

  if (!competenciaNormalizada) {
    return null;
  }

  const codigoNormalizado = codigo
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");

  if (!ubsId.trim() || !codigoNormalizado) {
    return null;
  }

  const docId = `${competenciaNormalizada}_${codigoNormalizado}`;

  const snapshot = await adminDb
    .collection("ubs")
    .doc(ubsId)
    .collection("resultadosIndicadores")
    .doc(docId)
    .get();

  if (!snapshot.exists) {
    return null;
  }

  return snapshot.data() ?? null;
}

/**
 * Lista as competências já consolidadas de um indicador.
 *
 * Esta função é opcional para telas históricas; o Dashboard principal
 * deve preferir buscar somente a competência necessária.
 */
export async function listarCompetenciasIndicador(
  ubsId: string,
  codigo: string,
): Promise<string[]> {
  const codigoNormalizado = codigo
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");

  if (!ubsId.trim() || !codigoNormalizado) {
    return [];
  }

  const snapshot = await adminDb
    .collection("ubs")
    .doc(ubsId)
    .collection("resultadosIndicadores")
    .where("codigo", "==", codigoNormalizado)
    .get();

  return snapshot.docs
    .map((doc) => String(doc.data().competencia ?? ""))
    .filter(Boolean)
    .sort()
    .reverse();
}

function normalizarCompetencia(valor: string): string | null {
  const texto = String(valor ?? "").trim();

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(texto)) {
    return null;
  }

  return texto;
}
