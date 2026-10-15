 "use client";

import {
  Activity,
  AlertCircle,
  Baby,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  HeartPulse,
  LoaderCircle,
  RefreshCw,
  Printer,
  Stethoscope,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase";

type UBS = {
  id: string;
  nome: string;
  municipio: string;
  uf: string;
  ativo: boolean;
};

type Pratica = {
  nome: string;
  percentual: number;
  atingidos: number | null;
};

type IndicadorRelatorio = {
  codigo: string;
  nome: string;
  possuiResultado: boolean;
  valor: number | null;
  unidade: "%" | "pontos";
  valorRotulo: string;
  classificacao: string | null;
  totalRegistros: number | null;
  totalElegiveis: number | null;
  praticas: Pratica[];
  tipoResultado: "pontuacao" | "praticas" | "sem-pontuacao" | "sem-dados";
};

type RespostaRelatorios = {
  sucesso: boolean;
  mensagem?: string;
  ubs?: { id: string; nome: string; municipio: string; uf: string };
  competencia: string | null;
  competenciasDisponiveis: string[];
  indicadores: IndicadorRelatorio[];
  resumo: {
    totalIndicadores: number;
    comResultado: number;
    semResultado: number;
    comClassificacao: number;
  };
};

const NOMES_INDICADORES = [
  { codigo: "C1", nome: "Mais Acesso", descricao: "Demanda programada", icon: CalendarDays, cor: "#0D9488", fundo: "#CCFBF1" },
  { codigo: "C2", nome: "Desenvolvimento Infantil", descricao: "Acompanhamento infantil", icon: Baby, cor: "#2563EB", fundo: "#DBEAFE" },
  { codigo: "C3", nome: "Gestantes e Puerpério", descricao: "Pré-natal e puerpério", icon: HeartPulse, cor: "#DB2777", fundo: "#FCE7F3" },
  { codigo: "C4", nome: "Diabetes", descricao: "Acompanhamento de pessoas com diabetes", icon: Activity, cor: "#7C3AED", fundo: "#EDE9FE" },
  { codigo: "C5", nome: "Hipertensão", descricao: "Acompanhamento de pessoas hipertensas", icon: Stethoscope, cor: "#EA580C", fundo: "#FFEDD5" },
  { codigo: "C6", nome: "Pessoa Idosa", descricao: "Acompanhamento da pessoa idosa", icon: UsersRound, cor: "#0891B2", fundo: "#CFFAFE" },
  { codigo: "C7", nome: "Saúde da Mulher", descricao: "Acompanhamento da saúde da mulher", icon: HeartPulse, cor: "#BE185D", fundo: "#FCE7F3" },
  { codigo: "BUCAL", nome: "Saúde Bucal", descricao: "Práticas e registros consolidados", icon: ClipboardList, cor: "#059669", fundo: "#D1FAE5" },
] as const;

function formatarCompetencia(valor: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(valor);
  if (!match) return valor;
  const data = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return data.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function formatarNumero(valor: number | null | undefined) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return "—";
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

function GraficoIndicador({ indicador, cor }: { indicador: IndicadorRelatorio; cor: string }) {
  if (indicador.tipoResultado === "praticas" && indicador.praticas.length > 0) {
    const itens = indicador.praticas.slice(0, 5);
    const largura = 250;
    const altura = 130;
    const max = 100;
    const barW = Math.min(28, Math.max(18, (largura - 35) / Math.max(1, itens.length) - 12));
    return (
      <div className="mt-3">
        <svg viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label={`Gráfico das práticas do indicador ${indicador.codigo}`} className="h-36 w-full overflow-visible">
          {[0, 50, 100].map((tick) => {
            const y = 96 - (tick / max) * 72;
            return <g key={tick}><line x1="28" x2="242" y1={y} y2={y} stroke="#E2E8F0" strokeDasharray="3 4" /><text x="22" y={y + 3} textAnchor="end" fontSize="8" fill="#94A3B8">{tick}</text></g>;
          })}
          {itens.map((item, index) => {
            const x = 40 + index * (200 / itens.length) + (200 / itens.length - barW) / 2;
            const h = Math.max(item.percentual > 0 ? 3 : 0, Math.min(72, (item.percentual / 100) * 72));
            const label = item.nome.length > 10 ? `${item.nome.slice(0, 9)}…` : item.nome;
            return <g key={`${item.nome}-${index}`}><rect x={x} y={96 - h} width={barW} height={h} rx="4" fill={cor} opacity="0.88" /><text x={x + barW / 2} y={Math.max(16, 91 - h)} textAnchor="middle" fontSize="8" fill="#475569">{formatarNumero(item.percentual)}%</text><text x={x + barW / 2} y="112" textAnchor="middle" fontSize="7" fill="#64748B">{label}</text></g>;
          })}
        </svg>
        <p className="text-[10px] text-slate-500">Percentuais das práticas disponíveis no snapshot.</p>
      </div>
    );
  }

  if (indicador.tipoResultado !== "pontuacao" || indicador.valor === null) {
    return (
      <div className="mt-3 flex min-h-[145px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 text-center">
        <ClipboardList size={24} className="text-slate-300" />
        <p className="mt-2 text-xs font-semibold text-slate-500">
          {indicador.possuiResultado ? "Dados disponíveis, sem pontuação única" : "Sem resultado nesta competência"}
        </p>
        <p className="mt-1 text-[10px] text-slate-400">
          {indicador.possuiResultado
            ? "O snapshot não possui um valor geral para representar neste gráfico."
            : "O indicador ainda não tem snapshot mensal para a UBS selecionada."}
        </p>
      </div>
    );
  }

  const valor = Math.max(0, Math.min(100, indicador.valor));
  const altura = valor === 0 ? 0 : Math.max(4, (valor / 100) * 82);
  return (
    <div className="mt-3">
      <svg viewBox="0 0 280 145" role="img" aria-label={`Gráfico do indicador ${indicador.codigo}: ${formatarNumero(valor)}${indicador.unidade}`} className="h-36 w-full">
        {[0, 50, 100].map((tick) => {
          const y = 112 - (tick / 100) * 82;
          return <g key={tick}><line x1="34" x2="266" y1={y} y2={y} stroke="#E2E8F0" strokeDasharray="3 4" /><text x="27" y={y + 3} textAnchor="end" fontSize="9" fill="#94A3B8">{tick}</text></g>;
        })}
        <rect x="105" y={112 - altura} width="88" height={altura} rx="7" fill={cor} opacity="0.88" />
        <text x="149" y={Math.max(18, 103 - altura)} textAnchor="middle" fontSize="12" fontWeight="700" fill="#334155">{formatarNumero(valor)}{indicador.unidade}</text>
        <text x="149" y="132" textAnchor="middle" fontSize="9" fill="#64748B">Resultado registrado</text>
      </svg>
      <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
        <span>Escala visual: 0–100</span>
        <span>{indicador.classificacao || "Classificação não registrada"}</span>
      </div>
    </div>
  );
}

export default function AdminMunicipalReports() {
  const [unidades, setUnidades] = useState<UBS[]>([]);
  const [ubsId, setUbsId] = useState("");
  const [competencia, setCompetencia] = useState("");
  const [resposta, setResposta] = useState<RespostaRelatorios | null>(null);
  const [carregandoUnidades, setCarregandoUnidades] = useState(true);
  const [carregandoRelatorio, setCarregandoRelatorio] = useState(false);
  const [erro, setErro] = useState("");

  const buscarRelatorio = useCallback(async (idUBS: string, mes?: string) => {
    if (!idUBS) {
      setResposta(null);
      setCompetencia("");
      return;
    }
    setCarregandoRelatorio(true);
    setErro("");
    try {
      const usuario = auth.currentUser;
      if (!usuario) throw new Error("Sua sessão expirou. Entre novamente.");
      const token = await usuario.getIdToken();
      const params = new URLSearchParams({ ubsId: idUBS });
      if (mes) params.set("competencia", mes);
      const res = await fetch(`/api/admin/relatorios?${params.toString()}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || data?.sucesso !== true) throw new Error(data?.mensagem || "Não foi possível carregar os relatórios.");
      const payload = data as RespostaRelatorios;
      setResposta(payload);
      setCompetencia(payload.competencia || "");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os relatórios.");
      setResposta(null);
    } finally {
      setCarregandoRelatorio(false);
    }
  }, []);

  useEffect(() => {
    let cancelado = false;
    async function carregarUBS() {
      setCarregandoUnidades(true);
      setErro("");
      try {
        const usuario = auth.currentUser;
        if (!usuario) throw new Error("Sua sessão expirou. Entre novamente.");
        const token = await usuario.getIdToken();
        const res = await fetch("/api/admin/ubs?somenteLista=1", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok || data?.sucesso !== true) throw new Error(data?.mensagem || "Não foi possível carregar as UBS.");
        const lista = Array.isArray(data.ubs) ? (data.ubs as UBS[]) : [];
        if (!cancelado) {
          setUnidades(lista);
          if (lista.length > 0) setUbsId(lista[0].id);
          // A lista foi carregada com sucesso: libera o seletor e remove o estado de carregamento.
          setCarregandoUnidades(false);
        }
      } catch (e) {
        if (!cancelado) {
          setErro(e instanceof Error ? e.message : "Não foi possível carregar as UBS.");
          setCarregandoUnidades(false);
        }
      }
    }
    void carregarUBS();
    return () => { cancelado = true; };
  }, []);

  useEffect(() => {
    if (!ubsId) return;
    void buscarRelatorio(ubsId);
  }, [ubsId, buscarRelatorio]);

  const indicadores = useMemo(() => {
    const recebidos = new Map((resposta?.indicadores || []).map((item) => [item.codigo, item]));
    return NOMES_INDICADORES.map((def) => {
      const existente = recebidos.get(def.codigo);
      if (existente) return { ...def, ...existente };
      return {
        ...def,
        possuiResultado: false,
        valor: null,
        unidade: def.codigo === "C1" ? "%" as const : "pontos" as const,
        valorRotulo: "Sem resultado",
        classificacao: null,
        totalRegistros: null,
        totalElegiveis: null,
        praticas: [],
        tipoResultado: "sem-dados" as const,
      };
    });
  }, [resposta]);

  const nomeUBS = unidades.find((unidade) => unidade.id === ubsId)?.nome || resposta?.ubs?.nome || "UBS";
  const totalComResultado = indicadores.filter((item) => item.possuiResultado).length;
  const totalSemResultado = indicadores.length - totalComResultado;
  const totalClassificados = indicadores.filter((item) => Boolean(item.classificacao)).length;

  const selecionarUBS = (id: string) => {
    setUbsId(id);
    setCompetencia("");
    setResposta(null);
  };

  const selecionarCompetencia = (mes: string) => {
    setCompetencia(mes);
    void buscarRelatorio(ubsId, mes);
  };

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-[#C9EAF4] bg-gradient-to-br from-white via-[#F5FBFF] to-[#E8F7FC] p-4 shadow-[0_8px_20px_rgba(0,59,142,0.07)] sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0D9488]">Painel de acompanhamento</p>
            <h2 className="mt-1 text-xl font-extrabold text-[#211A4A]">Resultados por UBS</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">Selecione a unidade e a competência para consultar os snapshots já consolidados, sem recalcular os indicadores.</p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <button type="button" onClick={() => void buscarRelatorio(ubsId, competencia || undefined)} disabled={!ubsId || carregandoRelatorio} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#B8DDE8] bg-white px-4 py-2.5 text-xs font-semibold text-[#0F766E] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50">
              <RefreshCw size={14} className={carregandoRelatorio ? "animate-spin" : ""} />
              Atualizar relatório
            </button>
            <button type="button" onClick={() => window.print()} disabled={!resposta || carregandoRelatorio} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-[0_5px_12px_rgba(109,40,217,0.24)] transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50">
              <Printer size={14} />
              Imprimir gráficos
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">UBS</span>
            <select value={ubsId} onChange={(e) => selecionarUBS(e.target.value)} disabled={carregandoUnidades || unidades.length === 0} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10 disabled:bg-slate-50">
              {unidades.length === 0 && <option value="">Nenhuma UBS disponível</option>}
              {unidades.map((unidade) => <option key={unidade.id} value={unidade.id}>{unidade.nome} — {unidade.municipio}/{unidade.uf}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">Mês de referência</span>
            <select value={competencia} onChange={(e) => selecionarCompetencia(e.target.value)} disabled={!resposta || carregandoRelatorio || resposta.competenciasDisponiveis.length === 0} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10 disabled:bg-slate-50">
              {resposta?.competenciasDisponiveis.length ? resposta.competenciasDisponiveis.map((mes) => <option key={mes} value={mes}>{formatarCompetencia(mes)}</option>) : <option value="">Sem competências disponíveis</option>}
            </select>
          </label>
        </div>
      </div>

      {erro && <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><AlertCircle size={18} className="mt-0.5 shrink-0" /><p>{erro}</p></div>}

      {carregandoUnidades && <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-100 bg-white p-10 text-sm text-slate-500"><LoaderCircle size={20} className="animate-spin text-[#0D9488]" /> Carregando UBS autorizadas...</div>}

      {!carregandoUnidades && unidades.length === 0 && !erro && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">Nenhuma UBS ativa foi encontrada para o município autorizado.</div>}

      {carregandoRelatorio && <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-100 bg-white p-8 text-sm text-slate-500"><LoaderCircle size={20} className="animate-spin text-[#0D9488]" /> Consultando snapshots da competência...</div>}

      {!carregandoRelatorio && resposta && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ResumoCard titulo="Indicadores previstos" valor={String(resposta.resumo.totalIndicadores)} detalhe="C1–C7 e Saúde Bucal" cor="violeta" />
            <ResumoCard titulo="Com resultado" valor={String(totalComResultado)} detalhe="Snapshot com dados agregados" cor="verde" />
            <ResumoCard titulo="Sem resultado" valor={String(totalSemResultado)} detalhe="Não pontuado nesta competência" cor="ambar" />
            <ResumoCard titulo="Com classificação" valor={String(totalClassificados)} detalhe="Classificação registrada no snapshot" cor="azul" />
          </div>

          <div id="brasil360-relatorios-impressao" className="space-y-4">
            <div className="hidden border-b-2 border-slate-200 pb-4 print-report-header">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Brasil360 · Administração municipal</p>
              <h1 className="mt-2 text-2xl font-extrabold text-slate-900">Relatório de indicadores da UBS</h1>
              <p className="mt-2 text-base font-bold text-slate-800">{nomeUBS}</p>
              <p className="mt-1 text-sm text-slate-600">Município: {resposta.ubs?.municipio || unidades.find((unidade) => unidade.id === ubsId)?.municipio || "—"}/{resposta.ubs?.uf || unidades.find((unidade) => unidade.id === ubsId)?.uf || "—"}</p>
              <p className="mt-1 text-sm text-slate-600">Mês de referência: {resposta.competencia ? formatarCompetencia(resposta.competencia) : "Sem competência disponível"}</p>
              <p className="mt-2 text-[10px] text-slate-500">Relatório baseado nos resultados consolidados disponíveis. Ausência de resultado não significa desempenho zero.</p>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-2 print:hidden">
              <div>
                <h3 className="text-base font-extrabold text-[#211A4A]">{nomeUBS}</h3>
                <p className="mt-1 text-xs text-slate-500">{resposta.competencia ? `Competência: ${formatarCompetencia(resposta.competencia)}` : "Nenhum snapshot mensal encontrado para esta UBS."}</p>
              </div>
              <p className="text-[10px] text-slate-400">Somente resultados consolidados; dados individuais não são exibidos.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3 print-report-grid">
            {indicadores.map((indicador) => {
              const Icone = indicador.icon;
              return (
                <article key={indicador.codigo} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_5px_15px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_25px_rgba(15,23,42,0.10)]">
                  <div className="flex items-start gap-3 border-b border-slate-100 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm" style={{ backgroundColor: indicador.fundo, color: indicador.cor }}>
                      <Icone size={19} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-extrabold tracking-wide text-slate-400">{indicador.codigo}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${indicador.possuiResultado ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{indicador.possuiResultado ? (indicador.classificacao || "Dados disponíveis") : "Sem resultado"}</span>
                      </div>
                      <h4 className="mt-1 text-sm font-extrabold text-[#211A4A]">{indicador.nome}</h4>
                      <p className="mt-0.5 text-[10px] text-slate-500">{indicador.descricao}</p>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-medium text-slate-400">{indicador.tipoResultado === "pontuacao" ? "Resultado consolidado" : indicador.tipoResultado === "praticas" ? "Práticas consolidadas" : indicador.possuiResultado ? "Dados consolidados" : "Resultado indisponível"}</p>
                        <p className="mt-1 text-2xl font-extrabold tracking-tight" style={{ color: indicador.cor }}>{indicador.valor !== null ? `${formatarNumero(indicador.valor)}${indicador.unidade}` : indicador.tipoResultado === "praticas" ? `${indicador.praticas.length} prática(s)` : indicador.valorRotulo && indicador.valorRotulo !== "Sem pontuação consolidada" && indicador.valorRotulo !== "Sem resultado" ? indicador.valorRotulo : "—"}</p>
                      </div>
                      {indicador.totalElegiveis !== null && <div className="text-right"><p className="text-[10px] text-slate-400">Elegíveis</p><p className="text-sm font-bold text-slate-700">{formatarNumero(indicador.totalElegiveis)}</p></div>}
                    </div>
                    <GraficoIndicador indicador={indicador} cor={indicador.cor} />
                    {indicador.totalRegistros !== null && <p className="mt-2 text-[10px] text-slate-400">{formatarNumero(indicador.totalRegistros)} registro(s) considerados no snapshot.</p>}
                  </div>
                </article>
              );
            })}
            </div>
          </div>
          <style>{`@page { size: A4 landscape; margin: 10mm; }
@media print { body * { visibility: hidden !important; } #brasil360-relatorios-impressao, #brasil360-relatorios-impressao * { visibility: visible !important; } #brasil360-relatorios-impressao { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; margin: 0 !important; padding: 0 !important; background: #fff !important; } .print-report-header { display: block !important; } .print-report-grid { display: grid !important; grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 8px !important; } .print-report-grid article { break-inside: avoid !important; page-break-inside: avoid !important; box-shadow: none !important; border: 1px solid #cbd5e1 !important; transform: none !important; } .print-report-grid article > div { padding: 10px !important; } .print-report-grid svg { max-height: 110px !important; } .print-report-grid * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }`}</style>
        </>
      )}

      {!carregandoUnidades && unidades.length > 0 && !carregandoRelatorio && !resposta && !erro && (
        <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-500">Selecione uma UBS para consultar os relatórios.</div>
      )}
    </section>
  );
}

function ResumoCard({ titulo, valor, detalhe, cor }: { titulo: string; valor: string; detalhe: string; cor: "violeta" | "verde" | "ambar" | "azul" }) {
  const estilos = {
    violeta: "border-violet-200 bg-gradient-to-br from-white to-violet-50 text-violet-800",
    verde: "border-emerald-200 bg-gradient-to-br from-white to-emerald-50 text-emerald-800",
    ambar: "border-amber-200 bg-gradient-to-br from-white to-amber-50 text-amber-800",
    azul: "border-sky-200 bg-gradient-to-br from-white to-sky-50 text-sky-800",
  };
  return <div className={`rounded-2xl border p-4 shadow-[0_5px_14px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-md ${estilos[cor]}`}><p className="text-xs font-semibold opacity-80">{titulo}</p><p className="mt-2 text-3xl font-extrabold">{valor}</p><p className="mt-1 text-[10px] opacity-70">{detalhe}</p></div>;
}
