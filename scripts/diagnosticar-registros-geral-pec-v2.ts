import { adminDb } from "../lib/firebase-admin-script";

type Dados = Record<string, unknown>;
const UBS_ID = "D68wxPwFiqgQvsBdbGwi";

function objetoSeguro(valor: unknown): Dados {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? valor as Dados : {};
}
function textoSeguro(valor: unknown): string {
  if (typeof valor === "string") return valor.trim();
  if (typeof valor === "number") return String(valor);
  return "";
}
function tipo(valor: unknown): string {
  if (valor === null) return "null";
  if (Array.isArray(valor)) return "array";
  if (valor instanceof Date) return "Date";
  if (valor && typeof valor === "object") {
    if ("toMillis" in valor && typeof (valor as { toMillis?: unknown }).toMillis === "function") return "Timestamp";
    return "objeto";
  }
  return typeof valor;
}
function incrementar(mapa: Map<string, Map<string, number>>, caminho: string, valor: unknown) {
  const tipos = mapa.get(caminho) ?? new Map<string, number>();
  const nomeTipo = tipo(valor);
  tipos.set(nomeTipo, (tipos.get(nomeTipo) ?? 0) + 1);
  mapa.set(caminho, tipos);
}

async function main() {
  console.log("========================================");
  console.log("DIAGNÓSTICO SOMENTE DE LEITURA — IMPORTAÇÕES GERAL");
  console.log("========================================");
  console.log(`UBS: ${UBS_ID}`);
  console.log("Nenhuma gravação será realizada.");
  console.log("Por privacidade, valores clínicos e identificadores de pacientes não serão exibidos.");

  const ubsRef = adminDb.collection("ubs").doc(UBS_ID);
  const ubsSnap = await ubsRef.get();
  if (!ubsSnap.exists) throw new Error(`UBS não encontrada: ${UBS_ID}`);

  const importacoesSnap = await ubsRef.collection("importacoesPEC").get();
  const importacoesGeral = importacoesSnap.docs.filter((doc) => {
    const lista = textoSeguro(doc.data().listaTematica).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return lista === "geral";
  });

  console.log(`Importações encontradas: ${importacoesSnap.size}`);
  console.log(`Importações com lista temática "Geral": ${importacoesGeral.length}`);

  const campos = new Map<string, Map<string, number>>();
  let totalRegistros = 0;
  let registrosSemDadosBase = 0;
  let registrosSemDadosEspecificos = 0;
  let registrosComListaNoRegistro = 0;
  let registrosComCodigoNoRegistro = 0;

  for (const importacaoDoc of importacoesGeral) {
    const importacao = importacaoDoc.data();
    const registrosSnap = await importacaoDoc.ref.collection("registros").get();
    totalRegistros += registrosSnap.size;

    console.log("");
    console.log(`Importação: ${importacaoDoc.id}`);
    console.log(`  Registros: ${registrosSnap.size}`);
    console.log(`  Campos da importação: ${Object.keys(importacao).sort().join(", ") || "(nenhum)"}`);
    console.log(`  listaTematica na importação: ${textoSeguro(importacao.listaTematica) || "(vazia)"}`);
    console.log(`  codigoIndicadorOrigem na importação: ${textoSeguro(importacao.codigoIndicadorOrigem) || "(vazio)"}`);

    for (const registroDoc of registrosSnap.docs) {
      const registro = registroDoc.data() as Dados;
      if (Object.keys(objetoSeguro(registro.dadosBase)).length === 0) registrosSemDadosBase++;
      if (Object.keys(objetoSeguro(registro.dadosEspecificos)).length === 0) registrosSemDadosEspecificos++;
      if (textoSeguro(registro.listaTematica)) registrosComListaNoRegistro++;
      if (textoSeguro(registro.codigoIndicadorOrigem)) registrosComCodigoNoRegistro++;

      for (const [chave, valor] of Object.entries(registro)) incrementar(campos, `registro.${chave}`, valor);
      for (const [chave, valor] of Object.entries(objetoSeguro(registro.dadosBase))) incrementar(campos, `dadosBase.${chave}`, valor);
      for (const [chave, valor] of Object.entries(objetoSeguro(registro.dadosEspecificos))) incrementar(campos, `dadosEspecificos.${chave}`, valor);
    }
  }

  console.log("");
  console.log("========================================");
  console.log("RESUMO");
  console.log("========================================");
  console.log(`Registros "Geral" analisados: ${totalRegistros}`);
  console.log(`Registros sem dadosBase preenchido: ${registrosSemDadosBase}`);
  console.log(`Registros sem dadosEspecificos preenchido: ${registrosSemDadosEspecificos}`);
  console.log(`Registros com listaTematica no próprio registro: ${registrosComListaNoRegistro}`);
  console.log(`Registros com codigoIndicadorOrigem no próprio registro: ${registrosComCodigoNoRegistro}`);
  console.log("");
  console.log("CAMPOS ENCONTRADOS (somente nomes, tipos e contagens; sem valores)");
  for (const [caminho, tipos] of [...campos.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const resumoTipos = [...tipos.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([nomeTipo, quantidade]) => `${nomeTipo}=${quantidade}`).join(", ");
    console.log(`- ${caminho}: ${resumoTipos}`);
  }
  console.log("");
  console.log("DIAGNÓSTICO CONCLUÍDO — nenhuma alteração foi gravada.");
}

main().catch((erro: unknown) => {
  console.error("Erro no diagnóstico:", erro);
  process.exitCode = 1;
});
