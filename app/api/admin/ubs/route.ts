import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { buscarCacheDashboard } from "@/lib/indicadores/cache-dashboard";

export const runtime = "nodejs";

function normalizarTexto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}


export async function GET(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Sessão não autenticada." },
        { status: 401 },
      );
    }

    const token = authorization.slice("Bearer ".length).trim();
    const decoded = await adminAuth.verifyIdToken(token);
    const usuarioSnap = await adminDb.collection("usuarios").doc(decoded.uid).get();

    if (!usuarioSnap.exists) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Usuário não encontrado." },
        { status: 403 },
      );
    }

    const usuario = usuarioSnap.data();
    const municipio = normalizarTexto(usuario?.municipio);
    const uf = normalizarTexto(usuario?.uf).toUpperCase();

    if (
      usuario?.perfil !== "administrador_municipal" ||
      usuario?.ativo !== true ||
      !municipio ||
      !/^[A-Z]{2}$/.test(uf)
    ) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Acesso administrativo não autorizado." },
        { status: 403 },
      );
    }

    // Restringe a leitura às UBS do município autorizado.
    // As unidades criadas pelo fluxo administrativo usam o nome exato do município do perfil.
    const snapshot = await adminDb
      .collection("ubs")
      .where("municipio", "==", municipio)
      .get();
    const normalizar = (valor: string) =>
      valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");

    const unidadesBase = snapshot.docs
      .map((doc) => {
        const dados = doc.data();
        return {
          id: doc.id,
          nome: normalizarTexto(dados.nome),
          municipio: normalizarTexto(dados.municipio),
          uf: normalizarTexto(dados.uf).toUpperCase(),
          ativo: dados.ativo === true,
          totalPacientesRegistrado: Number(dados.totalPacientes ?? 0),
        };
      })
      .filter((item) =>
        item.ativo &&
        normalizar(item.municipio) === normalizar(municipio) &&
        item.uf === uf
      )
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    // Reutiliza o snapshot consolidado que o Dashboard já usa.
    // Não recalcula indicadores, não lê pacientes nem históricos PEC.
    const ubs = await Promise.all(unidadesBase.map(async (unidade) => {
      const cache = await buscarCacheDashboard(unidade.id);
      const chavesIndicadores = cache
        ? Object.keys(cache.dados).filter((chave) => /^(c[1-7]|bucal|saudebucal)$/i.test(chave))
        : [];
      const possuiDados = Boolean(cache && (chavesIndicadores.length > 0 || cache.competencia));
      const totalPacientes = unidade.totalPacientesRegistrado;
      const statusDados = possuiDados
        ? "com_dados"
        : totalPacientes > 0
          ? "snapshot_pendente"
          : "aguardando_importacao";
      const atualizadoEm = cache?.atualizadoEm && typeof cache.atualizadoEm === "object" && "toDate" in cache.atualizadoEm && typeof cache.atualizadoEm.toDate === "function"
        ? cache.atualizadoEm.toDate().toISOString()
        : null;

      // Retorna apenas valores agregados já presentes no snapshot. Não consulta pacientes,
      // históricos PEC nem executa novamente os cálculos dos indicadores.
      const nomesIndicadores: Record<string, string> = {
        c1: "Mais Acesso",
        c2: "Desenvolvimento Infantil",
        c3: "Gestação e Puerpério",
        c4: "Diabetes",
        c5: "Hipertensão",
        c6: "Pessoa Idosa",
        c7: "Saúde da Mulher",
        bucal: "Saúde Bucal",
        saudebucal: "Saúde Bucal",
      };
      const resumoIndicadores = Object.entries(cache?.dados ?? {})
        .filter(([chave, valor]) => /^(c[1-7]|bucal|saudebucal)$/i.test(chave) && valor && typeof valor === "object" && !Array.isArray(valor))
        .map(([chave, valor]) => {
          const item = valor as Record<string, unknown>;
          const codigo = chave.toLowerCase() === "saudebucal" ? "BUCAL" : chave.toUpperCase();
          const percentual = codigo === "C1" && typeof item.percentualProgramado === "number" ? item.percentualProgramado : null;
          const pontuacao = typeof item.pontuacao === "number" ? item.pontuacao : null;
          const resultado = percentual ?? pontuacao;
          return {
            codigo,
            nome: nomesIndicadores[chave.toLowerCase()] ?? codigo,
            competencia: typeof item.competencia === "string" ? item.competencia : cache?.competencia ?? null,
            resultado,
            tipoResultado: percentual !== null ? "percentual" : pontuacao !== null ? "pontuacao" : "sem_valor",
            classificacao: typeof item.classificacao === "string" && item.classificacao.trim() ? item.classificacao : null,
          };
        })
        .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR"));

      return {
        id: unidade.id,
        nome: unidade.nome,
        municipio: unidade.municipio,
        uf: unidade.uf,
        ativo: unidade.ativo,
        possuiDados,
        statusDados,
        pacientes: possuiDados ? totalPacientes : statusDados === "snapshot_pendente" ? totalPacientes : null,
        indicadoresDisponiveis: chavesIndicadores.length,
        atualizadoEm,
        competencia: cache?.competencia ?? null,
        resumoIndicadores,
      };
    }));

    return NextResponse.json({ sucesso: true, ubs });
  } catch (error) {
    console.error("Erro ao listar UBS do município:", error);
    return NextResponse.json(
      { sucesso: false, mensagem: "Não foi possível carregar as UBS." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Sessão não autenticada." },
        { status: 401 },
      );
    }

    const token = authorization.slice("Bearer ".length).trim();
    const decoded = await adminAuth.verifyIdToken(token);

    const administradorSnap = await adminDb
      .collection("usuarios")
      .doc(decoded.uid)
      .get();

    if (!administradorSnap.exists) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Usuário não encontrado." },
        { status: 403 },
      );
    }

    const administrador = administradorSnap.data();
    const municipioAutorizado = normalizarTexto(administrador?.municipio);
    const ufAutorizada = normalizarTexto(administrador?.uf).toUpperCase();

    if (
      administrador?.perfil !== "administrador_municipal" ||
      administrador?.ativo !== true ||
      !municipioAutorizado ||
      !/^[A-Z]{2}$/.test(ufAutorizada)
    ) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem:
            "Somente um administrador municipal ativo e com município válido pode cadastrar UBS.",
        },
        { status: 403 },
      );
    }

    const corpo = await request.json().catch(() => null);
    const nome = normalizarTexto(corpo?.nome);

    if (!nome) {
      return NextResponse.json(
        { sucesso: false, mensagem: "O nome da UBS é obrigatório." },
        { status: 400 },
      );
    }

    if (nome.length > 160) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem: "O nome da UBS deve ter no máximo 160 caracteres.",
        },
        { status: 400 },
      );
    }

    // Município e UF vêm do cadastro autorizado no servidor.
    // O cliente não pode escolher outra cidade na requisição.
    const ubsRef = adminDb.collection("ubs").doc();
    const dadosUbs = {
      nome,
      municipio: municipioAutorizado,
      uf: ufAutorizada,
      ativo: true,
      criadoEm: FieldValue.serverTimestamp(),
      criadoPor: decoded.uid,
      origemCadastro: "administrador_municipal",
    };

    await ubsRef.create(dadosUbs);

    return NextResponse.json(
      {
        sucesso: true,
        mensagem: "UBS cadastrada com sucesso.",
        ubs: {
          id: ubsRef.id,
          nome,
          municipio: municipioAutorizado,
          uf: ufAutorizada,
          ativo: true,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Erro ao cadastrar UBS:", error);

    return NextResponse.json(
      {
        sucesso: false,
        mensagem: "Não foi possível cadastrar a UBS. Tente novamente.",
      },
      { status: 500 },
    );
  }
}
