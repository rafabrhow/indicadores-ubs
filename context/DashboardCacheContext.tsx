"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useAuth } from "@/context/AuthContext";

/**
 * Os dados dos indicadores são mantidos com a mesma estrutura
 * recebida da API do Dashboard.
 *
 * Usamos Record<string, any> aqui de propósito: o page.tsx já
 * trabalha com os campos específicos de C1, C2, C3, C4, C5,
 * C6, C7 e Saúde Bucal. Assim, o contexto não altera a tipagem
 * que já funciona no Dashboard.
 */
type DashboardDados = Record<string, any>;

type DashboardSnapshot = {
  dados: DashboardDados;
  acsAtivos: number;
  pacientes: number;
  versaoDados: number | null;
  competencia: string | null;
  atualizadoEm: string | null;
};

type CacheEntry = {
  dados: unknown;
  carregadoEm: number;
};

type DashboardCacheContextValue = {
  dados: DashboardDados | null;
  acsAtivos: number;
  pacientes: number;
  pacientesSituacao: any[];
  versaoDados: number | null;
  competencia: string | null;
  atualizadoEm: string | null;
  carregando: boolean;
  possuiDados: boolean;
  carregarDashboard: () => Promise<void>;
  limparCacheDashboard: () => void;

  /**
   * Cache global da aplicação.
   *
   * Cada página pode usar uma chave própria, por exemplo:
   * "c2", "c5", "pacientes", "equipe", "relatorios".
   *
   * Enquanto a aplicação permanecer aberta, o valor fica em memória
   * e não é buscado novamente até ser invalidado.
   */
  getCache: <T>(chave: string) => T | null;
  setCache: <T>(chave: string, dados: T) => void;
  carregarCache: <T>(
    chave: string,
    carregador: () => Promise<T>,
  ) => Promise<T>;
  limparCache: (chave?: string) => void;
};

const DashboardCacheContext =
  createContext<DashboardCacheContextValue | null>(null);

