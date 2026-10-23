import { adminDb } from "../lib/firebase-admin-script";

type Dados = Record<string, unknown>;

type ResumoTematico = Dados & {
  pacienteId: string;
  ubsId: string;
  dadosBase: Dados;
  dadosEspecificos: Dados;
};

type RegistroHistorico = Dados & {
  pacienteId?: string;
  ubsId?: string;
  listaTematica?: string;
  codigoIndicadorOrigem?: string;
  importacaoId?: string;
  fonteC5HipertensaoAtiva?: boolean;
  dadosBase?: Dados;
  dadosEspecificos?: Dados;
  microareaId?: string;
};

const UBS_ID = "D68wxPwFiqgQvsBdbGwi";
const APLICAR = process.argv.includes("--apply");
const TAMANHO_GRUPO = 30;
const LIMITE_EXEMPLOS = 25;

function objetoSeguro(valor: unknown): Dados {
  if (valor && typeof valor === "object" && !Array.isArray(valor)) {
    return valor as Dados;
  }
  return {};
}

function textoSeguro(valor: unknown): string {
  if (typeof valor === "string") return valor.trim();
  if (typeof valor === "number") return String(valor);
  return "";
}

function obterTempo(valor: unknown): number {
  if (!valor) return 0;
  if (valor instanceof Date) return valor.getTime();

  if (
    typeof valor === "object" &&
    valor !== null &&
    "toMillis" in valor &&
    typeof valor.toMillis === "function"
  ) {
    return valor.toMillis();
  }

  if (
    typeof valor === "object" &&
    valor !== null &&
    "seconds" in valor &&
    typeof valor.seconds === "number"
  ) {
    return valor.seconds * 1000;
  }

  if (typeof valor === "string" || typeof valor === "number") {
    const tempo = new Date(valor).getTime();
    return Number.isFinite(tempo) ? tempo : 0;
  }

  return 0;
}

function criarChaveResumo(
  codigoIndicadorOrigem: unknown,
  listaTematica: unknown
): string {
  const identificador =
    textoSeguro(codigoIndicadorOrigem) ||
    textoSeguro(listaTematica) ||
    "geral";

  return (
    identificador
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "geral"
  );
}

// Detecta conflitos entre valores preenchidos antes de consolidar registros.
// A migração não escolhe silenciosamente um valor clínico divergente.
function valorVazio(valor: unknown): boolean {
  return valor === undefined || valor === null ||
    (typeof valor === "string" && valor.trim() === "") ||
    (Array.isArray(valor) && valor.length === 0);
}

function detectarConflitos(
  anterior: unknown,
  novo: unknown,
  caminho: string,
  saida: string[]
): void {
  if (valorVazio(anterior) || valorVazio(novo)) return;
  if (iguais(anterior, novo)) return;

  const anteriorObjeto = anterior !== null && typeof anterior === "object" && !Array.isArray(anterior);
  const novoObjeto = novo !== null && typeof novo === "object" && !Array.isArray(novo);

  if (anteriorObjeto && novoObjeto) {
    const a = anterior as Dados;
    const n = novo as Dados;
    for (const chave of new Set([...Object.keys(a), ...Object.keys(n)])) {
      detectarConflitos(a[chave], n[chave], caminho ? `${caminho}.${chave}` : chave, saida);
    }
    return;
  }

  // Arrays preenchidos diferentes também precisam de revisão; não são mesclados por suposição.
  saida.push(caminho || "(raiz)");
}

function indicadorDoCodigo(codigo: unknown): string | null {
  const texto = textoSeguro(codigo).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const match = texto.match(/^(C[2-7]|B[1-6])(?:\b|[_\-])/);
  if (!match) return null;
  return match[1] === "B1" || match[1] === "B2" || match[1] === "B3" || match[1] === "B4" || match[1] === "B5" || match[1] === "B6"
    ? "B1–B6"
    : match[1];
}

