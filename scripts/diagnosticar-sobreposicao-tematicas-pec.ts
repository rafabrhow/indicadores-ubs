
import { adminDb } from "../lib/firebase-admin-script";

const UBS_ID = "D68wxPwFiqgQvsBdbGwi";

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function dataISO(valor: any): string {
  return valor?.toDate?.()?.toISOString?.() || "(sem data)";
}

type Importacao = {
  id: string;
  arquivo: string;
  data: string;
  status: string;
  tematica: string;
  ids: Set<string>;
  tematicasPorRegistro: Map<string, Set<string>>;
};

async function main() {
  const ubsRef = adminDb.collection("ubs").doc(UBS_ID);
  const importsSnap = await ubsRef.collection("importacoesPEC").get();

  const importacoes: Importacao[] = [];

  // Guarda apenas IDs técnicos dos registros e suas classificações.
  // Nenhum dado pessoal dos pacientes é exibido.
  const ocorrencias = new Map<
    string,
    Map<string, Set<string>>
  >();

  let totalRegistrosLidos = 0;

  for (const imp of importsSnap.docs) {
    const dadosImportacao = imp.data();
    const tematicaImportacao =
      texto(dadosImportacao.listaTematica) || "(sem temática)";

    const registrosSnap = await imp.ref.collection("registros").get();

    const item: Importacao = {
      id: imp.id,
      arquivo: texto(dadosImportacao.arquivoNome) || "(sem nome)",
      data: dataISO(dadosImportacao.criadoEm),
      status: texto(dadosImportacao.status) || "(sem status)",
      tematica: tematicaImportacao,
      ids: new Set(),
      tematicasPorRegistro: new Map(),
    };

    for (const registro of registrosSnap.docs) {
      totalRegistrosLidos++;

      const dados = registro.data();
      const tematicaRegistro =
        texto(dados.codigoIndicadorOrigem) ||
        texto(dados.listaTematica) ||
        tematicaImportacao;

      const chaveTematica = normalizar(tematicaRegistro);
      item.ids.add(registro.id);

      const tematicasDoRegistro =
        item.tematicasPorRegistro.get(registro.id) || new Set<string>();

      tematicasDoRegistro.add(chaveTematica);
      item.tematicasPorRegistro.set(registro.id, tematicasDoRegistro);

      let porImportacao = ocorrencias.get(registro.id);

      if (!porImportacao) {
        porImportacao = new Map();
        ocorrencias.set(registro.id, porImportacao);
      }

      let classificacoes = porImportacao.get(imp.id);

      if (!classificacoes) {
        classificacoes = new Set();
        porImportacao.set(imp.id, classificacoes);
      }

      classificacoes.add(chaveTematica);
    }

    importacoes.push(item);
  }

  console.log("DIAGNÓSTICO DE SOBREPOSIÇÃO PEC — SOMENTE LEITURA");
  console.log("Nenhuma gravação, alteração ou exclusão será realizada.");
  console.log(`Importações encontradas: ${importacoes.length}`);
  console.log(`Documentos de registros lidos: ${totalRegistrosLidos}`);

  // Resumo por temática declarada na importação.
  console.log("\nRESUMO POR TEMÁTICA DA IMPORTAÇÃO");

  const resumoTematicas = new Map<
    string,
    { importacoes: number; registros: number }
  >();

  for (const item of importacoes) {
    const chave = normalizar(item.tematica);
    const resumo = resumoTematicas.get(chave) || {
      importacoes: 0,
      registros: 0,
    };

    resumo.importacoes++;
    resumo.registros += item.ids.size;
    resumoTematicas.set(chave, resumo);
  }

  for (const [tematica, resumo] of [...resumoTematicas.entries()].sort()) {
    console.log(
      `${tematica}: importações=${resumo.importacoes}; ` +
      `registros somados entre importações=${resumo.registros}`
    );
  }

  // Metadados técnicos, sem informações dos pacientes.
  console.log("\nIMPORTAÇÕES ANALISADAS");

  for (const item of importacoes) {
    console.log(
      `${item.id} | temática=${item.tematica} | ` +
      `arquivo=${item.arquivo} | data=${item.data} | ` +
      `status=${item.status} | registros=${item.ids.size}`
    );
  }

  // Compara apenas pares com pelo menos um registro em comum.
  console.log("\nSOBREPOSIÇÃO ENTRE IMPORTAÇÕES");

  let paresComSobreposicao = 0;

  for (let i = 0; i < importacoes.length; i++) {
    for (let j = i + 1; j < importacoes.length; j++) {
      const a = importacoes[i];
      const b = importacoes[j];

      const menor = a.ids.size <= b.ids.size ? a : b;
      const maior = menor === a ? b : a;

      let emComum = 0;
      let mesmaClassificacao = 0;
      let classificacaoDiferente = 0;

      for (const id of menor.ids) {
        if (!maior.ids.has(id)) continue;

        emComum++;

        const temasA = a.tematicasPorRegistro.get(id) || new Set();
        const temasB = b.tematicasPorRegistro.get(id) || new Set();

        const temasIguais =
          temasA.size === temasB.size &&
          [...temasA].every((tema) => temasB.has(tema));

        if (temasIguais) mesmaClassificacao++;
        else classificacaoDiferente++;
      }

      if (emComum === 0) continue;

      paresComSobreposicao++;

      const mesmaTematicaImportacao =
        normalizar(a.tematica) === normalizar(b.tematica);

      const conjuntosIdenticos =
        a.ids.size === b.ids.size && emComum === a.ids.size;

      console.log(
        `${a.id} x ${b.id} | ` +
        `temáticas=${mesmaTematicaImportacao ? "iguais" : "diferentes"} | ` +
        `registros em comum=${emComum} | ` +
        `classificação igual=${mesmaClassificacao} | ` +
        `classificação diferente=${classificacaoDiferente} | ` +
        `conjuntos idênticos=${conjuntosIdenticos}`
      );
    }
  }

  console.log(`Pares com sobreposição: ${paresComSobreposicao}`);

  // Conta IDs técnicos que aparecem em mais de uma importação
  // e identifica se foram associados a classificações diferentes.
  let registrosEmMultiplasImportacoes = 0;
  let registrosComMultiplasTematicas = 0;

  for (const porImportacao of ocorrencias.values()) {
    if (porImportacao.size > 1) {
      registrosEmMultiplasImportacoes++;

      const todasTematicas = new Set<string>();

      for (const temas of porImportacao.values()) {
        for (const tema of temas) todasTematicas.add(tema);
      }

      if (todasTematicas.size > 1) {
        registrosComMultiplasTematicas++;
      }
    }
  }

  console.log("\nRESUMO GERAL");
  console.log(
    `IDs de registros presentes em múltiplas importações: ` +
    `${registrosEmMultiplasImportacoes}`
  );
  console.log(
    `IDs presentes em múltiplas importações com classificações distintas: ` +
    `${registrosComMultiplasTematicas}`
  );
  console.log("\nDiagnóstico concluído. Nenhuma gravação realizada.");
}

main().catch((erro) => {
  console.error("Falha no diagnóstico de sobreposição.");
  console.error(
    erro instanceof Error ? erro.message : "Erro não detalhado."
  );
  process.exitCode = 1;
});
