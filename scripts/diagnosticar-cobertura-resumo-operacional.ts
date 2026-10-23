
import { adminDb } from "../lib/firebase-admin-script";

const UBS_ID = "D68wxPwFiqgQvsBdbGwi";

function normalizar(valor: unknown): string {
  return (typeof valor === "string" ? valor : "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function indicadorDaTematica(valor: unknown): string | null {
  const tema = normalizar(valor);

  const regras = [
    { termos: ["infantil", "crianca"], indicador: "C2" },
    { termos: ["gestante", "gestacao", "puerperio"], indicador: "C3" },
    { termos: ["diabetes"], indicador: "C4" },
    { termos: ["hipertens"], indicador: "C5" },
    { termos: ["idos"], indicador: "C6" },
    { termos: ["mulher"], indicador: "C7" },
    { termos: ["bucal"], indicador: "B1–B6" },
  ];

  const regra = regras.find((item) =>
    item.termos.some((termo) => tema.includes(termo))
  );

  return regra?.indicador ?? null;
}

async function main() {
  console.log("DIAGNÓSTICO DE COBERTURA DO RESUMO OPERACIONAL");
  console.log("Somente leitura. Nenhuma gravação será realizada.");

  const pacientesSnap = await adminDb
    .collection("ubs")
    .doc(UBS_ID)
    .collection("pacientes")
    .get();

  let comResumo = 0;
  let semResumo = 0;
  let resumoVazio = 0;
  let resumoComTematicaReconhecida = 0;
  let resumoSemTematicaReconhecida = 0;
  let comGeral = 0;
  let comTematicaNaoReconhecida = 0;

  const indicadores = new Map<string, number>();

  for (const pacienteDoc of pacientesSnap.docs) {
    const paciente = pacienteDoc.data();
    const resumo = paciente.resumoOperacionalPEC;

    if (!resumo || typeof resumo !== "object" || Array.isArray(resumo)) {
      semResumo++;
      continue;
    }

    comResumo++;

    const entradas = Object.values(resumo).filter(
      (valor) =>
        valor !== null &&
        typeof valor === "object" &&
        !Array.isArray(valor)
    ) as Record<string, unknown>[];

    if (entradas.length === 0) {
      resumoVazio++;
      resumoSemTematicaReconhecida++;
      continue;
    }

    let reconheceu = false;

    for (const registro of entradas) {
      const lista = registro.listaTematica;
      const codigo = normalizar(registro.codigoIndicadorOrigem);
      const tema = normalizar(lista);

      if (tema === "geral" || tema.includes("geral")) {
        comGeral++;
      }

      const indicador =
        ["c2", "c3", "c4", "c5", "c6", "c7"].includes(codigo.toUpperCase())
          ? codigo.toUpperCase()
          : codigo.includes("b1") ||
              codigo.includes("b2") ||
              codigo.includes("b3") ||
              codigo.includes("b4") ||
              codigo.includes("b5") ||
              codigo.includes("b6")
            ? "B1–B6"
            : indicadorDaTematica(lista);

      if (indicador) {
        reconheceu = true;
        indicadores.set(indicador, (indicadores.get(indicador) || 0) + 1);
      } else {
        comTematicaNaoReconhecida++;
      }
    }

    if (reconheceu) resumoComTematicaReconhecida++;
    else resumoSemTematicaReconhecida++;
  }

  console.log("\nRESULTADO");
  console.log(`Pacientes analisados: ${pacientesSnap.size}`);
  console.log(`Pacientes com resumo: ${comResumo}`);
  console.log(`Pacientes sem resumo: ${semResumo}`);
  console.log(`Resumos sem entradas válidas: ${resumoVazio}`);
  console.log(
    `Pacientes com ao menos uma temática reconhecida: ${resumoComTematicaReconhecida}`
  );
  console.log(
    `Pacientes sem temática reconhecida: ${resumoSemTematicaReconhecida}`
  );
  console.log(`Entradas com classificação Geral: ${comGeral}`);
  console.log(
    `Entradas com temática não reconhecida: ${comTematicaNaoReconhecida}`
  );

  console.log("\nENTRADAS RECONHECIDAS POR INDICADOR");
  for (const [indicador, quantidade] of [...indicadores.entries()].sort()) {
    console.log(`${indicador}: ${quantidade}`);
  }

  console.log("\nDiagnóstico concluído. Nenhuma gravação realizada.");
}

main().catch((erro) => {
  console.error("Falha no diagnóstico de cobertura.");
  console.error(
    erro instanceof Error ? erro.message : "Erro não detalhado."
  );
  process.exitCode = 1;
});
