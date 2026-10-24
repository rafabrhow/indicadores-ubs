"use client";

import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { BadgeCheck, Building2, CalendarDays, CreditCard, LogOut, RefreshCw, ShieldCheck, Ban, CalendarPlus, AlertTriangle, X, ArrowLeft, HeartPulse } from "lucide-react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

type Pagamento = { id: string; valor: number; referencia: string; observacao: string; confirmadoPor: string; confirmadoEm: string | null }

type Profissional = {
  profissionalUid: string; nome: string; email: string; ativo: boolean; ubsId: string; ubsNome: string; municipio: string; uf: string;
  valorMensal: number; proximoVencimentoEm: string | null; ultimoPagamentoEm: string | null; ultimaCompetenciaPaga: string; status: string; observacao: string;
};

const statusLabels: Record<string, string> = {
  ativa: "Em dia", em_tolerancia: "Em tolerância", suspensa_por_atraso: "Atrasada",
  suspensa_manual: "Suspensa manualmente", cancelada: "Cancelada", pendente_configuracao: "Configurar assinatura",
};

function dataBR(value: string | null) {
  if (!value) return "—";
  const [ano, mes, dia] = value.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function DesenvolvedorPage() {
  const { usuario, carregando } = useAuth();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregandoDados, setCarregandoDados] = useState(false);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [selecionada, setSelecionada] = useState("");
  const [valorMensal, setValorMensal] = useState("0");
  const [vencimento, setVencimento] = useState("");
  const [observacao, setObservacao] = useState("");
  const [valorPagamento, setValorPagamento] = useState("");
  const [competencia, setCompetencia] = useState(new Date().toISOString().slice(0, 7));
  const [observacaoPagamento, setObservacaoPagamento] = useState("");
  const [acaoPendente, setAcaoPendente] = useState<"cancelar" | "gerar_proxima_mensalidade" | null>(null);
  const [executandoAcao, setExecutandoAcao] = useState(false);

  useEffect(() => onAuthStateChanged(auth, setFirebaseUser), []);

  const chamarAPI = useCallback(async (url: string, init: RequestInit = {}) => {
    if (!firebaseUser) throw new Error("Entre com a conta de desenvolvedora.");
    const token = await firebaseUser.getIdToken();
    const resposta = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    });
    const dados = await resposta.json();
    if (!resposta.ok || dados.sucesso === false) throw new Error(dados.mensagem ?? "Falha na operação.");
    return dados;
  }, [firebaseUser]);

  const carregar = useCallback(async () => {
    if (!firebaseUser) return;
    setCarregandoDados(true); setErro("");
    try {
      const dados = await chamarAPI("/api/desenvolvedor/assinaturas");
      setProfissionais(dados.profissionais ?? []);
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível carregar as UBS."); }
    finally { setCarregandoDados(false); }
  }, [firebaseUser, chamarAPI]);

  useEffect(() => { void carregar(); }, [carregar]);

  const profissionalAtual = profissionais.find((u) => u.profissionalUid === selecionada);
  useEffect(() => {
    if (!firebaseUser || !selecionada) { setPagamentos([]); return; }
    let cancelado = false;
    void chamarAPI(`/api/desenvolvedor/pagamentos?profissionalUid=${encodeURIComponent(selecionada)}`)
      .then((dados) => { if (!cancelado) setPagamentos(dados.pagamentos ?? []); })
      .catch(() => { if (!cancelado) setPagamentos([]); });
    return () => { cancelado = true; };
  }, [firebaseUser, selecionada, chamarAPI]);

  useEffect(() => {
    if (!profissionalAtual) return;
    setValorMensal(String(profissionalAtual.valorMensal ?? 0));
    setVencimento(profissionalAtual.proximoVencimentoEm ?? "");
    setObservacao(profissionalAtual.observacao ?? "");
    setValorPagamento(String(profissionalAtual.valorMensal ?? ""));
  }, [selecionada, profissionalAtual]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault(); setErro("");
    try { await signInWithEmailAndPassword(auth, email.trim(), senha); }
    catch { setErro("Não foi possível entrar. Confira o e-mail e a senha da conta de desenvolvedora."); }
  }

  async function salvarAssinatura(e: React.FormEvent) {
    e.preventDefault(); setErro(""); setMensagem("");
    try {
      const result = await chamarAPI("/api/desenvolvedor/assinaturas", { method: "PUT", body: JSON.stringify({ profissionalUid: selecionada, valorMensal: Number(valorMensal), proximoVencimentoEm: vencimento, observacao }) });
      setMensagem(result.mensagem); await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao salvar."); }
  }

  async function executarAcaoAssinatura(acao: "cancelar" | "gerar_proxima_mensalidade") {
    if (!selecionada) return;
    setAcaoPendente(acao);
  }

  async function confirmarAcaoPendente() {
    if (!selecionada || !acaoPendente || executandoAcao) return;
    setExecutandoAcao(true); setErro(""); setMensagem("");
    try {
      const result = await chamarAPI("/api/desenvolvedor/assinaturas", { method: "PUT", body: JSON.stringify({ profissionalUid: selecionada, acao: acaoPendente }) });
      setMensagem(result.mensagem); setAcaoPendente(null); await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível concluir a ação."); }
    finally { setExecutandoAcao(false); }
  }

  async function confirmarPagamento(e: React.FormEvent) {
    e.preventDefault(); setErro(""); setMensagem("");
    try {
      const result = await chamarAPI("/api/desenvolvedor/pagamentos", { method: "POST", body: JSON.stringify({ profissionalUid: selecionada, valor: Number(valorPagamento), referencia: competencia, observacao: observacaoPagamento }) });
      setMensagem(result.mensagem); setObservacaoPagamento(""); await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao registrar pagamento."); }
  }

  if (carregando) return <main className="min-h-screen bg-slate-50 p-8 text-slate-600">Verificando sessão…</main>;

  if (!firebaseUser) return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F7FF] px-4 py-6 sm:px-6">
  <div className="mx-auto flex w-full max-w-[1100px] items-center justify-center">
    <div className="grid w-full overflow-hidden rounded-3xl bg-white shadow-xl md:grid-cols-2">
          <section className="hidden bg-[#7C3AED] p-8 text-white md:flex md:flex-col md:justify-between lg:p-10">
            <div>
              <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-white/90 transition hover:text-white">
                <ArrowLeft size={18} />
                Voltar
              </Link>
              <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15">
                <HeartPulse size={34} />
              </div>
              <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">Indicadores-UBS</h1>
              <p className="mt-4 max-w-md text-base leading-relaxed text-white/85 lg:text-lg">
                Gerênciamento do Sistema e Acessos.
              </p>
            </div>
            <p className="text-xs text-white/70 sm:text-sm">Acesso seguro para profissionais autorizados. V.9</p>
          </section>

          <section className="p-6 sm:p-8 lg:p-12">
            <div className="mb-7 sm:mb-8">
              <h2 className="text-2xl font-bold text-[#211A4A] sm:text-3xl">Entrar</h2>
              <p className="mt-2 text-sm text-gray-500">Acesse sua conta para continuar.</p>
              <p className="mt-1 text-xs text-gray-400">Área restrita à conta comercial autorizada.</p>
            </div>
            <form onSubmit={entrar} className="space-y-4 sm:space-y-5">
              <div>
                <label htmlFor="dev-email" className="mb-2 block text-sm font-semibold text-gray-700">E-mail</label>
                <input id="dev-email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20" />
              </div>
              <div>
                <label htmlFor="dev-senha" className="mb-2 block text-sm font-semibold text-gray-700">Senha</label>
                <input id="dev-senha" type="password" required autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20" />
              </div>
              {erro && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
              <button type="submit" className="flex w-full items-center justify-center rounded-xl bg-[#7C3AED] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#6D28D9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] focus-visible:ring-offset-2">Entrar</button>
            </form>
            <div className="mt-6 text-center text-sm">
              <Link href="/" className="font-medium text-[#7C3AED] transition hover:underline">Voltar ao início</Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );

  if (usuario?.perfil !== "desenvolvedor") return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><div className="max-w-md rounded-2xl border bg-white p-8 text-center"><ShieldCheck className="mx-auto text-red-600" size={38}/><h1 className="mt-4 text-xl font-bold">Acesso não autorizado</h1><p className="mt-2 text-sm text-slate-600">Esta conta não possui o perfil de desenvolvedora.</p><button onClick={() => signOut(auth)} className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-white">Sair</button></div></main>
  );

  return (
    <main className="min-h-screen bg-[#F8F7FF] text-[#211A4A]">
      <section className="min-w-0 pb-6">
        <header className="relative isolate mx-auto w-full overflow-hidden rounded-b-[28px] border border-emerald-200/60 bg-gradient-to-br from-[#009C3B]/95 via-[#00A9E8]/85 to-[#F2C300]/85 px-6 py-5 text-white shadow-[0_12px_30px_rgba(0,156,59,0.18),0_5px_12px_rgba(0,59,142,0.12)] backdrop-blur-md sm:px-8">
          <div className="pointer-events-none absolute -left-10 -top-14 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
          <div className="pointer-events-none absolute right-8 -top-16 h-40 w-40 rounded-full bg-[#F2C300]/25 blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-70px] left-1/2 h-40 w-64 -translate-x-1/2 rounded-full bg-[#00A9E8]/20 blur-3xl" />
          <div className="relative pr-28 sm:pr-32">
            <p className="text-[11px] font-semibold text-white/85">Controle comercial</p>
            <h1 className="mt-1 text-xl font-bold tracking-tight drop-shadow-sm sm:text-2xl">Painel do desenvolvedor</h1>
            <p className="mt-1 text-[10px] text-white/90 sm:text-xs">Assinaturas individuais por profissional · tolerância de 5 dias</p>
          </div>
          <button onClick={() => signOut(auth)} className="absolute right-[5.5rem] top-1/2 flex -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-xl border border-white/40 bg-white/15 px-3 py-2 text-sm text-white transition hover:bg-white/25 sm:right-28"><LogOut size={16}/> Sair</button>
          <img src="/brasil360-logo-header.png" alt="Brasil 360" width={88} height={88} className="absolute right-3 top-1/2 h-12 w-12 -translate-y-1/2 rounded-xl object-cover shadow-[0_8px_18px_rgba(0,59,142,0.22)] ring-1 ring-white/50 sm:right-5 sm:h-16 sm:w-16" />
        </header>
        <div className="px-4 py-5 sm:px-7 sm:py-7">
          <div className="mx-auto grid w-full max-w-[1600px] grid-cols-1 items-start gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:gap-5">
        <section className="min-w-0 rounded-2xl border border-sky-100 bg-gradient-to-br from-[#F8FCFF] via-white to-[#EAF7FC] p-4 shadow-[0_10px_0_rgba(14,165,233,0.06),0_16px_32px_rgba(30,64,175,0.08)] sm:p-5 lg:p-6">
          <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-[#211A4A] sm:text-base">Profissionais e assinaturas</h2><p className="mt-1 text-sm text-slate-500">{profissionais.length} profissionais cadastrados</p></div><button onClick={() => void carregar()} className="rounded-lg border p-2 text-slate-600 hover:bg-slate-50" title="Atualizar"><RefreshCw size={18}/></button></div>
          {erro && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}{mensagem && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{mensagem}</p>}
          <div className="mt-4 space-y-3">
            {carregandoDados && <p className="py-6 text-sm text-slate-500">Carregando profissionais…</p>}
            {profissionais.map((u) => <button key={u.profissionalUid} onClick={() => setSelecionada(u.profissionalUid)} className={`group w-full min-w-0 rounded-2xl border p-4 text-left shadow-[0_4px_0_rgba(30,64,175,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_0_rgba(30,64,175,0.06),0_14px_24px_rgba(30,64,175,0.08)] ${selecionada === u.profissionalUid ? "border-violet-300 bg-gradient-to-br from-white via-violet-50 to-violet-100/70" : "border-sky-100 bg-white hover:border-sky-200"}`}><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="font-semibold">{u.nome}</p><p className="mt-1 text-xs text-slate-500">{u.email || "Sem e-mail"} · UID: {u.profissionalUid}</p><p className="mt-1 text-xs text-slate-600">UBS: {u.ubsNome}{u.municipio ? ` · ${u.municipio}` : ""}{u.uf ? `/${u.uf}` : ""}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${u.status === "ativa" ? "bg-emerald-100 text-emerald-800" : u.status === "em_tolerancia" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}>{statusLabels[u.status] ?? u.status}</span></div><div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600"><span>Mensalidade: {u.valorMensal.toLocaleString("pt-BR", {style:"currency",currency:"BRL"})}</span><span>Vencimento: {dataBR(u.proximoVencimentoEm)}</span><span>Último pagamento: {dataBR(u.ultimoPagamentoEm)}</span></div></button>)}
            {!carregandoDados && profissionais.length === 0 && <p className="py-8 text-sm text-slate-500">Nenhuma profissional cadastrada para assinatura.</p>}
          </div>
        </section>
        <div className="min-w-0 space-y-4 sm:space-y-5">
          <section className="min-w-0 rounded-2xl border border-sky-100 bg-gradient-to-br from-[#F8FCFF] via-white to-[#EAF7FC] p-4 shadow-[0_10px_0_rgba(14,165,233,0.06),0_16px_32px_rgba(30,64,175,0.08)] sm:p-5 lg:p-6"><div className="flex items-center gap-3"><Building2 className="text-indigo-700"/><div><h2 className="text-sm font-bold text-[#211A4A] sm:text-base">Configurar assinatura</h2><p className="text-sm text-slate-500">Defina a mensalidade e o vencimento da profissional selecionada.</p></div></div>
            {!selecionada ? <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Selecione uma profissional na lista ao lado.</p> : <form onSubmit={salvarAssinatura} className="mt-5 space-y-4"><p className="text-sm font-semibold text-slate-700">{profissionalAtual?.nome}</p><p className="text-xs text-slate-500">UBS: {profissionalAtual?.ubsNome}</p><div><label className="text-sm font-medium">Valor mensal (R$)</label><input type="number" min="0" step="0.01" required value={valorMensal} onChange={(e) => setValorMensal(e.target.value)} className="mt-1 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#211A4A] outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"/></div><div><label className="text-sm font-medium">Próximo vencimento</label><input type="date" required value={vencimento} onChange={(e) => setVencimento(e.target.value)} className="mt-1 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#211A4A] outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"/></div><div><label className="text-sm font-medium">Observação (opcional)</label><textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} maxLength={500} rows={2} className="mt-1 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#211A4A] outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"/></div><p className="text-xs text-slate-500">O vencimento é individual por profissional. A validação do acesso será aplicada às rotas protegidas e testada antes da publicação.</p><button disabled={profissionalAtual?.status !== "pendente_configuracao"} className="w-full rounded-xl bg-indigo-700 px-4 py-3 font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-300">{profissionalAtual?.status === "pendente_configuracao" ? "Salvar configuração" : "Assinatura já configurada"}</button></form>}
            {selecionada && profissionalAtual && profissionalAtual.status !== "pendente_configuracao" && <div className="mt-4 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => void executarAcaoAssinatura("gerar_proxima_mensalidade")} disabled={profissionalAtual.status === "cancelada" || !profissionalAtual.ultimaCompetenciaPaga || profissionalAtual.ultimaCompetenciaPaga !== (profissionalAtual.proximoVencimentoEm ? profissionalAtual.proximoVencimentoEm.slice(0, 7) : "")} className="flex items-center justify-center gap-2 rounded-xl border border-indigo-200 px-4 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"><CalendarPlus size={17}/> Gerar próxima mensalidade</button><button type="button" onClick={() => void executarAcaoAssinatura("cancelar")} disabled={profissionalAtual.status === "cancelada"} className="flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"><Ban size={17}/> Cancelar assinatura</button></div>}
          </section>
          <section className="min-w-0 rounded-2xl border border-sky-100 bg-gradient-to-br from-[#F8FCFF] via-white to-[#EAF7FC] p-4 shadow-[0_10px_0_rgba(14,165,233,0.06),0_16px_32px_rgba(30,64,175,0.08)] sm:p-5 lg:p-6"><div className="flex items-center gap-3"><CreditCard className="text-emerald-700"/><div><h2 className="text-sm font-bold text-[#211A4A] sm:text-base">Confirmar pagamento</h2><p className="text-sm text-slate-500">Registro manual com trilha de auditoria.</p></div></div>
            <form onSubmit={confirmarPagamento} className="mt-5 space-y-4"><div><label className="text-sm font-medium">Valor recebido (R$)</label><input type="number" min="0.01" step="0.01" required disabled={!selecionada} value={valorPagamento} onChange={(e) => setValorPagamento(e.target.value)} className="mt-1 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#211A4A] outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-100"/></div><div><label className="text-sm font-medium">Competência</label><input type="month" required disabled={!selecionada} value={competencia} onChange={(e) => setCompetencia(e.target.value)} className="mt-1 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#211A4A] outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-100"/></div><div><label className="text-sm font-medium">Observação do pagamento (opcional)</label><textarea disabled={!selecionada} value={observacaoPagamento} onChange={(e) => setObservacaoPagamento(e.target.value)} maxLength={500} rows={2} className="mt-1 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#211A4A] outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-100"/></div><button disabled={!selecionada} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"><BadgeCheck size={18}/> Confirmar recebimento</button></form>
          </section>
          <section className="min-w-0 rounded-2xl border border-sky-100 bg-gradient-to-br from-[#F8FCFF] via-white to-[#EAF7FC] p-4 shadow-[0_10px_0_rgba(14,165,233,0.06),0_16px_32px_rgba(30,64,175,0.08)] sm:p-5 lg:p-6"><h2 className="text-sm font-bold text-[#211A4A] sm:text-base">Histórico de pagamentos</h2><p className="mt-1 text-sm text-slate-500">Últimos 20 pagamentos da profissional selecionada.</p>{!selecionada ? <p className="mt-4 text-sm text-slate-500">Selecione uma profissional para ver o histórico.</p> : pagamentos.length === 0 ? <p className="mt-4 text-sm text-slate-500">Nenhum pagamento registrado.</p> : <div className="mt-4 space-y-3">{pagamentos.map((p) => <div key={p.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{p.valor.toLocaleString("pt-BR", {style:"currency",currency:"BRL"})}</p><p className="text-xs text-slate-500">Competência {p.referencia}</p></div><span className="text-xs text-slate-500">{p.confirmadoEm ? new Date(p.confirmadoEm).toLocaleDateString("pt-BR") : "Data indisponível"}</span></div>{p.observacao && <p className="mt-2 text-xs text-slate-600">{p.observacao}</p>}<p className="mt-2 text-[11px] text-slate-400">Confirmado por UID: {p.confirmadoPor || "—"}</p></div>)}</div>}</section>
          <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900"><CalendarDays size={17} className="mt-0.5 shrink-0"/>A assinatura e o histórico financeiro são individuais por UID. O bloqueio operacional precisa ser validado no servidor antes de considerar a implantação concluída.</p>
          </div>
          </div>
        </div>
      </section>
      {acaoPendente && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !executandoAcao) setAcaoPendente(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="confirmacao-titulo" aria-describedby="confirmacao-descricao" className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start gap-3 p-5 sm:p-6">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${acaoPendente === "cancelar" ? "bg-red-100 text-red-700" : "bg-indigo-100 text-indigo-700"}`}>
                {acaoPendente === "cancelar" ? <Ban size={22} /> : <CalendarPlus size={22} />}
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="confirmacao-titulo" className="text-lg font-bold text-slate-900">{acaoPendente === "cancelar" ? "Cancelar assinatura?" : "Gerar próxima mensalidade?"}</h2>
                <p id="confirmacao-descricao" className="mt-2 text-sm leading-6 text-slate-600">{acaoPendente === "cancelar" ? `A assinatura de ${profissionalAtual?.nome ?? "esta profissional"} será cancelada e o acesso será negado. Os dados e o histórico financeiro serão preservados. Esta ação não pode ser desfeita automaticamente.` : "A próxima mensalidade será criada manualmente. Esta ação só é permitida depois que o pagamento da mensalidade atual estiver confirmado."}</p>
              </div>
              <button type="button" onClick={() => setAcaoPendente(null)} disabled={executandoAcao} aria-label="Fechar" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"><X size={19} /></button>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button type="button" onClick={() => setAcaoPendente(null)} disabled={executandoAcao} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50">Voltar</button>
              <button type="button" onClick={() => void confirmarAcaoPendente()} disabled={executandoAcao} className={`inline-flex min-w-[190px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold !text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${acaoPendente === "cancelar" ? "bg-red-600 hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600" : "bg-indigo-700 hover:bg-indigo-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"}`}>
                {executandoAcao ? "Processando…" : acaoPendente === "cancelar" ? <><Ban size={16} /> Confirmar cancelamento</> : <><CalendarPlus size={16} /> Gerar mensalidade</>}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
