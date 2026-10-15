"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Activity, ArrowLeft, Baby, Building2, CalendarDays, CheckCircle2, Clock3, Database, Droplets, Heart, LoaderCircle, ShieldCheck, Smile, UsersRound, Venus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { auth } from "@/lib/firebase";
import LoadingBrasil360 from "@/components/ui/LoadingBrasil360";

type DadosUBS = {
  sucesso: boolean;
  possuiDados: boolean;
  versaoDados: number;
  competencia: string | null;
  atualizadoEm: string | null;
  dados: Record<string, unknown>;
  acsAtivos: number;
  pacientes: number;
  mensagem?: string;
};

const GRUPOS = [
  { chave: "c1", titulo: "Mais Acesso", subtitulo: "Acompanhamento do acesso", cor: "#2563EB", fundo: "from-blue-50 to-white", Icone: CalendarDays },
  { chave: "c2", titulo: "Desenvolvimento Infantil", subtitulo: "Acompanhamento infantil", cor: "#003B8E", fundo: "from-indigo-50 to-white", Icone: Baby },
  { chave: "c3", titulo: "Gestação e Puerpério", subtitulo: "Acompanhamento materno", cor: "#0891B2", fundo: "from-cyan-50 to-white", Icone: Heart },
  { chave: "c4", titulo: "Diabetes", subtitulo: "Cuidado da pessoa com diabetes", cor: "#B45309", fundo: "from-amber-50 to-white", Icone: Droplets },
  { chave: "c5", titulo: "Hipertensão", subtitulo: "Cuidado da pessoa com hipertensão", cor: "#CA8A04", fundo: "from-yellow-50 to-white", Icone: Activity },
  { chave: "c6", titulo: "Pessoa Idosa", subtitulo: "Acompanhamento da pessoa idosa", cor: "#1D4ED8", fundo: "from-sky-50 to-white", Icone: UsersRound },
  { chave: "c7", titulo: "Saúde da Mulher", subtitulo: "Prevenção e acompanhamento", cor: "#047857", fundo: "from-emerald-50 to-white", Icone: Venus },
  { chave: "bucal", titulo: "Saúde Bucal", subtitulo: "Indicadores odontológicos", cor: "#15803D", fundo: "from-green-50 to-white", Icone: Smile },
  { chave: "situacaopacientes", titulo: "Situação dos Pacientes", subtitulo: "Resumo agregado da unidade", cor: "#7C3AED", fundo: "from-violet-50 to-white", Icone: ShieldCheck },
];

const ROTULOS_CAMPOS: Record<string, string> = {
  competencia: "Competência",
  pontuacao: "Pontuação",
  classificacao: "Classificação",
  percentualProgramado: "Atendimentos programados (%)",
  atendimentosProgramados: "Atendimentos programados",
  atendimentosEspontaneos: "Atendimentos espontâneos",
  atendimentosNaoInformados: "Atendimentos não informados",
  totalDemandasC1: "Total de atendimentos considerados",
  totalAtendimentos: "Total de atendimentos",
  totalRegistros: "Registros consolidados",
  totalElegiveis: "Pessoas elegíveis",
  totalForaDoC2: "Registros fora do indicador",
  registrosIdentificados: "Registros identificados",
  registrosNaoIdentificados: "Registros não identificados",
  semNenhumRegistro: "Sem nenhum registro",
  comIndicadoresPendentes: "Com indicadores pendentes",
  comIndicadoresConcluidos: "Com indicadores concluídos",
  comRegistroSemIndicadorAplicavel: "Com registro sem indicador aplicável",
  indicadoresConcluidosPercentual: "Indicadores concluídos (%)",
};

