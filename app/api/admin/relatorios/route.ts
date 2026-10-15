import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const INDICADORES = [
  { codigo: "C1", nome: "Mais Acesso" },
  { codigo: "C2", nome: "Desenvolvimento Infantil" },
  { codigo: "C3", nome: "Gestantes e Puerpério" },
  { codigo: "C4", nome: "Diabetes" },
  { codigo: "C5", nome: "Hipertensão" },
  { codigo: "C6", nome: "Pessoa Idosa" },
  { codigo: "C7", nome: "Saúde da Mulher" },
  { codigo: "BUCAL", nome: "Saúde Bucal" },
] as const;

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function normalizar(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

function numero(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

function objeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? valor as Record<string, unknown>
    : {};
}

function extrairPraticas(valor: unknown) {
  const praticas = objeto(valor);
  return Object.entries(praticas).slice(0, 8).flatMap(([nome, dado]) => {
    const item = objeto(dado);
    const percentual = numero(item.percentual);
    if (percentual === null) return [];
    return [{
      nome: nome.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[._-]+/g, " ").trim(),
      percentual: Math.max(0, Math.min(100, percentual)),
      atingidos: numero(item.atingidos),
    }];
  });
}

function rotuloValor(codigo: string, valor: number | null, unidade: string, pontuacaoParcial: number | null) {
  if (codigo === "C7" && valor === null && pontuacaoParcial !== null) {
    return `${pontuacaoParcial.toLocaleString("pt-BR")} pontos parciais`;
  }
  if (valor === null) return "Sem pontuação consolidada";
  return `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${unidade}`;
}

