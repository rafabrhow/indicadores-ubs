import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "../lib/firebase-admin-script";

const TAMANHO_BATCH = 400;

function obterUbsId(): string {
  const ubsId = process.argv[2]?.trim();

  if (!ubsId) {
    throw new Error(
      "Informe o ubsId. Exemplo: npx tsx scripts/migrar-acompanhamentos.ts UBS_ID",
    );
  }

  return ubsId;
}

function obterDataMaisRecente(data: unknown): Timestamp | null {
  if (data instanceof Timestamp) {
    return data;
  }

  if (data && typeof data === "object" && "toDate" in data) {
    const toDate = (data as { toDate?: unknown }).toDate;

    if (typeof toDate === "function") {
      const valor = toDate();

      if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
        return Timestamp.fromDate(valor);
      }
    }
  }

  if (data instanceof Date && !Number.isNaN(data.getTime())) {
    return Timestamp.fromDate(data);
  }

  return null;
}

function obterPacienteId(refPath: string): string | null {
  const partes = refPath.split("/");

  // ubs/{ubsId}/pacientes/{pacienteId}/acompanhamentos/{acompanhamentoId}
  if (
    partes.length !== 6 ||
    partes[0] !== "ubs" ||
    partes[2] !== "pacientes" ||
    partes[4] !== "acompanhamentos"
  ) {
    return null;
  }

  return partes[3] || null;
}

async function migrarAcompanhamentos() {
  const ubsId = obterUbsId();

  console.log("============================================");
  console.log("Migração de acompanhamentos");
  console.log(`UBS alvo: ${ubsId}`);
  console.log("============================================");
  console.log("");

  console.log(
    "Etapa 1: identificando pacientes que possuem acompanhamentos...",
  );

  const acompanhamentosSnapshot = await adminDb
    .collectionGroup("acompanhamentos")
    .get();

  const maisRecentePorPaciente = new Map<
    string,
    Timestamp | null
  >();

  let acompanhamentosDaUbs = 0;
  let ignoradosPorCaminho = 0;

  for (const acompanhamentoDoc of acompanhamentosSnapshot.docs) {
    const refPath = acompanhamentoDoc.ref.path;
    const partes = refPath.split("/");

    if (
      partes.length !== 6 ||
      partes[0] !== "ubs" ||
      partes[2] !== "pacientes" ||
      partes[4] !== "acompanhamentos"
    ) {
      ignoradosPorCaminho += 1;
      continue;
    }

    if (partes[1] !== ubsId) {
      continue;
    }

    const pacienteId = obterPacienteId(refPath);

    if (!pacienteId) {
      ignoradosPorCaminho += 1;
      continue;
    }

    acompanhamentosDaUbs += 1;

    const dados = acompanhamentoDoc.data();

    const dataCriacao = obterDataMaisRecente(
      dados.criadoEm,
    );

    const dataVisita = obterDataMaisRecente(
      dados.data,
    );

    const dataAcompanhamento =
      dataCriacao ?? dataVisita;

    const atual =
      maisRecentePorPaciente.get(pacienteId);

    if (!atual) {
      maisRecentePorPaciente.set(
        pacienteId,
        dataAcompanhamento,
      );

      continue;
    }

    if (
      dataAcompanhamento &&
      dataAcompanhamento.toMillis() > atual.toMillis()
    ) {
      maisRecentePorPaciente.set(
        pacienteId,
        dataAcompanhamento,
      );
    }
  }

  console.log(
    `Acompanhamentos lidos no total: ${acompanhamentosSnapshot.size}`,
  );

  console.log(
    `Acompanhamentos da UBS: ${acompanhamentosDaUbs}`,
  );

  console.log(
    `Pacientes com acompanhamento: ${maisRecentePorPaciente.size}`,
  );

  if (ignoradosPorCaminho > 0) {
    console.log(
      `Documentos ignorados por caminho inesperado: ${ignoradosPorCaminho}`,
    );
  }

  console.log("");
  console.log(
    "Etapa 2: preenchendo temAcompanhamento em todos os pacientes da UBS...",
  );

  const pacientesRef = adminDb
    .collection("ubs")
    .doc(ubsId)
    .collection("pacientes");

  const pacientesSnapshot = await pacientesRef.get();

  console.log(
    `Pacientes encontrados na UBS: ${pacientesSnapshot.size}`,
  );

  if (pacientesSnapshot.empty) {
    console.log("");
    console.log(
      "Nenhum paciente encontrado para esta UBS.",
    );
    return;
  }

  let pacientesComAcompanhamento = 0;
  let pacientesSemAcompanhamento = 0;
  let pacientesAtualizados = 0;

  for (
    let inicio = 0;
    inicio < pacientesSnapshot.docs.length;
    inicio += TAMANHO_BATCH
  ) {
    const lote = pacientesSnapshot.docs.slice(
      inicio,
      inicio + TAMANHO_BATCH,
    );

    const batch = adminDb.batch();

    for (const pacienteSnap of lote) {
      const pacienteId = pacienteSnap.id;

      const possuiAcompanhamento =
        maisRecentePorPaciente.has(pacienteId);

      const dataMaisRecente =
        maisRecentePorPaciente.get(pacienteId) ?? null;

      const atualizacao: Record<string, unknown> = {
        temAcompanhamento: possuiAcompanhamento,
      };

      if (dataMaisRecente) {
        atualizacao.ultimoAcompanhamentoEm =
          dataMaisRecente;
      }

      batch.set(
        pacienteSnap.ref,
        atualizacao,
        { merge: true },
      );

      if (possuiAcompanhamento) {
        pacientesComAcompanhamento += 1;
      } else {
        pacientesSemAcompanhamento += 1;
      }

      pacientesAtualizados += 1;
    }

    await batch.commit();

    console.log(
      `Lote ${
        Math.floor(inicio / TAMANHO_BATCH) + 1
      }: ${lote.length} pacientes atualizados.`,
    );
  }

  console.log("");
  console.log("========== RESULTADO ==========");
  console.log(`UBS: ${ubsId}`);
  console.log(
    `Acompanhamentos da UBS: ${acompanhamentosDaUbs}`,
  );
  console.log(
    `Pacientes com acompanhamento: ${pacientesComAcompanhamento}`,
  );
  console.log(
    `Pacientes sem acompanhamento: ${pacientesSemAcompanhamento}`,
  );
  console.log(
    `Pacientes encontrados: ${pacientesSnapshot.size}`,
  );
  console.log(
    `Pacientes atualizados: ${pacientesAtualizados}`,
  );
  console.log(
    "Nenhum acompanhamento foi alterado ou excluído.",
  );
  console.log("===============================");
}

migrarAcompanhamentos().catch((error) => {
  console.error("");
  console.error(
    "Erro na migração de acompanhamentos:",
  );
  console.error(
    error instanceof Error ? error.message : error,
  );

  process.exitCode = 1;
});