function rotulo(chave: string) {
  if (ROTULOS_CAMPOS[chave]) return ROTULOS_CAMPOS[chave];
  return chave.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim().replace(/^\w/, (letra) => letra.toLocaleUpperCase("pt-BR"));
}
const NOMES_PRATICAS_C3: Record<string, string> = {
  A: "1ª consulta até 12 semanas", B: "7 consultas de pré-natal", C: "7 aferições de pressão",
  D: "7 registros de peso e altura", E: "3 visitas domiciliares", F: "dTpa a partir de 20 semanas",
  G: "Exames do 1º trimestre", H: "Exames do 3º trimestre", I: "Consulta no puerpério",
  J: "Visita no puerpério", K: "Saúde bucal",
};

function numeroPt(valor: number): string {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: Number.isInteger(valor) ? 0 : 1, maximumFractionDigits: 1 });
}

function formatarValor(valor: unknown, unidade: "padrao" | "percentual" = "padrao"): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (typeof valor === "number") return `${numeroPt(valor)}${unidade === "percentual" ? "%" : ""}`;
  if (typeof valor === "string") return valor;
  return "Detalhamento disponível";
}
type UnidadeCampo = "padrao" | "percentual";
type TipoCampo = "resultado" | "referencia";
type CampoAgregado = [string, unknown, UnidadeCampo, TipoCampo];

const CAMPOS_REFERENCIA = new Set([
  "codigo", "titulo", "descricao", "motivo", "peso", "disponivel",
  "pontosdisponiveis", "completo", "importacaoid", "competencia", "listatematica",
  "grupocondicoes", "filtroproblemas", "arquivonome", "nomearquivo",
]);

function normalizarChave(chave: string): string {
  return chave.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]/g, "");
}

function camposAgregados(valor: unknown, prefixo = "", indicador = ""): CampoAgregado[] {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return prefixo ? [[prefixo, valor, "padrao", "resultado"]] : [];
  return Object.entries(valor as Record<string, unknown>).flatMap(([chave, item]) => {
    if (Array.isArray(item)) return [];
    const rotuloCampo = rotulo(chave);
    const praticaC3 = indicador === "c3" && prefixo === "Praticas" && NOMES_PRATICAS_C3[chave]
      ? `Prática ${chave} — ${NOMES_PRATICAS_C3[chave]}`
      : null;
    const caminho = praticaC3 ? praticaC3 : prefixo ? `${prefixo} • ${rotuloCampo}` : rotuloCampo;
    if (item && typeof item === "object") return camposAgregados(item, caminho, indicador);
    const chaveNormalizada = normalizarChave(chave);
    const unidade: UnidadeCampo = chaveNormalizada.includes("percentual") || chaveNormalizada === "percentual" ? "percentual" : "padrao";
    const tipo: TipoCampo = CAMPOS_REFERENCIA.has(chaveNormalizada) ? "referencia" : "resultado";
    let caminhoFinal = caminho;
    if (indicador === "c3" && /^Prática [A-K] — /.test(prefixo)) {
      const pratica = prefixo;
      if (chaveNormalizada === "atingidos") caminhoFinal = `${pratica} • Atingidos (quantidade)`;
      if (chaveNormalizada === "pendentes") caminhoFinal = `${pratica} • Pendentes (quantidade)`;
      if (chaveNormalizada === "naoaplicaveis") caminhoFinal = `${pratica} • Não aplicáveis (quantidade)`;
      if (chaveNormalizada === "percentual") caminhoFinal = `${pratica} • Percentual atingido`;
    }
    return [[caminhoFinal, item, unidade, tipo] as CampoAgregado];
  });
}