export async function GET(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json({ sucesso: false, mensagem: "Sessão não autenticada." }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(authorization.slice("Bearer ".length).trim());
    const usuarioSnap = await adminDb.collection("usuarios").doc(decoded.uid).get();
    if (!usuarioSnap.exists) {
      return NextResponse.json({ sucesso: false, mensagem: "Usuário não encontrado." }, { status: 403 });
    }

    const usuario = usuarioSnap.data();
    const municipio = texto(usuario?.municipio);
    const uf = texto(usuario?.uf).toUpperCase();
    if (usuario?.perfil !== "administrador_municipal" || usuario?.ativo !== true || !municipio || !/^[A-Z]{2}$/.test(uf)) {
      return NextResponse.json({ sucesso: false, mensagem: "Acesso administrativo não autorizado." }, { status: 403 });
    }

    const url = new URL(request.url);
    const ubsId = texto(url.searchParams.get("ubsId"));
    const competenciaSolicitada = texto(url.searchParams.get("competencia"));
    if (!ubsId) {
      return NextResponse.json({ sucesso: false, mensagem: "Selecione uma UBS." }, { status: 400 });
    }
    if (competenciaSolicitada && !/^\d{4}-(0[1-9]|1[0-2])$/.test(competenciaSolicitada)) {
      return NextResponse.json({ sucesso: false, mensagem: "Competência inválida." }, { status: 400 });
    }

    const ubsSnap = await adminDb.collection("ubs").doc(ubsId).get();
    if (!ubsSnap.exists) {
      return NextResponse.json({ sucesso: false, mensagem: "UBS não encontrada." }, { status: 404 });
    }
    const ubs = ubsSnap.data();
    if (
      ubs?.ativo !== true ||
      normalizar(texto(ubs?.municipio)) !== normalizar(municipio) ||
      texto(ubs?.uf).toUpperCase() !== uf
    ) {
      return NextResponse.json({ sucesso: false, mensagem: "A UBS selecionada não pertence ao município autorizado." }, { status: 403 });
    }

    const resultadosRef = adminDb.collection("ubs").doc(ubsId).collection("resultadosIndicadores");
    // Consulta somente metadados dos snapshots para montar o seletor de competências.
    const metadadosSnap = await resultadosRef.select("codigo", "competencia").get();
    const competenciasDisponiveis = [...new Set(
      metadadosSnap.docs
        .map((doc) => texto(doc.data().competencia))
        .filter((item) => /^\d{4}-(0[1-9]|1[0-2])$/.test(item)),
    )].sort((a, b) => b.localeCompare(a));

    const competencia = competenciaSolicitada || competenciasDisponiveis[0] || null;
    const resultadosPorCodigo = new Map<string, Record<string, unknown>>();

    if (competencia) {
      // Projeção explícita: não lê nem devolve os arrays de pacientes dos snapshots.
      const resultadosSnap = await resultadosRef
        .where("competencia", "==", competencia)
        .select(
          "codigo",
          "competencia",
          "dados.pontuacao",
          "dados.classificacao",
          "dados.percentualProgramado",
          "dados.pontuacaoParcial",
          "dados.pontosDisponiveis",
          "dados.completo",
          "dados.totalElegiveis",
          "dados.totalRegistros",
          "dados.totalDemandasC1",
          "dados.atendimentosProgramados",
          "dados.atendimentosEspontaneos",
          "dados.praticas",
        )
        .get();

      for (const doc of resultadosSnap.docs) {
        const dado = doc.data();
        const codigo = texto(dado.codigo).toUpperCase();
        if (INDICADORES.some((item) => item.codigo === codigo)) {
          resultadosPorCodigo.set(codigo, objeto(dado.dados));
        }
      }
    }

    const indicadores = INDICADORES.map((def) => {
      const dados = resultadosPorCodigo.get(def.codigo);
      if (!dados) {
        return {
          ...def,
          possuiResultado: false,
          valor: null,
          unidade: def.codigo === "C1" ? "%" : " pontos",
          valorRotulo: "Sem resultado",
          classificacao: null,
          totalRegistros: null,
          totalElegiveis: null,
          praticas: [],
          tipoResultado: "sem-dados",
        };
      }

      const percentualC1 = numero(dados.percentualProgramado);
      const pontuacao = numero(dados.pontuacao);
      const parcial = numero(dados.pontuacaoParcial);
      const valor = def.codigo === "C1" ? percentualC1 : pontuacao;
      const praticas = extrairPraticas(dados.praticas);
      const totalRegistros = numero(dados.totalRegistros);
      const totalElegiveis = numero(dados.totalElegiveis);
      const possuiResultado = valor !== null || parcial !== null || praticas.length > 0 || totalRegistros !== null;

      let tipoResultado: "pontuacao" | "praticas" | "sem-pontuacao" | "sem-dados" = "sem-pontuacao";
      if (valor !== null) tipoResultado = "pontuacao";
      else if (praticas.length > 0) tipoResultado = "praticas";

      return {
        ...def,
        possuiResultado,
        valor,
        unidade: def.codigo === "C1" ? "%" : " pontos",
        valorRotulo: rotuloValor(def.codigo, valor, def.codigo === "C1" ? "%" : " pontos", parcial),
        classificacao: texto(dados.classificacao) || null,
        totalRegistros,
        totalElegiveis,
        praticas,
        tipoResultado,
      };
    });

    const comResultado = indicadores.filter((item) => item.possuiResultado).length;
    return NextResponse.json({
      sucesso: true,
      ubs: { id: ubsSnap.id, nome: texto(ubs?.nome), municipio, uf },
      competencia,
      competenciasDisponiveis,
      indicadores,
      resumo: {
        totalIndicadores: INDICADORES.length,
        comResultado,
        semResultado: INDICADORES.length - comResultado,
        comClassificacao: indicadores.filter((item) => Boolean(item.classificacao)).length,
      },
    });
  } catch (error) {
    console.error("Erro ao consultar relatórios municipais:", error);
    return NextResponse.json({ sucesso: false, mensagem: "Não foi possível carregar os relatórios municipais." }, { status: 500 });
  }
}
