"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ChevronDown, Info, Loader2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { onIdTokenChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

type Pratica = {
  codigo: "A" | "B" | "C" | "D" | "E" | "F";
  titulo: string;
  pontos: number;
  atingida: boolean;
  detalhe: string;
};

type Paciente = {
  id: string;
  nome: string;
  cpf: string;
  microarea: string;
  elegivel: boolean;
  motivoElegibilidade: string;
  pontuacao: number;
  classificacao: string;
  praticas: Pratica[];
};

type Relatorio = {
  possuiDados: boolean;
  mensagem?: string;
  importacao?: {
    arquivoNome: string;
    listaTematica: string;
    grupoCondicoes: string;
    filtroProblemas: string;
    geradoEm: string;
    quantidadeRegistros: number;
  };
  resumo?: {
    totalRegistros: number;
    totalElegiveis: number;
    pontuacao: number;
    classificacao: string;
    praticas: Record<"A" | "B" | "C" | "D" | "E" | "F", { atingidos: number; percentual: number }>;
  };
  pacientes?: Paciente[];
};

const TITULOS: Record<Pratica["codigo"], string> = {
  A: "Consulta médica/enfermagem",
  B: "Pressão arterial",
  C: "Peso + altura",
  D: "Visitas domiciliares",
  E: "Hemoglobina glicada",
  F: "Avaliação dos pés",
};

function classePontuacao(valor: number) {
  if (valor > 75) return "text-[#059669]";
  if (valor > 50) return "text-[#2563EB]";
  if (valor > 25) return "text-[#D97706]";
  return "text-[#DC2626]";
}