function metricasPrincipais(valor: unknown, indicador = ""): Array<{ rotulo: string; valor: unknown; destaque?: boolean; unidade?: "padrao" | "percentual" }> {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return [];
  const registro = valor as Record<string, unknown>;
  const candidatas = [
    ["pontuacao", registro.pontuacao, true],
    ["classificacao", registro.classificacao, true],
    ["percentualProgramado", registro.percentualProgramado, true],
    ["totalRegistros", registro.totalRegistros, false],
    ["totalElegiveis", registro.totalElegiveis, false],
    ["totalForaDoC2", registro.totalForaDoC2, false],
    ["totalDemandasC1", registro.totalDemandasC1, false],
    ["atendimentosProgramados", registro.atendimentosProgramados, false],
    ["atendimentosEspontaneos", registro.atendimentosEspontaneos, false],
    ["atendimentosNaoInformados", registro.atendimentosNaoInformados, false],
    ["semNenhumRegistro", registro.semNenhumRegistro, false],
    ["comIndicadoresPendentes", registro.comIndicadoresPendentes, false],
    ["comIndicadoresConcluidos", registro.comIndicadoresConcluidos, false],
    ["indicadoresConcluidosPercentual", registro.indicadoresConcluidosPercentual, true],
  ] as const;
  return candidatas
    .filter((item) => item[1] !== undefined && item[1] !== null && item[1] !== "")
    .map(([chave, valorCampo, destaque]) => ({
      rotulo: indicador === "c3" && chave === "pontuacao" ? "Resultado C3 (%)" : chave === "pontuacao" ? "Pontuação (pontos)" : indicador === "c3" && chave === "totalElegiveis" ? "Gestantes/puérperas elegíveis" : rotulo(chave),
      valor: valorCampo,
      destaque,
      unidade: (indicador === "c3" && chave === "pontuacao") || chave.toLocaleLowerCase("pt-BR").includes("percentual") ? "percentual" as const : "padrao" as const,
    }));
}

