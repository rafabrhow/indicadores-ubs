import { createHash } from "crypto";

export type LinhaPEC = Record<string, string>;

export interface ResultadoPEC {
  filtros: Record<string, string>;
  cabecalho: string[];
  linhas: LinhaPEC[];
  listaTematica: string;
  equipeResponsavel: string;
  microareas: string;
  grupoCondicoes: string;
  filtroProblemas: string;
  periodoAtendimento: string;
  geradoEm: string;
  por: string;
}

const CAMPOS_BASE = new Set([
  "Nome",
  "Data de nascimento",
  "Idade",
  "Sexo",
  "Identidade de gênero",
  "Raça/cor",
  "Beneficiário do programa Bolsa Família",
  "Vigência do programa Bolsa Família",
  "CPF",
  "CNS",
  "Telefone celular",
  "Telefone residencial",
  "Telefone de contato",
  "Microárea",
  "Rua",
  "Número",
  "Complemento",
  "Bairro",
  "Município",
  "UF",
  "CEP",
]);

function limpar(valor: string | undefined) {
  return (valor ?? "").replace(/^\uFEFF/, "").trim();
}

function normalizarCabecalho(valor: string) {
  return limpar(valor);
}

/**
 * Lê CSV delimitado sem depender de split, respeitando campos entre aspas,
 * aspas escapadas (""), quebras de linha dentro de campos e delimitadores
 * presentes no conteúdo de um campo.
 *
 * O PEC normalmente exporta arquivos separados por ponto e vírgula. A função
 * é intencionalmente pequena para não adicionar uma dependência ao projeto.
 */
function parsearCSV(conteudo: string, delimitador = ";"): string[][] {
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let dentroDeAspas = false;
  let aspasFechadas = false;

  for (let i = 0; i < conteudo.length; i++) {
    const caractere = conteudo[i];
    const proximo = conteudo[i + 1];

    if (dentroDeAspas) {
      if (caractere === '"') {
        if (proximo === '"') {
          campo += '"';
          i++;
        } else {
          dentroDeAspas = false;
          aspasFechadas = true;
        }
      } else {
        campo += caractere;
      }
      continue;
    }

    if (caractere === '"') {
      // Uma aspa abre um campo citado apenas no início do campo (ignorando
      // espaços iniciais); aspas soltas em campos sem citação são inválidas.
      if (campo.trim() === "" && !aspasFechadas) {
        campo = "";
        dentroDeAspas = true;
      } else {
        throw new Error(`CSV inválido: aspa inesperada na posição ${i + 1}.`);
      }
    } else if (caractere === delimitador) {
      linha.push(campo);
      campo = "";
      aspasFechadas = false;
    } else if (caractere === "\n" || caractere === "\r") {
      // CRLF conta como uma única quebra de registro.
      if (caractere === "\r" && proximo === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
      aspasFechadas = false;
    } else if (aspasFechadas && !/\s/.test(caractere)) {
      throw new Error(
        `CSV inválido: conteúdo inesperado após o fechamento de aspas na posição ${i + 1}.`
      );
    } else if (!aspasFechadas) {
      campo += caractere;
    }
  }

  if (dentroDeAspas) {
    throw new Error("CSV inválido: existe um campo com aspas não fechadas.");
  }

  // Inclui a última linha mesmo quando o arquivo não termina com quebra de
  // linha e preserva a última coluna vazia quando há delimitador final.
  if (campo.length > 0 || linha.length > 0 || conteudo.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }

  return linhas;
}

function encontrarLinhaCabecalho(linhas: string[][]) {
  return linhas.findIndex(
    (linha) =>
      limpar(linha[0]).toLowerCase() === "nome" &&
      linha.some((campo) => limpar(campo).toLowerCase() === "cpf")
  );
}

function montarFiltros(linhas: string[][]) {
  const filtros: Record<string, string> = {};

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];

    if (linha.length >= 2) {
      const chave = limpar(linha[0]);
      const valor = limpar(linha.slice(1).join(";"));

      if (
        chave &&
        [
          "Equipe responsável (Nome/INE)",
          "Microárea(s)",
          "Lista temática",
          "Grupo de condições prioritários",
          "Buscar problemas/condições",
          "CIAP2 e CID10",
          "Sexo",
          "Identidade de gênero",
          "Faixa etária",
          "Raça/cor",
          "Período do último atendimento",
        ].includes(chave)
      ) {
        filtros[chave] = valor;
      }
    }
  }

  return filtros;
}

function extrairGeradoEm(linhas: string[][]) {
  const indice = linhas.findIndex((linha) =>
    limpar(linha[0]).toLowerCase().startsWith("gerado em")
  );

  if (indice < 0) return "";

  return limpar(linhas[indice].slice(1).join(" "));
}