export default function RelatorioC4Page() {
  const router = useRouter();
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [microarea, setMicroarea] = useState("Todas");
  const [filtroPratica, setFiltroPratica] = useState("Todos");
  const [filtroClassificacao, setFiltroClassificacao] = useState("Todas");
  const [filtroSituacao, setFiltroSituacao] = useState("Todos");
  const [aberto, setAberto] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (usuario) => {
      if (!usuario) {
        router.replace("/login");
        return;
      }

      try {
        const token = await usuario.getIdToken();
        const resposta = await fetch("/api/indicadores/c4", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const dados = await resposta.json();
        if (!resposta.ok || !dados.sucesso) {
          throw new Error(dados.mensagem || "Não foi possível carregar o C4.");
        }
        setRelatorio(dados);
      } catch (error) {
        setErro(error instanceof Error ? error.message : "Não foi possível carregar o relatório.");
      } finally {
        setCarregando(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const microareas = useMemo(() => {
    const valores = (relatorio?.pacientes ?? []).map((p) => p.microarea).filter(Boolean);
    return ["Todas", ...Array.from(new Set(valores)).sort()];
  }, [relatorio]);

  const pacientesFiltrados = useMemo(() => {
    return (relatorio?.pacientes ?? []).filter((paciente) => {
      const texto = `${paciente.nome} ${paciente.cpf}`.toLowerCase();
      const correspondeBusca = !busca || texto.includes(busca.toLowerCase());
      const correspondeMicroarea = microarea === "Todas" || paciente.microarea === microarea;
      const correspondePratica =
        filtroPratica === "Todos" ||
        paciente.praticas.some((pratica) => pratica.codigo === filtroPratica && !pratica.atingida);
      const correspondeClassificacao =
        filtroClassificacao === "Todas" || paciente.classificacao === filtroClassificacao;
      const temPendencia = paciente.praticas.some((pratica) => !pratica.atingida);
      const correspondeSituacao =
        filtroSituacao === "Todos" ||
        (filtroSituacao === "Com pendências" && temPendencia) ||
        (filtroSituacao === "Em dia" && !temPendencia);
      return correspondeBusca && correspondeMicroarea && correspondePratica && correspondeClassificacao && correspondeSituacao;
    });
  }, [relatorio, busca, microarea, filtroPratica, filtroClassificacao, filtroSituacao]);

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F6F9FC]">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#003B8E]"><Loader2 className="animate-spin" size={20} /> Calculando C4...</div>
      </main>
    );
  }

  if (erro) {
    return (
      <main className="min-h-screen bg-[#F6F9FC] p-6 text-[#003B8E]">
        <button onClick={() => router.back()} className="mb-6 flex items-center gap-2 text-xs font-bold text-[#003B8E]"><ArrowLeft size={16} /> Voltar</button>
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-[#E7E2F2]"><p className="font-bold text-red-600">Não foi possível carregar o C4.</p><p className="mt-2 text-sm text-gray-500">{erro}</p></section>
      </main>
    );
  }

  if (!relatorio) {
    return (
      <main className="min-h-screen bg-[#F6F9FC] text-[#003B8E]">
        <header className="relative isolate overflow-hidden rounded-b-[28px] border border-emerald-200/60 bg-gradient-to-br from-[#009C3B]/95 via-[#00A9E8]/85 to-[#F2C300]/85 px-5 py-5 text-white shadow-[0_10px_24px_rgba(0,156,59,0.16),0_4px_10px_rgba(0,59,142,0.10)] backdrop-blur-md">
          <div className="pointer-events-none absolute -left-10 -top-14 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
          <div className="pointer-events-none absolute right-20 -top-12 h-32 w-32 rounded-full bg-[#F2C300]/20 blur-3xl" />
          <div className="relative pr-20">
            <button onClick={() => router.back()} className="flex items-center gap-2 text-xs font-bold text-white/95"><ArrowLeft size={17} /> Voltar</button>
            <div className="mt-4">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-white/85">Indicadores APS Brasil 360</p>
              <h1 className="mt-1 text-lg font-extrabold">C4 — Cuidado da pessoa com diabetes</h1>
              <p className="mt-1 text-[10px] text-white/90">Relatório operacional baseado na última importação válida do PEC</p>
            </div>
          </div>
          <img src="/brasil360-logo-header.png" alt="Brasil 360" width={88} height={88} className="absolute right-5 top-1/2 h-16 w-16 -translate-y-1/2 rounded-2xl object-cover shadow-[0_8px_18px_rgba(0,59,142,0.22)] ring-1 ring-white/50 sm:h-20 sm:w-20" />
        </header>
        <div className="p-5"><section className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-[#E7E2F2]"><p className="text-sm font-bold">Não foi possível carregar os dados do C4</p><p className="mt-2 text-xs leading-relaxed text-gray-500">Tente novamente em alguns instantes.</p></section></div>
      </main>
    );
  }

  if (!relatorio.possuiDados) {
    return (
      <main className="min-h-screen bg-[#F6F9FC] text-[#003B8E]">
        <header className="relative isolate overflow-hidden rounded-b-[28px] border border-emerald-200/60 bg-gradient-to-br from-[#009C3B]/95 via-[#00A9E8]/85 to-[#F2C300]/85 px-5 py-5 text-white shadow-[0_10px_24px_rgba(0,156,59,0.16),0_4px_10px_rgba(0,59,142,0.10)] backdrop-blur-md">
          <div className="pointer-events-none absolute -left-10 -top-14 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
          <div className="pointer-events-none absolute right-20 -top-12 h-32 w-32 rounded-full bg-[#F2C300]/20 blur-3xl" />
          <div className="relative pr-20">
            <button onClick={() => router.back()} className="flex items-center gap-2 text-xs font-bold text-white/95"><ArrowLeft size={17} /> Voltar</button>
            <div className="mt-4">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-white/85">Indicadores APS Brasil 360</p>
              <h1 className="mt-1 text-lg font-extrabold">C4 — Cuidado da pessoa com diabetes</h1>
              <p className="mt-1 text-[10px] text-white/90">Relatório operacional baseado na última importação válida do PEC</p>
            </div>
          </div>
          <img src="/brasil360-logo-header.png" alt="Brasil 360" width={88} height={88} className="absolute right-5 top-1/2 h-16 w-16 -translate-y-1/2 rounded-2xl object-cover shadow-[0_8px_18px_rgba(0,59,142,0.22)] ring-1 ring-white/50 sm:h-20 sm:w-20" />
        </header>
        <div className="p-5"><section className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-[#E7E2F2]"><p className="text-sm font-bold">Ainda não há dados para o C4</p><p className="mt-2 text-xs leading-relaxed text-gray-500">{relatorio.mensagem}</p></section></div>
      </main>
    );
  }

  if (!relatorio.resumo) {
    return (
      <main className="min-h-screen bg-[#F6F9FC] p-6 text-[#003B8E]">
        <button onClick={() => router.back()} className="mb-6 flex items-center gap-2 text-xs font-bold text-[#003B8E]"><ArrowLeft size={16} /> Voltar</button>
        <section className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-[#E7E2F2]"><p className="text-sm font-bold">Resumo do C4 indisponível</p><p className="mt-2 text-xs text-gray-500">Os dados foram encontrados, mas o resumo não pôde ser carregado.</p></section>
      </main>
    );
  }

  const resumo = relatorio.resumo;

  return (
    <main className="min-h-screen bg-[#F6F9FC] pb-10 text-[#003B8E]">
      <header className="relative isolate overflow-hidden rounded-b-[28px] border border-emerald-200/60 bg-gradient-to-br from-[#009C3B]/95 via-[#00A9E8]/85 to-[#F2C300]/85 px-5 py-5 text-white shadow-[0_10px_24px_rgba(0,156,59,0.16),0_4px_10px_rgba(0,59,142,0.10)] backdrop-blur-md">
          <div className="pointer-events-none absolute -left-10 -top-14 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
          <div className="pointer-events-none absolute right-20 -top-12 h-32 w-32 rounded-full bg-[#F2C300]/20 blur-3xl" />
          <div className="relative pr-20">
            <button onClick={() => router.back()} className="flex items-center gap-2 text-xs font-bold text-white/95"><ArrowLeft size={17} /> Voltar</button>
            <div className="mt-4">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-white/85">Indicadores APS Brasil 360</p>
              <h1 className="mt-1 text-lg font-extrabold">C4 — Cuidado da pessoa com diabetes</h1>
              <p className="mt-1 text-[10px] text-white/90">Relatório operacional baseado na última importação válida do PEC</p>
            </div>
          </div>
          <img src="/brasil360-logo-header.png" alt="Brasil 360" width={88} height={88} className="absolute right-5 top-1/2 h-16 w-16 -translate-y-1/2 rounded-2xl object-cover shadow-[0_8px_18px_rgba(0,59,142,0.22)] ring-1 ring-white/50 sm:h-20 sm:w-20" />
        </header>

      <div className="space-y-4 p-5 pt-6">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#9EDFF2] bg-gradient-to-br from-[#EAF7FC] via-white to-[#D7F1FA] p-5 shadow-[0_6px_14px_rgba(0,169,232,0.12),0_2px_5px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(0,169,232,0.18)]">
            <p className="text-[9px] font-medium text-[#39708A]">Resultado C4</p>
            <p className={`mt-1 text-3xl font-extrabold ${classePontuacao(resumo.pontuacao)}`}>{resumo.pontuacao.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</p>
            <p className="text-[9px] font-bold text-[#003B8E]">{resumo.classificacao}</p>
          </div>
          <div className="rounded-2xl border border-[#A7E6C0] bg-gradient-to-br from-[#ECFDF3] via-white to-[#DDF7E7] p-5 shadow-[0_6px_14px_rgba(0,156,59,0.12),0_2px_5px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(0,156,59,0.18)]">
            <p className="text-[9px] font-medium text-[#39705A]">Elegíveis</p>
            <p className="mt-1 text-3xl font-extrabold text-[#003B8E]">{resumo.totalElegiveis}</p>
            <p className="text-[9px] font-medium text-[#39705A]">pacientes no denominador</p>
          </div>
        </section>

        <section className="rounded-2xl border border-[#9EDFF2] bg-gradient-to-r from-[#EAF7FC] to-[#F2FBFD] p-4 shadow-[0_3px_8px_rgba(0,169,232,0.08)]"><div className="flex gap-3"><Info size={18} className="mt-0.5 shrink-0 text-[#003B8E]" /><div><p className="text-[10px] font-extrabold text-[#003B8E]">Como interpretar este C4</p><p className="mt-1 text-[9px] leading-relaxed text-[#39708A]">O resultado usa o relatório temático Diabetes do PEC com problemas ativos. Ele é uma avaliação operacional para acompanhamento da UBS e não substitui a apuração oficial do SIAPS, que utiliza critérios adicionais de vínculo, equipe e profissional.</p></div></div></section>

        <section className="rounded-2xl bg-white p-4 shadow-[0_6px_14px_rgba(0,59,142,0.10),0_2px_5px_rgba(0,0,0,0.05)] ring-1 ring-[#DDEAF2]">
          <h2 className="text-xs font-extrabold">Boas práticas</h2>
          <p className="mt-1 text-[9px] text-gray-500">Percentual de pacientes elegíveis que atingiram cada prática.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(Object.keys(TITULOS) as Pratica["codigo"][]).map((codigo) => {
              const dados = resumo.praticas[codigo];
              return <div key={codigo} className={`rounded-xl border p-3 shadow-[0_4px_10px_rgba(0,59,142,0.07)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_16px_rgba(0,59,142,0.11)] ${
                codigo === "A" ? "border-[#9EDFF2] bg-gradient-to-br from-[#EAF7FC] to-[#D7F1FA]" :
                codigo === "B" ? "border-[#A7E6C0] bg-gradient-to-br from-[#ECFDF3] to-[#DDF7E7]" :
                codigo === "C" ? "border-[#F5D66A] bg-gradient-to-br from-[#FFF9E5] to-[#FFF1B8]" :
                codigo === "D" ? "border-[#B7C8F5] bg-gradient-to-br from-[#EEF2FF] to-[#DDE7FF]" :
                codigo === "E" ? "border-[#F5D66A] bg-gradient-to-br from-[#FFF9E5] to-[#FFF1B8]" :
                "border-[#A7E6C0] bg-gradient-to-br from-[#ECFDF3] to-[#DDF7E7]"
              }`}>
                <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-bold">{codigo}. {TITULOS[codigo]}</p><p className="text-xs font-extrabold text-[#003B8E]">{dados.percentual}%</p></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/80"><div className={`h-full rounded-full ${
                  codigo === "A" ? "bg-[#00A9E8]" :
                  codigo === "B" ? "bg-[#009C3B]" :
                  codigo === "C" ? "bg-[#F2C300]" :
                  codigo === "D" ? "bg-[#003B8E]" :
                  codigo === "E" ? "bg-[#F2C300]" :
                  "bg-[#009C3B]"
                }`} style={{ width: `${Math.min(dados.percentual, 100)}%` }} /></div>
                <p className="mt-1 text-[8px] text-gray-400">{dados.atingidos} de {resumo.totalElegiveis} pacientes</p>
              </div>;
            })}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-[0_6px_14px_rgba(0,59,142,0.10),0_2px_5px_rgba(0,0,0,0.05)] ring-1 ring-[#DDEAF2]">
          <h2 className="text-xs font-extrabold">Onde concentrar o acompanhamento</h2>
          <p className="mt-1 text-[9px] text-gray-500">Toque em uma prática para mostrar quem ainda não a atingiu.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {["Todos", "A", "B", "C", "D", "E", "F"].map((codigo) => {
              const total = codigo === "Todos" ? resumo.totalElegiveis : resumo.totalElegiveis - resumo.praticas[codigo as Pratica["codigo"]].atingidos;
              const prioridade = codigo === "D" || codigo === "F" ? "border-red-100 bg-red-50" : codigo === "E" ? "border-amber-100 bg-amber-50" : "border-[#E7E2F2] bg-[#F7FAFC]";
              return (
                <button key={codigo} onClick={() => setFiltroPratica(codigo)} className={`rounded-xl border p-3 text-left transition ${filtroPratica === codigo ? "border-[#7C3AED] bg-[#EAF7FC] ring-1 ring-[#00A9E8]/20" : prioridade}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[9px] font-bold">{codigo === "Todos" ? "Todos" : `${codigo} • ${TITULOS[codigo as Pratica["codigo"]]}`}</p>
                    {codigo === "D" || codigo === "F" ? <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[7px] font-bold text-red-700">Prioridade</span> : codigo === "E" ? <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[7px] font-bold text-amber-700">Atenção</span> : null}
                  </div>
                  <p className="mt-1 text-lg font-extrabold text-[#003B8E]">{total}</p>
                  <p className="text-[8px] text-gray-400">{codigo === "Todos" ? "elegíveis" : "pendentes"}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-[0_6px_14px_rgba(0,59,142,0.10),0_2px_5px_rgba(0,0,0,0.05)] ring-1 ring-[#DDEAF2]">
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou CPF..." className="min-w-0 rounded-xl border border-[#E7E2F2] bg-[#F7FAFC] px-3 py-2 text-xs outline-none focus:border-[#00A9E8]" />
            <select value={microarea} onChange={(e) => setMicroarea(e.target.value)} className="rounded-xl border border-[#E7E2F2] bg-[#F7FAFC] px-3 py-2 text-[10px] font-semibold outline-none focus:border-[#00A9E8]">
              <option value="Todas">Todas as microáreas</option>
              {microareas.filter((m) => m !== "Todas").map((m) => <option key={m} value={m}>Microárea {m}</option>)}
            </select>
            <select value={filtroClassificacao} onChange={(e) => setFiltroClassificacao(e.target.value)} className="rounded-xl border border-[#E7E2F2] bg-[#F7FAFC] px-3 py-2 text-[10px] font-semibold outline-none focus:border-[#00A9E8]">
              <option value="Todas">Todas as classificações</option>
              <option value="Ótimo">Ótimo</option>
              <option value="Bom">Bom</option>
              <option value="Suficiente">Suficiente</option>
              <option value="Regular">Regular</option>
            </select>
            <select value={filtroSituacao} onChange={(e) => setFiltroSituacao(e.target.value)} className="rounded-xl border border-[#E7E2F2] bg-[#F7FAFC] px-3 py-2 text-[10px] font-semibold outline-none focus:border-[#00A9E8]">
              <option value="Todos">Todas as situações</option>
              <option value="Com pendências">Com pendências</option>
              <option value="Em dia">Em dia</option>
            </select>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => { setBusca(""); setMicroarea("Todas"); setFiltroClassificacao("Todas"); setFiltroSituacao("Todos"); setFiltroPratica("Todos"); }} className="rounded-full border border-[#E7E2F2] bg-white px-3 py-1.5 text-[9px] font-bold text-gray-600">Limpar filtros</button>
            {filtroPratica !== "Todos" && <span className="rounded-full bg-[#EEE7FF] px-3 py-1.5 text-[9px] font-bold text-[#003B8E]">Prática {filtroPratica}</span>}
            {filtroSituacao !== "Todos" && <span className="rounded-full bg-[#EEE7FF] px-3 py-1.5 text-[9px] font-bold text-[#003B8E]">{filtroSituacao}</span>}
            {filtroClassificacao !== "Todas" && <span className="rounded-full bg-[#EEE7FF] px-3 py-1.5 text-[9px] font-bold text-[#003B8E]">{filtroClassificacao}</span>}
            {microarea !== "Todas" && <span className="rounded-full bg-[#EEE7FF] px-3 py-1.5 text-[9px] font-bold text-[#003B8E]">Microárea {microarea}</span>}
          </div>
          <div className="mt-4 flex items-center justify-between"><div><h2 className="text-xs font-extrabold">Pacientes avaliados</h2><p className="mt-1 text-[9px] text-gray-500">{pacientesFiltrados.length} registro(s) exibido(s).</p></div></div>
          <div className="mt-3 space-y-2">
            {pacientesFiltrados.map((paciente) => {
              const expandido = aberto === paciente.id;
              return <div key={paciente.id} className="overflow-hidden rounded-xl border border-[#E7E2F2] bg-[#F7FAFC]">
                <button onClick={() => setAberto(expandido ? null : paciente.id)} className="flex w-full items-center justify-between gap-3 p-3 text-left"><div className="min-w-0"><p className="truncate text-[10px] font-extrabold">{paciente.nome}</p><p className="mt-0.5 text-[8px] text-gray-400">{paciente.microarea ? `Microárea ${paciente.microarea}` : "Microárea não informada"} {paciente.cpf ? `• CPF ${paciente.cpf}` : ""}</p></div><div className="flex items-center gap-2"><div className="flex items-center gap-1.5">
                      <span className={`rounded-full px-2 py-1 text-[8px] font-bold ${paciente.pontuacao > 75 ? "bg-emerald-50 text-emerald-700" : paciente.pontuacao > 50 ? "bg-blue-50 text-blue-700" : paciente.pontuacao > 25 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>{paciente.pontuacao.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</span>
                      <span className="hidden rounded-full bg-white px-2 py-1 text-[8px] font-semibold text-gray-500 sm:inline">{paciente.classificacao}</span>
                    </div><ChevronDown size={15} className={`transition ${expandido ? "rotate-180" : ""}`} /></div></button>
                {expandido && <div className="border-t border-[#E7E2F2] p-3"><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{paciente.praticas.map((pratica) => <div key={pratica.codigo} className="rounded-lg bg-white p-2 ring-1 ring-[#E7E2F2]"><div className="flex items-center justify-between gap-2"><p className="text-[9px] font-bold">{pratica.codigo} • {TITULOS[pratica.codigo]}</p>{pratica.atingida ? <CheckCircle2 size={14} className="text-emerald-600" /> : <XCircle size={14} className="text-red-500" />}</div><p className="mt-1 text-[8px] leading-relaxed text-gray-500">{pratica.detalhe}</p></div>)}</div></div>}
              </div>;
            })}
            {pacientesFiltrados.length === 0 && <p className="py-8 text-center text-xs text-gray-400">Nenhum paciente encontrado com os filtros atuais.</p>}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-[0_6px_14px_rgba(0,59,142,0.10),0_2px_5px_rgba(0,0,0,0.05)] ring-1 ring-[#DDEAF2]"><h2 className="text-xs font-extrabold">Fonte da avaliação</h2><div className="mt-3 space-y-2 text-[9px] text-gray-500"><p><strong>Arquivo:</strong> {relatorio.importacao?.arquivoNome}</p><p><strong>Lista temática:</strong> {relatorio.importacao?.listaTematica}</p><p><strong>Grupo:</strong> {relatorio.importacao?.grupoCondicoes}</p><p><strong>Filtro:</strong> {relatorio.importacao?.filtroProblemas}</p><p><strong>Registros:</strong> {relatorio.importacao?.quantidadeRegistros}</p><p><strong>Referência:</strong> {relatorio.importacao?.geradoEm || "—"}</p></div></section>
      </div>
    </main>
  );
}
