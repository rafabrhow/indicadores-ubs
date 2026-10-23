
import { adminDb } from "../lib/firebase-admin-script";

const UBS_ID = "D68wxPwFiqgQvsBdbGwi";

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

async function main() {
  const ubsRef = adminDb.collection("ubs").doc(UBS_ID);
  const imports = await ubsRef.collection("importacoesPEC").get();

  const gerais = imports.docs.filter(
    (doc) =>
      texto(doc.data().listaTematica)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase() === "geral"
  );

  const conjuntos: Array<{
    id: string;
    arquivo: string;
    data: string;
    status: string;
    ids: Set<string>;
  }> = [];

  for (const imp of gerais) {
    const registros = await imp.ref.collection("registros").get();
    const dados = imp.data();

    conjuntos.push({
      id: imp.id,
      arquivo: texto(dados.arquivoNome) || "(sem nome)",
      data:
        dados.criadoEm?.toDate?.()?.toISOString?.() || "(sem data)",
      status: texto(dados.status) || "(sem status)",
      ids: new Set(registros.docs.map((doc) => doc.id)),
    });
  }

  console.log("DIAGNÓSTICO DE DUPLICIDADE — SOMENTE LEITURA");
  console.log(`Importações Geral: ${conjuntos.length}`);

  for (const item of conjuntos) {
    console.log(
      `Importação ${item.id} | arquivo=${item.arquivo} | ` +
      `data=${item.data} | status=${item.status} | ` +
      `registros=${item.ids.size}`
    );
  }

  console.log("\nCOMPARAÇÃO DOS CONJUNTOS DE REGISTROS");

  for (let i = 0; i < conjuntos.length; i++) {
    for (let j = i + 1; j < conjuntos.length; j++) {
      const a = conjuntos[i];
      const b = conjuntos[j];

      let iguais = a.ids.size === b.ids.size;
      let intersecao = 0;

      for (const id of a.ids) {
        if (b.ids.has(id)) intersecao++;
        else iguais = false;
      }

      console.log(
        `${a.id} x ${b.id}: ` +
        `IDs em comum=${intersecao}; conjuntos idênticos=${iguais}`
      );
    }
  }

  console.log("\nDiagnóstico concluído. Nenhuma gravação realizada.");
}

main().catch((erro) => {
  console.error("Falha no diagnóstico:", erro);
  process.exitCode = 1;
});
