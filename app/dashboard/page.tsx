"use client";

import {
  Activity,
  Baby,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Droplets,
  FileBarChart,
  Heart,
  HeartPulse,
  Smile,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  UserRound,
  UsersRound,
  Venus,
} from "lucide-react";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import ModalCadastrarACS from "@/components/acs/ModalCadastrarACS";
import TourBrasil360 from "@/components/tour/TourBrasil360";

/**
 * Cards dos indicadores Brasil 360.
 *
 * Os valores serão preenchidos posteriormente com os dados
 * reais do e-SUS PEC e as regras oficiais dos indicadores.
 */
const indicadores = [
  {
    codigo: "C2",
    titulo: "Desenvolvimento Infantil",
    descricao: "Acompanhamento infantil",
    cor: "#3B82F6",
    icone: Baby,
  },
  {
    codigo: "C3",
    titulo: "Gestação e Puerpério",
    descricao: "Gestantes e puérperas",
    cor: "#EC4899",
    icone: Heart,
  },
  {
    codigo: "C4",
    titulo: "Diabetes",
    descricao: "Cuidado da pessoa com diabetes",
    cor: "#F59E0B",
    icone: Droplets,
  },
  {
    codigo: "C5",
    titulo: "Hipertensão",
    descricao: "Cuidado da pessoa com hipertensão",
    cor: "#EF4444",
    icone: Activity,
  },
  {
    codigo: "C6",
    titulo: "Pessoa Idosa",
    descricao: "Cuidado da pessoa idosa",
    cor: "#10B981",
    icone: UsersRound,
  },
  {
    codigo: "C7",
    titulo: "Câncer da Mulher",
    descricao: "Prevenção do câncer",
    cor: "#8B5CF6",
    icone: Venus,
  },
];

type ResumoC2Dashboard = {
  pontuacao: number;
  classificacao: "Ótimo" | "Bom" | "Suficiente" | "Regular";
  totalElegiveis: number;
};

type ResumoC3Dashboard = {
  pontuacao: number;
  classificacao: "Ótimo" | "Bom" | "Suficiente" | "Regular";
  totalElegiveis: number;
};

type ResumoC4Dashboard = {
  pontuacao: number;
  classificacao: "Ótimo" | "Bom" | "Suficiente" | "Regular";
  totalElegiveis: number;
};

type ResumoC5Dashboard = {
  pontuacao: number;
  classificacao: "Ótimo" | "Bom" | "Suficiente" | "Regular";
  totalElegiveis: number;
  praticas: {
    A: { atingidos: number; percentual: number };
    B: { atingidos: number; percentual: number };
    C: { atingidos: number; percentual: number };
    D: { atingidos: number; percentual: number };
  };
};

type ResumoC6Dashboard = {
  pontuacao: number;
  classificacao: "Ótimo" | "Bom" | "Suficiente" | "Regular";
  totalElegiveis: number;
};

type ResumoC7Dashboard = {
  pontuacao: number | null;
  pontuacaoParcial: number;
  classificacao: "Ótimo" | "Bom" | "Suficiente" | "Regular" | "Indisponível";
  totalElegiveis: number;
  completo: boolean;
};

type ResumoBucalDashboard = {
  b1Percentual: number | null;
  totalRegistros: number;
};

type ResumoC1Dashboard = {
  possuiDados: boolean;
  percentualProgramado: number | null;
  classificacao: "Ótimo" | "Bom" | "Suficiente" | "Regular" | "Indisponível";
  atendimentosProgramados: number;
  atendimentosEspontaneos: number;
  totalAtendimentos: number;
  competencias: string[];
};

type ResumoDashboard = {
  acsAtivos: number;
  pacientes: number;
};

type ResumoSituacaoPacientes = {
  totalPacientes: number;
  semNenhumRegistro: number;
  comIndicadoresPendentes: number;
  comIndicadoresConcluidos: number;
  comRegistroSemIndicadorAplicavel: number;
  indicadoresConcluidosPercentual: number;
};