function combinarDadosPEC(anteriores: Dados, novos: Dados): Dados {
  const resultado: Dados = { ...anteriores };

  for (const [chave, valorNovo] of Object.entries(novos)) {
    // Não apaga informações úteis com valores ausentes.
    if (
      valorNovo === undefined ||
      valorNovo === null ||
      (typeof valorNovo === "string" && valorNovo.trim() === "")
    ) {
      continue;
    }

    const valorAnterior = resultado[chave];

    // Preserva arrays preenchidos quando o novo está vazio.
    if (
      Array.isArray(valorNovo) &&
      valorNovo.length === 0 &&
      Array.isArray(valorAnterior) &&
      valorAnterior.length > 0
    ) {
      continue;
    }

    const objetoNovo =
      typeof valorNovo === "object" &&
      valorNovo !== null &&
      !Array.isArray(valorNovo);

    const objetoAnterior =
      typeof valorAnterior === "object" &&
      valorAnterior !== null &&
      !Array.isArray(valorAnterior);

    if (objetoNovo && objetoAnterior) {
      resultado[chave] = combinarDadosPEC(
        objetoSeguro(valorAnterior),
        objetoSeguro(valorNovo)
      );
      continue;
    }

    // false é um valor válido e pode substituir true.
    resultado[chave] = valorNovo;
  }

  return resultado;
}

function valorBooleano(
  registro: Dados,
  importacao: Dados,
  campo: string
): boolean | undefined {
  if (typeof registro[campo] === "boolean") {
    return registro[campo] as boolean;
  }
  if (typeof importacao[campo] === "boolean") {
    return importacao[campo] as boolean;
  }
  return undefined;
}

function criarResumoTematico(
  registro: RegistroHistorico,
  importacao: Dados,
  pacienteId: string,
  resumoAnterior: Dados
): ResumoTematico {
  const ubsId =
    textoSeguro(registro.ubsId) ||
    textoSeguro(importacao.ubsId) ||
    UBS_ID;

  const listaTematica =
    textoSeguro(registro.listaTematica) ||
    textoSeguro(importacao.listaTematica);

  const codigoIndicadorOrigem =
    textoSeguro(registro.codigoIndicadorOrigem) ||
    textoSeguro(importacao.codigoIndicadorOrigem);

  const fonteC5HipertensaoAtiva = valorBooleano(
    registro,
    importacao,
    "fonteC5HipertensaoAtiva"
  );

  const resumo: Dados = {
    ...resumoAnterior,
    pacienteId,
    ubsId,
    dadosBase: combinarDadosPEC(
      objetoSeguro(resumoAnterior.dadosBase),
      objetoSeguro(registro.dadosBase)
    ),
    dadosEspecificos: combinarDadosPEC(
      objetoSeguro(resumoAnterior.dadosEspecificos),
      objetoSeguro(registro.dadosEspecificos)
    ),
  };

  if (listaTematica) resumo.listaTematica = listaTematica;

  // Guarda a data da importação mais recente que contribuiu para este resumo.
  // O script percorre as importações em ordem cronológica, então este valor
  // acompanha os dados consolidados mais recentes sem remover o histórico original.
  const importacaoCriadoEm = registro.importacaoCriadoEm ?? importacao.criadoEm;
  if (importacaoCriadoEm !== undefined && importacaoCriadoEm !== null) {
    resumo.importacaoCriadoEm = importacaoCriadoEm;
  }

  const grupoCondicoes =
    registro.grupoCondicoes ?? importacao.grupoCondicoes;
  if (
    grupoCondicoes !== undefined &&
    grupoCondicoes !== null &&
    grupoCondicoes !== ""
  ) {
    resumo.grupoCondicoes = grupoCondicoes;
  }

  const filtroProblemas =
    registro.filtroProblemas ?? importacao.filtroProblemas;
  if (
    filtroProblemas !== undefined &&
    filtroProblemas !== null &&
    filtroProblemas !== ""
  ) {
    resumo.filtroProblemas = filtroProblemas;
  }

  if (codigoIndicadorOrigem) {
    resumo.codigoIndicadorOrigem = codigoIndicadorOrigem;
  }

  // Não inventa false quando a informação não existe.
  if (fonteC5HipertensaoAtiva !== undefined) {
    resumo.fonteC5HipertensaoAtiva = fonteC5HipertensaoAtiva;
  }

  const microareaId =
    textoSeguro(registro.microareaId) ||
    textoSeguro(importacao.microareaId);
  if (microareaId) resumo.microareaId = microareaId;

  const importacaoId =
    textoSeguro(registro.importacaoId) ||
    textoSeguro(importacao.id);
  if (importacaoId) resumo.importacaoId = importacaoId;

  return resumo as ResumoTematico;
}

function listaTematicaTexto(valor: unknown): string {
  if (Array.isArray(valor)) {
    return valor.filter((item) => typeof item === "string").join(", ").trim();
  }
  return textoSeguro(valor);
}