function extrairPor(linhas: string[][]) {
  const indice = linhas.findIndex((linha) =>
    linha.some((campo) => limpar(campo).toLowerCase() === "por")
  );

  if (indice < 0) return "";

  const linha = linhas[indice];
  const posicao = linha.findIndex(
    (campo) => limpar(campo).toLowerCase() === "por"
  );

  return posicao >= 0 ? limpar(linha.slice(posicao + 1).join(" ")) : "";
}

/**
 * Parser específico dos CSVs exportados pelo e-SUS APS/PEC.
 *
 * Os relatórios possuem um cabeçalho de filtros antes da tabela.
 * Os arquivos analisados usam ';' como separador e podem vir em
 * Windows-1252/Latin-1. A rota da API faz a decodificação antes
 * de chamar esta função.
 */
export function analisarCSVPEC(conteudo: string): ResultadoPEC {
  if (!conteudo.trim()) {
    throw new Error("O arquivo CSV está vazio.");
  }

  const linhas = parsearCSV(conteudo.replace(/^\uFEFF/, ""));

  const indiceCabecalho = encontrarLinhaCabecalho(linhas);

  if (indiceCabecalho < 0) {
    throw new Error(
      "Não foi possível localizar a tabela de pacientes no CSV do e-SUS PEC."
    );
  }

  const cabecalho = linhas[indiceCabecalho].map(normalizarCabecalho);

  if (!cabecalho.includes("Nome")) {
    throw new Error("O CSV não possui a coluna Nome.");
  }

  const linhasDados = linhas
    .slice(indiceCabecalho + 1)
    .filter((linha) => linha.some((valor) => limpar(valor)));

  const registros: LinhaPEC[] = [];

  for (const linha of linhasDados) {
    const registro: LinhaPEC = {};

    for (let i = 0; i < cabecalho.length; i++) {
      const campo = cabecalho[i];

      // Alguns relatórios terminam com uma coluna vazia.
      if (!campo) continue;

      registro[campo] = limpar(linha[i]);
    }

    if (registro.Nome) {
      registros.push(registro);
    }
  }

  const filtros = montarFiltros(linhas);

  return {
    filtros,
    cabecalho,
    linhas: registros,
    listaTematica: filtros["Lista temática"] || "Geral",
    equipeResponsavel: filtros["Equipe responsável (Nome/INE)"] || "",
    microareas: filtros["Microárea(s)"] || "",
    grupoCondicoes: filtros["Grupo de condições prioritários"] || "",
    filtroProblemas: filtros["Buscar problemas/condições"] || "",
    periodoAtendimento: filtros["Período do último atendimento"] || "",
    geradoEm: extrairGeradoEm(linhas),
    por: extrairPor(linhas),
  };
}

export function normalizarDocumento(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function identificarPaciente(registro: LinhaPEC) {
  const cpf = limpar(registro.CPF).replace(/\D/g, "");
  if (cpf) {
    return `cpf_${cpf}`;
  }

  const cns = limpar(registro.CNS).replace(/\D/g, "");
  if (cns) {
    return `cns_${cns}`;
  }

  const nome = normalizarDocumento(registro.Nome || "");
  const nascimento = limpar(registro["Data de nascimento"] || "");

  if (!nome) {
    throw new Error("Registro sem nome do paciente.");
  }

  return `nome_${createHash("sha256")
    .update(`${nome}|${nascimento}`)
    .digest("hex")
    .slice(0, 32)}`;
}

export function separarDadosBase(registro: LinhaPEC) {
  const base: LinhaPEC = {};
  const especificos: LinhaPEC = {};

  for (const [campo, valor] of Object.entries(registro)) {
    if (CAMPOS_BASE.has(campo)) {
      base[campo] = valor;
    } else {
      especificos[campo] = valor;
    }
  }

  return { base, especificos };
}

export function ehFonteC5HipertensaoAtiva(
  listaTematica: string,
  grupoCondicoes: string,
  filtroProblemas: string
) {
  const lista = normalizarDocumento(listaTematica);
  const grupo = normalizarDocumento(grupoCondicoes);
  const filtro = normalizarDocumento(filtroProblemas);

  return (
    lista.includes("hipertens") &&
    grupo.includes("hipertens") &&
    filtro.includes("somente problemas ativos")
  );
}

export function classificarOrigemTematica(listaTematica: string) {
  const lista = normalizarDocumento(listaTematica);

  if (lista.includes("diabetes")) return "C4";
  if (lista.includes("hipertens")) return "C5";
  if (lista.includes("gestacao") || lista.includes("puerperio")) return "C3";
  if (lista.includes("idos")) return "C6";
  if (lista.includes("mulher")) return "C7";
  if (lista.includes("infantil") || lista.includes("crianca")) return "C2";

  return null;
}