export default function DashboardPage() {
  const router = useRouter();

  const {
    usuario,
    ubs,
    carregando,
    logout,
  } = useAuth();

  const tourEtapas = [
    {
      alvo: "tour-dashboard",
      titulo: "Bem-vinda ao Brasil 360 👋",
      descricao:
        "Este é o seu Dashboard. Aqui você acompanha, em um só lugar, a situação da UBS, da equipe e dos indicadores.",
    },
    {
      alvo: "tour-resumo",
      titulo: "Resumo da UBS",
      descricao:
        "Estes cards mostram informações rápidas sobre ACS ativos, pacientes, progresso geral e acessos.",
    },
    {
      alvo: "tour-situacao",
      titulo: "Situação dos pacientes",
      descricao:
        "Aqui você acompanha quantos pacientes estão sem indicador aplicável, com pendências ou com os indicadores concluídos.",
    },
    {
      alvo: "tour-equipe",
      titulo: "ACS da equipe",
      descricao:
        "Nesta área você acompanha a equipe e pode acessar o cadastro dos ACS.",
    },
    {
      alvo: "tour-indicadores",
      titulo: "Indicadores Brasil 360",
      descricao:
        "Aqui ficam os indicadores C2 a C7 e Saúde Bucal. Toque em um card para abrir o detalhamento.",
    },
    {
      alvo: "tour-c1",
      titulo: "C1 — Mais acesso",
      descricao:
        "Este card apresenta o indicador de acesso e permite abrir o detalhamento do C1.",
    },
    {
      alvo: "tour-menu",
      titulo: "Menu de navegação",
      descricao:
        "No tablet, o menu fica na parte inferior. Use-o para acessar Início, Equipe, Relatórios e Configurações.",
    },
  ];

  const [c2, setC2] = useState<ResumoC2Dashboard | null>(null);
  const [carregandoC2, setCarregandoC2] = useState(false);
  const [c3, setC3] = useState<ResumoC3Dashboard | null>(null);
  const [carregandoC3, setCarregandoC3] = useState(false);
  const [c4, setC4] = useState<ResumoC4Dashboard | null>(null);
  const [carregandoC4, setCarregandoC4] = useState(false);
  const [c5, setC5] = useState<ResumoC5Dashboard | null>(null);
  const [carregandoC5, setCarregandoC5] = useState(false);
  const [c6, setC6] = useState<ResumoC6Dashboard | null>(null);
  const [carregandoC6, setCarregandoC6] = useState(false);
  const [c7, setC7] = useState<ResumoC7Dashboard | null>(null);
  const [carregandoC7, setCarregandoC7] = useState(false);
  const [bucal, setBucal] = useState<ResumoBucalDashboard | null>(null);
  const [carregandoBucal, setCarregandoBucal] = useState(false);
  const [resumoDashboard, setResumoDashboard] = useState<ResumoDashboard | null>(null);
  const [modalCadastrarACS, setModalCadastrarACS] = useState(false);
  const [carregandoResumoDashboard, setCarregandoResumoDashboard] = useState(false);
  const [situacaoPacientes, setSituacaoPacientes] =
    useState<ResumoSituacaoPacientes | null>(null);
  const [carregandoSituacaoPacientes, setCarregandoSituacaoPacientes] =
    useState(false);
  const [c1, setC1] = useState<ResumoC1Dashboard | null>(null);
  const [carregandoC1, setCarregandoC1] = useState(false);

  useEffect(() => {
    if (carregando) return;

    if (!usuario) {
      router.replace("/login");
      return;
    }

    // O dashboard é exclusivo da enfermeira gestora.
    // O ACS deve permanecer na área operacional /acs.
    if (usuario.perfil !== "enfermeira") {
      router.replace("/acs");
      return;
    }

    let cancelado = false;

    /**
     * Carrega C1 e a situação dos pacientes a partir do snapshot
     * consolidado do Dashboard.
     *
     * A API /api/dashboard consulta somente:
     * ubs/{ubsId}/cacheDashboard/atual
     *
     * Assim, C1 e situação deixam de consultar APIs individuais.
     */
    async function carregarDashboardCache() {
      try {
        setCarregandoSituacaoPacientes(true);
        setCarregandoC1(true);
        setCarregandoC2(true);
        setCarregandoC3(true);
        setCarregandoC4(true);
        setCarregandoC5(true);
        setCarregandoC6(true);
        setCarregandoC7(true);
        setCarregandoBucal(true);

        const usuarioFirebase = auth.currentUser;
        if (!usuarioFirebase) return;

        const token = await usuarioFirebase.getIdToken();

        const resposta = await fetch("/api/dashboard", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const dados = await resposta.json();

        if (!cancelado && resposta.ok && dados.sucesso) {
          const snapshot = dados.dados ?? {};

          // ---------------------------------------------------------
          // Situação dos pacientes
          // ---------------------------------------------------------
          const situacao =
            snapshot.situacaopacientes &&
            typeof snapshot.situacaopacientes === "object" &&
            !Array.isArray(snapshot.situacaopacientes)
              ? snapshot.situacaopacientes
              : null;

          if (situacao) {
            setSituacaoPacientes({
              totalPacientes: Number(situacao.totalPacientes ?? 0),
              semNenhumRegistro: Number(situacao.semNenhumRegistro ?? 0),
              comIndicadoresPendentes: Number(
                situacao.comIndicadoresPendentes ?? 0,
              ),
              comIndicadoresConcluidos: Number(
                situacao.comIndicadoresConcluidos ?? 0,
              ),
              comRegistroSemIndicadorAplicavel: Number(
                situacao.comRegistroSemIndicadorAplicavel ?? 0,
              ),
              indicadoresConcluidosPercentual: Number(
                situacao.indicadoresConcluidosPercentual ?? 0,
              ),
            });
          } else {
            setSituacaoPacientes(null);
          }

          // ---------------------------------------------------------
          // C1 — Mais acesso
          // ---------------------------------------------------------
          const c1Cache =
            snapshot.c1 &&
            typeof snapshot.c1 === "object" &&
            !Array.isArray(snapshot.c1)
              ? snapshot.c1
              : null;

          if (c1Cache) {
            const percentualProgramado =
              typeof c1Cache.percentualProgramado === "number"
                ? c1Cache.percentualProgramado
                : null;

            setC1({
              possuiDados: percentualProgramado !== null,
              percentualProgramado,
              classificacao:
                typeof c1Cache.classificacao === "string"
                  ? c1Cache.classificacao
                  : "Indisponível",
              atendimentosProgramados: Number(
                c1Cache.atendimentosProgramados ?? 0,
              ),
              atendimentosEspontaneos: Number(
                c1Cache.atendimentosEspontaneos ?? 0,
              ),
              totalAtendimentos: Number(
                c1Cache.totalDemandasC1 ??
                  Number(c1Cache.atendimentosProgramados ?? 0) +
                    Number(c1Cache.atendimentosEspontaneos ?? 0),
              ),
              competencias:
                typeof c1Cache.competencia === "string"
                  ? [c1Cache.competencia]
                  : [],
            });
          } else {
            setC1(null);
          }

          // ---------------------------------------------------------
          // C2 — Desenvolvimento Infantil
          // ---------------------------------------------------------
          const c2Cache =
            snapshot.c2 &&
            typeof snapshot.c2 === "object" &&
            !Array.isArray(snapshot.c2)
              ? snapshot.c2
              : null;

          if (c2Cache) {
            setC2({
              pontuacao: Number(c2Cache.pontuacao ?? 0),
              classificacao:
                typeof c2Cache.classificacao === "string"
                  ? c2Cache.classificacao
                  : "Regular",
              totalElegiveis: Number(c2Cache.totalElegiveis ?? 0),
            });
          } else {
            setC2(null);
          }

          // ---------------------------------------------------------
          // C3 — Gestação e Puerpério
          // ---------------------------------------------------------
          const c3Cache =
            snapshot.c3 &&
            typeof snapshot.c3 === "object" &&
            !Array.isArray(snapshot.c3)
              ? snapshot.c3
              : null;

          if (c3Cache) {
            setC3({
              pontuacao: Number(c3Cache.pontuacao ?? 0),
              classificacao:
                typeof c3Cache.classificacao === "string"
                  ? c3Cache.classificacao
                  : "Regular",
              totalElegiveis: Number(c3Cache.totalElegiveis ?? 0),
            });
          } else {
            setC3(null);
          }

          // ---------------------------------------------------------
          // C4 — Diabetes
          // ---------------------------------------------------------
          const c4Cache =
            snapshot.c4 &&
            typeof snapshot.c4 === "object" &&
            !Array.isArray(snapshot.c4)
              ? snapshot.c4
              : null;

          if (c4Cache) {
            setC4({
              pontuacao: Number(c4Cache.pontuacao ?? 0),
              classificacao:
                typeof c4Cache.classificacao === "string"
                  ? c4Cache.classificacao
                  : "Regular",
              totalElegiveis: Number(c4Cache.totalElegiveis ?? 0),
            });
          } else {
            setC4(null);
          }

          // ---------------------------------------------------------
          // C5 — Hipertensão
          // ---------------------------------------------------------
          const c5Cache =
            snapshot.c5 &&
            typeof snapshot.c5 === "object" &&
            !Array.isArray(snapshot.c5)
              ? snapshot.c5
              : null;

          if (c5Cache) {
            setC5({
              pontuacao: Number(c5Cache.pontuacao ?? 0),
              classificacao:
                typeof c5Cache.classificacao === "string"
                  ? c5Cache.classificacao
                  : "Regular",
              totalElegiveis: Number(c5Cache.totalElegiveis ?? 0),
              praticas: {
                A: {
                  atingidos: Number(c5Cache.praticas?.A?.atingidos ?? 0),
                  percentual: Number(c5Cache.praticas?.A?.percentual ?? 0),
                },
                B: {
                  atingidos: Number(c5Cache.praticas?.B?.atingidos ?? 0),
                  percentual: Number(c5Cache.praticas?.B?.percentual ?? 0),
                },
                C: {
                  atingidos: Number(c5Cache.praticas?.C?.atingidos ?? 0),
                  percentual: Number(c5Cache.praticas?.C?.percentual ?? 0),
                },
                D: {
                  atingidos: Number(c5Cache.praticas?.D?.atingidos ?? 0),
                  percentual: Number(c5Cache.praticas?.D?.percentual ?? 0),
                },
              },
            });

          } else {
            setC5(null);
          }

          // ---------------------------------------------------------
          // C6 — Pessoa Idosa
          // ---------------------------------------------------------
          const c6Cache =
            snapshot.c6 &&
            typeof snapshot.c6 === "object" &&
            !Array.isArray(snapshot.c6)
              ? snapshot.c6
              : null;

          if (c6Cache) {
            setC6({
              pontuacao: Number(c6Cache.pontuacao ?? 0),
              classificacao:
                typeof c6Cache.classificacao === "string"
                  ? c6Cache.classificacao
                  : "Regular",
              totalElegiveis: Number(c6Cache.totalElegiveis ?? 0),
            });
          } else {
            setC6(null);
          }

          // ---------------------------------------------------------
          // C7 — Câncer da Mulher
          // ---------------------------------------------------------
          const c7Cache =
            snapshot.c7 &&
            typeof snapshot.c7 === "object" &&
            !Array.isArray(snapshot.c7)
              ? snapshot.c7
              : null;

          if (c7Cache) {
            setC7({
              pontuacao:
                c7Cache.pontuacao !== null &&
                c7Cache.pontuacao !== undefined
                  ? Number(c7Cache.pontuacao)
                  : null,
              pontuacaoParcial: Number(c7Cache.pontuacaoParcial ?? 0),
              classificacao:
                typeof c7Cache.classificacao === "string"
                  ? c7Cache.classificacao
                  : "Indisponível",
              totalElegiveis: Number(c7Cache.totalElegiveis ?? 0),
              completo: c7Cache.completo === true,
            });
          } else {
            setC7(null);
          }

          // ---------------------------------------------------------
          // Saúde Bucal — B1 a B6
          // ---------------------------------------------------------
          const bucalCache =
            snapshot.bucal &&
            typeof snapshot.bucal === "object" &&
            !Array.isArray(snapshot.bucal)
              ? snapshot.bucal
              : null;

          if (bucalCache) {
            setBucal({
              b1Percentual:
                bucalCache.praticas?.B1?.percentual !== null &&
                bucalCache.praticas?.B1?.percentual !== undefined
                  ? Number(bucalCache.praticas.B1.percentual)
                  : null,
              totalRegistros: Number(bucalCache.totalRegistros ?? 0),
            });
          } else {
            setBucal(null);
          }
        } else if (!cancelado) {
          setSituacaoPacientes(null);
          setC1(null);
          setC2(null);
          setC3(null);
          setC4(null);
          setC5(null);
          setC6(null);
          setC7(null);
          setBucal(null);
        }
      } catch (error) {
        console.error(
          "Erro ao carregar cache consolidado do dashboard:",
          error,
        );
      } finally {
        if (!cancelado) {
          setCarregandoSituacaoPacientes(false);
          setCarregandoC1(false);
          setCarregandoC2(false);
          setCarregandoC3(false);
          setCarregandoC4(false);
          setCarregandoC5(false);
          setCarregandoC6(false);
          setCarregandoC7(false);
          setCarregandoBucal(false);
        }
      }
    }

    async function carregarResumoDashboard() {
      try {
        setCarregandoResumoDashboard(true);

        const usuarioFirebase = auth.currentUser;
        if (!usuarioFirebase) return;

        const token = await usuarioFirebase.getIdToken();

        const resposta = await fetch("/api/dashboard/resumo", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const dados = await resposta.json();

        if (!cancelado && resposta.ok && dados.sucesso) {
          setResumoDashboard({
            acsAtivos: Number(dados.acsAtivos ?? 0),
            pacientes: Number(dados.pacientes ?? 0),
          });
        }
      } catch (error) {
        console.error("Erro ao carregar resumo do dashboard:", error);
      } finally {
        if (!cancelado) setCarregandoResumoDashboard(false);
      }
    }

   /**
 * C2 — Desenvolvimento Infantil é lido exclusivamente do snapshot
 * consolidado do Dashboard.
 *
 * O cálculo do C2 acontece na importação/migração e o resultado é
 * persistido em:
 *   ubs/{ubsId}/cacheDashboard/atual
 *
 * Assim, abrir o Dashboard não recalcula o indicador nem consulta
 * /api/indicadores/c2.
 */
    carregarResumoDashboard();
    carregarDashboardCache();

    return () => {
      cancelado = true;
    };
  }, [carregando, usuario]);

  /**
   * Enquanto o AuthProvider verifica a sessão,
   * mostramos apenas o carregamento.
   */
  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F7FF]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-4 border-[#7C3AED]/20 border-t-[#7C3AED]" />

          <p className="text-sm font-semibold text-[#4C1D95]">
            Carregando...
          </p>
        </div>
      </main>
    );
  }

  /**
   * Segurança adicional.
   */
  if (!usuario) {
  return null;
}

  // Proteção adicional para impedir que o ACS visualize
  // qualquer conteúdo do dashboard antes do redirecionamento.
  if (usuario.perfil !== "enfermeira") {
  return null;
}

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  const primeiroNome =
    usuario.nome?.split(" ")[0] || "Profissional";

  const pontuacoesGerais = [
    c2?.pontuacao,
    c3?.pontuacao,
    c4?.pontuacao,
    c5?.pontuacao,
    c6?.pontuacao,
    c7?.completo && c7.pontuacao !== null ? c7.pontuacao : null,
  ].filter((valor): valor is number => typeof valor === "number" && Number.isFinite(valor));

  const progressoGeral =
    pontuacoesGerais.length > 0
      ? pontuacoesGerais.reduce((soma, valor) => soma + valor, 0) / pontuacoesGerais.length
      : null;

  return (
    <main data-tour="tour-dashboard" className="min-h-screen bg-[#F8F7FF] text-[#211A4A]">

      <div className="flex min-h-screen">

        {/* =====================================================
            SIDEBAR
            Tablet portrait
        ====================================================== */}

        <aside className="hidden w-[150px] shrink-0 flex-col border-r border-[#E7E2F2] bg-white lg:flex">

          {/* Logo */}
          <div className="border-b border-[#E7E2F2] px-4 py-5">

            <div className="flex items-center gap-2">

              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7C3AED]">
                <HeartPulse
                  size={17}
                  className="text-white"
                />
              </div>

              <span className="text-[11px] font-bold text-[#4C1D95]">
                Indicadores
              </span>

            </div>

            <p className="mt-4 text-[8px] font-bold uppercase tracking-wide text-[#7C3AED]">
              Enfermeira Gestora
            </p>

          </div>

          {/* Menu */}
          <nav className="flex-1 px-3 py-4">

            <button
              type="button"
              className="mb-2 flex w-full items-center gap-3 rounded-lg bg-[#EEE7FF] px-3 py-3 text-left text-[10px] font-semibold text-[#7C3AED]"
            >
              <LayoutDashboard size={15} />
              Início
            </button>

            <button
              type="button"
              onClick={() => router.push("/equipe")}
              className="mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[10px] text-gray-500 transition hover:bg-[#F8F7FF]"
            >
              <UsersRound size={15} />
              Equipe
            </button>

           <button
          type="button"
          onClick={() => router.push("/historico")}
          className="mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[10px] text-gray-500 transition hover:bg-[#F8F7FF]"
        >
          <FileBarChart size={15} />
          Relatórios
        </button>

            <button
              type="button"
              onClick={() => router.push("/config")}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[10px] text-gray-500 transition hover:bg-[#F8F7FF]"
            >
              <Settings size={15} />
              Config
            </button>

          </nav>

          {/* Usuário */}
          <div className="border-t border-[#E7E2F2] p-3">

            <div className="flex items-center gap-2">

              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EEE7FF]">
                <UserRound
                  size={15}
                  className="text-[#7C3AED]"
                />
              </div>

              <div className="min-w-0 flex-1">

                <p className="truncate text-[9px] font-semibold">
                  {primeiroNome}
                </p>

                <p className="truncate text-[8px] text-gray-400">
                  Enfermeira
                </p>

              </div>

            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-2 py-2 text-[9px] font-semibold text-gray-500 transition hover:bg-gray-50 hover:text-red-500"
            >
              <LogOut size={13} />
              Sair
            </button>

          </div>

        </aside>

        {/* =====================================================
            CONTEÚDO PRINCIPAL
        ====================================================== */}

        <section className="min-w-0 flex-1 pb-20 lg:pb-0">

          {/* =================================================
              CABEÇALHO
              Tablet: identidade visual do Brasil 360
              Desktop: mantém o cabeçalho compacto
          ================================================== */}
          <header className="px-3 pt-3 sm:px-5 sm:pt-4 lg:px-7 lg:py-5">

            <div
              className="relative overflow-hidden rounded-[26px] border border-white/70 bg-gradient-to-br from-[#F5F3FF]/95 via-[#E9E4FF]/82 to-[#D8CCFF]/90 px-5 py-5 text-[#211A4A] shadow-[0_14px_35px_rgba(124,58,237,0.16),inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-1px_0_rgba(124,58,237,0.08)] backdrop-blur-md sm:px-6 sm:py-6 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:text-[#211A4A] lg:shadow-none lg:backdrop-blur-none"
            >
              {/* Elementos decorativos — profundidade 3D */}
              <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-[#8B5CF6]/18 shadow-[inset_8px_8px_18px_rgba(255,255,255,0.45),inset_-8px_-8px_18px_rgba(124,58,237,0.08)] lg:hidden" />
              <div className="pointer-events-none absolute -bottom-16 right-20 h-32 w-32 rounded-full border border-[#8B5CF6]/15 bg-white/10 shadow-[inset_4px_4px_12px_rgba(255,255,255,0.5)] lg:hidden" />
              <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-white/80 lg:hidden" />

              <div className="relative z-10 flex items-start gap-4">
                <div className="min-w-0">

                  <div className="mb-3 flex items-center">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/80 bg-white/45 shadow-[0_5px_12px_rgba(124,58,237,0.12),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-sm lg:bg-[#EEE7FF] lg:shadow-none">
                      <HeartPulse
                        size={18}
                        className="text-[#7C3AED]"
                      />
                    </div>
                  </div>

                  <h1 className="text-xl font-extrabold leading-tight text-[#211A4A] sm:text-2xl lg:text-lg lg:font-bold">
                    Olá, {primeiroNome} <span aria-hidden="true">👋</span>
                  </h1>

                  <p className="mt-2 max-w-[90%] text-[10px] font-medium leading-relaxed text-[#5B527A] lg:mt-1 lg:max-w-none lg:text-[9px] lg:font-normal lg:text-gray-400">
                    {ubs?.nome || "UBS"} •{" "}
                    {ubs?.municipio || ""}{" "}
                    {ubs?.uf ? `• ${ubs.uf}` : ""}
                  </p>

                </div>
              </div>

              <div className="relative z-10 mt-5 flex items-center gap-2 lg:hidden">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_7px_rgba(52,211,153,0.45)]" />
                <span className="text-[8px] font-medium text-[#625A80]">
                  Painel da equipe de saúde
                </span>
              </div>
            </div>

          </header>

          <div className="px-7 pb-8">

            {/* =================================================
                CARDS RESUMO
            ================================================== */}

            <section data-tour="tour-resumo" className="grid grid-cols-2 gap-3">

              {/* ACS ativos */}
<button
  type="button"
  onClick={() => router.push("/equipe")}
  className="relative min-h-[105px] w-full cursor-pointer overflow-hidden rounded-2xl bg-[#7C3AED] p-4 text-left text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
>
  <UsersRound
    size={18}
    className="absolute right-4 top-4 opacity-50"
  />

  <p className="text-3xl font-bold leading-none">
    {resumoDashboard?.acsAtivos ?? 0}
  </p>

  <p className="mt-2 text-[10px] font-medium">
    ACS ativos
  </p>

  <ChevronRight
    size={14}
    className="absolute bottom-4 right-4 opacity-70"
  />
</button>

              {/* Pacientes */}
              <div 
              onClick={() => router.push("/pacientes")}
              className="relative min-h-[105px] w-full cursor-pointer overflow-hidden rounded-2xl bg-[#7C3AED] p-4 text-left text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <UserRound
                  size={18}
                  className="absolute right-4 top-4 opacity-50"
                />

                <p className="text-3xl font-bold leading-none">
                  {carregandoResumoDashboard ? "..." : resumoDashboard?.pacientes ?? "—"}
                </p>

                <p className="mt-2 text-[10px] font-medium">
                  Pacientes
                </p>

                <ChevronRight
                  size={14}
                  className="absolute bottom-4 right-4 opacity-70"
                />

              </div>

              {/* Progresso */}
              <div className="relative min-h-[105px] overflow-hidden rounded-2xl bg-[#7C3AED] p-4 text-white shadow-sm">

                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15">
                  <Activity size={15} />
                </div>

                <p className="mt-3 text-2xl font-bold leading-none">
                  {progressoGeral !== null
                    ? `${progressoGeral.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
                    : "—"}
                </p>

                <p className="mt-2 text-[10px] font-medium">
                  Progresso geral • {pontuacoesGerais.length} indicadores
                </p>

                <div className="mt-3 h-1.5 rounded-full bg-white/20">
                  <div
                    className="h-1.5 rounded-full bg-white transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, progressoGeral ?? 0))}%` }}
                  />
                </div>

              </div>

              {/* Acessos */}
              <div className="relative min-h-[105px] overflow-hidden rounded-2xl border border-[#E5E0EC] bg-white p-4 shadow-sm">

                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#D1FAE5]">
                  <ShieldCheck
                    size={15}
                    className="text-[#10B981]"
                  />
                </div>

                <p className="mt-3 text-2xl font-bold leading-none">
                  0
                </p>

                <p className="mt-2 text-[10px] font-medium text-gray-500">
                  Acessos registrados
                </p>

                <div className="mt-3 h-1.5 rounded-full bg-[#D1FAE5]" />

              </div>

            </section>

            {/* =================================================
                BRASIL 360
            ================================================== */}

            <div className="mt-7 flex items-center justify-between">

              <div>
                <h2 className="text-sm font-bold text-[#211A4A]">
                  Indicadores APS Brasil 360
                </h2>

                <p className="mt-1 text-[9px] text-gray-400">
                  Acompanhamento dos indicadores da equipe
                </p>
              </div>

              <button
                type="button"
                onClick={() => router.push("/indicadores/c5")}
                className="text-[9px] font-semibold text-[#7C3AED]"
              >
                Ver C5 →
              </button>

            </div>

            {/* Situação dos pacientes */}
            <section data-tour="tour-situacao" className="mt-3 rounded-2xl border border-[#E5E0EC] bg-white p-5 shadow-sm">

              <h3 className="text-[11px] font-bold">
                Situação dos pacientes da equipe
              </h3>

              <div className="mt-5 space-y-4">

                {[
                  {
                    label: "Sem indicador C2–C7 aplicável",
                    valor:
                      situacaoPacientes?.comRegistroSemIndicadorAplicavel ?? 0,
                    corTexto: "text-gray-400",
                    corFundo: "bg-gray-200",
                    corBarra: "bg-gray-400",
                  },
                  {
                    label: "Com indicadores pendentes",
                    valor: situacaoPacientes?.comIndicadoresPendentes ?? 0,
                    corTexto: "text-[#F59E0B]",
                    corFundo: "bg-[#FEF3C7]",
                    corBarra: "bg-[#F59E0B]",
                  },
                  {
                    label: "Com indicadores concluídos",
                    valor: situacaoPacientes?.comIndicadoresConcluidos ?? 0,
                    corTexto: "text-[#10B981]",
                    corFundo: "bg-[#D1FAE5]",
                    corBarra: "bg-[#10B981]",
                  },
                ].map((item) => {
                  const total = situacaoPacientes?.totalPacientes ?? 0;
                  const percentual =
                    total > 0 ? (item.valor / total) * 100 : 0;

                  return (
                    <div key={item.label}>
                      <div className="mb-1.5 flex justify-between text-[9px]">
                        <span className="text-gray-500">
                          {item.label}
                        </span>

                        <span className={`font-semibold ${item.corTexto}`}>
                          {carregandoSituacaoPacientes ? "..." : item.valor}
                        </span>
                      </div>

                      <div className={`h-1.5 rounded-full ${item.corFundo}`}>
                        <div
                          className={`h-1.5 rounded-full ${item.corBarra} transition-all`}
                          style={{
                            width: `${Math.max(
                              0,
                              Math.min(100, percentual)
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}

              </div>

              <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">

                <span className="text-[9px] text-gray-400">
                  Indicadores concluídos
                </span>

                <span className="text-xl font-bold text-[#7C3AED]">
                  {carregandoSituacaoPacientes
                    ? "..."
                    : situacaoPacientes
                      ? `${situacaoPacientes.indicadoresConcluidosPercentual.toLocaleString(
                          "pt-BR",
                          {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 1,
                          }
                        )}%`
                      : "—"}
                </span>

              </div>

            </section>


            {/* =================================================
                ACS DA EQUIPE
            ================================================== */}

            <section
              data-tour="tour-equipe"
              className="mt-3 rounded-2xl border border-[#E5E0EC] bg-white p-5 shadow-sm"
            >

              <div className="flex items-center justify-between">

                <h3 className="text-[11px] font-bold">
                  ACS da Equipe
                </h3>

                <button
                  type="button"
                  onClick={() => router.push("/equipe")}
                  className="text-[9px] font-medium text-[#7C3AED]"
                >
                  Ver todos →
                </button>

              </div>

              <div className="flex min-h-[90px] flex-col items-center justify-center">

                <UsersRound
                  size={28}
                  className="text-gray-300"
                />

                <p className="mt-2 text-[9px] text-gray-400">
                  Nenhum ACS vinculado ainda.
                </p>

                <button
                  type="button"
                  onClick={() => setModalCadastrarACS(true)}
                  className="mt-3 rounded-lg bg-[#7C3AED] px-4 py-2 text-[9px] font-semibold text-white transition hover:bg-[#6D28D9]"
                >
                  Convidar ACS
                </button>

              </div>

            </section>

            {/* =================================================
                INDICADORES
            ================================================== */}

            <section data-tour="tour-indicadores" className="mt-5 grid grid-cols-2 gap-3">

              {indicadores.map((indicador) => {
                const Icone = indicador.icone;

                if (indicador.codigo === "C2") {
                  return (
                    <div key={indicador.codigo} className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => router.push("/indicadores/c2")}
                        className="relative flex min-h-[145px] flex-col justify-between overflow-hidden rounded-2xl p-3 text-left text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        style={{ backgroundColor: indicador.cor }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20">
                            <Icone size={15} />
                          </div>
                          <span className="rounded-md bg-white/15 px-1.5 py-1 text-[7px] font-bold">C2</span>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold leading-tight">Desenvolvimento Infantil</p>
                          <p className="mt-1 text-[7px] text-white/80">Acompanhamento infantil</p>
                          <p className="mt-2 text-[15px] font-extrabold">
                            {carregandoC2
                              ? "..."
                              : c2
                                ? `${c2.pontuacao.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
                                : "—"}
                          </p>
                          <p className="mt-0.5 text-[7px] font-semibold text-white/80">
                            {c2 ? `${c2.classificacao} • ${c2.totalElegiveis} elegíveis` : "Importe o PEC"}
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => router.push("/indicadores/bucal")}
                        className="relative flex min-h-[145px] flex-col justify-between overflow-hidden rounded-2xl bg-[#14B8A6] p-3 text-left text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20">
                            <Smile size={15} />
                          </div>
                          <span className="rounded-md bg-white/15 px-1.5 py-1 text-[7px] font-bold">B1–B6</span>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold leading-tight">Saúde Bucal</p>
                          <p className="mt-1 text-[7px] text-white/80">Indicadores odontológicos</p>
                          <p className="mt-2 text-[15px] font-extrabold">
                            {carregandoBucal
                              ? "..."
                              : bucal?.b1Percentual !== null && bucal?.b1Percentual !== undefined
                                ? `${bucal.b1Percentual.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
                                : "—"}
                          </p>
                          <p className="mt-0.5 text-[7px] font-semibold text-white/80">
                            {bucal ? `B1 • ${bucal.totalRegistros} registros` : "Importe o PEC"}
                          </p>
                        </div>
                      </button>
                    </div>
                  );
                }

                return (
                  <button
                    key={indicador.codigo}
                    type="button"
                    onClick={() => {
                      if (indicador.codigo === "C2") {
                        router.push("/indicadores/c2");
                      }
                      if (indicador.codigo === "C3") {
                        router.push("/indicadores/c3");
                      }
                      if (indicador.codigo === "C4") {
                        router.push("/indicadores/c4");
                      }
                      if (indicador.codigo === "C5") {
                        router.push("/indicadores/c5");
                      }
                      if (indicador.codigo === "C6") {
                        router.push("/indicadores/c6");
                      }
                      if (indicador.codigo === "C7") {
                        router.push("/indicadores/c7");
                      }
                    }}
                    className="relative flex min-h-[145px] flex-col justify-between overflow-hidden rounded-2xl p-4 text-left text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    style={{
                      backgroundColor: indicador.cor,
                    }}
                  >

                    <div className="flex items-center justify-between">

                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
                        <Icone size={16} />
                      </div>

                      <span className="rounded-md bg-white/15 px-2 py-1 text-[7px] font-bold">
                        {indicador.codigo}
                      </span>

                    </div>

                    <div>

                      <p className="text-[11px] font-bold leading-tight">
                        {indicador.titulo}
                      </p>

                      <p className="mt-1 text-[8px] text-white/80">
                        {indicador.descricao}
                      </p>

                      <div className="mt-3">
                        {indicador.codigo === "C3" ? (
                          <>
                            <p className="text-[16px] font-extrabold">
                              {carregandoC3
                                ? "..."
                                : c3
                                  ? `${c3.pontuacao.toLocaleString("pt-BR", {
                                      minimumFractionDigits: 1,
                                      maximumFractionDigits: 1,
                                    })}%`
                                  : "—"}
                            </p>

                            <p className="mt-0.5 text-[8px] font-semibold text-white/80">
                              {c3
                                ? `${c3.classificacao} • ${c3.totalElegiveis} elegíveis`
                                : "Importe o PEC para calcular"}
                            </p>
                          </>
                        ) : indicador.codigo === "C4" ? (
                          <>
                            <p className="text-[16px] font-extrabold">
                              {carregandoC4
                                ? "..."
                                : c4
                                  ? `${c4.pontuacao.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
                                  : "—"}
                            </p>
                            {c4 ? (
                              <div className="mt-1 flex items-center gap-2">
                                <span className="rounded-full bg-white/20 px-2 py-1 text-[8px] font-extrabold">
                                  {c4.classificacao}
                                </span>
                                <span className="text-[8px] font-semibold text-white/80">
                                  {c4.totalElegiveis} elegíveis
                                </span>
                              </div>
                            ) : (
                              <p className="mt-0.5 text-[8px] font-semibold text-white/80">
                                Importe o PEC para calcular
                              </p>
                            )}
                          </>
                        ) : indicador.codigo === "C5" ? (
                          <>
                            <p className="text-[16px] font-extrabold">
                              {carregandoC5
                                ? "..."
                                : c5
                                  ? `${c5.pontuacao.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 1,
                                  maximumFractionDigits: 1,
                                })}%`
                                  : "—"}
                            </p>
                            <p className="mt-0.5 text-[8px] font-semibold text-white/80">
                              {c5
                                ? `${c5.classificacao} • ${c5.totalElegiveis} elegíveis`
                                : "Importe o PEC para calcular"}
                            </p>
                          </>
                        ) : indicador.codigo === "C6" ? (
                          <>
                            <p className="text-[16px] font-extrabold">
                              {carregandoC6
                                ? "..."
                                : c6
                                  ? `${c6.pontuacao.toLocaleString("pt-BR", {
                                      minimumFractionDigits: 1,
                                      maximumFractionDigits: 1,
                                    })}%`
                                  : "—"}
                            </p>

                            <p className="mt-0.5 text-[8px] font-semibold text-white/80">
                              {c6
                                ? `${c6.classificacao} • ${c6.totalElegiveis} elegíveis`
                                : "Importe o PEC para calcular"}
                            </p>
                          </>
                        ) : indicador.codigo === "C7" ? (
                          <>
                            <p className="text-[16px] font-extrabold">
                              {carregandoC7
                                ? "..."
                                : c7
                                  ? c7.completo && c7.pontuacao !== null
                                    ? `${c7.pontuacao.toLocaleString("pt-BR", {
                                        minimumFractionDigits: 1,
                                        maximumFractionDigits: 1,
                                      })}%`
                                    : `${c7.pontuacaoParcial.toLocaleString("pt-BR", {
                                        minimumFractionDigits: 1,
                                        maximumFractionDigits: 1,
                                      })}%*`
                                  : "—"}
                            </p>

                            <p className="mt-0.5 text-[8px] font-semibold text-white/80">
                              {c7
                                ? c7.completo
                                  ? `${c7.classificacao} • ${c7.totalElegiveis} elegíveis`
                                  : `Parcial • ${c7.totalElegiveis} elegíveis`
                                : "Importe o PEC para calcular"}
                            </p>
                          </>
                        ) : (
                          <p className="text-[11px] font-bold">—</p>
                        )}
                      </div>

                    </div>

                  </button>
                );
              })}

            </section>

            {/* =================================================
                C1 — MAIS ACESSO
            ================================================== */}

            <button
              data-tour="tour-c1"
              type="button"
              onClick={() => router.push("/indicadores/c1")}
              className="mt-3 w-full rounded-2xl border border-[#E5E0EC] bg-white px-5 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >

              <div className="flex items-center gap-4">

                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EEE7FF]">
                  <CalendarDays
                    size={18}
                    className="text-[#7C3AED]"
                  />
                </div>

                <div className="flex-1">

                  <p className="text-[10px] font-bold">
                    C1 — Mais acesso
                  </p>

                  <p className="mt-1 text-[8px] text-gray-400">
                    Acompanhamento do acesso e das consultas da equipe.
                  </p>

                </div>

                <div className="text-right">
                  <span className="text-lg font-bold text-[#7C3AED]">
                    {carregandoC1
                      ? "..."
                      : c1?.possuiDados && c1.percentualProgramado !== null
                        ? `${c1.percentualProgramado.toLocaleString("pt-BR", {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })}%`
                        : "Indisponível"}
                  </span>

                  {c1?.possuiDados ? (
                    <p className="mt-0.5 text-[7px] font-semibold text-gray-400">
                      {c1.classificacao} • {c1.totalAtendimentos} atendimentos
                    </p>
                  ) : !carregandoC1 ? (
                    <p className="mt-0.5 text-[7px] font-semibold text-gray-400">
                      Sem dados de demanda qualificados
                    </p>
                  ) : null}
                </div>

                <ChevronRight
                  size={16}
                  className="text-gray-300"
                />

              </div>

            </button>

            {/* =================================================
                AVISO
            ================================================== */}

            <div className="mt-3 flex items-center gap-3 rounded-xl bg-[#F1EDF9] px-4 py-3">

              <ClipboardList
                size={15}
                className="shrink-0 text-[#7C3AED]"
              />

              <p className="text-[8px] leading-relaxed text-gray-500">
                Os indicadores serão calculados automaticamente após a
                importação dos relatórios do e-SUS PEC.
              </p>

            </div>

          </div>
        </section>

      </div>
      {/* =====================================================
          NAVEGAÇÃO INFERIOR
          Tablet e celular
      ====================================================== */}
      <nav data-tour="tour-menu" className="fixed inset-x-0 bottom-0 z-50 border-t border-[#E7E2F2] bg-white/95 px-3 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-4px_16px_rgba(33,26,74,0.08)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-2xl items-center justify-around">

          {/* Início */}
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-[#7C3AED]"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEE7FF]">
              <LayoutDashboard size={17} />
            </div>
            <span className="text-[9px] font-semibold">Início</span>
          </button>

          {/* Equipe */}
          <button
            type="button"
            onClick={() => router.push("/equipe")}
            className="flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-gray-500 transition hover:bg-[#F8F7FF]"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg">
              <UsersRound size={17} />
            </div>
            <span className="text-[9px] font-medium">Equipe</span>
          </button>

          {/* Histórico */}
          <button
            type="button"
            onClick={() => router.push("/historico")}
            className="flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-gray-500 transition hover:bg-[#F8F7FF]"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg">
              <FileBarChart size={17} />
            </div>
            <span className="text-[9px] font-medium">Histórico</span>
          </button>

          {/* Config */}
          <button
            type="button"
            onClick={() => router.push("/config")}
            className="flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-gray-500 transition hover:bg-[#F8F7FF]"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg">
              <Settings size={17} />
            </div>
            <span className="text-[9px] font-medium">Config</span>
          </button>

          {/* Sair */}
          <button
            type="button"
            onClick={handleLogout}
            className="flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-gray-500 transition hover:bg-red-50 hover:text-red-500"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg">
              <LogOut size={17} />
            </div>
            <span className="text-[9px] font-medium">Sair</span>
          </button>

        </div>
      </nav>

      <TourBrasil360
        etapas={tourEtapas}
        storageKey="brasil360_tour_enfermeira_v1"
        ativo={!carregando && usuario?.perfil === "enfermeira"}
      />

      <ModalCadastrarACS
      aberto={modalCadastrarACS}
      onFechar={() => setModalCadastrarACS(false)}
      onSucesso={() => {
        setResumoDashboard((atual) =>
          atual
            ? { ...atual, acsAtivos: atual.acsAtivos + 1 }
            : atual
        );
      }}
    />

  </main>
  );
}