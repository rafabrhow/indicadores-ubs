
import { adminDb } from "../lib/firebase-admin-script";

const UBS_ID = "D68wxPwFiqgQvsBdbGwi";
const APLICAR = process.argv.includes("--apply");
const LIMITE_OPERACOES = 400;

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

async function main() {
  console.log("========================================");
  console.log("MIGRAÇÃO DO HISTÓRICO PEC POR PACIENTE");
  console.log("========================================");
  console.log(`UBS: ${UBS_ID}`);
  console.log(`Modo: ${APLICAR ? "APLICAÇÃO REAL" : "SIMULAÇÃO"}`);

  if (!APLICAR) {
    console.log("Nenhuma alteração será gravada.");
  } else {
    console.log("ATENÇÃO: gravação habilitada.");
  }

  const ubsRef = adminDb.collection("ubs").doc(UBS_ID);
  const ubsSnap = await ubsRef.get();

  if (!ubsSnap.exists) {
    throw new Error(`UBS não encontrada: ${UBS_ID}`);
  }

  // Consulta coletiva dos pacientes da UBS.
  const pacientesSnap = await ubsRef.collection("pacientes").get();
  const pacientesExistentes = new Set(
    pacientesSnap.docs.map((doc) => doc.id)
  );

  // Consulta coletiva dos destinos já existentes.
  // Não sobrescrevemos nenhum documento de destino.
  const destinosSnap = await adminDb
    .collectionGroup("historicoPEC")
    .get();

  const destinosExistentes = new Set<string>();

  for (const destino of destinosSnap.docs) {
    const caminho = destino.ref.path;
    const prefixo = `ubs/${UBS_ID}/pacientes/`;

    if (!caminho.startsWith(prefixo)) continue;

    const partes = caminho.split("/");
    // ubs/{ubsId}/pacientes/{pacienteId}/historicoPEC/{importacaoId}
    if (partes.length === 6) {
      destinosExistentes.add(`${partes[3]}__${partes[5]}`);
    }
  }

  const importacoesSnap = await ubsRef
    .collection("importacoesPEC")
    .get();

  let analisados = 0;
  let candidatos = 0;
  let jaExistentes = 0;
  let ignorados = 0;
  let pacientesAusentes = 0;
  let gravados = 0;
  let operacoesPendentes = 0;

  let batch = adminDb.batch();

  async function confirmarBatch() {
    if (!APLICAR || operacoesPendentes === 0) return;

    await batch.commit();
    batch = adminDb.batch();
    operacoesPendentes = 0;
  }

  for (const importacaoDoc of importacoesSnap.docs) {
    const importacao = importacaoDoc.data();

    const registrosSnap = await importacaoDoc.ref
      .collection("registros")
      .get();

    for (const registroDoc of registrosSnap.docs) {
      analisados++;

      const registro = registroDoc.data();
      const pacienteId = texto(registro.pacienteId) || registroDoc.id;

      if (!pacienteId) {
        ignorados++;
        continue;
      }

      const ubsRegistro = texto(registro.ubsId);

      if (ubsRegistro && ubsRegistro !== UBS_ID) {
        ignorados++;
        continue;
      }

      if (!pacientesExistentes.has(pacienteId)) {
        pacientesAusentes++;
        continue;
      }

      const chaveDestino = `${pacienteId}__${importacaoDoc.id}`;

      if (destinosExistentes.has(chaveDestino)) {
        jaExistentes++;
        continue;
      }

      candidatos++;

      if (!APLICAR) continue;

      const pacienteRef = ubsRef
        .collection("pacientes")
        .doc(pacienteId);

      const destinoRef = pacienteRef
        .collection("historicoPEC")
        .doc(importacaoDoc.id);

      const dadosDestino = {
        ...registro,
        pacienteId,
        ubsId: UBS_ID,
        importacaoId: importacaoDoc.id,

        arquivoNome:
          texto(importacao.arquivoNome) || "Relatório do PEC",

        listaTematica:
          registro.listaTematica ??
          importacao.listaTematica ??
          "Não informada",

        criadoEm: registro.criadoEm ?? importacao.criadoEm ?? null,
        importacaoCriadoEm: importacao.criadoEm ?? null,
      };

      batch.create(destinoRef, dadosDestino);
      destinosExistentes.add(chaveDestino);

      operacoesPendentes++;
      gravados++;

      if (operacoesPendentes >= LIMITE_OPERACOES) {
        await confirmarBatch();
      }
    }
  }

  await confirmarBatch();

  console.log("");
  console.log("========== RESULTADO ==========");
  console.log(`Pacientes consultados: ${pacientesSnap.size}`);
  console.log(`Destinos consultados: ${destinosSnap.size}`);
  console.log(`Importações lidas: ${importacoesSnap.size}`);
  console.log(`Registros analisados: ${analisados}`);
  console.log(`Candidatos para cópia: ${candidatos}`);
  console.log(`Já existentes no destino: ${jaExistentes}`);
  console.log(`Pacientes ausentes: ${pacientesAusentes}`);
  console.log(`Registros ignorados: ${ignorados}`);
  console.log(`Gravações realizadas: ${gravados}`);

  if (!APLICAR) {
    console.log("");
    console.log("SIMULAÇÃO concluída: nenhuma gravação foi feita.");
    console.log("Revise os números antes de usar --apply.");
  }
}

main().catch((erro) => {
  console.error("Falha na migração do histórico PEC:", erro);
  process.exitCode = 1;
});
