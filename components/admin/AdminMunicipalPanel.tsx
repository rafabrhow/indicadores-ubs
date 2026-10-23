"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  ClipboardList,
  Database,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  ShieldCheck,
  UsersRound,
  UserRoundCog,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { auth } from "@/lib/firebase";
import LoadingBrasil360 from "@/components/ui/LoadingBrasil360";
import AdminMunicipalReports from "@/components/admin/AdminMunicipalReports";
import AdminInfoButton from "@/components/admin/AdminInfoButton";

interface UBSCriada {
  id: string;
  nome: string;
  municipio: string;
  uf: string;
  ativo: boolean;
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
}

interface EnfermeiraCriada {
  uid: string;
  nome: string;
  email: string;
  ubsId: string;
  ubsNome: string;
}

type TamanhoFonteAdmin = "pequena" | "padrao" | "grande" | "extra-grande";
type FonteAdmin = "sistema" | "Arial" | "Verdana" | "Tahoma" | "Trebuchet MS";

const TAMANHOS_FONTE_ADMIN: Record<TamanhoFonteAdmin, string> = {
  pequena: "14px",
  padrao: "16px",
  grande: "18px",
  "extra-grande": "20px",
};

export default function AdminMunicipalPanel({ mode }: { mode: "overview" | "config" | "reports" }) {
  const router = useRouter();
  const { usuario, carregando, logout } = useAuth();
  const [tamanhoFonteAdmin, setTamanhoFonteAdmin] = useState<TamanhoFonteAdmin>("padrao");
  const [fonteAdmin, setFonteAdmin] = useState<FonteAdmin>("sistema");
  const [preferenciasCarregadas, setPreferenciasCarregadas] = useState(false);

  useEffect(() => {
    try {
      const tamanhoSalvo = window.localStorage.getItem("brasil360:admin:tamanhoFonte");
      const fonteSalva = window.localStorage.getItem("brasil360:admin:fonte");
      if (["pequena", "padrao", "grande", "extra-grande"].includes(tamanhoSalvo ?? "")) {
        setTamanhoFonteAdmin(tamanhoSalvo as TamanhoFonteAdmin);
      }
      if (["sistema", "Arial", "Verdana", "Tahoma", "Trebuchet MS"].includes(fonteSalva ?? "")) {
        setFonteAdmin(fonteSalva as FonteAdmin);
      }
    } catch (error) {
      console.warn("Não foi possível carregar as preferências de acessibilidade:", error);
    } finally {
      setPreferenciasCarregadas(true);
    }
  }, []);

  useEffect(() => {
    if (!preferenciasCarregadas) return;
    try {
      // Mantém compatibilidade com as chaves antigas e sincroniza a preferência global.
      window.localStorage.setItem("brasil360:admin:tamanhoFonte", tamanhoFonteAdmin);
      window.localStorage.setItem("brasil360:admin:fonte", fonteAdmin);
      window.localStorage.setItem("brasil360_tamanho_fonte_v1", tamanhoFonteAdmin);
      const fonteGlobal = fonteAdmin === "sistema" ? "padrao" : fonteAdmin.toLowerCase().replace("trebuchet ms", "trebuchet");
      window.localStorage.setItem("brasil360_fonte_sistema_v1", fonteGlobal);
      window.dispatchEvent(new Event("brasil360:config-fonte"));
    } catch (error) {
      console.warn("Não foi possível salvar as preferências de acessibilidade:", error);
    }
  }, [tamanhoFonteAdmin, fonteAdmin, preferenciasCarregadas]);

  const estiloAcessibilidade = {
    fontFamily: fonteAdmin === "sistema"
      ? "inherit"
      : fonteAdmin === "Trebuchet MS"
        ? '"Trebuchet MS", sans-serif'
        : `"${fonteAdmin}", sans-serif`,
  } as const;

  const [nomeUBS, setNomeUBS] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [ubsCriada, setUbsCriada] = useState<UBSCriada | null>(null);

  const [unidades, setUnidades] = useState<UBSOpcao[]>([]);
  const [carregandoUnidades, setCarregandoUnidades] = useState(false);
  const [erroUnidades, setErroUnidades] = useState("");
  const [nomeEnfermeira, setNomeEnfermeira] = useState("");
  const [emailEnfermeira, setEmailEnfermeira] = useState("");
  const [salvandoEnfermeira, setSalvandoEnfermeira] = useState(false);
  const [erroEnfermeira, setErroEnfermeira] = useState("");
  const [sucessoEnfermeira, setSucessoEnfermeira] = useState("");
  const [enfermeiraCriada, setEnfermeiraCriada] = useState<EnfermeiraCriada | null>(null);

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
    if (
      carregando ||
      !usuario ||
      usuario.perfil !== "administrador_municipal" ||
      mode === "reports"
    ) {
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
        const resposta = await fetch(mode === "config" ? "/api/admin/ubs?somenteLista=1" : "/api/admin/ubs", {
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
  }, [carregando, usuario, mode]);

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

  async function cadastrarUBS(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");
    setSucesso("");
    setUbsCriada(null);

    const nome = nomeUBS.trim();

    if (!nome) {
      setErro("Informe o nome da UBS.");
      return;
    }

    setSalvando(true);

    try {
      const usuarioAuth = auth.currentUser;

      if (!usuarioAuth) {
        throw new Error("Sua sessão expirou. Entre novamente no sistema.");
      }

      const token = await usuarioAuth.getIdToken();

      const resposta = await fetch("/api/admin/ubs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nome }),
      });

      const dados = await resposta.json();

      if (!resposta.ok || dados?.sucesso !== true) {
        throw new Error(
          typeof dados?.mensagem === "string"
            ? dados.mensagem
            : "Não foi possível cadastrar a UBS.",
        );
      }

      setUbsCriada(dados.ubs);
      setUnidades((atuais) => {
        if (atuais.some((unidade) => unidade.id === dados.ubs.id)) return atuais;
        return [...atuais, {
          ...dados.ubs,
          possuiDados: false,
          statusDados: "aguardando_importacao" as const,
          pacientes: null,
          indicadoresDisponiveis: 0,
          atualizadoEm: null,
          competencia: null,
        }].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      });
      setSucesso("UBS cadastrada com sucesso.");
      setNomeUBS("");
    } catch (error) {
      console.error("Erro ao cadastrar UBS:", error);
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível cadastrar a UBS. Tente novamente.",
      );
    } finally {
      setSalvando(false);
    }
  }

  async function cadastrarEnfermeira(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErroEnfermeira("");
    setSucessoEnfermeira("");
    setEnfermeiraCriada(null);

    const nome = nomeEnfermeira.trim();
    const email = emailEnfermeira.trim().toLowerCase();

    if (!nome || !email) {
      setErroEnfermeira("Preencha nome e e-mail profissional.");
      return;
    }
    setSalvandoEnfermeira(true);

    try {
      const usuarioAuth = auth.currentUser;
      if (!usuarioAuth) throw new Error("Sua sessão expirou. Entre novamente.");

      const token = await usuarioAuth.getIdToken();
      const resposta = await fetch("/api/admin/enfermeiras", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nome,
          email,
        }),
      });
      const dados = await resposta.json();

      if (!resposta.ok || dados?.sucesso !== true) {
        throw new Error(dados?.mensagem || "Não foi possível cadastrar a enfermeira.");
      }

      setEnfermeiraCriada(dados.enfermeira);
      setSucessoEnfermeira("Enfermeira cadastrada. Ela deverá usar “Esqueci minha senha” na tela de login para definir a própria senha.");
      setNomeEnfermeira("");
      setEmailEnfermeira("");
    } catch (error) {
      console.error("Erro ao cadastrar enfermeira:", error);
      setErroEnfermeira(
        error instanceof Error ? error.message : "Não foi possível cadastrar a enfermeira."
      );
    } finally {
      setSalvandoEnfermeira(false);
    }
  }

  function navegar(caminho: string) { router.push(caminho); }


  const unidadesComDados = unidades.filter((unidade) => unidade.statusDados === "com_dados").length;
  const unidadesAguardando = unidades.filter((unidade) => unidade.statusDados === "aguardando_importacao").length;
  const unidadesSnapshotPendente = unidades.filter((unidade) => unidade.statusDados === "snapshot_pendente").length;

  const itensMenu = [
    { label: "Visão geral", icon: LayoutDashboard, caminho: "/admin", ativo: mode === "overview" },
    { label: "Relatórios", icon: ClipboardList, caminho: "/admin/relatorios", ativo: mode === "reports" },
    { label: "Profissionais", icon: UserRoundCog, caminho: "/admin/profissionais", ativo: false },
    { label: "Configuração", icon: ShieldCheck, caminho: "/admin/config", ativo: mode === "config" },
    { label: "Sair", icon: LogOut, caminho: "sair", ativo: false },
  ];

  return (
    <main className="min-h-screen bg-[#F8F7FF] text-[#211A4A]" style={estiloAcessibilidade}>
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
                <div key={item.label} className="mb-1">
                  <button
                    type="button"
                    onClick={() => navegar(item.caminho)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-3 text-left text-[10px] font-semibold transition ${
                      item.ativo ? "bg-[#EEE7FF] text-[#7C3AED]" : "text-gray-500 hover:bg-gray-50"
                    }`}
                    aria-current={item.ativo ? "page" : undefined}
                  >
                    <Icone size={14} />
                    <span>{item.label}</span>
                  </button>
                  {item.label === "Configuração" && item.ativo && (
                    <div className="ml-5 mt-1 border-l border-violet-100 pl-2">
                      <button type="button" onClick={() => navegar("/admin/config#cadastro-ubs")} className="mb-1 block w-full rounded-md px-2 py-2 text-left text-[9px] font-medium text-gray-600 hover:bg-violet-50 hover:text-violet-700">Unidades UBS</button>
                      <button type="button" onClick={() => navegar("/admin/config#cadastro-enfermeira")} className="block w-full rounded-md px-2 py-2 text-left text-[9px] font-medium text-gray-600 hover:bg-violet-50 hover:text-violet-700">Enfermeiras</button>
                    </div>
                  )}
                </div>
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
          className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-[#E7E2F2] bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 shadow-[0_-8px_24px_rgba(33,26,74,0.08)] backdrop-blur-md lg:hidden"
        >
          {itensMenu.map((item) => {
            const Icone = item.icon;
            const itemSair = item.label === "Sair";
            const classes = `flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold transition ${
              item.ativo ? "bg-[#EEE7FF] text-[#7C3AED]" : itemSair ? "text-gray-500 hover:bg-red-50 hover:text-red-600" : "text-gray-400"
            }`;
            if (itemSair) {
              return <button key={item.label} type="button" onClick={sair} className={classes} aria-label="Sair da conta"><Icone size={18} /><span>{item.label}</span></button>;
            }
            return <button key={item.label} type="button" onClick={() => navegar(item.caminho)} className={classes} aria-current={item.ativo ? "page" : undefined}><Icone size={18} /><span>{item.label}</span></button>;
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
              <div className="mt-1 flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight drop-shadow-sm sm:text-2xl">
                  {mode === "overview" ? "Visão geral municipal" : mode === "config" ? "Configuração" : "Relatórios municipais"}
                </h1>
                <AdminInfoButton titulo={mode === "config" ? "Configuração municipal" : mode === "overview" ? "Visão geral municipal" : "Relatórios municipais"}>
                  {mode === "config" ? "Área para administrar os cadastros e vínculos de UBS e enfermeiras do município autorizado. Confira os dados antes de salvar alterações." : mode === "overview" ? "Resumo administrativo das unidades e dos dados consolidados disponíveis para o município." : "Consulte resultados consolidados por UBS e competência. A ausência de resultado não significa desempenho zero, e os indicadores não são recalculados nesta tela."}
                </AdminInfoButton>
              </div>
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
            {mode === "overview" && (
            <section id="visao-geral" className="scroll-mt-4 rounded-2xl border border-sky-100 bg-gradient-to-br from-[#F8FCFF] via-white to-[#EAF7FC] p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100">
                    <LayoutDashboard size={21} className="text-sky-700" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#211A4A]">Visão geral municipal</h2>
                    <p className="mt-1 text-xs leading-relaxed text-gray-500">Resumo das UBS cadastradas e da disponibilidade dos snapshots existentes, sem recalcular indicadores.</p>
                  </div>
                </div>
                <button type="button" onClick={() => navegar("/admin/config#cadastro-ubs")} className="rounded-xl bg-[#7C3AED] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#6D28D9]">Cadastrar UBS</button>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="relative overflow-hidden rounded-2xl border border-[#B7C8F5] bg-gradient-to-br from-[#EEF2FF] via-white to-[#DDE7FF] p-4 shadow-[0_6px_14px_rgba(99,102,241,0.13),0_2px_5px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_22px_rgba(99,102,241,0.20)]">
                  <div className="pointer-events-none absolute -right-5 -top-7 h-20 w-20 rounded-full bg-indigo-300/20 blur-2xl" />
                  <p className="relative text-xs font-semibold text-indigo-800">UBS cadastradas</p>
                  <p className="relative mt-2 text-3xl font-extrabold text-indigo-700">{carregandoUnidades ? "—" : unidades.length}</p>
                  <p className="relative mt-1 text-[10px] text-indigo-700/80">Unidades ativas no município</p>
                </div>
                <div className="relative overflow-hidden rounded-2xl border border-[#A7E6C0] bg-gradient-to-br from-[#ECFDF3] via-white to-[#DDF7E7] p-4 shadow-[0_6px_14px_rgba(0,156,59,0.12),0_2px_5px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_22px_rgba(0,156,59,0.20)]">
                  <div className="pointer-events-none absolute -right-5 -top-7 h-20 w-20 rounded-full bg-emerald-300/25 blur-2xl" />
                  <p className="relative text-xs font-semibold text-emerald-800">Com dados consolidados</p>
                  <p className="relative mt-2 text-3xl font-extrabold text-emerald-700">{carregandoUnidades ? "—" : unidadesComDados}</p>
                  <p className="relative mt-1 text-[10px] text-emerald-800/80">Possuem snapshot de indicadores</p>
                </div>
                <div className="relative overflow-hidden rounded-2xl border border-[#F5D66A] bg-gradient-to-br from-[#FFF9E5] via-white to-[#FFF1B8] p-4 shadow-[0_6px_14px_rgba(217,119,6,0.12),0_2px_5px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_22px_rgba(217,119,6,0.20)]">
                  <div className="pointer-events-none absolute -right-5 -top-7 h-20 w-20 rounded-full bg-amber-300/25 blur-2xl" />
                  <p className="relative text-xs font-semibold text-amber-800">Aguardando primeira importação</p>
                  <p className="relative mt-2 text-3xl font-extrabold text-amber-700">{carregandoUnidades ? "—" : unidadesAguardando}</p>
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

                {carregandoUnidades ? (
                  <div className="rounded-xl border border-gray-100 bg-white p-4 text-xs text-gray-500">Carregando unidades e consultando os snapshots existentes...</div>
                ) : erroUnidades ? (
                  <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">Não foi possível carregar o resumo municipal: {erroUnidades}</div>
                ) : unidades.length === 0 ? (
                  <div className="rounded-xl border border-gray-100 bg-white p-4 text-xs text-gray-500">Nenhuma UBS ativa cadastrada para este município.</div>
                ) : (
                  <div className="space-y-2">
                    {unidades.map((unidade) => {
                      const aguardando = unidade.statusDados === "aguardando_importacao";
                      const snapshotPendente = unidade.statusDados === "snapshot_pendente";
                      return (
                        <div key={unidade.id} className={`flex flex-col gap-3 rounded-2xl border p-4 shadow-[0_5px_12px_rgba(0,59,142,0.07),0_2px_4px_rgba(0,0,0,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_9px_18px_rgba(0,59,142,0.12)] sm:flex-row sm:items-center sm:justify-between ${aguardando ? "border-[#F5D66A] bg-gradient-to-r from-[#FFF9E5] via-white to-[#FFF1B8]" : snapshotPendente ? "border-orange-200 bg-gradient-to-r from-orange-50 via-white to-orange-100" : "border-[#A7E6C0] bg-gradient-to-r from-[#ECFDF3] via-white to-[#DDF7E7]"}`}>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-[#211A4A]">{unidade.nome}</p>
                            <p className="mt-1 text-[10px] text-gray-500">{unidade.municipio}/{unidade.uf}</p>
                            <p className="mt-1 break-all text-[9px] text-gray-400">ID: {unidade.id}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${aguardando ? "bg-amber-50 text-amber-700" : snapshotPendente ? "bg-orange-50 text-orange-700" : "bg-emerald-50 text-emerald-700"}`}>
                              {aguardando ? "Aguardando primeira importação" : snapshotPendente ? "Snapshot pendente" : "Dados consolidados"}
                            </span>
                            <span className="rounded-full bg-gray-50 px-2.5 py-1 text-[10px] text-gray-600">
                              {unidade.pacientes == null ? "Pacientes: —" : `Pacientes: ${unidade.pacientes}`}
                            </span>
                            <span className="rounded-full bg-gray-50 px-2.5 py-1 text-[10px] text-gray-600">
                              {unidade.indicadoresDisponiveis ?? 0} indicadores
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="mt-3 flex items-center gap-2 text-[10px] text-gray-400"><Database size={13} /> A visão usa os snapshots já existentes. UBS sem dados não são contabilizadas como desempenho zero.</p>
              </div>
            </section>
            )}


            {mode === "config" && (
                <>
              <section id="acessibilidade" className="mb-4 rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50/70 via-white to-violet-50/40 p-5 shadow-sm sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100">
                    <span className="text-lg font-bold text-sky-700">Aa</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-bold text-[#211A4A]">Acessibilidade e leitura</h2>
                    <p className="mt-1 text-xs leading-relaxed text-gray-500">
                      Personalize o tamanho e a família da fonte nas páginas da administração municipal. As preferências ficam salvas neste navegador.
                    </p>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="tamanhoFonteAdmin" className="mb-2 block text-[11px] font-semibold text-[#211A4A]">Tamanho das letras</label>
                    <select id="tamanhoFonteAdmin" value={tamanhoFonteAdmin} onChange={(event) => setTamanhoFonteAdmin(event.target.value as TamanhoFonteAdmin)} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20">
                      <option value="pequena">Pequena</option>
                      <option value="padrao">Padrão</option>
                      <option value="grande">Grande</option>
                      <option value="extra-grande">Extra grande</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="fonteAdmin" className="mb-2 block text-[11px] font-semibold text-[#211A4A]">Fonte do sistema</label>
                    <select id="fonteAdmin" value={fonteAdmin} onChange={(event) => setFonteAdmin(event.target.value as FonteAdmin)} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20">
                      <option value="sistema">Padrão do sistema</option>
                      <option value="Arial">Arial</option>
                      <option value="Verdana">Verdana</option>
                      <option value="Tahoma">Tahoma</option>
                      <option value="Trebuchet MS">Trebuchet MS</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4 rounded-xl border border-gray-100 bg-white px-4 py-3">
                  <p className="text-gray-500" style={{ fontSize: TAMANHOS_FONTE_ADMIN[tamanhoFonteAdmin], fontFamily: estiloAcessibilidade.fontFamily }}>
                    Exemplo de leitura: Brasil 360 — Administração municipal.
                  </p>
                </div>
              </section>

              <section className="group relative overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/60 via-white to-fuchsia-50/30 p-5 shadow-sm transition duration-200 hover:border-violet-200 hover:shadow-lg hover:shadow-violet-100/60 sm:p-6">
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-violet-200/30 blur-2xl" />
              <div className="relative flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EEE7FF]">
                  <MapPin size={21} className="text-[#7C3AED]" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-bold text-[#211A4A]">
                    Município autorizado
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">
                    Este administrador pode cadastrar unidades somente em{" "}
                    <strong>{usuario.municipio}/{usuario.uf}</strong>. O
                    município e a UF são definidos pelo cadastro administrativo
                    e não podem ser alterados por este formulário.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#F5F1FF] px-2.5 py-1 text-[9px] font-semibold text-[#7C3AED]">
                      {usuario.municipio}
                    </span>
                    <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[9px] font-semibold text-sky-700">
                      {usuario.uf}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section id="cadastro-ubs" className="group relative mt-4 scroll-mt-4 overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-[#F3FFF8] via-white to-[#EAF7FC] p-5 shadow-sm transition duration-200 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-100/60 sm:p-6">
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-200/30 blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
                    <Building2 size={21} className="text-emerald-700" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#211A4A]">
                      Cadastrar nova UBS
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-gray-500">
                      Cadastre a unidade municipal. O vínculo da enfermeira será
                      realizado na próxima etapa.
                    </p>
                  </div>
                </div>

                <form onSubmit={cadastrarUBS} className="mt-5 space-y-4">
                  <div>
                    <label
                      htmlFor="nomeUBS"
                      className="mb-2 block text-[11px] font-semibold text-[#211A4A]"
                    >
                      Nome da UBS
                    </label>
                    <input
                      id="nomeUBS"
                      type="text"
                      value={nomeUBS}
                      onChange={(event) => setNomeUBS(event.target.value)}
                      maxLength={160}
                      required
                      placeholder="Ex.: UBS Centro"
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20"
                    />
                  </div>

                  {erro && (
                    <div
                      role="alert"
                      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                    >
                      {erro}
                    </div>
                  )}

                  {sucesso && (
                    <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                      <p className="flex items-center gap-2 font-semibold">
                        <CheckCircle2 size={18} />
                        {sucesso}
                      </p>
                      {ubsCriada && (
                        <div className="mt-3 space-y-1 text-xs">
                          <p><strong>Unidade:</strong> {ubsCriada.nome}</p>
                          <p><strong>Município:</strong> {ubsCriada.municipio}/{ubsCriada.uf}</p>
                          <p className="break-all"><strong>ID da UBS:</strong> {ubsCriada.id}</p>
                          <p className="mt-2 text-gray-600">
                            Guarde o ID para conferência. Na próxima etapa, a
                            enfermeira será vinculada a esta unidade.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={salvando}
                    className="inline-flex items-center justify-center rounded-xl bg-[#7C3AED] px-5 py-3 text-xs font-semibold text-white shadow-sm transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {salvando ? "Cadastrando..." : "Cadastrar UBS"}
                  </button>
                </form>
              </div>
            </section>


            <section
              id="cadastro-enfermeira"
              className="group relative mt-4 scroll-mt-4 overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/60 via-white to-fuchsia-50/30 p-5 shadow-sm sm:p-6"
            >
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-violet-200/30 blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EEE7FF]">
                    <UsersRound size={21} className="text-[#7C3AED]" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#211A4A]">
                      Cadastrar enfermeira
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-gray-500">
                      Cadastre uma nova profissional. O vínculo com a UBS é gerenciado na tela Profissionais.
                    </p>
                  </div>
                </div>

                <form onSubmit={cadastrarEnfermeira} className="mt-5 space-y-4">
                  <div>
                    <label htmlFor="nomeEnfermeira" className="mb-2 block text-[11px] font-semibold text-[#211A4A]">
                      Nome completo
                    </label>
                    <input
                      id="nomeEnfermeira"
                      type="text"
                      value={nomeEnfermeira}
                      onChange={(event) => setNomeEnfermeira(event.target.value)}
                      maxLength={160}
                      required
                      placeholder="Nome da enfermeira"
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20"
                    />
                  </div>

                  <div>
                    <label htmlFor="emailEnfermeira" className="mb-2 block text-[11px] font-semibold text-[#211A4A]">
                      E-mail profissional
                    </label>
                    <input
                      id="emailEnfermeira"
                      type="email"
                      value={emailEnfermeira}
                      onChange={(event) => setEmailEnfermeira(event.target.value)}
                      maxLength={254}
                      required
                      placeholder="enfermeira@exemplo.com"
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20"
                    />
                  </div>

                  {erroEnfermeira && (
                    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {erroEnfermeira}
                    </div>
                  )}

                  {sucessoEnfermeira && (
                    <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                      <p className="flex items-center gap-2 font-semibold">
                        <CheckCircle2 size={18} />
                        Enfermeira cadastrada com sucesso.
                      </p>
                      <p className="mt-2">{sucessoEnfermeira}</p>
                      {enfermeiraCriada && (
                        <div className="mt-3 space-y-1 text-xs">
                          <p><strong>Nome:</strong> {enfermeiraCriada.nome}</p>
                          <p><strong>E-mail:</strong> {enfermeiraCriada.email}</p>
                          <p><strong>Vínculo:</strong> Sem UBS vinculada. Faça o vínculo na tela Profissionais.</p>
                          <p className="break-all"><strong>UID:</strong> {enfermeiraCriada.uid}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={salvandoEnfermeira}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-5 py-3 text-xs font-semibold text-white shadow-sm transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Mail size={15} />
                    {salvandoEnfermeira ? "Cadastrando..." : "Cadastrar enfermeira"}
                  </button>
                </form>
              </div>
            </section>
              </>
            )}

            {mode === "reports" && <AdminMunicipalReports />}
            <p className="mt-5 text-[10px] text-gray-400">
              Brasil 360 • Administração municipal
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