function resolverListaTematica(
  listaRegistro: unknown,
  listaImportacao: unknown
): string {
  const listaRegistroTexto = listaTematicaTexto(listaRegistro);
  const listaImportacaoTexto = listaTematicaTexto(listaImportacao);

  const registroEhGeral = normalizarTematica(listaRegistroTexto) === "geral";
  const importacaoEhGeral = normalizarTematica(listaImportacaoTexto) === "geral";

  // Uma classificação específica tem prioridade sobre "Geral".
  if (listaRegistroTexto && !registroEhGeral) return listaRegistroTexto;
  if (listaImportacaoTexto && !importacaoEhGeral) return listaImportacaoTexto;

  // Mantém "Geral" quando não há classificação específica confiável.
  return listaRegistroTexto || listaImportacaoTexto;
}

function normalizarTematica(valor: unknown): string {
  return textoSeguro(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
}

function obterListaTematica(valor: unknown): string {
  if (Array.isArray(valor)) {
    return valor.filter((item) => typeof item === "string").join(", ");
  }
  return textoSeguro(valor);
}

// Espelha as regras de identificação de temáticas da rota operacional.
function identificarIndicadorDaLista(listaTematica: unknown): string | null {
  const origem = normalizarTematica(obterListaTematica(listaTematica));
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
    item.termos.some((termo) => origem.includes(normalizarTematica(termo)))
  );

  return regra?.indicador ?? null;
}

function obterIndicadoresReconhecidos(resumo: Dados): Set<string> {
  const indicadores = new Set<string>();

  for (const valor of Object.values(resumo)) {
    if (!valor || typeof valor !== "object" || Array.isArray(valor)) continue;
    const registro = valor as Dados;
    const indicador = identificarIndicadorDaLista(registro.listaTematica);
    if (indicador) indicadores.add(indicador);
  }

  return indicadores;
}

function valorComparavel(valor: unknown): unknown {
  if (valor instanceof Date) return valor.toISOString();

  if (
    valor &&
    typeof valor === "object" &&
    !Array.isArray(valor) &&
    "toMillis" in valor &&
    typeof (valor as { toMillis?: unknown }).toMillis === "function"
  ) {
    return (valor as { toMillis: () => number }).toMillis();
  }

  if (Array.isArray(valor)) return valor.map(valorComparavel);

  if (valor && typeof valor === "object") {
    const ordenado: Dados = {};
    for (const chave of Object.keys(valor as Dados).sort()) {
      ordenado[chave] = valorComparavel((valor as Dados)[chave]);
    }
    return ordenado;
  }

  return valor;
}

function iguais(a: unknown, b: unknown): boolean {
  return JSON.stringify(valorComparavel(a)) === JSON.stringify(valorComparavel(b));
}

function listarDiferencas(
  atual: unknown,
  proposto: unknown,
  caminho: string,
  saida: string[]
): void {
  if (iguais(atual, proposto)) return;

  const atualObjeto =
    atual !== null && typeof atual === "object" && !Array.isArray(atual);
  const propostoObjeto =
    proposto !== null && typeof proposto === "object" && !Array.isArray(proposto);

  if (atualObjeto && propostoObjeto) {
    const atualDados = atual as Dados;
    const propostoDados = proposto as Dados;
    const chaves = new Set([
      ...Object.keys(atualDados),
      ...Object.keys(propostoDados),
    ]);

    for (const chave of [...chaves].sort()) {
      listarDiferencas(
        atualDados[chave],
        propostoDados[chave],
        caminho ? `${caminho}.${chave}` : chave,
        saida
      );
    }
    return;
  }

  saida.push(caminho || "(raiz)");
}

