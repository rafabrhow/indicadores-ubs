"use client";

import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Info,
  UsersRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useDashboardCache } from "@/context/DashboardCacheContext";

type ResultadoC1 = {
  sucesso: boolean;
  possuiDados?: boolean;
  pontuacao?: number | null;
  percentualProgramado?: number | null;
  classificacao?:
    | "Ótimo"
    | "Bom"
    | "Suficiente"
    | "Regular"
    | "Indisponível";
  atendimentosProgramados?: number;
  atendimentosEspontaneos?: number;
  atendimentosNaoInformados?: number;
  totalAtendimentos?: number;
  competencias?: string[];
  competencia?: string;
  periodo?: string | null;
  equipe?: string | null;
  mensagem?: string;
};

function formatarCompetencia(valor?: string) {
  if (!valor || !/^\d{4}-\d{2}$/.test(valor)) return valor || "—";

  const [ano, mes] = valor.split("-");
  const nomes = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  return `${nomes[Number(mes) - 1] || mes} de ${ano}`;
}

function formatarNumero(valor: number | undefined) {
  return Number(valor ?? 0).toLocaleString("pt-BR");
}

export default function C1MaisAcessoPage() {
  const router = useRouter();
  const { usuario, carregando } = useAuth();
  const { carregarCache } = useDashboardCache();

  const [resultado, setResultado] = useState<ResultadoC1 | null>(null);
  const [carregandoC1, setCarregandoC1] = useState(true);
  const [erro, setErro] = useState("");

 
useEffect(() => {
  if (carregando || !usuario) return;

  const usuarioAtual = usuario;

  if (usuarioAtual.perfil !== "enfermeira") {
    router.replace("/acs");
    return;
  }

  let cancelado = false;

  async function carregarC1() {
    try {
      setCarregandoC1(true);
      setErro("");

      const usuarioFirebase = auth.currentUser;

      if (!usuarioFirebase) {
        setErro("Sessão não autenticada.");
        return;
      }

      const token = await usuarioFirebase.getIdToken();

      const dados = await carregarCache<ResultadoC1>(
        `indicador:c1:${usuarioAtual.ubsId}`,
        async () => {
          const resposta = await fetch(
            "/api/indicadores/c1",
            {
              cache: "no-store",
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          );

          const resultadoApi = await resposta.json();

          if (!resposta.ok || !resultadoApi.sucesso) {
            throw new Error(
              resultadoApi.mensagem ||
                "Não foi possível consultar o C1.",
            );
          }

          return resultadoApi as ResultadoC1;
        },
      );

      if (cancelado) return;

      setResultado(dados);
    } catch (error) {
      if (!cancelado) {
        setErro(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o C1.",
        );
      }
    } finally {
      if (!cancelado) {
        setCarregandoC1(false);
      }
    }
  }

  void carregarC1();

  return () => {
    cancelado = true;
  };
}, [carregando, usuario, router, carregarCache]);


  if (carregando || !usuario) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7FAFC]">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#7C3AED]/20 border-t-[#7C3AED]" />
          <p className="mt-3 text-sm font-semibold text-[#4C1D95]">
            Carregando...
          </p>
        </div>
      </main>
    );
  }

  if (usuario.perfil !== "enfermeira") {
    return null;
  }

  const percentual =
    resultado?.percentualProgramado !== null &&
    resultado?.percentualProgramado !== undefined
      ? Number(resultado.percentualProgramado)
      : null;

  const programados = Number(resultado?.atendimentosProgramados ?? 0);
  const espontaneos = Number(resultado?.atendimentosEspontaneos ?? 0);
  const naoInformados = Number(resultado?.atendimentosNaoInformados ?? 0);
  const total = Number(
    resultado?.totalAtendimentos ?? programados + espontaneos,
  );

  return (
    <main className="min-h-screen bg-[#F7FAFC] text-[#003B8E]">
      <header className="relative isolate overflow-hidden rounded-b-[28px] border border-emerald-200/60 bg-gradient-to-br from-[#009C3B]/95 via-[#00A9E8]/85 to-[#F2C300]/85 px-5 py-5 text-white shadow-[0_10px_24px_rgba(0,156,59,0.16),0_4px_10px_rgba(0,59,142,0.10)] backdrop-blur-md">
        <div className="pointer-events-none absolute -left-10 -top-14 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute right-20 -top-12 h-32 w-32 rounded-full bg-[#F2C300]/20 blur-3xl" />

        <div className="relative pr-24">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="group flex items-center gap-2 text-xs font-bold text-white/95"
          >
            <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" />
            Voltar
          </button>

          <div className="mt-4">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-white/85">
              Indicadores APS Brasil 360
            </p>
            <h1 className="mt-1 text-lg font-extrabold">C1 — Mais acesso</h1>
            <p className="mt-1 max-w-2xl text-[10px] leading-relaxed text-white/90">
              Acompanhamento da proporção de atendimentos de demanda programada em relação ao total de atendimentos de demanda programada e espontânea.
            </p>
          </div>
        </div>

        <img
          src="/brasil360-logo-header.png"
          alt="Brasil 360"
          width={88}
          height={88}
          className="absolute right-5 top-1/2 h-16 w-16 -translate-y-1/2 rounded-2xl object-cover shadow-[0_8px_18px_rgba(0,59,142,0.22)] ring-1 ring-white/50 sm:h-20 sm:w-20"
        />
      </header>

      <div className="mx-auto min-h-screen max-w-5xl px-4 pb-6 pt-5 sm:px-6 md:pt-6 lg:px-8">

        <section className="rounded-3xl border border-[#9EDFF2] bg-gradient-to-br from-[#EAF7FC] via-white to-[#D7F1FA] p-5 shadow-[0_8px_18px_rgba(0,169,232,0.12),0_3px_7px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(0,169,232,0.16)] sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/80 shadow-sm ring-1 ring-[#9EDFF2]">
                  <CalendarDays size={22} className="text-[#00A9E8]" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#003B8E]">C1</p>
                  <h2 className="text-xl font-extrabold text-[#003B8E]">Mais acesso</h2>
                </div>
              </div>

              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#39708A]">
                Acompanhamento da proporção de atendimentos de demanda programada em relação ao total de atendimentos de demanda programada e espontânea.
              </p>
            </div>

            <div className="rounded-2xl border border-[#B7C8F5] bg-gradient-to-br from-[#EEF2FF] via-white to-[#DDE7FF] px-6 py-4 text-right shadow-[0_5px_12px_rgba(0,59,142,0.10)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_9px_18px_rgba(0,59,142,0.14)]">
              <p className="text-[10px] font-medium text-gray-400">
                Resultado do C1
              </p>

              <p className="mt-1 text-3xl font-extrabold text-[#003B8E]">
                {carregandoC1
                  ? "..."
                  : percentual !== null
                    ? `${percentual.toLocaleString("pt-BR", {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}%`
                    : "Indisponível"}
              </p>

              <p className="mt-1 text-[10px] font-semibold text-gray-500">
                {resultado?.classificacao || "Sem dados"}
              </p>
            </div>
          </div>

          {erro && (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <Info size={18} className="mt-0.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {!erro && !carregandoC1 && resultado?.possuiDados === false && (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <Info size={18} className="mt-0.5 shrink-0" />
              <span>
                {resultado.mensagem ||
                  "Ainda não existe resultado consolidado do C1 para esta competência."}
              </span>
            </div>
          )}
        </section>

        {!erro && resultado?.possuiDados && (
          <>
            <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border border-[#A7E6C0] bg-gradient-to-br from-[#ECFDF3] via-white to-[#DDF7E7] p-5 shadow-[0_6px_14px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(0,156,59,0.18)]">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#D9F6E5]">
                  <CheckCircle2 size={17} className="text-[#009C3B]" />
                </div>
                <p className="mt-4 text-2xl font-bold text-[#003B8E]">
                  {formatarNumero(programados)}
                </p>
                <p className="mt-1 text-[10px] font-medium text-[#39705A]">
                  Atendimentos programados
                </p>
              </div>

              <div className="rounded-2xl border border border-[#9EDFF2] bg-gradient-to-br from-[#EAF7FC] via-white to-[#D7F1FA] p-5 shadow-[0_6px_14px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(0,169,232,0.18)]">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#DDF4FC]">
                  <Clock3 size={17} className="text-[#00A9E8]" />
                </div>
                <p className="mt-4 text-2xl font-bold text-[#003B8E]">
                  {formatarNumero(espontaneos)}
                </p>
                <p className="mt-1 text-[10px] font-medium text-[#39708A]">
                  Atendimentos espontâneos
                </p>
              </div>

              <div className="rounded-2xl border border border-[#C9B8F5] bg-gradient-to-br from-[#F3EEFF] via-white to-[#E8DEFF] p-5 shadow-[0_6px_14px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(124,58,237,0.16)]">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E5F5FB]">
                  <UsersRound size={17} className="text-[#7C3AED]" />
                </div>
                <p className="mt-4 text-2xl font-bold text-[#003B8E]">
                  {formatarNumero(total)}
                </p>
                <p className="mt-1 text-[10px] font-medium text-[#5B4A8A]">
                  Total considerado no cálculo
                </p>
              </div>

              <div className="rounded-2xl border border border-[#F5D66A] bg-gradient-to-br from-[#FFF9E5] via-white to-[#FFF1B8] p-5 shadow-[0_6px_14px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(242,195,0,0.18)]">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFF1B8]">
                  <ClipboardList size={17} className="text-[#C78A00]" />
                </div>
                <p className="mt-4 text-2xl font-bold text-[#003B8E]">
                  {formatarNumero(naoInformados)}
                </p>
                <p className="mt-1 text-[10px] font-medium text-[#8A6500]">
                  Não informados/ignorados
                </p>
              </div>
            </section>

            <section className="mt-4 grid gap-4 lg:grid-cols-2">
              {/* Painel 1: usa somente os números já disponíveis no resultado consolidado do C1. */}
              <div className="group rounded-2xl border border-[#B7E7D2] bg-gradient-to-br from-white via-[#F7FFFB] to-[#E4F8EE] p-4 shadow-[0_8px_18px_rgba(16,185,129,0.10),0_3px_6px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(16,185,129,0.16)] sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#0D9488] shadow-sm ring-1 ring-[#B7E7D2]">
                      <CheckCircle2 size={18} />
                    </div>
                    <h2 className="text-sm font-extrabold text-[#244B43]">Atendimentos Realizados</h2>
                  </div>
                  <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-[#0D9488] ring-1 ring-[#B7E7D2]">C1 · Mais Acesso</span>
                </div>

                <div className="mt-4 rounded-xl border border-white bg-white/90 px-4 py-3 text-center shadow-sm">
                  <p className="text-[11px] text-slate-500">Total de atendimentos considerados</p>
                  <p className="mt-1 text-3xl font-extrabold tracking-tight text-[#0D9488]">{formatarNumero(total)}</p>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#B7E7D2] bg-white/90 p-3 text-center shadow-sm">
                    <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-[#E4F8EE] text-[#0D9488]"><CalendarDays size={17} /></div>
                    <p className="mt-2 text-xl font-extrabold text-[#16805D]">{formatarNumero(programados)}</p>
                    <p className="mt-1 text-[10px] font-medium text-slate-600">Demanda programada</p>
                    <p className="mt-1 text-[10px] font-bold text-[#16805D]">{total > 0 ? ((programados / total) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "0,0"}%</p>
                  </div>
                  <div className="rounded-xl border border-[#F5D6A5] bg-white/90 p-3 text-center shadow-sm">
                    <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF2D9] text-[#D97706]"><Clock3 size={17} /></div>
                    <p className="mt-2 text-xl font-extrabold text-[#B7791F]">{formatarNumero(espontaneos)}</p>
                    <p className="mt-1 text-[10px] font-medium text-slate-600">Demanda espontânea</p>
                    <p className="mt-1 text-[10px] font-bold text-[#B7791F]">{total > 0 ? ((espontaneos / total) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "0,0"}%</p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between gap-3 text-[10px] font-semibold">
                    <span className="text-[#16805D]">Programada: {total > 0 ? ((programados / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "0"}%</span>
                    <span className="text-[#B7791F]">Espontânea: {total > 0 ? ((espontaneos / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "0"}%</span>
                  </div>
                  <div className="flex h-3 overflow-hidden rounded-full bg-slate-100 shadow-inner">
                    <div className="h-full bg-gradient-to-r from-[#10B981] to-[#34D399] transition-all duration-500" style={{ width: `${total > 0 ? Math.min(100, (programados / total) * 100) : 0}%` }} />
                    <div className="h-full bg-gradient-to-r from-[#F59E0B] to-[#D97706] transition-all duration-500" style={{ width: `${total > 0 ? Math.min(100, (espontaneos / total) * 100) : 0}%` }} />
                  </div>
                </div>
                <p className="mt-3 text-[10px] leading-relaxed text-slate-500">Composição calculada a partir dos atendimentos programados e espontâneos já consolidados no C1.</p>
              </div>

              {/* Painel 2: não inventa contagens de agendamento que não existem no relatório C1 atual. */}
              <div className="rounded-2xl border border-[#C7DDF5] bg-gradient-to-br from-white via-[#F8FBFF] to-[#E7F2FF] p-4 shadow-[0_8px_18px_rgba(59,130,246,0.10),0_3px_6px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(59,130,246,0.15)] sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#0284C7] shadow-sm ring-1 ring-[#C7DDF5]">
                      <CalendarDays size={18} />
                    </div>
                    <h2 className="text-sm font-extrabold text-[#23466B]">Atendimentos Agendados</h2>
                  </div>
                  <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-[#64748B] ring-1 ring-[#CBD5E1]">Fonte necessária</span>
                </div>

                <div className="mt-4 rounded-xl border border-dashed border-[#B8D5F2] bg-white/80 px-4 py-5 text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#E7F2FF] text-[#0284C7]"><Info size={20} /></div>
                  <p className="mt-2 text-base font-extrabold text-[#315A80]">Dados não disponíveis</p>
                  <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-600">O relatório PEC usado no C1 informa o tipo de atendimento, mas não traz as situações de agendamento necessárias para preencher este painel com segurança.</p>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-[#D7E7F8] bg-white/80 p-2.5"><p className="text-[10px] text-slate-500">Agendado / presente</p><p className="mt-1 text-sm font-bold text-slate-400">—</p></div>
                  <div className="rounded-lg border border-[#D7E7F8] bg-white/80 p-2.5"><p className="text-[10px] text-slate-500">Atendimento realizado</p><p className="mt-1 text-sm font-bold text-slate-400">—</p></div>
                  <div className="rounded-lg border border-[#D7E7F8] bg-white/80 p-2.5"><p className="text-[10px] text-slate-500">Não compareceu</p><p className="mt-1 text-sm font-bold text-slate-400">—</p></div>
                  <div className="rounded-lg border border-[#D7E7F8] bg-white/80 p-2.5"><p className="text-[10px] text-slate-500">Cancelado / não aguardou</p><p className="mt-1 text-sm font-bold text-slate-400">—</p></div>
                </div>
                <p className="mt-3 text-[10px] leading-relaxed text-slate-500">Este quadro será preenchido quando houver uma fonte de agendamentos no PEC integrada ao Brasil360. Nenhuma contagem foi estimada.</p>
              </div>
            </section>

            <section className="mt-4 rounded-2xl border border-[#C9B8F5] bg-gradient-to-br from-[#F3EEFF] via-white to-[#E8DEFF] p-5 shadow-[0_5px_14px_rgba(124,58,237,0.08)] sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-[#C9B8F5]">
                  <Info size={20} className="text-[#7C3AED]" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-[#211A4A]">Como entender o Mais Acesso?</h2>
                  <p className="mt-2 text-xs leading-relaxed text-[#4B5563]">
                    O C1 mostra qual parte dos atendimentos considerados foi programada, em comparação com a soma dos atendimentos programados e espontâneos. Ele descreve a composição dos atendimentos registrados — não a porcentagem da população atendida nem a porcentagem de pessoas que conseguiram consulta.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[#9EDFF2] bg-gradient-to-br from-[#EAF7FC] to-white p-4">
                  <p className="text-xs font-bold text-[#003B8E]">Demanda programada</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#39708A]">Consulta agendada, consulta agendada programada/cuidado continuado.</p>
                </div>
                <div className="rounded-xl border border-[#F5D66A] bg-gradient-to-br from-[#FFF9E5] to-white p-4">
                  <p className="text-xs font-bold text-[#8A6500]">Demanda espontânea</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#8A6500]">Escuta inicial/orientação, consulta no dia e atendimento de urgência.</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-[#DDEAF2] bg-white/90 p-4">
                <h3 className="text-xs font-extrabold text-[#211A4A]">Como interpretar a classificação oficial</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg bg-[#F3EEFF] p-3"><p className="text-[10px] text-[#5B4A8A]">Regular</p><p className="mt-1 text-sm font-extrabold text-[#5B21B6]">≤ 10% ou &gt; 70%</p></div>
                  <div className="rounded-lg bg-[#FFF9E5] p-3"><p className="text-[10px] text-[#8A6500]">Suficiente</p><p className="mt-1 text-sm font-extrabold text-[#8A6500]">&gt; 10% até 30%</p></div>
                  <div className="rounded-lg bg-[#EAF7FC] p-3"><p className="text-[10px] text-[#39708A]">Bom</p><p className="mt-1 text-sm font-extrabold text-[#003B8E]">&gt; 30% até 50%</p></div>
                  <div className="rounded-lg bg-[#ECFDF3] p-3"><p className="text-[10px] text-[#39705A]">Ótimo</p><p className="mt-1 text-sm font-extrabold text-[#047857]">&gt; 50% até 70%</p></div>
                </div>
                <p className="mt-3 text-[10px] leading-relaxed text-gray-500">
                  A faixa oficial não significa que quanto maior o percentual, melhor em qualquer situação. Um percentual muito baixo pode indicar pouca oferta programada; um percentual acima de 70% pode indicar pouca abertura à demanda espontânea. A interpretação deve considerar a organização local do acesso.
                </p>
              </div>
            </section>

            <section className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-[#DDEAF2] bg-white p-5 shadow-[0_5px_14px_rgba(0,59,142,0.07)]">
                <h2 className="text-sm font-bold">Período e equipe</h2>

                <div className="mt-4 space-y-3 text-[10px]">
                  <div className="flex justify-between gap-4 border-b border-gray-100 pb-3">
                    <span className="text-gray-400">Competência</span>
                    <span className="font-semibold">
                      {formatarCompetencia(resultado.competencia)}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4 border-b border-gray-100 pb-3">
                    <span className="text-gray-400">Período</span>
                    <span className="text-right font-semibold">
                      {resultado.periodo || "Não informado"}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-gray-400">Equipe</span>
                    <span className="text-right font-semibold">
                      {resultado.equipe || "Não informada"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#DDEAF2] bg-white p-5 shadow-[0_5px_14px_rgba(0,59,142,0.07)]">
                <h2 className="text-sm font-bold">Critérios do C1</h2>

                <ul className="mt-4 space-y-3 text-[10px] leading-relaxed text-gray-500">
                  <li className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7C3AED]" />
                    O cálculo utiliza registros de Atendimento Individual.
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7C3AED]" />
                    O tipo de demanda precisa estar explicitamente informado.
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7C3AED]" />
                    A metodologia oficial também prevê validação da equipe e dos CBOs profissionais elegíveis.
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7C3AED]" />
                    Esta tela apresenta uma apuração operacional a partir dos tipos de atendimento identificados no relatório PEC importado; ela não substitui o resultado oficial do SIAPS. Confirme o período, a equipe e os filtros/CBOs usados no relatório.
                  </li>
                </ul>
              </div>
            </section>
          </>
        )}

      </div>
    </main>
  );
}
