"use client";

import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  FileBarChart,
  FileText,
  Filter,
  History,
  Search,
  AlertCircle,
  Settings,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import LoadingBrasil360 from "@/components/ui/LoadingBrasil360";

type Importacao = {
  id: string;
  criadoEm: number;
  arquivoNome: string;
  tipo: string;
  codigoIndicadorOrigem: string;
  listaTematica: string;
  grupoCondicoes: string;
  filtroProblemas: string;
  quantidadeRegistros: number;
  novosPacientes: number;
  pacientesAtualizados: number;
  registrosIgnorados: number;
  processados: number;
  status: string;
  criadoPor: string;
  usuarioEmail: string;
  geradoEm: string;
};

type ResultadoHistorico = {
  sucesso: boolean;
  estatisticas?: {
    totalImportacoes: number;
    importacoesConcluidas: number;
    comPendencias: number;
    ultimaImportacao: {
      data: number;
      arquivoNome: string;
      status: string;
    } | null;
  };
  importacoes?: Importacao[];
  mensagem?: string;
};

function formatarData(timestamp: number) {
  if (!timestamp) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(timestamp));
}

function formatarDataHora(timestamp: number) {
  if (!timestamp) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function statusConcluida(status: string) {
  return status
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase() === "concluida";
}

function nomeTipo(tipo: string) {
  if (tipo === "Pacientes") return "Pacientes";
  return tipo;
}

function classeTipoPdf(tipo: string) {
  const valor = tipo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (valor.includes("c1") || valor.includes("mais acesso")) return "pdf-c1";
  if (valor.includes("c2") || valor.includes("infantil")) return "pdf-c2";
  if (valor.includes("c3") || valor.includes("gesta")) return "pdf-c3";
  if (valor.includes("c4") || valor.includes("diabet")) return "pdf-c4";
  if (valor.includes("c5") || valor.includes("hipertens")) return "pdf-c5";
  if (valor.includes("c6") || valor.includes("idos")) return "pdf-c6";
  if (valor.includes("c7") || valor.includes("mulher")) return "pdf-c7";
  if (valor.includes("bucal")) return "pdf-bucal";
  if (valor.includes("situacao") || valor.includes("situacao dos pacientes")) return "pdf-situacao";
  if (valor.includes("paciente")) return "pdf-pacientes";

  return "pdf-default";
}

function estiloTipo(tipo: string) {
  const valor = tipo.toLowerCase();

  if (valor.includes("c1") || valor.includes("mais acesso")) {
    return {
      badge: "bg-orange-100 text-orange-700 ring-1 ring-orange-200",
      linha: "border-l-4 border-l-orange-300 bg-orange-50/20",
    };
  }

  if (valor.includes("c2") || valor.includes("infantil")) {
    return {
      badge: "bg-blue-100 text-blue-700 ring-1 ring-blue-200",
      linha: "border-l-4 border-l-blue-300 bg-blue-50/20",
    };
  }

  if (valor.includes("c3") || valor.includes("gesta")) {
    return {
      badge: "bg-pink-100 text-pink-700 ring-1 ring-pink-200",
      linha: "border-l-4 border-l-pink-300 bg-pink-50/20",
    };
  }

  if (valor.includes("c4") || valor.includes("diabet")) {
    return {
      badge: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
      linha: "border-l-4 border-l-amber-300 bg-amber-50/20",
    };
  }

  if (valor.includes("c5") || valor.includes("hipertens")) {
    return {
      badge: "bg-red-100 text-red-700 ring-1 ring-red-200",
      linha: "border-l-4 border-l-red-300 bg-red-50/20",
    };
  }

  if (valor.includes("c6") || valor.includes("idos")) {
    return {
      badge: "bg-violet-100 text-violet-700 ring-1 ring-violet-200",
      linha: "border-l-4 border-l-violet-300 bg-violet-50/20",
    };
  }

  if (valor.includes("c7") || valor.includes("mulher")) {
    return {
      badge: "bg-fuchsia-100 text-fuchsia-700 ring-1 ring-fuchsia-200",
      linha: "border-l-4 border-l-fuchsia-300 bg-fuchsia-50/20",
    };
  }

  if (valor.includes("bucal")) {
    return {
      badge: "bg-teal-100 text-teal-700 ring-1 ring-teal-200",
      linha: "border-l-4 border-l-teal-300 bg-teal-50/20",
    };
  }

  if (valor.includes("situa")) {
    return {
      badge: "bg-cyan-100 text-cyan-700 ring-1 ring-cyan-200",
      linha: "border-l-4 border-l-cyan-300 bg-cyan-50/20",
    };
  }

  return {
    badge: "bg-purple-100 text-purple-700 ring-1 ring-purple-200",
    linha: "border-l-4 border-l-purple-300 bg-purple-50/20",
  };
}

export default function HistoricoPage() {
  const router = useRouter();
  const { usuario, ubs, carregando } = useAuth();

  const [dados, setDados] = useState<ResultadoHistorico | null>(null);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);
  const [erro, setErro] = useState("");

  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("Todos");
  const [statusFiltro, setStatusFiltro] = useState("Todos");
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [pagina, setPagina] = useState(1);
  const [selecionada, setSelecionada] = useState<Importacao | null>(null);

  const porPagina = 10;

  // Redirecionamento de autenticação fica separado do carregamento da página.
  // Isso evita atualizar o Router durante o render do componente.
  useEffect(() => {
    if (carregando) return;

    if (!usuario) {
      router.replace("/login");
      return;
    }

    if (usuario.perfil !== "enfermeira") {
      router.replace("/acs");
    }
  }, [carregando, usuario, router]);

  // Carrega somente o histórico depois que a autenticação/perfil estiverem resolvidos.
  useEffect(() => {
    if (carregando || !usuario || usuario.perfil !== "enfermeira") return;

    async function carregar() {
      try {
        setCarregandoHistorico(true);
        setErro("");

        const usuarioFirebase = auth.currentUser;

        if (!usuarioFirebase) {
          throw new Error("Sessão de autenticação não encontrada.");
        }

        const token = await usuarioFirebase.getIdToken();

        const resposta = await fetch("/api/dashboard/historico", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const resultado: ResultadoHistorico = await resposta.json();

        if (!resposta.ok || !resultado.sucesso) {
          throw new Error(
            resultado.mensagem || "Não foi possível carregar o histórico.",
          );
        }

        setDados(resultado);

        if (resultado.importacoes?.length) {
          setSelecionada(resultado.importacoes[0]);
        } else {
          setSelecionada(null);
        }
      } catch (error) {
        setErro(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o histórico.",
        );
      } finally {
        setCarregandoHistorico(false);
      }
    }

    carregar();
  }, [carregando, usuario]);

  const tipos = useMemo(() => {
    const lista = dados?.importacoes ?? [];
    return ["Todos", ...Array.from(new Set(lista.map((item) => item.tipo)))];
  }, [dados]);

  const filtradas = useMemo(() => {
    const lista = dados?.importacoes ?? [];
    const texto = busca.trim().toLowerCase();

    return lista.filter((item) => {
      const correspondeBusca =
        !texto ||
        item.arquivoNome.toLowerCase().includes(texto) ||
        item.usuarioEmail.toLowerCase().includes(texto) ||
        item.listaTematica.toLowerCase().includes(texto) ||
        item.tipo.toLowerCase().includes(texto);

      const correspondeTipo =
        tipoFiltro === "Todos" || item.tipo === tipoFiltro;

      const concluida = statusConcluida(item.status);

      const correspondeStatus =
        statusFiltro === "Todos" ||
        (statusFiltro === "Concluídas" && concluida) ||
        (statusFiltro === "Pendentes" && !concluida);

      const data = new Date(item.criadoEm);
      const inicio = dataInicial
        ? new Date(`${dataInicial}T00:00:00`)
        : null;
      const fim = dataFinal
        ? new Date(`${dataFinal}T23:59:59.999`)
        : null;

      const correspondePeriodo =
        (!inicio || data >= inicio) && (!fim || data <= fim);

      return (
        correspondeBusca &&
        correspondeTipo &&
        correspondeStatus &&
        correspondePeriodo
      );
    });
  }, [dados, busca, tipoFiltro, statusFiltro, dataInicial, dataFinal]);

  const totalRegistrosProcessados = useMemo(
    () => filtradas.reduce((total, item) => total + (item.processados || 0), 0),
    [filtradas],
  );

  const totalPaginas = Math.max(
    1,
    Math.ceil(filtradas.length / porPagina),
  );

  const paginaAtual = Math.min(pagina, totalPaginas);

  const exibidas = filtradas.slice(
    (paginaAtual - 1) * porPagina,
    paginaAtual * porPagina,
  );

  useEffect(() => {
    setPagina(1);
  }, [busca, tipoFiltro, statusFiltro, dataInicial, dataFinal]);

  useEffect(() => {
    if (
      selecionada &&
      !filtradas.some((item) => item.id === selecionada.id)
    ) {
      setSelecionada(filtradas[0] ?? null);
    }
  }, [filtradas, selecionada]);

  function limparFiltros() {
    setBusca("");
    setTipoFiltro("Todos");
    setStatusFiltro("Todos");
    setDataInicial("");
    setDataFinal("");
  }

  function selecionar(item: Importacao) {
    setSelecionada(item);
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }

  function exportarResumo() {
    const tituloOriginal = document.title;
    document.title = `Historico de Importacoes - Brasil 360`;

    window.setTimeout(() => {
      window.print();
      document.title = tituloOriginal;
    }, 50);
  }

  if (carregando || carregandoHistorico) {
  return (
    <LoadingBrasil360
      mensagem="Carregando histórico..."
      subtitulo="Buscando as importações da UBS"
    />
  );
}

  if (!usuario) return null;

  const estatisticas = dados?.estatisticas ?? {
    totalImportacoes: 0,
    importacoesConcluidas: 0,
    comPendencias: 0,
    ultimaImportacao: null,
  };

  const percentualPendencias =
    estatisticas.totalImportacoes > 0
      ? (estatisticas.comPendencias / estatisticas.totalImportacoes) * 100
      : 0;

  return (
    <main className="min-h-screen bg-[#F8F7FC] text-[#211A4A] print:bg-white">
      <div className="mx-auto min-h-screen max-w-[1500px] lg:flex">
        {/* SIDEBAR */}
        <aside className="hidden w-[190px] shrink-0 flex-col border-r border-[#E8E1F5] bg-white lg:flex print:hidden">
          <div className="border-b border-[#E8E1F5] px-4 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#003B8E] text-white shadow-[0_3px_8px_rgba(0,59,142,0.22)]">
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
            <p className="mt-4 text-[8px] font-bold uppercase tracking-wide text-[#6D28D9]">
              Enfermeira Gestora
            </p>
          </div>

          <nav className="flex-1 px-3 py-4">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[10px] text-gray-500 transition hover:bg-[#F4F0FF]"
            >
              <FileBarChart size={15} />
              Início
            </button>

            <button
              type="button"
              onClick={() => router.push("/equipe")}
              className="mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[10px] text-gray-500 transition hover:bg-[#F4F0FF]"
            >
              <Upload size={15} />
              Equipe
            </button>

            <button
              type="button"
              className="mb-2 flex w-full items-center gap-3 rounded-lg bg-[#EDE9FE] px-3 py-3 text-left text-[10px] font-semibold text-[#6D28D9]"
            >
              <History size={15} />
              Histórico
            </button>

            <button
              type="button"
              onClick={() => router.push("/config")}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[10px] text-gray-500 transition hover:bg-[#F4F0FF]"
            >
              <Settings size={15} />
              Config
            </button>
          </nav>
        </aside>

        {/* CONTEÚDO */}
        <section className="min-w-0 flex-1 pb-20 lg:pb-0">
          <header>
            <div className="relative isolate overflow-hidden rounded-b-[28px] border border-emerald-200/60 bg-gradient-to-br from-[#009C3B]/95 via-[#00A9E8]/85 to-[#F2C300]/85 px-8 py-6 text-white shadow-[0_12px_30px_rgba(0,156,59,0.18),0_5px_12px_rgba(0,59,142,0.12)] backdrop-blur-md">
              <div className="pointer-events-none absolute -left-10 -top-14 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
              <div className="pointer-events-none absolute right-8 -top-16 h-40 w-40 rounded-full bg-[#F2C300]/25 blur-3xl" />
              <div className="pointer-events-none absolute bottom-[-70px] left-1/2 h-40 w-64 -translate-x-1/2 rounded-full bg-[#00A9E8]/20 blur-3xl" />

              <div className="relative">
                <p className="text-[11px] font-semibold text-white/85">
                  Enfermeira Gestora
                </p>

                <h1 className="mt-1 text-2xl font-bold tracking-tight drop-shadow-sm">
                  Histórico
                </h1>

                <p className="mt-1 text-[10px] text-white/90">
                  {ubs?.nome || "UBS"} • {ubs?.municipio || ""} {ubs?.uf ? `• ${ubs.uf}` : ""}
                </p>
              </div>
            </div>
          </header>

          <div className="px-5 pt-5 pb-8 sm:px-7 print:hidden">
            {erro && (
              <div className="mb-4 flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-red-600">
                <AlertCircle size={18} />
                <p className="text-[10px] font-semibold">{erro}</p>
              </div>
            )}

            {/* CARDS */}
            <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <div className="relative overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-blue-50 p-4 shadow-[0_5px_12px_rgba(124,58,237,0.12),0_2px_4px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_14px_26px_rgba(124,58,237,0.18),0_5px_10px_rgba(0,0,0,0.08)]">
                <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-blue-200/40 blur-xl" />
                <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#6D28D9] to-[#2563EB] shadow-[0_5px_10px_rgba(109,40,217,0.28)]">
                  <History size={17} className="text-white" />
                </div>
                <p className="relative mt-3 text-2xl font-bold text-[#211A4A]">
                  {estatisticas.totalImportacoes}
                </p>
                <p className="relative mt-1 text-[9px] font-semibold text-[#5B21B6]">
                  Total de importações
                </p>
                <p className="relative mt-1 text-[8px] text-[#7C3AED]">
                  Todas as importações
                </p>
              </div>

              <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-green-50 p-4 shadow-[0_5px_12px_rgba(16,185,129,0.12),0_2px_4px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_14px_26px_rgba(16,185,129,0.18),0_5px_10px_rgba(0,0,0,0.08)]">
                <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-emerald-200/40 blur-xl" />
                <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 shadow-[0_5px_10px_rgba(16,185,129,0.25)]">
                  <CheckCircle2 size={17} className="text-white" />
                </div>
                <p className="relative mt-3 text-2xl font-bold text-emerald-900">
                  {totalRegistrosProcessados.toLocaleString("pt-BR")}
                </p>
                <p className="relative mt-1 text-[9px] font-semibold text-emerald-700/80">
                  Registros processados
                </p>
                <p className="relative mt-1 text-[8px] font-bold text-emerald-500">
                  Soma dos registros processados
                </p>
              </div>

              <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-4 shadow-[0_5px_12px_rgba(245,158,11,0.12),0_2px_4px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_14px_26px_rgba(245,158,11,0.18),0_5px_10px_rgba(0,0,0,0.08)]">
                <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-amber-200/40 blur-xl" />
                <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 shadow-[0_5px_10px_rgba(245,158,11,0.25)]">
                  <AlertCircle size={17} className="text-white" />
                </div>
                <p className="relative mt-3 text-2xl font-bold text-yellow-900">
                  {estatisticas.comPendencias}
                </p>
                <p className="relative mt-1 text-[9px] font-semibold text-yellow-800/80">
                  Com pendências
                </p>
                <p className="relative mt-1 text-[8px] font-bold text-yellow-700">
                  {percentualPendencias.toFixed(1)}% do total
                </p>
              </div>

              <div className="relative overflow-hidden rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-4 shadow-[0_5px_12px_rgba(6,182,212,0.12),0_2px_4px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_14px_26px_rgba(6,182,212,0.18),0_5px_10px_rgba(0,0,0,0.08)]">
                <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-sky-200/40 blur-xl" />
                <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 shadow-[0_5px_10px_rgba(6,182,212,0.25)]">
                  <CalendarDays size={17} className="text-white" />
                </div>
                <p className="relative mt-3 text-sm font-bold text-[#211A4A]">
                  {estatisticas.ultimaImportacao
                    ? formatarData(estatisticas.ultimaImportacao.data)
                    : "—"}
                </p>
                <p className="relative mt-1 text-[9px] font-semibold text-cyan-800/80">
                  Última importação
                </p>
                <p className="relative mt-1 truncate text-[8px] text-cyan-700">
                  {estatisticas.ultimaImportacao?.arquivoNome || "Nenhuma"}
                </p>
              </div>
            </section>

            {/* FILTROS */}
            <section className="mt-4 rounded-2xl border border-violet-200 bg-gradient-to-br from-white via-white to-violet-50/70 p-4 shadow-[0_5px_14px_rgba(124,58,237,0.08)]">
              <div className="mb-3 flex items-center gap-2">
                <Filter size={14} className="text-[#6D28D9]" />
                <h2 className="text-[10px] font-bold">Filtros</h2>
                <button
                  type="button"
                  onClick={limparFiltros}
                  className="ml-auto text-[8px] font-semibold text-[#6D28D9]"
                >
                  Limpar filtros
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <label className="block">
                  <span className="mb-1.5 block text-[8px] font-semibold text-gray-500">
                    Período inicial
                  </span>
                  <div className="relative">
                    <CalendarDays
                      size={13}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="date"
                      value={dataInicial}
                      onChange={(e) => setDataInicial(e.target.value)}
                      className="h-9 w-full rounded-lg border border-gray-200 bg-[#F8FBFD] pl-9 pr-2 text-[9px] outline-none focus:border-[#7C3AED]"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[8px] font-semibold text-gray-500">
                    Período final
                  </span>
                  <div className="relative">
                    <CalendarDays
                      size={13}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="date"
                      value={dataFinal}
                      onChange={(e) => setDataFinal(e.target.value)}
                      className="h-9 w-full rounded-lg border border-gray-200 bg-[#F8FBFD] pl-9 pr-2 text-[9px] outline-none focus:border-[#7C3AED]"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[8px] font-semibold text-gray-500">
                    Tipo de importação
                  </span>
                  <select
                    value={tipoFiltro}
                    onChange={(e) => setTipoFiltro(e.target.value)}
                    className="h-9 w-full rounded-lg border border-gray-200 bg-[#F8FBFD] px-3 text-[9px] outline-none focus:border-[#7C3AED]"
                  >
                    {tipos.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {tipo}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[8px] font-semibold text-gray-500">
                    Status
                  </span>
                  <select
                    value={statusFiltro}
                    onChange={(e) => setStatusFiltro(e.target.value)}
                    className="h-9 w-full rounded-lg border border-gray-200 bg-[#F8FBFD] px-3 text-[9px] outline-none focus:border-[#7C3AED]"
                  >
                    <option value="Todos">Todos</option>
                    <option value="Concluídas">Concluídas</option>
                    <option value="Pendentes">Pendentes</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[8px] font-semibold text-gray-500">
                    Buscar
                  </span>
                  <div className="relative">
                    <Search
                      size={13}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="search"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Arquivo, usuário ou temática..."
                      className="h-9 w-full rounded-lg border border-gray-200 bg-[#F8FBFD] pl-9 pr-3 text-[9px] outline-none placeholder:text-gray-400 focus:border-[#7C3AED]"
                    />
                  </div>
                </label>
              </div>
            </section>

            {/* TABELA */}
            <section className="mt-4 overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-[0_5px_14px_rgba(124,58,237,0.08)]">
              <div className="flex items-center justify-between border-b border-violet-100 bg-gradient-to-r from-blue-50/70 via-white to-indigo-50/50 px-4 py-3">
                <div>
                  <h2 className="text-[11px] font-bold text-[#211A4A]">Importações</h2>
                  <p className="mt-0.5 text-[8px] text-gray-400">
                    {filtradas.length} registro(s) encontrado(s)
                  </p>
                </div>

                <div className="flex items-center gap-2 text-[8px] text-gray-400">
                  <span>
                    Página {paginaAtual} de {totalPaginas}
                  </span>
                </div>
              </div>

              {exibidas.length === 0 ? (
                <div className="px-5 py-14 text-center">
                  <FileText className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-3 text-xs font-semibold text-gray-500">
                    Nenhuma importação encontrada
                  </p>
                  <p className="mt-1 text-[9px] text-gray-400">
                    Tente remover ou alterar os filtros.
                  </p>
                </div>
              ) : (
                <>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[900px] border-collapse">
                      <thead>
                        <tr className="bg-[#F8FBFD] text-left">
                          {[
                            "Data",
                            "Arquivo",
                            "Tipo",
                            "Registros",
                            "Novos",
                            "Atualizados",
                            "Ignorados",
                            "Status",
                            "Usuário",
                            "Ações",
                          ].map((titulo) => (
                            <th
                              key={titulo}
                              className="border-b border-[#E8E1F5] px-3 py-3 text-[8px] font-bold text-gray-500"
                            >
                              {titulo}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {exibidas.map((item) => {
                          const concluida = statusConcluida(item.status);
                          const tipoVisual = estiloTipo(item.tipo);

                          return (
                            <tr
                              key={item.id}
                              className={`${tipoVisual.linha} border-b border-gray-100 transition hover:bg-white hover:shadow-[inset_0_0_0_9999px_rgba(124,58,237,0.025)]`}
                            >
                              <td className="whitespace-nowrap px-3 py-3 text-[8px] text-gray-600">
                                <div className="font-semibold">
                                  {formatarData(item.criadoEm)}
                                </div>
                                <div className="mt-0.5 text-gray-400">
                                  {new Date(item.criadoEm).toLocaleTimeString(
                                    "pt-BR",
                                    {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  )}
                                </div>
                              </td>

                              <td className="max-w-[180px] px-3 py-3">
                                <p className="truncate text-[9px] font-semibold text-[#12325B]">
                                  {item.arquivoNome}
                                </p>
                                <p className="mt-0.5 truncate text-[7px] text-gray-400">
                                  {item.listaTematica || "PEC"}
                                </p>
                              </td>

                              <td className="px-3 py-3">
                                <span className={`inline-flex rounded-full px-2 py-1 text-[7px] font-bold ${tipoVisual.badge}`}>
                                  {nomeTipo(item.tipo)}
                                </span>
                              </td>

                              <td className="px-3 py-3 text-[9px] font-bold text-slate-700">
                                {item.quantidadeRegistros}
                              </td>

                              <td className="px-3 py-3 text-[9px] font-bold text-emerald-600">
                                {item.novosPacientes}
                              </td>

                              <td className="px-3 py-3 text-[9px] font-bold text-sky-600">
                                {item.pacientesAtualizados}
                              </td>

                              <td className={`px-3 py-3 text-[9px] font-bold ${item.registrosIgnorados > 0 ? "text-orange-600" : "text-slate-400"}`}>
                                {item.registrosIgnorados}
                              </td>

                              <td className="px-3 py-3">
                                {concluida ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-[#D1FAE5] px-2 py-1 text-[7px] font-bold text-[#047857]">
                                    <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                                    Concluída
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF3C7] px-2 py-1 text-[7px] font-bold text-[#B45309]">
                                    <span className="h-1.5 w-1.5 rounded-full bg-[#F59E0B]" />
                                    {item.status}
                                  </span>
                                )}
                              </td>

                              <td className="max-w-[145px] px-3 py-3">
                                <p className="truncate text-[8px] text-gray-500">
                                  {item.usuarioEmail}
                                </p>
                              </td>

                              <td className="px-3 py-3">
                                <button
                                  type="button"
                                  onClick={() => selecionar(item)}
                                  className="rounded-lg border border-[#E8E1F5] p-2 text-gray-400 transition hover:bg-[#E8F3FA] hover:text-[#6D28D9]"
                                  title="Ver detalhes"
                                >
                                  <Eye size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* MOBILE / TABLET */}
                  <div className="divide-y divide-gray-100 md:hidden">
                    {exibidas.map((item) => {
                      const concluida = statusConcluida(item.status);
                      const tipoVisual = estiloTipo(item.tipo);

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => selecionar(item)}
                          className="block w-full p-4 text-left transition hover:bg-[#FCFBFF]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[10px] font-bold">
                                {item.arquivoNome}
                              </p>
                              <p className="mt-1 text-[8px] text-gray-400">
                                {formatarDataHora(item.criadoEm)}
                              </p>
                            </div>

                            <span
                              className={
                                concluida
                                  ? "shrink-0 rounded-full bg-[#D1FAE5] px-2 py-1 text-[7px] font-bold text-[#047857]"
                                  : "shrink-0 rounded-full bg-[#FEF3C7] px-2 py-1 text-[7px] font-bold text-[#B45309]"
                              }
                            >
                              {concluida ? "Concluída" : item.status}
                            </span>
                          </div>

                          <div className="mt-3 grid grid-cols-4 gap-2">
                            <div className="rounded-lg bg-slate-50 p-2 ring-1 ring-slate-100">
                              <p className="text-[7px] text-gray-400">
                                Registros
                              </p>
                              <p className="mt-0.5 text-[10px] font-bold">
                                {item.quantidadeRegistros}
                              </p>
                            </div>
                            <div className="rounded-lg bg-emerald-50 p-2 ring-1 ring-emerald-100">
                              <p className="text-[7px] text-gray-400">Novos</p>
                              <p className="mt-0.5 text-[10px] font-bold text-[#10B981]">
                                {item.novosPacientes}
                              </p>
                            </div>
                            <div className="rounded-lg bg-sky-50 p-2 ring-1 ring-sky-100">
                              <p className="text-[7px] text-gray-400">
                                Atualizados
                              </p>
                              <p className="mt-0.5 text-[10px] font-bold">
                                {item.pacientesAtualizados}
                              </p>
                            </div>
                            <div className="rounded-lg bg-orange-50 p-2 ring-1 ring-orange-100">
                              <p className="text-[7px] text-gray-400">
                                Ignorados
                              </p>
                              <p className="mt-0.5 text-[10px] font-bold">
                                {item.registrosIgnorados}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <span className={`rounded-full px-2 py-1 text-[7px] font-bold ${tipoVisual.badge}`}>
                              {item.tipo}
                            </span>
                            <ChevronRight
                              size={14}
                              className="text-gray-300"
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* PAGINAÇÃO */}
                  <div className="flex items-center justify-between border-t border-[#E8E1F5] px-4 py-3">
                    <p className="text-[8px] text-gray-400">
                      Mostrando{" "}
                      {filtradas.length === 0
                        ? 0
                        : (paginaAtual - 1) * porPagina + 1}{" "}
                     –{" "}
                      {Math.min(paginaAtual * porPagina, filtradas.length)}{" "}
                      de {filtradas.length}
                    </p>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={paginaAtual <= 1}
                        onClick={() => setPagina((valor) => valor - 1)}
                        className="rounded-lg border border-gray-200 p-1.5 text-gray-500 disabled:opacity-30"
                      >
                        <ChevronLeft size={13} />
                      </button>

                      <button
                        type="button"
                        disabled={paginaAtual >= totalPaginas}
                        onClick={() => setPagina((valor) => valor + 1)}
                        className="rounded-lg border border-gray-200 p-1.5 text-gray-500 disabled:opacity-30"
                      >
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>

            {/* DETALHES */}
            {selecionada && (
              <section className="mt-4 overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-[0_5px_14px_rgba(124,58,237,0.08)]">
                <div className="flex items-start justify-between gap-4 border-b border-violet-100 bg-gradient-to-r from-blue-50/70 via-white to-cyan-50/40 p-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E8F3FA]">
                      <FileText size={17} className="text-[#6D28D9]" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-[11px] font-bold">
                        Detalhes da importação
                      </h2>
                      <p className="mt-1 truncate text-[8px] text-gray-400">
                        {selecionada.arquivoNome}
                      </p>
                    </div>
                  </div>

                  <span
                    className={
                      statusConcluida(selecionada.status)
                        ? "shrink-0 rounded-full bg-[#D1FAE5] px-2 py-1 text-[7px] font-bold text-[#047857]"
                        : "shrink-0 rounded-full bg-[#FEF3C7] px-2 py-1 text-[7px] font-bold text-[#B45309]"
                    }
                  >
                    {statusConcluida(selecionada.status)
                      ? "Concluída"
                      : selecionada.status}
                  </span>
                </div>

                <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl bg-sky-50 p-3 ring-1 ring-sky-100">
                    <p className="text-[8px] font-semibold text-sky-500">Data</p>
                    <p className="mt-1 text-[9px] font-bold">
                      {formatarDataHora(selecionada.criadoEm)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-blue-50 p-3 ring-1 ring-blue-100">
                    <p className="text-[8px] font-semibold text-[#7C3AED]">Tipo</p>
                    <p className="mt-1 text-[9px] font-bold">
                      {selecionada.tipo}
                    </p>
                  </div>

                  <div className="rounded-xl bg-fuchsia-50 p-3 ring-1 ring-fuchsia-100">
                    <p className="text-[8px] font-semibold text-fuchsia-500">Usuário</p>
                    <p className="mt-1 truncate text-[9px] font-bold">
                      {selecionada.usuarioEmail}
                    </p>
                  </div>

                  <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-100">
                    <p className="text-[8px] font-semibold text-emerald-500">Registros</p>
                    <p className="mt-1 text-[9px] font-bold">
                      {selecionada.quantidadeRegistros}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-gray-100 bg-slate-50/40 p-4 sm:grid-cols-4">
                  <div className="rounded-xl bg-blue-50 p-3 ring-1 ring-blue-100">
                    <p className="text-[8px] font-semibold text-[#7C3AED]">Processados</p>
                    <p className="mt-1 text-sm font-bold">
                      {selecionada.processados}
                    </p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-100">
                    <p className="text-[8px] font-semibold text-emerald-500">Novos pacientes</p>
                    <p className="mt-1 text-sm font-bold text-[#10B981]">
                      {selecionada.novosPacientes}
                    </p>
                  </div>
                  <div className="rounded-xl bg-sky-50 p-3 ring-1 ring-sky-100">
                    <p className="text-[8px] font-semibold text-sky-500">
                      Pacientes atualizados
                    </p>
                    <p className="mt-1 text-sm font-bold">
                      {selecionada.pacientesAtualizados}
                    </p>
                  </div>
                  <div className="rounded-xl bg-orange-50 p-3 ring-1 ring-orange-100">
                    <p className="text-[8px] font-semibold text-orange-500">Ignorados</p>
                    <p className="mt-1 text-sm font-bold text-gray-500">
                      {selecionada.registrosIgnorados}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 border-t border-gray-100 p-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-violet-100 bg-violet-50/30 p-3">
                    <p className="text-[8px] font-bold text-[#6D28D9]">
                      Lista temática
                    </p>
                    <p className="mt-1 text-[9px] text-gray-600">
                      {selecionada.listaTematica || "Não informado"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-violet-100 bg-violet-50/30 p-3">
                    <p className="text-[8px] font-bold text-[#2563EB]">
                      Grupo de condições
                    </p>
                    <p className="mt-1 text-[9px] text-gray-600">
                      {selecionada.grupoCondicoes || "Não informado"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3 sm:col-span-2">
                    <p className="text-[8px] font-bold text-emerald-600">
                      Filtro de problemas
                    </p>
                    <p className="mt-1 text-[9px] text-gray-600">
                      {selecionada.filtroProblemas || "Não informado"}
                    </p>
                  </div>
                </div>

                <div className="border-t border-gray-100 bg-[#F8FBFD] p-4">
                  <div className="flex items-center gap-2">
                    <Clock3 size={13} className="text-[#6D28D9]" />
                    <p className="text-[8px] text-gray-500">
                      Registro preservado no histórico da importação do PEC.
                    </p>
                  </div>
                </div>
              </section>
            )}
          </div>
        </section>
      </div>

      {/* VERSÃO DO HISTÓRICO PARA IMPRESSÃO / PDF */}
      <section className="hidden print:block print-report" aria-hidden="true">
        <div className="print-report-header">
          <div>
            <p className="print-brand">BRASIL 360 • INDICADORES UBS</p>
            <h1>Histórico de Importações</h1>
            <p className="print-subtitle">
              Registro das importações e processamentos de dados da UBS
            </p>
          </div>
          <div className="print-date">
            <strong>Emitido em</strong>
            <span>{formatarDataHora(Date.now())}</span>
          </div>
        </div>

        <div className="print-summary-grid">
          <div className="print-summary-card purple">
            <span>Total de importações</span>
            <strong>{estatisticas.totalImportacoes}</strong>
            <small>Todas as importações</small>
          </div>
          <div className="print-summary-card green">
            <span>Registros processados</span>
            <strong>{totalRegistrosProcessados.toLocaleString("pt-BR")}</strong>
            <small>Soma dos registros processados</small>
          </div>
          <div className="print-summary-card orange">
            <span>Com pendências</span>
            <strong>{estatisticas.comPendencias}</strong>
            <small>{percentualPendencias.toFixed(1)}% do total</small>
          </div>
          <div className="print-summary-card blue">
            <span>Última importação</span>
            <strong>
              {estatisticas.ultimaImportacao
                ? formatarData(estatisticas.ultimaImportacao.data)
                : "—"}
            </strong>
            <small>{estatisticas.ultimaImportacao?.arquivoNome || "Nenhuma"}</small>
          </div>
        </div>

        <div className="print-filters">
          <div>
            <strong>Filtros aplicados</strong>
            <span>
              Período: {dataInicial ? formatarData(new Date(`${dataInicial}T00:00:00`).getTime()) : "Todos"}
              {" → "}
              {dataFinal ? formatarData(new Date(`${dataFinal}T00:00:00`).getTime()) : "Todos"}
            </span>
          </div>
          <div>
            <strong>Tipo</strong>
            <span>{tipoFiltro}</span>
          </div>
          <div>
            <strong>Status</strong>
            <span>{statusFiltro}</span>
          </div>
          <div>
            <strong>Busca</strong>
            <span>{busca.trim() || "Sem busca"}</span>
          </div>
        </div>

        <div className="print-section-title">
          <div>
            <h2>Importações</h2>
            <p>{filtradas.length} registro(s) encontrado(s)</p>
          </div>
          <span>Página completa</span>
        </div>

        {filtradas.length === 0 ? (
          <div className="print-empty">Nenhuma importação encontrada para os filtros selecionados.</div>
        ) : (
          <table className="print-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Arquivo</th>
                <th>Tipo</th>
                <th>Registros</th>
                <th>Novos</th>
                <th>Atualizados</th>
                <th>Ignorados</th>
                <th>Status</th>
                <th>Usuário</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((item) => (
                <tr key={`print-${item.id}`}>
                  <td>{formatarDataHora(item.criadoEm)}</td>
                  <td className="print-file">{item.arquivoNome}</td>
                  <td>
                    <span className={`print-type ${classeTipoPdf(item.tipo)}`}>{item.tipo}</span>
                  </td>
                  <td className="num">{item.quantidadeRegistros}</td>
                  <td className="num green-text">{item.novosPacientes}</td>
                  <td className="num blue-text">{item.pacientesAtualizados}</td>
                  <td className={`num ${item.registrosIgnorados > 0 ? "orange-text" : "muted-text"}`}>
                    {item.registrosIgnorados}
                  </td>
                  <td>
                    <span className={statusConcluida(item.status) ? "print-status done" : "print-status pending"}>
                      {statusConcluida(item.status) ? "Concluída" : item.status}
                    </span>
                  </td>
                  <td>{item.usuarioEmail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {selecionada && (
          <div className="print-details print-details-page">
            <div className="print-section-title">
              <div>
                <h2>Detalhes da importação</h2>
                <p>{selecionada.arquivoNome}</p>
              </div>
              <span className="print-status done">{statusConcluida(selecionada.status) ? "Concluída" : selecionada.status}</span>
            </div>

            <div className="print-detail-grid">
              <div><strong>Data</strong><span>{formatarDataHora(selecionada.criadoEm)}</span></div>
              <div><strong>Tipo</strong><span>{selecionada.tipo}</span></div>
              <div><strong>Usuário</strong><span>{selecionada.usuarioEmail}</span></div>
              <div><strong>Registros</strong><span>{selecionada.quantidadeRegistros}</span></div>
              <div><strong>Processados</strong><span>{selecionada.processados}</span></div>
              <div><strong>Novos pacientes</strong><span>{selecionada.novosPacientes}</span></div>
              <div><strong>Pacientes atualizados</strong><span>{selecionada.pacientesAtualizados}</span></div>
              <div><strong>Ignorados</strong><span>{selecionada.registrosIgnorados}</span></div>
            </div>

            <div className="print-meta-grid">
              <div><strong>Lista temática</strong><span>{selecionada.listaTematica || "Não informado"}</span></div>
              <div><strong>Grupo de condições</strong><span>{selecionada.grupoCondicoes || "Não informado"}</span></div>
              <div><strong>Filtro de problemas</strong><span>{selecionada.filtroProblemas || "Não informado"}</span></div>
            </div>

            <p className="print-footer-note">
              Registro preservado no histórico da importação do PEC.
            </p>
          </div>
        )}

        <div className="print-page-footer">
          <span>Brasil 360 • Histórico de Importações</span>
          <span>Documento gerado pelo sistema</span>
        </div>
      </section>

      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm 11mm;
          }

          html,
          body {
            background: #ffffff !important;
            color: #211a4a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body {
            margin: 0 !important;
          }

          body > * {
            overflow: visible !important;
          }

          .print-page-footer::after {
            content: "Página " counter(page) " de " counter(pages);
            margin-left: 14px;
          }

          .print-report {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 9px;
          }

          .print-report-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 20px;
            border-bottom: 2px solid #7c3aed;
            padding-bottom: 10px;
            margin-bottom: 12px;
          }

          .print-brand {
            margin: 0 0 3px;
            color: #7c3aed;
            font-size: 8px;
            font-weight: 800;
            letter-spacing: 0.08em;
          }

          .print-report-header h1 {
            margin: 0;
            color: #211a4a;
            font-size: 20px;
            line-height: 1.1;
          }

          .print-subtitle {
            margin: 4px 0 0;
            color: #6b7280;
            font-size: 9px;
          }

          .print-date {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 3px;
            color: #6b7280;
            font-size: 8px;
          }

          .print-date strong {
            color: #7c3aed;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }

          .print-summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 7px;
            margin-bottom: 10px;
          }

          .print-summary-card {
            min-height: 58px;
            padding: 8px 10px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
          }

          .print-summary-card.purple { background: #f5f3ff; border-color: #ddd6fe; }
          .print-summary-card.green { background: #ecfdf5; border-color: #a7f3d0; }
          .print-summary-card.orange { background: #fffbeb; border-color: #fde68a; }
          .print-summary-card.blue { background: #eff6ff; border-color: #bfdbfe; }

          .print-summary-card span,
          .print-summary-card small {
            display: block;
            color: #6b7280;
            font-size: 7px;
          }

          .print-summary-card strong {
            display: block;
            margin: 4px 0 1px;
            color: #211a4a;
            font-size: 16px;
          }

          .print-summary-card.green strong { color: #047857; }
          .print-summary-card.orange strong { color: #b45309; }
          .print-summary-card.blue strong { color: #1d4ed8; }

          .print-filters {
            display: grid;
            grid-template-columns: 2fr 1fr 1fr 2fr;
            gap: 7px;
            padding: 8px 10px;
            margin-bottom: 10px;
            border: 1px solid #ddd6fe;
            border-radius: 8px;
            background: #faf9ff;
          }

          .print-filters div {
            display: flex;
            flex-direction: column;
            gap: 2px;
            min-width: 0;
          }

          .print-filters strong {
            color: #7c3aed;
            font-size: 7px;
          }

          .print-filters span {
            overflow: hidden;
            color: #4b5563;
            font-size: 8px;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .print-section-title {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin: 10px 0 5px;
            padding-bottom: 5px;
            border-bottom: 1px solid #e5e7eb;
          }

          .print-section-title h2 {
            margin: 0;
            color: #4c1d95;
            font-size: 11px;
          }

          .print-section-title p {
            margin: 2px 0 0;
            color: #9ca3af;
            font-size: 7px;
          }

          .print-section-title > span {
            color: #7c3aed;
            font-size: 7px;
            font-weight: 700;
          }

          .print-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            page-break-inside: auto;
          }

          .print-table thead {
            display: table-header-group;
          }

          .print-table th {
            padding: 7px 5px;
            border: 1px solid #ddd6fe;
            background: #f5f3ff;
            color: #4c1d95;
            font-size: 7px;
            font-weight: 800;
            text-align: left;
          }

          .print-table td {
            padding: 6px 5px;
            border: 1px solid #e5e7eb;
            color: #4b5563;
            font-size: 7.5px;
            vertical-align: middle;
            word-break: break-word;
          }

          .print-table tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .print-table th:nth-child(1) { width: 10%; }
          .print-table th:nth-child(2) { width: 19%; }
          .print-table th:nth-child(3) { width: 14%; }
          .print-table th:nth-child(4),
          .print-table th:nth-child(5),
          .print-table th:nth-child(6),
          .print-table th:nth-child(7) { width: 7%; text-align: center; }
          .print-table th:nth-child(8) { width: 9%; }
          .print-table th:nth-child(9) { width: 13%; }

          .print-table td.num { text-align: center; font-weight: 800; color: #211a4a; }
          .print-table td.green-text { color: #059669; }
          .print-table td.blue-text { color: #2563eb; }
          .print-table td.orange-text { color: #ea580c; }
          .print-table td.muted-text { color: #9ca3af; }
          .print-file { color: #211a4a !important; font-weight: 700; }

          .print-type,
          .print-status {
            display: inline-block;
            padding: 2px 5px;
            border-radius: 999px;
            font-size: 6px;
            font-weight: 800;
          }

          .print-type {
            background: #f3e8ff;
            color: #7c3aed;
          }

          .print-type.pdf-c1 { background: #ffedd5; color: #c2410c; }
          .print-type.pdf-c2 { background: #dbeafe; color: #1d4ed8; }
          .print-type.pdf-c3 { background: #fce7f3; color: #be185d; }
          .print-type.pdf-c4 { background: #fef3c7; color: #b45309; }
          .print-type.pdf-c5 { background: #fee2e2; color: #b91c1c; }
          .print-type.pdf-c6 { background: #ede9fe; color: #6d28d9; }
          .print-type.pdf-c7 { background: #fae8ff; color: #a21caf; }
          .print-type.pdf-bucal { background: #ccfbf1; color: #0f766e; }
          .print-type.pdf-situacao { background: #cffafe; color: #0e7490; }
          .print-type.pdf-pacientes { background: #dbeafe; color: #2563eb; }

          .print-status.done {
            background: #d1fae5;
            color: #047857;
          }

          .print-status.pending {
            background: #fef3c7;
            color: #b45309;
          }

          .print-details {
            margin-top: 12px;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .print-details-page {
            break-before: page;
            page-break-before: always;
          }

          .print-detail-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 6px;
          }

          .print-detail-grid > div,
          .print-meta-grid > div {
            display: flex;
            flex-direction: column;
            gap: 3px;
            padding: 7px 8px;
            border: 1px solid #e5e7eb;
            border-radius: 7px;
            background: #fafafa;
          }

          .print-detail-grid strong,
          .print-meta-grid strong {
            color: #7c3aed;
            font-size: 6px;
            text-transform: uppercase;
          }

          .print-detail-grid span,
          .print-meta-grid span {
            color: #374151;
            font-size: 8px;
            font-weight: 700;
          }

          .print-meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 6px;
            margin-top: 6px;
          }

          .print-footer-note {
            margin: 7px 0 0;
            padding-top: 6px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 7px;
          }

          .print-page-footer {
            display: flex;
            justify-content: space-between;
            margin-top: 10px;
            padding-top: 5px;
            border-top: 1px solid #ddd6fe;
            color: #9ca3af;
            font-size: 6px;
          }

          .print-empty {
            padding: 20px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            color: #6b7280;
            text-align: center;
          }
        }
      `}</style>

      {/* NAVEGAÇÃO INFERIOR — TABLET/CELULAR */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#E8E1F5] bg-white/95 px-3 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-4px_16px_rgba(33,26,74,0.08)] backdrop-blur lg:hidden print:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-around">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-gray-500"
          >
            <FileBarChart size={17} />
            <span className="text-[9px] font-medium">Início</span>
          </button>

          <button
            type="button"
            onClick={() => router.push("/equipe")}
            className="flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-gray-500"
          >
            <Upload size={17} />
            <span className="text-[9px] font-medium">Equipe</span>
          </button>

          <button
            type="button"
            className="flex min-w-[64px] flex-col items-center gap-1 rounded-xl bg-[#E8F3FA] px-3 py-2 text-[#6D28D9]"
          >
            <History size={17} />
            <span className="text-[9px] font-semibold">Histórico</span>
          </button>

          <button
            type="button"
            onClick={() => router.push("/config")}
            className="flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-gray-500"
          >
            <FileBarChart size={17} />
            <span className="text-[9px] font-medium">Config</span>
          </button>
        </div>
      </nav>
    </main>
  );
}