async function main() {
  console.log("========================================");
  console.log("PRÉVIA DA MIGRAÇÃO DO RESUMO OPERACIONAL PEC");
  console.log("========================================");
  console.log(`UBS: ${UBS_ID}`);
  console.log(`Modo: ${APLICAR ? "APLICAÇÃO REAL" : "SIMULAÇÃO"}`);

  if (!APLICAR) {
    console.log("Nenhuma alteração será gravada no Firestore.");
  } else {
    console.log("ATENÇÃO: modo de gravação habilitado por --apply.");
  }

  const ubsRef = adminDb.collection("ubs").doc(UBS_ID);
  const ubsSnap = await ubsRef.get();
  if (!ubsSnap.exists) throw new Error(`UBS não encontrada: ${UBS_ID}`);

  const importacoesSnap = await ubsRef.collection("importacoesPEC").get();
  const importacoes = [...importacoesSnap.docs].sort((a, b) => {
    const diferenca =
      obterTempo(a.data().criadoEm) - obterTempo(b.data().criadoEm);
    return diferenca || a.id.localeCompare(b.id);
  });

  const resumosPorPaciente = new Map<string, Map<string, Dados>>();
  let registrosAnalisados = 0;
  let registrosIgnorados = 0;
  let registrosSemListaTematica = 0;
  let registrosSemCodigoIndicador = 0;
  let registrosSemListaNemCodigo = 0;
  const metadadosAusentesPorImportacao = new Map<
    string,
    { semLista: number; semCodigo: number; semAmbos: number; listaImportacao: string; codigoImportacao: string }
  >();
  const conflitosDados: string[] = [];
  const conflitosClassificacao: string[] = [];
  const LIMITE_CONFLITOS = 30;

  for (const importacaoDoc of importacoes) {
    const dadosImportacao = importacaoDoc.data();
    const registrosSnap = await importacaoDoc.ref.collection("registros").get();

    for (const registroDoc of registrosSnap.docs) {
      registrosAnalisados++;
      const registro = registroDoc.data() as RegistroHistorico;
      const pacienteId = textoSeguro(registro.pacienteId) || registroDoc.id;

      if (!pacienteId) {
        registrosIgnorados++;
        continue;
      }

      const ubsRegistro =
        textoSeguro(registro.ubsId) || textoSeguro(dadosImportacao.ubsId);

      if (ubsRegistro && ubsRegistro !== UBS_ID) {
        registrosIgnorados++;
        continue;
      }

      const listaNoRegistro = listaTematicaTexto(registro.listaTematica);
      const listaNaImportacao = listaTematicaTexto(dadosImportacao.listaTematica);
      const codigoNoRegistro = textoSeguro(registro.codigoIndicadorOrigem);
      const codigoNaImportacao = textoSeguro(dadosImportacao.codigoIndicadorOrigem);
      const listaEfetiva = resolverListaTematica(
          registro.listaTematica,
          dadosImportacao.listaTematica
        );

        const codigoEfetivo = codigoNoRegistro || codigoNaImportacao;

      const indicadorCodigo = indicadorDoCodigo(codigoEfetivo);
      const indicadorLista = identificarIndicadorDaLista(listaEfetiva);
      if (indicadorCodigo && indicadorLista && indicadorCodigo !== indicadorLista && conflitosClassificacao.length < LIMITE_CONFLITOS) {
        conflitosClassificacao.push(
          `${pacienteId} / importação ${importacaoDoc.id}: código ${codigoEfetivo} (${indicadorCodigo}) diverge da lista "${listaEfetiva}" (${indicadorLista})`
        );
      }

      const semLista = !listaEfetiva;
      const semCodigo = !codigoEfetivo;
      if (semLista) registrosSemListaTematica++;
      if (semCodigo) registrosSemCodigoIndicador++;
      if (semLista && semCodigo) registrosSemListaNemCodigo++;

      if (semLista || semCodigo) {
        const metadadoAtual = metadadosAusentesPorImportacao.get(importacaoDoc.id) ?? {
          semLista: 0,
          semCodigo: 0,
          semAmbos: 0,
          listaImportacao: listaNaImportacao || "(vazia)",
          codigoImportacao: codigoNaImportacao || "(vazio)",
        };
        if (semLista) metadadoAtual.semLista++;
        if (semCodigo) metadadoAtual.semCodigo++;
        if (semLista && semCodigo) metadadoAtual.semAmbos++;
        metadadosAusentesPorImportacao.set(importacaoDoc.id, metadadoAtual);
      }

      const chaveResumo = criarChaveResumo(
        codigoEfetivo,
        listaEfetiva
      );

      let resumosTematicos = resumosPorPaciente.get(pacienteId);
      if (!resumosTematicos) {
        resumosTematicos = new Map<string, Dados>();
        resumosPorPaciente.set(pacienteId, resumosTematicos);
      }

      const resumoAnterior = resumosTematicos.get(chaveResumo) ?? {};
      const registroComImportacao: RegistroHistorico = {
        ...registro,
        listaTematica: listaEfetiva,
        codigoIndicadorOrigem: codigoEfetivo,
        importacaoId: importacaoDoc.id,
        importacaoCriadoEm: dadosImportacao.criadoEm ?? null,
      };

      // Só compara os blocos clínicos que serão consolidados; metadados de importação
      // (como importacaoId) podem mudar legitimamente entre cargas.
      const conflitosRegistro: string[] = [];
      detectarConflitos(
        objetoSeguro(resumoAnterior.dadosBase),
        objetoSeguro(registroComImportacao.dadosBase),
        "dadosBase",
        conflitosRegistro
      );
      detectarConflitos(
        objetoSeguro(resumoAnterior.dadosEspecificos),
        objetoSeguro(registroComImportacao.dadosEspecificos),
        "dadosEspecificos",
        conflitosRegistro
      );
      for (const campo of conflitosRegistro) {
        if (conflitosDados.length >= LIMITE_CONFLITOS) break;
        conflitosDados.push(`${pacienteId} / importação ${importacaoDoc.id} / chave ${chaveResumo}: ${campo}`);
      }

      const resumoNovo = criarResumoTematico(
        registroComImportacao,
        dadosImportacao,
        pacienteId,
        resumoAnterior
      );
      resumosTematicos.set(chaveResumo, resumoNovo);
    }
  }

  const pacientesIds = [...resumosPorPaciente.keys()];
  let pacientesEncontrados = 0;
  let pacientesAusentes = 0;
  let pacientesSemResumo = 0;
  let pacientesComResumo = 0;
  let pacientesSemAlteracao = 0;
  let pacientesComAlteracao = 0;
  let tematicasNovas = 0;
  let camposDiferentes = 0;
  let pacientesParaGravar = 0;
  let tematicasPropostasAnalisadas = 0;
  let tematicasReconhecidas = 0;
  let tematicasNaoReconhecidas = 0;
  let pacientesSemTematicaReconhecida = 0;
  let indicadoresAntes = 0;
  let indicadoresDepois = 0;
  const chavesNaoReconhecidas = new Set<string>();
  const exemplos: string[] = [];
  const gravacoesPendentes: Array<{
    pacienteId: string;
    resumo: Dados;
  }> = [];

  console.log("");
  console.log(`Importações lidas: ${importacoes.length}`);
  console.log(`Registros analisados: ${registrosAnalisados}`);
  console.log(`Registros ignorados: ${registrosIgnorados}`);
  console.log(`Registros sem lista temática (registro + importação): ${registrosSemListaTematica}`);
  console.log(`Registros sem código indicador (registro + importação): ${registrosSemCodigoIndicador}`);
  console.log(`Registros sem lista temática e sem código: ${registrosSemListaNemCodigo}`);
  console.log(`Pacientes distintos no histórico: ${pacientesIds.length}`);

  if (metadadosAusentesPorImportacao.size > 0) {
    console.log("");
    console.log("IMPORTAÇÕES COM METADADOS TEMÁTICOS AUSENTES");
    for (const [importacaoId, dados] of [...metadadosAusentesPorImportacao.entries()].sort(
      (a, b) => b[1].semAmbos - a[1].semAmbos
    )) {
      console.log(
        `- ${importacaoId}: sem lista=${dados.semLista}, sem código=${dados.semCodigo}, sem ambos=${dados.semAmbos}; ` +
        `lista da importação=${dados.listaImportacao}; código da importação=${dados.codigoImportacao}`
      );
    }
  }

  if (conflitosClassificacao.length > 0) {
    console.log("\nDIVERGÊNCIAS ENTRE CÓDIGO E LISTA TEMÁTICA (máximo 30)");
    for (const conflito of conflitosClassificacao) console.log(`- ${conflito}`);
  }
  if (conflitosDados.length > 0) {
    console.log("\nCONFLITOS DE DADOS ENTRE REGISTROS (máximo 30; valores omitidos)");
    for (const conflito of conflitosDados) console.log(`- ${conflito}`);
  }

  for (
    let inicio = 0;
    inicio < pacientesIds.length;
    inicio += TAMANHO_GRUPO
  ) {
    const blocoIds = pacientesIds.slice(inicio, inicio + TAMANHO_GRUPO);
    const referencias = blocoIds.map((pacienteId) =>
      ubsRef.collection("pacientes").doc(pacienteId)
    );
    const snapshots = await adminDb.getAll(...referencias);

    for (const pacienteSnap of snapshots) {
      if (!pacienteSnap.exists) {
        pacientesAusentes++;
        continue;
      }

      pacientesEncontrados++;
      const pacienteId = pacienteSnap.id;
      const pacienteAtual = objetoSeguro(pacienteSnap.data());
      const resumoExistente = objetoSeguro(pacienteAtual.resumoOperacionalPEC);
      const resumosHistoricos = resumosPorPaciente.get(pacienteId);

      if (!resumosHistoricos || resumosHistoricos.size === 0) continue;

      if (Object.keys(resumoExistente).length === 0) pacientesSemResumo++;

      const resumoFinal: Dados = { ...resumoExistente };
      let tematicasNovasPaciente = 0;

      for (const [chave, resumoHistorico] of resumosHistoricos) {
        const resumoAtual = objetoSeguro(resumoFinal[chave]);
        if (Object.keys(resumoAtual).length === 0) tematicasNovasPaciente++;

        resumoFinal[chave] = criarResumoTematico(
          resumoHistorico as RegistroHistorico,
          {},
          pacienteId,
          resumoAtual
        );
      }

      // Mede o reconhecimento pela mesma regra de listaTematica usada na API.
      const indicadoresAntesPaciente = obterIndicadoresReconhecidos(resumoExistente);
      const indicadoresDepoisPaciente = obterIndicadoresReconhecidos(resumoFinal);
      indicadoresAntes += indicadoresAntesPaciente.size;
      indicadoresDepois += indicadoresDepoisPaciente.size;

      let tematicaReconhecidaPaciente = false;
      for (const [chave, valor] of Object.entries(resumoFinal)) {
        if (!valor || typeof valor !== "object" || Array.isArray(valor)) continue;
        tematicasPropostasAnalisadas++;
        const lista = (valor as Dados).listaTematica;
        if (identificarIndicadorDaLista(lista)) {
          tematicasReconhecidas++;
          tematicaReconhecidaPaciente = true;
        } else {
          tematicasNaoReconhecidas++;
          chavesNaoReconhecidas.add(chave);
        }
      }
      if (!tematicaReconhecidaPaciente && Object.keys(resumoFinal).length > 0) {
        pacientesSemTematicaReconhecida++;
      }

      const diferencasPaciente: string[] = [];
      listarDiferencas(
        resumoExistente,
        resumoFinal,
        "resumoOperacionalPEC",
        diferencasPaciente
      );

      if (tematicasNovasPaciente > 0) tematicasNovas += tematicasNovasPaciente;

      if (diferencasPaciente.length > 0) {
        pacientesComAlteracao++;
        camposDiferentes += diferencasPaciente.length;
        pacientesParaGravar++;

        if (exemplos.length < LIMITE_EXEMPLOS) {
          exemplos.push(
            `${pacienteId}: ${diferencasPaciente.length} campo(s) diferente(s)` +
              (tematicasNovasPaciente
                ? `; ${tematicasNovasPaciente} temática(s) nova(s)`
                : "") +
              `; exemplos: ${diferencasPaciente.slice(0, 8).join(", ")}`
          );
        }

        // Não grava durante a análise. As gravações ficam em memória até
        // todas as validações terminarem, evitando aplicação parcial.
        if (APLICAR) {
          gravacoesPendentes.push({ pacienteId, resumo: resumoFinal });
        }
      } else {
        pacientesSemAlteracao++;
      }

      pacientesComResumo++;
    }

    console.log(
      `Grupo ${Math.floor(inicio / TAMANHO_GRUPO) + 1}: ` +
        `${snapshots.length} pacientes verificados.`
    );
  }

  console.log("");
  console.log("========================================");
  console.log("RESULTADO DA PRÉVIA");
  console.log("========================================");
  console.log(`Importações lidas: ${importacoes.length}`);
  console.log(`Registros analisados: ${registrosAnalisados}`);
  console.log(`Registros ignorados: ${registrosIgnorados}`);
  console.log(`Pacientes encontrados: ${pacientesEncontrados}`);
  console.log(`Pacientes ausentes: ${pacientesAusentes}`);
  console.log(`Pacientes com resumo analisado: ${pacientesComResumo}`);
  console.log(`Pacientes sem resumo anterior: ${pacientesSemResumo}`);
  console.log(`Pacientes com alterações propostas: ${pacientesComAlteracao}`);
  console.log(`Pacientes sem alterações: ${pacientesSemAlteracao}`);
  console.log(`Temáticas novas propostas: ${tematicasNovas}`);
  console.log(`Campos diferentes: ${camposDiferentes}`);
  console.log(`Pacientes que seriam gravados: ${pacientesParaGravar}`);
  console.log("");
  console.log("VALIDAÇÃO DE TEMÁTICAS PELA REGRA DA API");
  console.log(`Temáticas analisadas no resumo proposto: ${tematicasPropostasAnalisadas}`);
  console.log(`Temáticas reconhecidas pela listaTematica: ${tematicasReconhecidas}`);
  console.log(`Temáticas sem classificação pela API: ${tematicasNaoReconhecidas}`);
  console.log(`Pacientes sem nenhuma temática reconhecida: ${pacientesSemTematicaReconhecida}`);
  console.log(`Indicadores distintos reconhecidos antes da migração (soma por paciente): ${indicadoresAntes}`);
  console.log(`Indicadores distintos reconhecidos após a migração (soma por paciente): ${indicadoresDepois}`);
  if (chavesNaoReconhecidas.size > 0) {
    console.log(
      `Chaves com ao menos uma temática não reconhecida: ${[...chavesNaoReconhecidas].sort().join(", ")}`
    );
  }

  if (exemplos.length > 0) {
    console.log("");
    console.log(`Exemplos de diferenças (máximo ${LIMITE_EXEMPLOS}):`);
    for (const exemplo of exemplos) console.log(`- ${exemplo}`);
  } else {
    console.log("");
    console.log("Nenhuma diferença detectada entre o resumo atual e o proposto.");
  }

  console.log("");
  if (!APLICAR) {
    console.log("SIMULAÇÃO: nenhuma alteração foi gravada.");
    console.log("Conflitos de valores são informativos; prevalece o dado preenchido da importação mais recente.");
    if (conflitosClassificacao.length > 0) {
      console.log("BLOQUEIO: foram encontradas divergências entre código indicador e lista temática.");
    } else {
      console.log("Classificação: nenhuma divergência entre código indicador e lista temática foi detectada.");
    }
  } else {
    // Bloqueia toda a aplicação se houver pacientes históricos sem documento
    // de destino ou sem nenhuma temática reconhecida. Nenhuma gravação ocorreu
    // antes deste ponto.
    const bloqueios: string[] = [];
    if (pacientesAusentes > 0) {
      bloqueios.push(`${pacientesAusentes} paciente(s) do histórico sem documento de destino`);
    }
    if (pacientesSemTematicaReconhecida > 0) {
      bloqueios.push(`${pacientesSemTematicaReconhecida} paciente(s) sem temática reconhecida`);
    }
    if (conflitosClassificacao.length > 0) {
      bloqueios.push("há divergências entre código indicador e lista temática; revisar a origem");
    }
    // Divergências entre snapshots são esperadas em campos que mudam com o tempo
    // (idade, dias desde atendimento/visita e avaliações atualizadas). A consolidação
    // já percorre as importações em ordem cronológica, fazendo prevalecer o valor
    // preenchido da importação mais recente. Esses conflitos são reportados para
    // auditoria, mas não bloqueiam a migração. Divergências de classificação continuam
    // bloqueando, pois podem colocar um registro na temática errada.
    if (bloqueios.length > 0) {
      console.error("APLICAÇÃO BLOQUEADA: nenhuma alteração foi gravada.");
      for (const bloqueio of bloqueios) console.error(`- ${bloqueio}`);
      process.exitCode = 1;
      return;
    }

    console.log(`Validação aprovada. Gravando ${gravacoesPendentes.length} paciente(s)...`);
    for (let inicio = 0; inicio < gravacoesPendentes.length; inicio += TAMANHO_GRUPO) {
      const bloco = gravacoesPendentes.slice(inicio, inicio + TAMANHO_GRUPO);
      const batch = adminDb.batch();
      for (const item of bloco) {
        batch.set(
          ubsRef.collection("pacientes").doc(item.pacienteId),
          { resumoOperacionalPEC: item.resumo },
          { merge: true }
        );
      }
      await batch.commit();
      console.log(`Gravação ${Math.floor(inicio / TAMANHO_GRUPO) + 1}: ${bloco.length} paciente(s).`);
    }
    console.log("CONCLUÍDO: todas as alterações validadas foram gravadas no Firestore.");
  }
}

main().catch((erro: unknown) => {
  console.error("Erro na migração:", erro);
  process.exitCode = 1;
});
