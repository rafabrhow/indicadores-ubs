"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  ClipboardList,
  Database,
  LayoutDashboard,
  LogOut,
  Settings2,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { auth } from "@/lib/firebase";
import LoadingBrasil360 from "@/components/ui/LoadingBrasil360";

interface IndicadorResumoUBS {
  codigo: string;
  nome: string;
  competencia: string | null;
  resultado: number | null;
  tipoResultado: "percentual" | "pontuacao" | "sem_valor";
  classificacao: string | null;
}

interface UBSOpcao {
  id: string;
  nome: string;
  municipio: string;
  uf: string;
  ativo: boolean;
  possuiDados?: boolean;
  statusDados?: "com_dados" | "aguardando_importacao" | "snapshot_pendente";
  pacientes?: number | null;
  indicadoresDisponiveis?: number;
  atualizadoEm?: string | null;
  competencia?: string | null;
  resumoIndicadores?: IndicadorResumoUBS[];
}

export default function AdminPage() {
  const router = useRouter();
  const { usuario, carregando, logout } = useAuth();


  const [unidades, setUnidades] = useState<UBSOpcao[]>([]);
  const [carregandoUnidades, setCarregandoUnidades] = useState(false);
  const [erroUnidades, setErroUnidades] = useState("");

  useEffect(() => {
    if (carregando) return;

    if (!usuario) {
      router.replace("/login");
      return;
    }

    if (usuario.perfil !== "administrador_municipal") {
      router.replace(usuario.perfil === "acs" ? "/acs" : "/dashboard");
    }
  }, [usuario, carregando, router]);

  useEffect(() => {
    if (carregando || !usuario || usuario.perfil !== "administrador_municipal") {
      return;
    }

    let cancelado = false;

    async function carregarUnidades() {
      setCarregandoUnidades(true);
      setErroUnidades("");

      try {
        const usuarioAuth = auth.currentUser;
        if (!usuarioAuth) throw new Error("Sua sessão expirou. Entre novamente.");

        const token = await usuarioAuth.getIdToken();
        const resposta = await fetch("/api/admin/ubs", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const dados = await resposta.json();

        if (!resposta.ok || dados?.sucesso !== true) {
          throw new Error(dados?.mensagem || "Não foi possível carregar as UBS.");
        }

        if (!cancelado) {
          setUnidades(Array.isArray(dados.ubs) ? dados.ubs : []);
        }
      } catch (error) {
        if (!cancelado) {
          setErroUnidades(error instanceof Error ? error.message : "Erro ao carregar UBS.");
        }
      } finally {
        if (!cancelado) setCarregandoUnidades(false);
      }
    }

    void carregarUnidades();
    return () => { cancelado = true; };
  }, [carregando, usuario]);

  if (carregando || !usuario || usuario.perfil !== "administrador_municipal") {
    return (
      <LoadingBrasil360
        mensagem="Verificando acesso..."
        subtitulo="Validando seu perfil administrativo"
      />
    );
  }

  async function sair() {
    await logout();
    router.replace("/login");
  }

  function irParaSecao() {
    document.getElementById("visao-geral")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const unidadesComDados = unidades.filter((unidade) => unidade.statusDados === "com_dados").length;
  const unidadesAguardando = unidades.filter((unidade) => unidade.statusDados === "aguardando_importacao").length;
  const unidadesSnapshotPendente = unidades.filter((unidade) => unidade.statusDados === "snapshot_pendente").length;

  const itensMenu = [
    { label: "Visão geral", icon: LayoutDashboard, ativo: true, acao: "overview" },
    { label: "Relatórios", icon: ClipboardList, ativo: false, acao: "reports" },
    { label: "Configuração", icon: Settings2, ativo: false, acao: "config" },
    { label: "Sair", icon: LogOut, ativo: false, acao: "sair" },
  ];
  return (
    <main className="min-h-screen bg-[#F8F7FF] text-[#211A4A]">
      <div className="flex min-h-screen">
        <aside className="hidden w-[150px] shrink-0 flex-col border-r border-[#E7E2F2] bg-white lg:flex">
          <div className="border-b border-[#E7E2F2] px-4 py-5">
            <div className="flex items-center justify-center">
              <img
                src="/brasil360-logo-header.png"
                alt="Brasil 360"
                className="h-14 w-[100px] object-contain"
              />
            </div>
            <p className="mt-4 text-[8px] font-bold uppercase tracking-wide text-[#7C3AED]">
              Administração municipal
            </p>
          </div>

          <nav className="flex-1 px-3 py-4">
            {itensMenu.filter((item) => item.label !== "Sair").map((item) => {
              const Icone = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.acao === "overview" ? irParaSecao : item.acao === "config" ? () => router.push("/admin/config") : item.acao === "reports" ? () => router.push("/admin/relatorios") : undefined}
                  disabled={item.acao === "indisponivel"}
                  className={`mb-2 flex w-full items-center gap-2 rounded-lg px-2 py-3 text-left text-[10px] font-semibold ${
                    item.ativo
                      ? "bg-[#EEE7FF] text-[#7C3AED]"
                      : "text-gray-500"
                  }`}
                  aria-current={item.ativo ? "page" : undefined}
                >
                  <Icone size={14} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="border-t border-[#E7E2F2] p-3">
            <div className="truncate text-[9px] font-semibold text-[#211A4A]">
              {usuario.nome || usuario.email}
            </div>
            <button
              type="button"
              onClick={sair}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-2 py-2 text-[9px] font-semibold text-gray-500 transition hover:bg-gray-50 hover:text-red-500"
            >
              <LogOut size={13} />
              Sair
            </button>
          </div>
        </aside>

        <nav
          aria-label="Navegação administrativa"
          className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-[#E7E2F2] bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 shadow-[0_-8px_24px_rgba(33,26,74,0.08)] backdrop-blur-md lg:hidden"
        >
          {itensMenu.map((item) => {
            const Icone = item.icon;
            const itemSair = item.label === "Sair";
            const classes = `flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold transition ${
              item.ativo
                ? "bg-[#EEE7FF] text-[#7C3AED]"
                : itemSair
                  ? "text-gray-500 hover:bg-red-50 hover:text-red-600"
                  : "text-gray-400"
            }`;

            if (itemSair) {
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={sair}
                  className={classes}
                  aria-label="Sair da conta"
                >
                  <Icone size={18} />
                  <span>{item.label}</span>
                </button>
              );
            }

            return (
              <button
                key={item.label}
                type="button"
                onClick={item.acao === "overview" ? irParaSecao : item.acao === "config" ? () => router.push("/admin/config") : item.acao === "reports" ? () => router.push("/admin/relatorios") : undefined}
                disabled={item.acao === "indisponivel"}
                className={classes}
                aria-disabled={item.acao === "indisponivel"}
              >
                <Icone size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <section className="min-w-0 flex-1 pb-24 lg:pb-8">
          <header className="relative isolate overflow-hidden rounded-b-[28px] border border-emerald-200/60 bg-gradient-to-br from-[#009C3B]/95 via-[#00A9E8]/85 to-[#F2C300]/85 px-6 py-5 text-white shadow-[0_12px_30px_rgba(0,156,59,0.18),0_5px_12px_rgba(0,59,142,0.12)] backdrop-blur-md sm:px-8">
            <div className="pointer-events-none absolute -left-10 -top-14 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
            <div className="pointer-events-none absolute right-8 -top-16 h-40 w-40 rounded-full bg-[#F2C300]/25 blur-3xl" />
            <div className="pointer-events-none absolute bottom-[-70px] left-1/2 h-40 w-64 -translate-x-1/2 rounded-full bg-[#00A9E8]/20 blur-3xl" />

            <div className="relative pr-16 sm:pr-24">
              <p className="text-[11px] font-semibold text-white/85">
                Administração municipal
              </p>
              <h1 className="mt-1 text-xl font-bold tracking-tight drop-shadow-sm sm:text-2xl">
                Painel de acompanhamento municipal
              </h1>
              <p className="mt-1 text-[10px] text-white/90 sm:text-xs">
                {usuario.municipio} — {usuario.uf}
              </p>
            </div>

            <img
              src="/brasil360-logo-header.png"
              alt="Brasil 360"
              width={88}
              height={88}
              className="absolute right-4 top-1/2 h-12 w-12 -translate-y-1/2 rounded-xl object-cover shadow-[0_8px_18px_rgba(0,59,142,0.22)] ring-1 ring-white/50 sm:right-5 sm:h-16 sm:w-16"
            />
          </header>

          <div className="px-4 py-5 sm:px-7 sm:py-7">
            <section id="visao-geral" className="scroll-mt-4 rounded-2xl border border-sky-100 bg-gradient-to-br from-[#F8FCFF] via-white to-[#EAF7FC] p-5 shadow-[0_10px_0_rgba(14,165,233,0.06),0_16px_32px_rgba(30,64,175,0.08)] sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100">
                    <LayoutDashboard size={21} className="text-sky-700" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#211A4A]">Visão geral municipal</h2>
                    <p className="mt-1 text-xs leading-relaxed text-gray-500">Resumo das UBS, disponibilidade dos dados e resultados dos indicadores já consolidados, sem recalcular indicadores.</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="group relative overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-white via-violet-50 to-violet-100/80 p-4 shadow-[0_6px_0_rgba(124,58,237,0.12),0_12px_22px_rgba(124,58,237,0.10)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_8px_0_rgba(124,58,237,0.13),0_18px_28px_rgba(124,58,237,0.16)] before:pointer-events-none before:absolute before:-right-6 before:-top-8 before:h-24 before:w-24 before:rounded-full before:bg-white/70 before:blur-xl">
                  <p className="relative text-xs font-semibold text-violet-700">UBS cadastradas</p>
                  <p className="relative mt-2 text-3xl font-extrabold text-violet-900">{carregandoUnidades ? "—" : unidades.length}</p>
                  <p className="relative mt-1 text-[10px] text-violet-700/80">Unidades ativas no município</p>
                </div>
                <div className="group relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-white via-emerald-50 to-emerald-100/80 p-4 shadow-[0_6px_0_rgba(5,150,105,0.12),0_12px_22px_rgba(5,150,105,0.10)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_8px_0_rgba(5,150,105,0.13),0_18px_28px_rgba(5,150,105,0.16)] before:pointer-events-none before:absolute before:-right-6 before:-top-8 before:h-24 before:w-24 before:rounded-full before:bg-white/70 before:blur-xl">
                  <p className="relative text-xs font-semibold text-emerald-700">Com dados consolidados</p>
                  <p className="relative mt-2 text-3xl font-extrabold text-emerald-800">{carregandoUnidades ? "—" : unidadesComDados}</p>
                  <p className="relative mt-1 text-[10px] text-emerald-800/80">Possuem snapshot de indicadores</p>
                </div>
                <div className="group relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-white via-amber-50 to-amber-100/90 p-4 shadow-[0_6px_0_rgba(217,119,6,0.12),0_12px_22px_rgba(217,119,6,0.10)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_8px_0_rgba(217,119,6,0.13),0_18px_28px_rgba(217,119,6,0.16)] before:pointer-events-none before:absolute before:-right-6 before:-top-8 before:h-24 before:w-24 before:rounded-full before:bg-white/70 before:blur-xl">
                  <p className="relative text-xs font-semibold text-amber-800">Aguardando primeira importação</p>
                  <p className="relative mt-2 text-3xl font-extrabold text-amber-800">{carregandoUnidades ? "—" : unidadesAguardando}</p>
                  <p className="relative mt-1 text-[10px] text-amber-800/80">Sem snapshot e sem total de pacientes registrado</p>
                </div>
              </div>

              {unidadesSnapshotPendente > 0 && (
                <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-xs text-orange-800">
                  {unidadesSnapshotPendente} UBS têm pacientes registrados, mas não possuem snapshot consolidado. Esses casos precisam ser conferidos antes de interpretar o desempenho.
                </div>
              )}

              <div className="mt-5">
                <div className="mb-3 flex items-center gap-2">
                  <Building2 size={16} className="text-[#7C3AED]" />
                  <h3 className="text-xs font-bold text-[#211A4A]">Situação por UBS</h3>
                </div>

                <p className="mb-3 text-[10px] leading-relaxed text-gray-500">Resumo visual por unidade. Para consultar valores, períodos e detalhes de cada indicador, abra a UBS correspondente.</p>

                {carregandoUnidades ? (
                  <div className="rounded-xl border border-gray-100 bg-white p-4 text-xs text-gray-500">Carregando unidades e consultando os snapshots existentes...</div>
                ) : erroUnidades ? (
                  <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">Não foi possível carregar o resumo municipal: {erroUnidades}</div>
                ) : unidades.length === 0 ? (
                  <div className="rounded-xl border border-gray-100 bg-white p-4 text-xs text-gray-500">Nenhuma UBS ativa cadastrada para este município.</div>
                ) : unidades.length === 0 ? (
                  <div className="rounded-xl border border-gray-100 bg-white p-4 text-xs text-gray-500">Nenhuma UBS corresponde à busca e à situação selecionadas.</div>
                ) : (
                  <div className="space-y-2">
                    {unidades.map((unidade) => {
                      const aguardando = unidade.statusDados === "aguardando_importacao";
                      const snapshotPendente = unidade.statusDados === "snapshot_pendente";
                      return (
                        <div key={unidade.id} className={`group relative overflow-hidden rounded-2xl border p-4 shadow-[0_5px_0_rgba(30,41,59,0.045),0_10px_20px_rgba(30,41,59,0.055)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_7px_0_rgba(30,41,59,0.05),0_16px_26px_rgba(30,41,59,0.09)] ${aguardando ? "border-amber-200 bg-gradient-to-br from-white via-white to-amber-50" : snapshotPendente ? "border-orange-200 bg-gradient-to-br from-white via-white to-orange-50" : "border-sky-100 bg-gradient-to-br from-white via-white to-sky-50/80"}`}>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-start gap-3">
                              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_4px_8px_rgba(15,23,42,0.08)] ring-1 ring-white/80 ${aguardando ? "bg-gradient-to-br from-amber-100 to-amber-200 text-amber-800" : snapshotPendente ? "bg-gradient-to-br from-orange-100 to-orange-200 text-orange-800" : "bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-800"}`}>
                                <Building2 size={18} />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-[#211A4A]">{unidade.nome}</p>
                                <p className="mt-1 text-[10px] text-gray-500">{unidade.municipio}/{unidade.uf}</p>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${aguardando ? "bg-amber-50 text-amber-700" : snapshotPendente ? "bg-orange-50 text-orange-700" : "bg-emerald-50 text-emerald-700"}`}>
                                    {aguardando ? "Aguardando primeira importação" : snapshotPendente ? "Snapshot pendente" : "Dados consolidados"}
                                  </span>
                                  {unidade.competencia && !aguardando && <span className="text-[10px] text-gray-500">Competência: {unidade.competencia}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                              <span className="rounded-lg bg-slate-50 px-3 py-2 text-[10px] text-slate-600"><strong className="text-[#211A4A]">{unidade.indicadoresDisponiveis ?? 0}</strong> indicadores</span>
                              <span className="rounded-lg bg-slate-50 px-3 py-2 text-[10px] text-slate-600">Pacientes: {unidade.pacientes == null ? "—" : unidade.pacientes}</span>
                              <button type="button" onClick={() => router.push(`/admin/ubs/${encodeURIComponent(unidade.id)}`)} className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-b from-[#8B5CF6] to-[#6D28D9] px-3 py-2 text-[10px] font-semibold text-white shadow-[0_4px_0_#5B21B6,0_7px_12px_rgba(109,40,217,0.20)] transition duration-150 hover:-translate-y-0.5 hover:shadow-[0_5px_0_#5B21B6,0_10px_16px_rgba(109,40,217,0.25)] active:translate-y-0.5 active:shadow-[0_2px_0_#5B21B6]">
                                Ver detalhes <span aria-hidden="true">→</span>
                              </button>
                            </div>
                          </div>

                          {!aguardando && !snapshotPendente && (unidade.resumoIndicadores?.length ?? 0) > 0 && (() => {
                            const resumo = unidade.resumoIndicadores ?? [];
                            const normalizarClasse = (valor: string | null) => (valor ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
                            const contagens = [
                              { nome: "Ótimo", total: resumo.filter((item) => normalizarClasse(item.classificacao) === "otimo").length, cor: "bg-emerald-500", texto: "text-emerald-700" },
                              { nome: "Bom", total: resumo.filter((item) => normalizarClasse(item.classificacao) === "bom").length, cor: "bg-sky-500", texto: "text-sky-700" },
                              { nome: "Suficiente", total: resumo.filter((item) => normalizarClasse(item.classificacao) === "suficiente").length, cor: "bg-amber-400", texto: "text-amber-700" },
                              { nome: "Regular", total: resumo.filter((item) => normalizarClasse(item.classificacao) === "regular").length, cor: "bg-rose-500", texto: "text-rose-700" },
                            ];
                            const classificados = contagens.reduce((soma, item) => soma + item.total, 0);
                            const semClassificacao = resumo.length - classificados;
                            return (
                              <div className="mt-4 border-t border-slate-100 pt-3">
                                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-[11px] font-bold text-[#211A4A]">Panorama dos indicadores</p>
                                  <p className="text-[10px] text-slate-400">Classificações já registradas · sem novo cálculo</p>
                                </div>
                                {classificados > 0 ? (
                                  <>
                                    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100" aria-label={`Classificações registradas em ${unidade.nome}`}>
                                      {contagens.filter((item) => item.total > 0).map((item) => <div key={item.nome} title={`${item.nome}: ${item.total}`} className={`${item.cor} h-full`} style={{ width: `${(item.total / resumo.length) * 100}%` }} />)}
                                      {semClassificacao > 0 && <div title={`Sem classificação: ${semClassificacao}`} className="h-full bg-slate-300" style={{ width: `${(semClassificacao / resumo.length) * 100}%` }} />}
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                                      {contagens.filter((item) => item.total > 0).map((item) => <span key={item.nome} className={`inline-flex items-center gap-1.5 text-[10px] ${item.texto}`}><span className={`h-2 w-2 rounded-full ${item.cor}`} />{item.nome}: <strong>{item.total}</strong></span>)}
                                      {semClassificacao > 0 && <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500"><span className="h-2 w-2 rounded-full bg-slate-300" />Sem classificação: <strong>{semClassificacao}</strong></span>}
                                    </div>
                                  </>
                                ) : (
                                  <p className="text-[10px] text-slate-500">Há {resumo.length} indicadores disponíveis, mas o snapshot não apresenta classificações para resumir.</p>
                                )}
                                <p className="mt-2 text-[9px] leading-relaxed text-slate-400">Este panorama resume classificações existentes; não significa, por si só, que metas específicas foram atingidas.</p>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="mt-3 flex flex-col gap-1 text-[10px] text-gray-400 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-center gap-2"><Database size={13} /> A visão usa os snapshots já existentes. UBS sem dados não são contabilizadas como desempenho zero.</p>
                  {!carregandoUnidades && !erroUnidades && unidades.length > 0 && (
                    <p className="shrink-0">Exibindo {unidades.length} UBS</p>
                  )}
                </div>
              </div>
            </section>

            <p className="mt-5 text-[10px] text-gray-400">
              Brasil 360 • Administração municipal
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