export function DashboardCacheProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { usuario, carregando: carregandoAuth } = useAuth();

  const [dados, setDados] = useState<DashboardDados | null>(null);
  const [acsAtivos, setAcsAtivos] = useState(0);
  const [pacientes, setPacientes] = useState(0);
  const [pacientesSituacao, setPacientesSituacao] = useState<any[]>([]);
  const [versaoDados, setVersaoDados] = useState<number | null>(null);
  const [competencia, setCompetencia] = useState<string | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  /**
   * Cache mantido somente enquanto a aplicação estiver aberta.
   *
   * Ao dar F5/recarregar a página, este Map é criado novamente
   * e o cache em memória é perdido.
   */
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());

  /**
   * Evita duas cargas simultâneas do Dashboard.
   */
  const carregandoDashboardRef = useRef(false);

  /**
   * Compartilha uma mesma Promise quando duas partes da aplicação
   * solicitam a mesma chave ao mesmo tempo.
   */
  const carregamentosRef = useRef<Map<string, Promise<unknown>>>(
    new Map(),
  );

  /**
   * Limpa especificamente os dados principais do Dashboard.
   */
  const limparCacheDashboard = useCallback(() => {
    cacheRef.current.delete("dashboard");
    cacheRef.current.delete("dashboard:situacao-pacientes");

    setDados(null);
    setAcsAtivos(0);
    setPacientes(0);
    setPacientesSituacao([]);
    setVersaoDados(null);
    setCompetencia(null);
    setAtualizadoEm(null);
  }, []);

  /**
   * Obtém um valor do cache global.
   */
  const getCache = useCallback(<T,>(chave: string): T | null => {
    const entrada = cacheRef.current.get(chave);

    if (!entrada) {
      return null;
    }

    return entrada.dados as T;
  }, []);

  /**
   * Grava um valor diretamente no cache global.
   */
  const setCache = useCallback(<T,>(chave: string, valor: T) => {
    cacheRef.current.set(chave, {
      dados: valor,
      carregadoEm: Date.now(),
    });
  }, []);

  /**
   * Busca um valor do cache.
   *
   * Se já existir, não executa o carregador novamente.
   *
   * Se ainda não existir, executa o carregador e guarda
   * o resultado em memória.
   */
  const carregarCache = useCallback(
    async <T,>(
      chave: string,
      carregador: () => Promise<T>,
    ): Promise<T> => {
      const existente = cacheRef.current.get(chave);

      if (existente) {
        return existente.dados as T;
      }

      const carregamentoEmAndamento =
        carregamentosRef.current.get(chave);

      if (carregamentoEmAndamento) {
        return carregamentoEmAndamento as Promise<T>;
      }

      const promessa = carregador()
        .then((resultado) => {
          cacheRef.current.set(chave, {
            dados: resultado,
            carregadoEm: Date.now(),
          });

          return resultado;
        })
        .finally(() => {
          carregamentosRef.current.delete(chave);
        });

      carregamentosRef.current.set(chave, promessa);

      return promessa;
    },
    [],
  );

  /**
   * Limpa uma chave específica ou todo o cache global.
   */
  const limparCache = useCallback((chave?: string) => {
    if (chave) {
      cacheRef.current.delete(chave);
      return;
    }

    cacheRef.current.clear();
  }, []);

  /**
   * Carrega o Dashboard.
   *
   * Primeiro verifica se o snapshot já está em memória.
   * Se estiver, restaura os estados sem consultar novamente a API.
   *
   * Caso contrário, busca uma única vez e grava no cache.
   */
  const carregarDashboard = useCallback(async () => {
    if (carregandoDashboardRef.current) {
      return;
    }

    if (carregandoAuth || usuario?.perfil !== "enfermeira") {
      return;
    }

    /**
     * Se o Dashboard já estiver em memória, apenas restaura os estados.
     */
    const existente = cacheRef.current.get("dashboard");

    if (existente) {
      const snapshot = existente.dados as DashboardSnapshot;

      setDados(snapshot.dados ?? {});
      setAcsAtivos(Number(snapshot.acsAtivos ?? 0));
      setPacientes(Number(snapshot.pacientes ?? 0));

      setVersaoDados(
        snapshot.versaoDados !== undefined
          ? Number(snapshot.versaoDados)
          : null,
      );

      setCompetencia(snapshot.competencia ?? null);
      setAtualizadoEm(snapshot.atualizadoEm ?? null);

      const situacaoExistente = cacheRef.current.get(
        "dashboard:situacao-pacientes",
      );

      if (situacaoExistente) {
        setPacientesSituacao(
          Array.isArray(situacaoExistente.dados)
            ? situacaoExistente.dados
            : [],
        );
      }

      return;
    }

    const usuarioFirebase = auth.currentUser;

    if (!usuarioFirebase) {
      return;
    }

    carregandoDashboardRef.current = true;
    setCarregando(true);

    try {
      const token = await usuarioFirebase.getIdToken();

      /**
       * Dashboard principal.
       */
      const resultado = await carregarCache<DashboardSnapshot>(
        "dashboard",
        async () => {
          const resposta = await fetch("/api/dashboard", {
            cache: "no-store",
            headers: {
              Authorization: `Bearer ${token}`,
              "Cache-Control": "no-cache",
            },
          });

          const dadosResposta = await resposta.json();

          if (
            resposta.status === 403 &&
            dadosResposta?.codigo === "ASSINATURA_PROFISSIONAL_INATIVA"
          ) {
            cacheRef.current.clear();
            setDados(null);
            setAcsAtivos(0);
            setPacientes(0);
            setPacientesSituacao([]);
            setVersaoDados(null);
            setCompetencia(null);
            setAtualizadoEm(null);
            await signOut(auth);
            if (typeof window !== "undefined") {
              window.location.replace("/login?motivo=assinatura-pendente");
            }
            throw new Error(
              dadosResposta.mensagem ||
                "Acesso suspenso por pagamento pendente. Regularize sua assinatura para voltar a acessar o sistema.",
            );
          }

          if (!resposta.ok || !dadosResposta.sucesso) {
            throw new Error(
              dadosResposta.mensagem ||
                "Não foi possível carregar o Dashboard.",
            );
          }

          return {
            dados:
              dadosResposta.dados &&
              typeof dadosResposta.dados === "object" &&
              !Array.isArray(dadosResposta.dados)
                ? (dadosResposta.dados as DashboardDados)
                : {},

            acsAtivos: Number(dadosResposta.acsAtivos ?? 0),

            pacientes: Number(dadosResposta.pacientes ?? 0),

            versaoDados:
              dadosResposta.versaoDados !== undefined
                ? Number(dadosResposta.versaoDados)
                : null,

            competencia:
              typeof dadosResposta.competencia === "string"
                ? dadosResposta.competencia
                : null,

            atualizadoEm:
              typeof dadosResposta.atualizadoEm === "string"
                ? dadosResposta.atualizadoEm
                : null,
          };
        },
      );

      setDados(resultado.dados);
      setAcsAtivos(resultado.acsAtivos);
      setPacientes(resultado.pacientes);
      setVersaoDados(resultado.versaoDados);
      setCompetencia(resultado.competencia);
      setAtualizadoEm(resultado.atualizadoEm);

      /**
       * Situação detalhada dos pacientes.
       *
       * Também possui uma chave própria no cache.
       */
      const situacao = await carregarCache<any[]>(
        "dashboard:situacao-pacientes",
        async () => {
          const resposta = await fetch(
            "/api/dashboard/situacao-pacientes",
            {
              cache: "no-store",
              headers: {
                Authorization: `Bearer ${token}`,
                "Cache-Control": "no-cache",
              },
            },
          );

          const resultadoSituacao = await resposta.json();

          if (
            resposta.ok &&
            resultadoSituacao.sucesso &&
            Array.isArray(resultadoSituacao.pacientes)
          ) {
            return resultadoSituacao.pacientes;
          }

          return [];
        },
      );

      setPacientesSituacao(
        Array.isArray(situacao) ? situacao : [],
      );
    } catch (error) {
      console.error(
        "Erro ao carregar snapshot do Dashboard:",
        error,
      );
    } finally {
      carregandoDashboardRef.current = false;
      setCarregando(false);
    }
  }, [carregandoAuth, usuario, carregarCache]);

  /**
   * Nova importação PEC:
   *
   * A importação dispara "dashboard:atualizado".
   * Nesse momento o cache em memória é invalidado e o Dashboard
   * é carregado novamente com os dados atualizados.
   */
  useEffect(() => {
    const handleDashboardAtualizado = () => {
      limparCache();

      setDados(null);
      setAcsAtivos(0);
      setPacientes(0);
      setPacientesSituacao([]);
      setVersaoDados(null);
      setCompetencia(null);
      setAtualizadoEm(null);

      void carregarDashboard();
    };

    window.addEventListener(
      "dashboard:atualizado",
      handleDashboardAtualizado,
    );

    return () => {
      window.removeEventListener(
        "dashboard:atualizado",
        handleDashboardAtualizado,
      );
    };
  }, [carregarDashboard, limparCache]);

  /**
   * Ao entrar na aplicação como enfermeira, carrega o Dashboard.
   *
   * Se já estiver no cache, carregarDashboard() apenas restaura
   * os dados em memória.
   */
  useEffect(() => {
    if (!usuario) {
      limparCache();
      return;
    }

    if (usuario.perfil !== "enfermeira") {
      limparCache();
      return;
    }

    void carregarDashboard();
  }, [usuario, limparCache, carregarDashboard]);

  const valor: DashboardCacheContextValue = {
    dados,
    acsAtivos,
    pacientes,
    pacientesSituacao,
    versaoDados,
    competencia,
    atualizadoEm,
    carregando,
    possuiDados: dados !== null,
    carregarDashboard,
    limparCacheDashboard,
    getCache,
    setCache,
    carregarCache,
    limparCache,
  };

  return (
    <DashboardCacheContext.Provider value={valor}>
      {children}
    </DashboardCacheContext.Provider>
  );
}

export function useDashboardCache() {
  const contexto = useContext(DashboardCacheContext);

  if (!contexto) {
    throw new Error(
      "useDashboardCache deve ser usado dentro de DashboardCacheProvider.",
    );
  }

  return contexto;
}