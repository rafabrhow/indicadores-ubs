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
import Image from "next/image";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import ModalCadastrarACS from "@/components/acs/ModalCadastrarACS";
import TourBrasil360 from "@/components/tour/TourBrasil360";
import LoadingBrasil360 from "@/components/ui/LoadingBrasil360";

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
    cor: "#003B8E",
    icone: Baby,
  },
  {
    codigo: "C3",
    titulo: "Gestação e Puerpério",
    descricao: "Gestantes e puérperas",
    cor: "#00A9E8",
    icone: Heart,
  },
  {
    codigo: "C4",
    titulo: "Diabetes",
    descricao: "Cuidado da pessoa com diabetes",
    cor: "#F2C300",
    icone: Droplets,
  },
  {
    codigo: "C5",
    titulo: "Hipertensão",
    descricao: "Cuidado da pessoa com hipertensão",
    cor: "#F2C300",
    icone: Activity,
  },
  {
    codigo: "C6",
    titulo: "Pessoa Idosa",
    descricao: "Cuidado da pessoa idosa",
    cor: "#062B63",
    icone: UsersRound,
  },
  {
    codigo: "C7",
    titulo: "Saúde da Mulher",
    descricao: "Prevenção do câncer",
    cor: "#009C3B",
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
  const [agora, setAgora] = useState<Date | null>(null);

  async function carregarPacientesSituacao() {
    try {
      setCarregandoPacientesSituacao(true);

      const usuarioFirebase = auth.currentUser;

      if (!usuarioFirebase) return;

      const token = await usuarioFirebase.getIdToken();

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

      const dados = await resposta.json();

      if (resposta.ok && dados.sucesso) {
        setPacientesSituacao(
          Array.isArray(dados.pacientes)
            ? dados.pacientes
            : [],
        );
      }
    } catch (error) {
      console.error(
        "Erro ao carregar situação detalhada dos pacientes:",
        error,
      );

      setPacientesSituacao([]);
    } finally {
      setCarregandoPacientesSituacao(false);
    }
  }

  useEffect(() => {
    const atualizar = () => setAgora(new Date());

    atualizar();

    const intervalo = window.setInterval(atualizar, 1000);

    return () => window.clearInterval(intervalo);
  }, []);

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
  const [situacaoPacientes, setSituacaoPacientes] =
    useState<ResumoSituacaoPacientes | null>(null);
  const [carregandoSituacaoPacientes, setCarregandoSituacaoPacientes] =
    useState(false);
  const [c1, setC1] = useState<ResumoC1Dashboard | null>(null);
  const [carregandoC1, setCarregandoC1] = useState(false);

type PacienteSituacao = {
  id: string;
  nome: string;
  categoria:
    | "sem_nenhum_registro"
    | "indicadores_pendentes"
    | "indicadores_concluidos"
    | "registro_sem_indicador_aplicavel";
  indicadores: {
    codigo: "C2" | "C3" | "C4" | "C5" | "C6" | "C7";
    status: "pendente" | "concluido";
  }[];
  indicadoresSemRegistro?: Array<"C2" | "C3" | "C4" | "C5" | "C6" | "C7">;
};

const [pacientesSituacao, setPacientesSituacao] = useState<
  PacienteSituacao[]
>([]);
const [carregandoPacientesSituacao, setCarregandoPacientesSituacao] =
  useState(false);
const [modalSituacaoAberto, setModalSituacaoAberto] = useState(false);
  const [situacaoSelecionada, setSituacaoSelecionada] = useState<
    "sem-registro" | "sem-indicador" | "pendente" | "concluido" | null
  >(null);
  const [pacienteSituacaoSelecionado, setPacienteSituacaoSelecionado] =
    useState<PacienteSituacao | null>(null);
  
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
     * 
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
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
          },
        });

        const dados = await resposta.json();

        if (!cancelado && resposta.ok && dados.sucesso) {
          setResumoDashboard({
            acsAtivos: Number(dados.acsAtivos ?? 0),
            pacientes: Number(dados.pacientes ?? 0),
          });

          const snapshot = dados.dados ?? {};

          // ---------------------------------------------------------
          // Situação dos pacientes
          // ---------------------------------------------------------
          // A lista detalhada é a fonte única da verdade para as
          // categorias dos pacientes. Assim, o card e o modal usam
          // exatamente a mesma classificação.
          try {
            const respostaSituacao = await fetch(
              "/api/dashboard/situacao-pacientes",
              {
                cache: "no-store",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Cache-Control": "no-cache",
                },
              },
            );

            const dadosSituacao = await respostaSituacao.json();

            if (
              !cancelado &&
              respostaSituacao.ok &&
              dadosSituacao.sucesso &&
              Array.isArray(dadosSituacao.pacientes)
            ) {
              const pacientesDetalhados =
                dadosSituacao.pacientes as PacienteSituacao[];

              const semNenhumRegistro = pacientesDetalhados.filter(
                (p) => p.categoria === "sem_nenhum_registro",
              ).length;

              const comIndicadoresPendentes = pacientesDetalhados.filter(
                (p) => p.categoria === "indicadores_pendentes",
              ).length;

              const comIndicadoresConcluidos = pacientesDetalhados.filter(
                (p) => p.categoria === "indicadores_concluidos",
              ).length;

              const comRegistroSemIndicadorAplicavel =
                pacientesDetalhados.filter(
                  (p) =>
                    p.categoria ===
                    "registro_sem_indicador_aplicavel",
                ).length;

              const totalPacientes = pacientesDetalhados.length;

              setPacientesSituacao(pacientesDetalhados);

              setSituacaoPacientes({
                totalPacientes,
                semNenhumRegistro,
                comIndicadoresPendentes,
                comIndicadoresConcluidos,
                comRegistroSemIndicadorAplicavel,
                indicadoresConcluidosPercentual:
                  totalPacientes > 0
                    ? Number(
                        (
                          (comIndicadoresConcluidos / totalPacientes) *
                          100
                        ).toFixed(1),
                      )
                    : 0,
              });
            } else {
              setSituacaoPacientes(null);
            }
          } catch (error) {
            console.error(
              "Erro ao carregar situação detalhada para o Dashboard:",
              error,
            );

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
    carregarDashboardCache();

    // A situação detalhada dos pacientes é carregada somente quando
    // a enfermeira abre uma das categorias.
    // Isso evita reconstruir todo o histórico de pacientes
    // a cada abertura do Dashboard.

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
      <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <div className="text-center">
          <LoadingBrasil360
          mensagem="Carregando..."
          subtitulo="Buscando as importações da UBS"
          />
          
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
    <main data-tour="tour-dashboard" className="min-h-screen bg-[#F8FAFC] text-[#062B63]">

      <div className="flex min-h-screen">

        {/* =====================================================
            SIDEBAR
            Tablet portrait
        ====================================================== */}

        <aside className="hidden w-[190px] shrink-0 flex-col border-r border-[#DCE8F5] bg-white lg:flex">

          {/* Logo */}
          <div className="border-b border-[#DCE8F5] px-4 py-5">

            <div className="flex items-center gap-2">

              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#003B8E] shadow-sm">
                <img
                src="/brasil360-logo-header.png"
                alt="Brasil 360"
                className="h-14 w-[88px] object-contain"
              />
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-black tracking-tight text-[#003B8E]">
                  BR<span className="text-[#00A9E8]">3</span><span className="text-[#009C3B]">6</span><span className="text-[#F2C300]">0</span>
                </p>
                <p className="text-[7px] font-semibold uppercase tracking-wide text-[#003B8E]">
                  Indicadores
                </p>
              </div>

            </div>

            <p className="mt-4 text-[8px] font-bold uppercase tracking-wide text-[#003B8E]">
              Enfermeira Gestora
            </p>

          </div>

          {/* Menu */}
          <nav className="flex-1 px-3 py-4">

            <button
              type="button"
              className="mb-2 flex w-full items-center gap-3 rounded-lg bg-[#EAF4FF] px-3 py-3 text-left text-[10px] font-semibold text-[#003B8E]"
            >
              <LayoutDashboard size={15} />
              Início
            </button>

            <button
              type="button"
              onClick={() => router.push("/equipe")}
              className="mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[10px] text-gray-500 transition hover:bg-[#F8FAFC]"
            >
              <UsersRound size={15} />
              Equipe
            </button>

           <button
          type="button"
          onClick={() => router.push("/historico")}
          className="mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[10px] text-gray-500 transition hover:bg-[#F8FAFC]"
        >
          <FileBarChart size={15} />
          Relatórios
        </button>

            <button
              type="button"
              onClick={() => router.push("/config")}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[10px] text-gray-500 transition hover:bg-[#F8FAFC]"
            >
              <Settings size={15} />
              Config
            </button>

          </nav>

          {/* Usuário */}
          <div className="border-t border-[#DCE8F5] p-3">

            <div className="flex items-center gap-2">

              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EAF4FF]">
                <UserRound
                  size={15}
                  className="text-[#003B8E]"
                />
              </div>

              <div className="min-w-0 flex-1">

                <p className="truncate text-[9px] font-semibold">
                  {usuario.nome}
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
          <header>
            <div className="relative isolate overflow-hidden rounded-b-[28px] border border-emerald-200/60 bg-gradient-to-br from-[#009C3B]/95 via-[#00A9E8]/85 to-[#F2C300]/85 px-8 py-6 text-white shadow-[0_12px_30px_rgba(0,156,59,0.18),0_5px_12px_rgba(0,59,142,0.12)] backdrop-blur-md">
              <div className="pointer-events-none absolute -left-10 -top-14 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
              <div className="pointer-events-none absolute right-8 -top-16 h-40 w-40 rounded-full bg-[#F2C300]/25 blur-3xl" />
              <div className="pointer-events-none absolute bottom-[-70px] left-1/2 h-40 w-64 -translate-x-1/2 rounded-full bg-[#00A9E8]/20 blur-3xl" />

              <div className="relative pr-28 sm:pr-44 lg:pr-52">
                <p className="text-[11px] font-semibold text-white/85">
                  Enfermeira Gestora
                </p>

                <h1 className="mt-1 text-2xl font-bold tracking-tight drop-shadow-sm">
                  Olá, {usuario.nome} <span aria-hidden="true">👋</span>
                </h1>

                <p className="mt-1 text-[10px] text-white/90">
                  {ubs?.nome || "UBS"} • {ubs?.municipio || ""} {ubs?.uf ? `• ${ubs.uf}` : ""}
                </p>

                  <div className="absolute right-20 top-1/2 flex -translate-y-1/2 lg:right-32">
                  <div className="flex h-[78px] w-[195px] items-center justify-between rounded-[20px] border border-transparent bg-transparent px-1 shadow-none backdrop-blur-none">
                    <div className="min-w-0">
                      <p className="text-[22px] font-semibold leading-none tracking-tight tabular-nums">
                        {agora
                          ? agora.toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—:—"}
                      </p>

                      <p className="mt-2 truncate text-[10px] font-medium text-white/70">
                        {agora
                          ? agora.toLocaleDateString("pt-BR", {
                              weekday: "short",
                              day: "2-digit",
                              month: "long",
                            })
                          : "—"}
                      </p>

                      <p className="mt-0.5 text-[9px] font-medium text-white/55">
                        Hoje • horário local
                      </p>
                    </div>

                    <div className="relative ml-0 h-14 w-14 shrink-0 rounded-full border border-white/35 bg-white/10">
                      {Array.from({ length: 12 }).map((_, index) => {
                        const angle = index * 30;
                        return (
                          <span
                            key={index}
                            className="absolute left-1/2 top-1/2 h-[2px] w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/75"
                            style={{
                              transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-23px)`,
                            }}
                          />
                        );
                      })}

                      <span
                        className="absolute bottom-1/2 left-1/2 h-[17px] w-[2px] origin-bottom -translate-x-1/2 rounded-full bg-white"
                        style={{
                          transform: `translateX(-50%) rotate(${agora ? ((agora.getHours() % 12) * 30 + agora.getMinutes() * 0.5) : 0}deg)`,
                        }}
                      />

                      <span
                        className="absolute bottom-1/2 left-1/2 h-[22px] w-[1.5px] origin-bottom -translate-x-1/2 rounded-full bg-white/90"
                        style={{
                          transform: `translateX(-50%) rotate(${agora ? (agora.getMinutes() * 6 + agora.getSeconds() * 0.1) : 0}deg)`,
                        }}
                      />

                      <span
                        className="absolute bottom-1/2 left-1/2 h-[24px] w-px origin-bottom -translate-x-1/2 rounded-full bg-white/55"
                        style={{
                          transform: `translateX(-50%) rotate(${agora ? agora.getSeconds() * 6 : 0}deg)`,
                        }}
                      />

                      <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-sm" />
                    </div>
                  </div>
                </div>
              </div>

              <img
                src="/brasil360-logo-header.png"
                alt="Brasil 360"
                width={88}
                height={88}
                className="absolute right-5 top-1/2 h-16 w-16 -translate-y-1/2 rounded-2xl object-cover shadow-[0_8px_18px_rgba(0,59,142,0.22)] ring-1 ring-white/50 sm:h-20 sm:w-20"
              />
            </div>
          </header>

          <div className="px-7 pt-5 pb-8">

            {/* =================================================
                CARDS RESUMO
            ================================================== */}

            <section data-tour="tour-resumo" className="grid grid-cols-2 gap-3">

              {/* ACS ativos */}
<button
  type="button"
  onClick={() => router.push("/equipe")}
  className="group relative min-h-[105px] w-full cursor-pointer overflow-hidden rounded-2xl border border-[#67D0F2] bg-gradient-to-br from-[#00A9E8] to-[#008FC5] p-4 text-left text-white shadow-[0_7px_14px_rgba(0,169,232,0.22),0_2px_4px_rgba(0,59,142,0.10)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_22px_rgba(0,169,232,0.28),0_4px_8px_rgba(0,59,142,0.14)]"
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
              className="group relative min-h-[105px] w-full cursor-pointer overflow-hidden rounded-2xl border border-[#5B8FC9] bg-gradient-to-br from-[#003B8E] to-[#062B63] p-4 text-left text-white shadow-[0_7px_14px_rgba(0,59,142,0.22),0_2px_4px_rgba(0,59,142,0.10)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_22px_rgba(0,59,142,0.28),0_4px_8px_rgba(0,59,142,0.14)]"
              >
                <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-white/10 blur-2xl transition-transform duration-300 group-hover:scale-125" />

                <UserRound
                  size={18}
                  className="absolute right-4 top-4 opacity-50"
                />

                <p className="text-3xl font-bold leading-none">
                  {resumoDashboard?.pacientes ?? "—"}
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
              <div className="group relative min-h-[105px] overflow-hidden rounded-2xl border border-[#58C78B] bg-gradient-to-br from-[#009C3B] to-[#007A2E] p-4 text-white shadow-[0_7px_14px_rgba(0,156,59,0.22),0_2px_4px_rgba(0,59,142,0.10)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_22px_rgba(0,156,59,0.28),0_4px_8px_rgba(0,59,142,0.14)]">

                <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-white/12 blur-2xl transition-transform duration-300 group-hover:scale-125" />

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
              <div className="group relative min-h-[105px] overflow-hidden rounded-2xl border border-[#B8D8EA] bg-gradient-to-br from-white to-[#F1FAFD] p-4 shadow-[0_7px_14px_rgba(0,59,142,0.08),0_2px_4px_rgba(0,169,232,0.06)] transition-all duration-200 hover:-translate-y-1 hover:border-[#8BCDE5] hover:shadow-[0_12px_22px_rgba(0,169,232,0.14),0_4px_8px_rgba(0,59,142,0.10)]">

                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#DDF7EA]">
                  <ShieldCheck
                    size={15}
                    className="text-[#009C3B]"
                  />
                </div>

                <p className="mt-3 text-2xl font-bold leading-none">
                  0
                </p>

                <p className="mt-2 text-[10px] font-medium text-gray-500">
                  Acessos registrados
                </p>

                <div className="mt-3 h-1.5 rounded-full bg-[#DDF7EA]" />

              </div>

            </section>

            {/* =================================================
                BRASIL 360
            ================================================== */}

            <div className="mt-7 flex items-center justify-between">

              <div>
                <h2 className="text-sm font-bold text-[#062B63]">
                  Indicadores APS Brasil 360
                </h2>

                <p className="mt-1 text-[9px] text-gray-400">
                  Acompanhamento dos indicadores da equipe
                </p>
              </div>


            </div>

            {/* Situação dos pacientes */}
            <section data-tour="tour-situacao" className="group relative mt-3 overflow-hidden rounded-2xl border border-[#B8DFF0] bg-gradient-to-br from-[#F8FCFF] via-[#F2FAFE] to-[#EAF7FC] p-5 shadow-[0_8px_18px_rgba(0,59,142,0.10),0_3px_7px_rgba(0,169,232,0.08)] transition-all duration-200 hover:-translate-y-1 hover:border-[#8FD0E8] hover:shadow-[0_14px_26px_rgba(0,59,142,0.14),0_5px_10px_rgba(0,169,232,0.12)]">
              <div className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-[#00A9E8]/10 blur-3xl transition-transform duration-300 group-hover:scale-125" />

              <h3 className="text-[11px] font-bold">
                Situação dos pacientes da equipe
              </h3>

              <div className="mt-5 space-y-4">

                {[
                  {
                    label: "Sem nenhum registro",
                    valor: situacaoPacientes?.semNenhumRegistro ?? 0,
                    corTexto: "text-[#7B8794]",
                    corFundo: "bg-[#E8EDF2]",
                    corBarra: "bg-[#7B8794]",
                  },
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
                    corTexto: "text-[#F2C300]",
                    corFundo: "bg-[#FFF4C2]",
                    corBarra: "bg-[#F2C300]",
                  },
                  {
                    label: "Com indicadores concluídos",
                    valor: situacaoPacientes?.comIndicadoresConcluidos ?? 0,
                    corTexto: "text-[#009C3B]",
                    corFundo: "bg-[#DDF7EA]",
                    corBarra: "bg-[#009C3B]",
                  },
                ].map((item) => {
                  const total = situacaoPacientes?.totalPacientes ?? 0;
                  const percentual =
                    total > 0 ? (item.valor / total) * 100 : 0;

                  return (
                    <button
  key={item.label}
  type="button"
  onClick={() => {
                        if (item.label === "Sem nenhum registro") {
                          setSituacaoSelecionada("sem-registro");
                        } else if (item.label === "Sem indicador C2–C7 aplicável") {
                          setSituacaoSelecionada("sem-indicador");
                        } else if (item.label === "Com indicadores pendentes") {
                          setSituacaoSelecionada("pendente");
                        } else {
                          setSituacaoSelecionada("concluido");
                        }

                        setModalSituacaoAberto(true);
                        void carregarPacientesSituacao();
                      }}
  className="w-full text-left transition-opacity hover:opacity-80"
>
  <div className="mb-1.5 flex justify-between text-[9px]">
    <span className="text-gray-500">{item.label}</span>

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
          Math.min(100, percentual),
        )}%`,
      }}
    />
  </div>
</button>                 );
                })}

              </div>

              <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">

                <span className="text-[9px] text-gray-400">
                  Indicadores concluídos
                </span>

                <span className="text-xl font-bold text-[#003B8E]">
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
              className="group relative mt-3 overflow-hidden rounded-2xl border border-[#B8DFF0] bg-gradient-to-br from-[#F8FCFF] via-[#F2FAFE] to-[#EAF7FC] p-5 shadow-[0_8px_18px_rgba(0,59,142,0.10),0_3px_7px_rgba(0,169,232,0.08)] transition-all duration-200 hover:-translate-y-1 hover:border-[#8FD0E8] hover:shadow-[0_14px_26px_rgba(0,59,142,0.14),0_5px_10px_rgba(0,169,232,0.12)]"
            >
              <div className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-[#00A9E8]/10 blur-3xl transition-transform duration-300 group-hover:scale-125" />

              <div className="flex items-center justify-between">

                <h3 className="text-[11px] font-bold">
                  ACS da Equipe
                </h3>

                <button
                  type="button"
                  onClick={() => router.push("/equipe")}
                  className="text-[9px] font-medium text-[#003B8E]"
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
                  {resumoDashboard?.acsAtivos
                    ? `${resumoDashboard.acsAtivos} ACS ${
                        resumoDashboard.acsAtivos === 1
                          ? "vinculado"
                          : "vinculados"
                      }`
                    : "Nenhum ACS vinculado ainda."}
                </p>

                <button
                  type="button"
                  onClick={() => setModalCadastrarACS(true)}
                  className="mt-3 rounded-lg bg-[#003B8E] px-4 py-2 text-[9px] font-semibold text-white transition hover:bg-[#062B63]"
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
                        className="group relative flex min-h-[145px] flex-col justify-between overflow-hidden rounded-2xl border border-white/25 p-3 text-left text-white shadow-[0_8px_16px_rgba(0,59,142,0.18),0_2px_5px_rgba(0,0,0,0.08)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_14px_24px_rgba(0,59,142,0.24),0_4px_8px_rgba(0,0,0,0.10)]"
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
                        className="group relative flex min-h-[145px] flex-col justify-between overflow-hidden rounded-2xl border border-[#58C78B] bg-gradient-to-br from-[#009C3B] to-[#007A2E] p-3 text-left text-white shadow-[0_8px_16px_rgba(0,156,59,0.20),0_2px_5px_rgba(0,59,142,0.08)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_14px_24px_rgba(0,156,59,0.26),0_4px_8px_rgba(0,59,142,0.10)]"
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
                    className="group relative flex min-h-[145px] flex-col justify-between overflow-hidden rounded-2xl border border-white/25 p-4 text-left text-white shadow-[0_8px_16px_rgba(0,59,142,0.18),0_2px_5px_rgba(0,0,0,0.08)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_14px_24px_rgba(0,59,142,0.24),0_4px_8px_rgba(0,0,0,0.10)]"
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
              className="group relative mt-3 w-full overflow-hidden rounded-2xl border border-[#B8D8EA] bg-gradient-to-br from-white to-[#F4FAFD] px-5 py-4 text-left shadow-[0_7px_16px_rgba(0,59,142,0.08),0_2px_5px_rgba(0,169,232,0.05)] transition-all duration-200 hover:-translate-y-1 hover:border-[#8BCDE5] hover:shadow-[0_12px_22px_rgba(0,169,232,0.13),0_4px_8px_rgba(0,59,142,0.09)]"
            >
              <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-[#00A9E8]/10 blur-2xl transition-transform duration-300 group-hover:scale-125" />

              <div className="relative flex items-center gap-4">

                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EAF4FF]">
                  <CalendarDays
                    size={18}
                    className="text-[#003B8E]"
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
                  <span className="text-lg font-bold text-[#003B8E]">
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

            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[#C9E8F5] bg-gradient-to-r from-[#EFF9FD] to-[#F6FBFE] px-4 py-3 shadow-[0_4px_10px_rgba(0,169,232,0.06)]">

              <ClipboardList
                size={15}
                className="shrink-0 text-[#003B8E]"
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
      <nav data-tour="tour-menu" className="fixed inset-x-0 bottom-0 z-50 border-t border-[#DCE8F5] bg-white/95 px-3 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-4px_16px_rgba(33,26,74,0.08)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-2xl items-center justify-around">

          {/* Início */}
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-[#003B8E]"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF4FF]">
              <LayoutDashboard size={17} />
            </div>
            <span className="text-[9px] font-semibold">Início</span>
          </button>

          {/* Equipe */}
          <button
            type="button"
            onClick={() => router.push("/equipe")}
            className="flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-gray-500 transition hover:bg-[#F8FAFC]"
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
            className="flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-gray-500 transition hover:bg-[#F8FAFC]"
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
            className="flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-gray-500 transition hover:bg-[#F8FAFC]"
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

      {modalSituacaoAberto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h3 className="text-sm font-bold text-[#062B63]">
                  Situação dos pacientes
                </h3>
                <p className="mt-1 text-[9px] text-gray-400">
                  Consulte os pacientes desta categoria.
                </p>
              </div>
              <button type="button" onClick={() => { setModalSituacaoAberto(false); setSituacaoSelecionada(null); }} className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600" aria-label="Fechar">×</button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto px-5 py-4">
              {carregandoPacientesSituacao ? (
                <div className="flex min-h-[120px] items-center justify-center"><p className="text-[10px] text-gray-400">Carregando pacientes...</p></div>
              ) : (
                (() => {
                  const pacientesFiltrados =
                    situacaoSelecionada === "sem-registro"
                      ? pacientesSituacao.filter(
                          (p) => p.categoria === "sem_nenhum_registro",
                        )
                      : situacaoSelecionada === "pendente"
                        ? pacientesSituacao.filter(
                            (p) => p.categoria === "indicadores_pendentes",
                          )
                        : situacaoSelecionada === "concluido"
                          ? pacientesSituacao.filter(
                              (p) => p.categoria === "indicadores_concluidos",
                            )
                          : pacientesSituacao.filter(
                              (p) =>
                                p.categoria ===
                                "registro_sem_indicador_aplicavel",
                            );

                  const titulo =
                    situacaoSelecionada === "sem-registro"
                      ? "Pacientes sem nenhum registro"
                      : situacaoSelecionada === "pendente"
                        ? "Pacientes com indicadores pendentes"
                        : situacaoSelecionada === "concluido"
                          ? "Pacientes com indicadores concluídos"
                          : "Pacientes sem indicador C2–C7 aplicável";
                  return (
                    <>
                      <div className="mb-3 flex items-center justify-between"><p className="text-[10px] font-bold text-[#062B63]">{titulo}</p><span className="rounded-full bg-[#EAF4FF] px-2 py-1 text-[8px] font-bold text-[#003B8E]">{pacientesFiltrados.length}</span></div>
                      {pacientesFiltrados.length === 0 ? (
                        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-6 text-center"><p className="text-[10px] text-gray-400">Nenhum paciente encontrado nesta categoria.</p></div>
                      ) : (
                        <div className="space-y-2">
                          {pacientesFiltrados.map((paciente) => (
                            <button
                              key={paciente.id}
                              type="button"
                              onClick={() => setPacienteSituacaoSelecionado(paciente)}
                              className="w-full rounded-xl border border-gray-100 bg-white px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#B8DFF0] hover:shadow-md"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-[10px] font-bold text-[#062B63]">
                                  {paciente.nome}
                                </p>
                                <ChevronRight
                                  size={14}
                                  className="shrink-0 text-gray-300"
                                />
                              </div>

                              {paciente.indicadores.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {paciente.indicadores.map((indicador) => (
                                    <span
                                      key={indicador.codigo}
                                      className={`rounded-full px-2 py-1 text-[8px] font-bold ${
                                        indicador.status === "pendente"
                                          ? "bg-[#FFF4C2] text-[#9A7800]"
                                          : "bg-[#DDF7EA] text-[#007A2E]"
                                      }`}
                                    >
                                      {indicador.codigo} •{" "}
                                      {indicador.status === "pendente"
                                        ? "Pendente"
                                        : "Concluído"}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {paciente.indicadores.length === 0 && (
                                <p className="mt-1 text-[8px] text-gray-400">
                                  Clique para consultar a situação dos indicadores.
                                </p>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()
              )}
            </div>
            <div className="border-t border-gray-100 px-5 py-3"><button type="button" onClick={() => { setModalSituacaoAberto(false); setSituacaoSelecionada(null); }} className="w-full rounded-xl bg-[#003B8E] px-4 py-2.5 text-[10px] font-semibold text-white transition hover:bg-[#062B63]">Fechar</button></div>
          </div>
        </div>
      )}

      {pacienteSituacaoSelecionado && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div className="min-w-0 pr-3">
                <h3 className="text-sm font-bold text-[#062B63]">
                  Situação do paciente
                </h3>
                <p className="mt-1 truncate text-[9px] text-gray-400">
                  {pacienteSituacaoSelecionado.nome}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPacienteSituacaoSelecionado(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <div className="px-5 py-4">
              <div className="space-y-2">
                {(["C2", "C3", "C4", "C5", "C6", "C7"] as const).map(
                  (codigo) => {
                    const indicador =
                      pacienteSituacaoSelecionado.indicadores.find(
                        (item) => item.codigo === codigo,
                      );
                    const semRegistro =
                      pacienteSituacaoSelecionado.indicadoresSemRegistro?.includes(
                        codigo,
                      ) ?? false;

                    return (
                      <div
                        key={codigo}
                        className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
                      >
                        <span className="text-[10px] font-bold text-[#062B63]">
                          {codigo}
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-1 text-[8px] font-bold ${
                            indicador?.status === "pendente"
                              ? "bg-[#FFF4C2] text-[#9A7800]"
                              : indicador?.status === "concluido"
                                ? "bg-[#DDF7EA] text-[#007A2E]"
                                : semRegistro
                                  ? "bg-[#E8EDF2] text-[#5F6B76]"
                                  : "bg-gray-200 text-gray-500"
                          }`}
                        >
                          {indicador?.status === "pendente"
                            ? "Pendente"
                            : indicador?.status === "concluido"
                              ? "Concluído"
                              : semRegistro
                                ? "Sem registro"
                                : "Não aplicável"}
                        </span>
                      </div>
                    );
                  },
                )}
              </div>
            </div>

            <div className="border-t border-gray-100 px-5 py-3">
              <button
                type="button"
                onClick={() => setPacienteSituacaoSelecionado(null)}
                className="w-full rounded-xl bg-[#003B8E] px-4 py-2.5 text-[10px] font-semibold text-white transition hover:bg-[#062B63]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

  </main>
  );
}
