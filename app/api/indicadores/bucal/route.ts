import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { avaliarBucal } from "@/lib/indicadores/bucal";

export const runtime = "nodejs";

/**
 * Converte diferentes formatos de data do Firestore
 * para milissegundos, permitindo ordenar as importações.
 */
function tempo(valor: unknown): number {
  if (typeof valor === "number") return valor;

  if (valor instanceof Date) {
    return valor.getTime();
  }

  if (valor && typeof valor === "object") {
    const v = valor as {
      toMillis?: unknown;
      seconds?: unknown;
      _seconds?: unknown;
    };

    if (typeof v.toMillis === "function") {
      return (v.toMillis as () => number)();
    }

    if (typeof v.seconds === "number") {
      return v.seconds * 1000;
    }

    if (typeof v._seconds === "number") {
      return v._seconds * 1000;
    }
  }

  return 0;
}

/**
 * Estrutura mínima esperada de uma importação PEC.
 * A tipagem evita que o TypeScript infira somente { id: string }.
 */
type ImportacaoPEC = {
  id: string;
  listaTematica?: string;
  criadoEm?: unknown;
  arquivoNome?: string;
  geradoEm?: string;
  quantidadeRegistros?: number;
};

/**
 * GET /api/indicadores/bucal
 *
 * Carrega a última importação de Saúde Bucal da UBS
 * e calcula os indicadores B1 a B6.
 */
export async function GET(request: Request) {
  try {
    // ---------------------------------------------------------
    // 1. Validar o token enviado pelo navegador
    // ---------------------------------------------------------
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem: "Sessão não autenticada.",
        },
        { status: 401 }
      );
    }

    const token = authorization.slice("Bearer ".length).trim();

    const decoded = await adminAuth.verifyIdToken(token);

    // ---------------------------------------------------------
    // 2. Buscar usuário autenticado
    // ---------------------------------------------------------
    const usuarioSnap = await adminDb
      .collection("usuarios")
      .doc(decoded.uid)
      .get();

    const usuario = usuarioSnap.data();

    if (
      !usuarioSnap.exists ||
      usuario?.perfil !== "enfermeira" ||
      usuario?.ativo !== true ||
      typeof usuario?.ubsId !== "string"
    ) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem: "Acesso não autorizado.",
        },
        { status: 403 }
      );
    }

    // ---------------------------------------------------------
    // 3. Referência da UBS do usuário
    // ---------------------------------------------------------
    const ubsRef = adminDb.collection("ubs").doc(usuario.ubsId);

    // ---------------------------------------------------------
    // 4. Buscar todas as importações PEC da UBS
    // ---------------------------------------------------------
    const importsSnapshot = await ubsRef
      .collection("importacoesPEC")
      .get();

    // ---------------------------------------------------------
    // 5. Transformar os documentos em uma estrutura tipada
    // ---------------------------------------------------------
    const imports: ImportacaoPEC[] = importsSnapshot.docs.map(
      (doc): ImportacaoPEC => {
        const dados = doc.data();

        return {
          id: doc.id,
          listaTematica:
            typeof dados.listaTematica === "string"
              ? dados.listaTematica
              : undefined,
          criadoEm: dados.criadoEm,
          arquivoNome:
            typeof dados.arquivoNome === "string"
              ? dados.arquivoNome
              : undefined,
          geradoEm:
            typeof dados.geradoEm === "string"
              ? dados.geradoEm
              : undefined,
          quantidadeRegistros:
            typeof dados.quantidadeRegistros === "number"
              ? dados.quantidadeRegistros
              : undefined,
        };
      }
    );

    // ---------------------------------------------------------
    // 6. Encontrar somente importações de Saúde Bucal
    // ---------------------------------------------------------
    const candidatas = imports
      .filter((item) =>
        /sa[uú]de\s+bucal/i.test(
          String(item.listaTematica ?? "")
        )
      )
      .sort(
        (a, b) =>
          tempo(b.criadoEm) - tempo(a.criadoEm)
      );

    // ---------------------------------------------------------
    // 7. Utilizar a importação mais recente
    // ---------------------------------------------------------
    const importacao = candidatas[0];

    if (!importacao) {
      return NextResponse.json({
        sucesso: true,
        possuiDados: false,
        mensagem:
          "Ainda não existe uma importação de Saúde Bucal.",
      });
    }

    // ---------------------------------------------------------
    // 8. Buscar os registros históricos da importação
    // ---------------------------------------------------------
    const registrosSnapshot = await ubsRef
      .collection("importacoesPEC")
      .doc(importacao.id)
      .collection("registros")
      .get();

    // ---------------------------------------------------------
    // 9. Preparar os registros para o motor dos indicadores
    // ---------------------------------------------------------
    const registros: Record<string, unknown>[] =
      registrosSnapshot.docs.map(
        (doc): Record<string, unknown> => ({
          id: doc.id,
          ...doc.data(),
        })
      );

    // ---------------------------------------------------------
    // 10. Calcular B1 a B6
    // ---------------------------------------------------------
    const resultado = avaliarBucal(registros);

    // ---------------------------------------------------------
    // 11. Retornar resultado para a página
    // ---------------------------------------------------------
    return NextResponse.json({
      ...resultado,

      possuiDados: true,

      importacao: {
        id: importacao.id,
        arquivoNome:
          importacao.arquivoNome ??
          "Relatório de Saúde Bucal",
        listaTematica:
          importacao.listaTematica ?? "",
        geradoEm:
          importacao.geradoEm ?? "",
        quantidadeRegistros:
          importacao.quantidadeRegistros ??
          registrosSnapshot.size,
      },
    });
  } catch (error) {
    console.error(
      "Erro ao calcular Saúde Bucal:",
      error
    );

    return NextResponse.json(
      {
        sucesso: false,
        mensagem:
          "Não foi possível carregar Saúde Bucal.",
      },
      { status: 500 }
    );
  }
}