export default function AdminUBSDashboardPage() {
  const params = useParams<{ ubsId: string }>();
  const router = useRouter();
  const { usuario, carregando } = useAuth();
  const [dados, setDados] = useState<DadosUBS | null>(null);
  const [nomeUBS, setNomeUBS] = useState("Unidade de Saúde");
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [erro, setErro] = useState("");
  const [indicadorSelecionado, setIndicadorSelecionado] = useState<string | null>(null);
  const ubsId = Array.isArray(params.ubsId) ? params.ubsId[0] : params.ubsId;

  useEffect(() => {
    if (carregando) return;
    if (!usuario) { router.replace("/login"); return; }
    if (usuario.perfil !== "administrador_municipal") { router.replace(usuario.perfil === "acs" ? "/acs" : "/dashboard"); }
  }, [usuario, carregando, router]);

  useEffect(() => {
    if (carregando || !usuario || usuario.perfil !== "administrador_municipal" || !ubsId) return;
    let cancelado = false;
    async function carregar() {
      setCarregandoDados(true); setErro("");
      try {
        const atual = auth.currentUser;
        if (!atual) throw new Error("Sua sessão expirou. Entre novamente.");
        const token = await atual.getIdToken();
        const resposta = await fetch(`/api/admin/ubs/dashboard?ubsId=${encodeURIComponent(ubsId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const resultado = await resposta.json();
        if (!resposta.ok || resultado?.sucesso !== true) throw new Error(resultado?.mensagem || "Não foi possível carregar os dados desta UBS.");
        if (!cancelado) {
          setDados(resultado as DadosUBS);
          const lista = await fetch("/api/admin/ubs?somenteLista=1", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
          const unidades = await lista.json();
          const unidade = Array.isArray(unidades?.ubs) ? unidades.ubs.find((item: { id: string }) => item.id === ubsId) : null;
          if (unidade && !cancelado) setNomeUBS(unidade.nome);
        }
      } catch (e) { if (!cancelado) setErro(e instanceof Error ? e.message : "Erro ao consultar a UBS."); }
      finally { if (!cancelado) setCarregandoDados(false); }
    }
    void carregar();
    return () => { cancelado = true; };
  }, [carregando, usuario, ubsId]);

  useEffect(() => {
    if (!indicadorSelecionado) return;
    function fecharComEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIndicadorSelecionado(null);
    }
    window.addEventListener("keydown", fecharComEscape);
    return () => window.removeEventListener("keydown", fecharComEscape);
  }, [indicadorSelecionado]);

  const grupos = useMemo(() => GRUPOS.map((grupo) => ({ ...grupo, valor: dados?.dados?.[grupo.chave] ?? dados?.dados?.[grupo.chave.toUpperCase()] })).filter((grupo) => grupo.valor !== undefined), [dados]);
  const grupoSelecionado = grupos.find((grupo) => grupo.chave === indicadorSelecionado) ?? null;

  if (carregando || !usuario || usuario.perfil !== "administrador_municipal") return <LoadingBrasil360 mensagem="Verificando acesso..." subtitulo="Validando seu perfil administrativo" />;

  return (
    <main className="min-h-screen bg-[#F8F7FF] px-4 py-5 text-[#211A4A] sm:px-7 sm:py-7">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="relative isolate overflow-hidden rounded-3xl border border-emerald-200/60 bg-gradient-to-br from-[#009C3B]/95 via-[#00A9E8]/85 to-[#F2C300]/85 p-5 text-white shadow-[0_12px_30px_rgba(0,156,59,0.18)] sm:p-7">
          <div className="pointer-events-none absolute -right-5 -top-8 h-40 w-40 rounded-full bg-white/20 blur-3xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20"><Building2 size={24} /></div><div><p className="text-xs font-semibold text-white/80">Dashboard administrativo da UBS</p><h1 className="mt-1 text-xl font-extrabold sm:text-2xl">{nomeUBS}</h1><p className="mt-1 text-xs text-white/90">{usuario.municipio} — {usuario.uf}</p></div></div>
            <button onClick={() => router.push("/admin")} className="inline-flex items-center gap-2 rounded-xl border border-white/50 bg-white/15 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/25"><ArrowLeft size={15} /> Voltar à visão municipal</button>
          </div>
        </header>

        {carregandoDados ? <div className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-white p-6 text-sm text-gray-500"><LoaderCircle className="animate-spin" size={20} /> Carregando snapshots consolidados da unidade...</div> : erro ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{erro}</div> : dados ? <>
          {!dados.possuiDados && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">{dados.mensagem || "Esta UBS ainda não possui snapshot consolidado. Os indicadores não serão apresentados como desempenho zero."}</div>}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-indigo-100/70 p-4 shadow-[0_7px_16px_rgba(79,70,229,.12)] transition hover:-translate-y-1"><p className="text-xs font-semibold text-indigo-800">Pacientes cadastrados</p><p className="mt-2 text-3xl font-extrabold text-indigo-700">{dados.pacientes.toLocaleString("pt-BR")}</p><p className="mt-1 text-[10px] text-indigo-700/70">Somente total agregado</p></div>
            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/70 p-4 shadow-[0_7px_16px_rgba(16,185,129,.12)] transition hover:-translate-y-1"><p className="flex items-center gap-2 text-xs font-semibold text-emerald-800"><UsersRound size={14} /> ACS ativos</p><p className="mt-2 text-3xl font-extrabold text-emerald-700">{dados.acsAtivos.toLocaleString("pt-BR")}</p></div>
            <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-sky-100/70 p-4 shadow-[0_7px_16px_rgba(14,165,233,.12)] transition hover:-translate-y-1"><p className="flex items-center gap-2 text-xs font-semibold text-sky-800"><CalendarDays size={14} /> Competência</p><p className="mt-2 text-xl font-extrabold text-sky-700">{dados.competencia || "—"}</p></div>
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-amber-100/70 p-4 shadow-[0_7px_16px_rgba(245,158,11,.12)] transition hover:-translate-y-1"><p className="flex items-center gap-2 text-xs font-semibold text-amber-800"><Clock3 size={14} /> Última atualização</p><p className="mt-2 text-sm font-bold text-amber-700">{dados.atualizadoEm ? new Date(dados.atualizadoEm).toLocaleString("pt-BR") : "Ainda não disponível"}</p></div>
          </section>

          {dados.possuiDados && <section className="space-y-3"><div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-lg font-extrabold">Indicadores da unidade</h2><p className="mt-1 text-xs text-gray-500">Selecione um indicador para ver seus principais resultados e o detalhamento consolidado disponível. Nenhum dado individual de paciente é exibido.</p></div><span className="rounded-full bg-violet-100 px-3 py-1.5 text-[10px] font-bold text-violet-700">Snapshot v{dados.versaoDados}</span></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {grupos.map((grupo) => {
                const Icone = grupo.Icone;
                return (
                  <button
                    key={grupo.chave}
                    type="button"
                    onClick={() => setIndicadorSelecionado(grupo.chave)}
                    aria-label={`Ver detalhamento de ${grupo.titulo}`}
                    className={`group min-h-32 rounded-2xl border border-white bg-gradient-to-br ${grupo.fundo} p-4 text-left shadow-[0_7px_16px_rgba(33,26,74,.08)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_13px_25px_rgba(33,26,74,.15)] focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/90 shadow-sm" style={{ color: grupo.cor }}><Icone size={18} /></span>
                      <span className="rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-bold shadow-sm transition group-hover:bg-white" style={{ color: grupo.cor }}>Ver dados <span aria-hidden="true">↗</span></span>
                    </div>
                    <h3 className="mt-3 text-sm font-extrabold" style={{ color: grupo.cor }}>{grupo.titulo}</h3>
                    <p className="mt-1 text-[11px] text-gray-500">{grupo.subtitulo}</p>
                  </button>
                );
              })}
            </div>
          </section>}
          {grupoSelecionado && (() => {
            const IconeModal = grupoSelecionado.Icone;
            const metricas = metricasPrincipais(grupoSelecionado.valor, grupoSelecionado.chave);
            const todosCampos = camposAgregados(grupoSelecionado.valor, "", grupoSelecionado.chave).filter(([campo]) => ![
              "Pontuação", "Classificação", "Atendimentos programados (%)", "Registros consolidados", "Pessoas elegíveis", "Registros fora do indicador", "Total de atendimentos considerados", "Atendimentos programados", "Atendimentos espontâneos", "Atendimentos não informados", "Sem nenhum registro", "Com indicadores pendentes", "Com indicadores concluídos", "Indicadores concluídos (%)"
            ].includes(campo));
            const campos = todosCampos.filter(([, , , tipo]) => tipo === "resultado");
            const referencias = todosCampos.filter(([, , , tipo]) => tipo === "referencia");
            const coresMini = [
              "border-blue-100 bg-blue-50/90 text-blue-800",
              "border-emerald-100 bg-emerald-50/90 text-emerald-800",
              "border-amber-100 bg-amber-50/90 text-amber-800",
              "border-violet-100 bg-violet-50/90 text-violet-800",
              "border-cyan-100 bg-cyan-50/90 text-cyan-800",
              "border-rose-100 bg-rose-50/90 text-rose-800",
            ];
            return (
              <div
                className="fixed inset-0 z-[100] flex items-center justify-center bg-[#17132D]/55 p-3 backdrop-blur-sm sm:p-6"
                role="presentation"
                onMouseDown={(event) => { if (event.target === event.currentTarget) setIndicadorSelecionado(null); }}
              >
                <section role="dialog" aria-modal="true" aria-labelledby="titulo-detalhe-indicador" className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/70 bg-[#F8F7FF] shadow-[0_28px_90px_rgba(23,19,45,.35)]">
                  <header className="relative shrink-0 overflow-hidden border-b border-white/50 bg-gradient-to-br from-[#009C3B]/95 via-[#00A9E8]/90 to-[#7C3AED]/85 px-5 py-5 text-white sm:px-7">
                    <div className="pointer-events-none absolute -right-5 -top-12 h-40 w-40 rounded-full bg-white/20 blur-3xl" />
                    <div className="relative flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 shadow-inner"><IconeModal size={24} /></span>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-white/80">Detalhamento consolidado da UBS</p>
                          <h2 id="titulo-detalhe-indicador" className="mt-1 text-lg font-extrabold sm:text-2xl">{grupoSelecionado.titulo}</h2>
                          <p className="mt-1 text-xs text-white/90">{nomeUBS} • {dados.competencia || "Competência não informada"}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => setIndicadorSelecionado(null)} className="shrink-0 rounded-xl border border-white/50 bg-white/15 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/25" aria-label="Fechar detalhamento">Fechar <span aria-hidden="true">×</span></button>
                    </div>
                  </header>
                  <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-7">
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                      <div><h3 className="text-sm font-extrabold text-[#211A4A]">Resultados do indicador</h3><p className="mt-1 text-xs text-gray-500">Valores disponíveis no snapshot, sem recálculo e sem dados individuais.</p></div>
                      <span className="rounded-full bg-violet-100 px-3 py-1.5 text-[10px] font-bold text-violet-700">Snapshot v{dados.versaoDados}</span>
                    </div>
                    {metricas.length > 0 && <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {metricas.map((metrica, index) => <div key={metrica.rotulo} className={`rounded-2xl border p-4 shadow-[0_5px_12px_rgba(33,26,74,.06)] ${metrica.destaque ? "border-violet-200 bg-gradient-to-br from-violet-50 to-white" : "border-sky-100 bg-gradient-to-br from-sky-50/80 to-white"}`}>
                        <p className="text-[11px] font-semibold text-slate-500">{metrica.rotulo}</p><p className={`mt-2 text-2xl font-extrabold ${metrica.destaque ? "text-violet-700" : "text-[#211A4A]"}`}>{formatarValor(metrica.valor, metrica.unidade)}</p>
                      </div>)}
                    </div>}
                    {grupoSelecionado.chave === "c1" && <section className="mb-6 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-violet-100/80 p-4 shadow-[0_8px_20px_rgba(124,58,237,.09)] sm:p-5">
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-white text-violet-600 shadow-sm"><Activity size={18} /></span>
                        <div>
                          <h3 className="text-sm font-extrabold text-[#211A4A]">Como entender o Mais Acesso?</h3>
                          <p className="mt-1 text-xs leading-relaxed text-slate-600">O C1 mostra qual parte dos atendimentos considerados foi programada, em comparação com a soma dos atendimentos programados e espontâneos. Ele descreve a composição dos atendimentos registrados — não a porcentagem da população atendida nem a porcentagem de pessoas que conseguiram consulta.</p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-3">
                          <p className="text-xs font-extrabold text-sky-800">Demanda programada</p>
                          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">Consulta agendada, consulta agendada programada e cuidado continuado.</p>
                        </div>
                        <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-3">
                          <p className="text-xs font-extrabold text-amber-800">Demanda espontânea</p>
                          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">Escuta inicial/orientação, consulta no dia e atendimento de urgência.</p>
                        </div>
                      </div>
                      <div className="mt-4 rounded-xl border border-violet-100 bg-white/90 p-3">
                        <h4 className="text-xs font-extrabold text-[#211A4A]">Como interpretar a classificação oficial</h4>
                        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
                          <div className="rounded-lg border border-violet-100 bg-violet-50 p-3"><p className="text-[10px] font-semibold text-violet-700">Regular</p><p className="mt-1 text-xs font-extrabold text-violet-900">≤ 10% ou &gt; 70%</p></div>
                          <div className="rounded-lg border border-amber-100 bg-amber-50 p-3"><p className="text-[10px] font-semibold text-amber-700">Suficiente</p><p className="mt-1 text-xs font-extrabold text-amber-900">&gt; 10% até 30%</p></div>
                          <div className="rounded-lg border border-sky-100 bg-sky-50 p-3"><p className="text-[10px] font-semibold text-sky-700">Bom</p><p className="mt-1 text-xs font-extrabold text-sky-900">&gt; 30% até 50%</p></div>
                          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3"><p className="text-[10px] font-semibold text-emerald-700">Ótimo</p><p className="mt-1 text-xs font-extrabold text-emerald-900">&gt; 50% até 70%</p></div>
                        </div>
                        <p className="mt-3 text-[10px] leading-relaxed text-slate-500">A faixa oficial não significa que quanto maior o percentual, melhor em qualquer situação. Um percentual muito baixo pode indicar pouca oferta programada; um percentual acima de 70% pode indicar pouca abertura à demanda espontânea. A interpretação deve considerar a organização local do acesso.</p>
                      </div>
                      <div className="mt-3 rounded-xl border border-slate-200 bg-white/80 p-3 text-[10px] leading-relaxed text-slate-600"><strong className="text-[#211A4A]">Fórmula:</strong> atendimentos de demanda programada ÷ (atendimentos de demanda programada + atendimentos de demanda espontânea) × 100. <br /><strong className="text-[#211A4A]">Importante:</strong> este painel apresenta um cálculo operacional com base nos registros identificados no snapshot importado do PEC. Não substitui o resultado oficial do SIAPS; a metodologia oficial também considera a compatibilidade da equipe e do CBO profissional.</div>
                    </section>}
                    {campos.length > 0 ? <section>
                      <div className="mb-3 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: grupoSelecionado.cor }} /><h3 className="text-sm font-extrabold text-[#211A4A]">Práticas e resultados detalhados</h3></div>
                      {grupoSelecionado.chave === "c3" && <p className="mb-3 rounded-xl border border-cyan-100 bg-cyan-50/70 px-3 py-2 text-[11px] leading-relaxed text-cyan-900">Percentuais são exibidos com %. Atingidos, pendentes e não aplicáveis são quantidades de registros elegíveis, não percentuais.</p>}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {campos.map(([campo, valor, unidade], index) => <div key={`${campo}-${index}`} className={`min-h-[88px] rounded-2xl border p-4 shadow-[0_5px_12px_rgba(33,26,74,.05)] transition hover:-translate-y-0.5 hover:shadow-md ${coresMini[index % coresMini.length]}`}>
                          <p className="text-[11px] font-semibold leading-relaxed opacity-80">{campo}</p><p className="mt-2 text-xl font-extrabold">{formatarValor(valor, unidade)}</p>
                        </div>)}
                      </div>
                    </section> : null}
                    {referencias.length > 0 && <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                      <div className="mb-3"><h3 className="text-sm font-extrabold text-slate-700">Informações de referência do indicador</h3><p className="mt-1 text-xs text-slate-500">Dados explicativos da prática — não são resultados nem devem ser interpretados como pontuação ou percentual.</p></div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {referencias.map(([campo, valor], index) => <div key={`${campo}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3">
                          <p className="text-[10px] font-semibold leading-relaxed text-slate-500">{campo}</p><p className="mt-1 break-words text-sm font-bold text-slate-700">{formatarValor(valor)}</p>
                        </div>)}
                      </div>
                    </section>}
                    {!metricas.length && !campos.length && referencias.length === 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">Ainda não há resultados consolidados disponíveis para este indicador.</div>}
                    <div className="mt-6 flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3 text-[11px] leading-relaxed text-slate-500"><Database size={15} className="mt-0.5 shrink-0" /> Informações provenientes do snapshot existente. Nenhuma lista ou identificação individual de paciente é exibida.</div>
                  </div>
                  <footer className="flex shrink-0 justify-end border-t border-violet-100 bg-white/90 px-4 py-3 sm:px-7"><button type="button" onClick={() => setIndicadorSelecionado(null)} className="rounded-xl bg-[#7C3AED] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#6D28D9]">Voltar aos indicadores</button></footer>
                </section>
              </div>
            );
          })()}
          <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white/80 p-3 text-[11px] leading-relaxed text-slate-500"><Database size={15} className="mt-0.5 shrink-0" /> Os dados são lidos dos snapshots existentes. Informações individualizadas e listas de pacientes não são disponibilizadas nesta tela.</div>
        </> : null}
        <footer className="flex items-center gap-2 py-2 text-[10px] text-gray-400"><ShieldCheck size={13} /> Brasil 360 • Administração municipal</footer>
      </div>
    </main>
  );
}
