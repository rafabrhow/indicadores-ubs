"use client";

import {
  ArrowLeft,
  Building2,
  Database,
  FileUp,
  History,
  Info,
  Loader2,
  LogOut,
  MapPin,
  Save,
  Settings,
  Type,
  HeartPulse,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import ImportarPECModal from "@/components/pec/ImportarPECModal";
import { useAuth } from "@/context/AuthContext";
import { auth } from "@/lib/firebase";

export default function ConfigPage() {
  const router = useRouter();
  const { usuario, ubs, carregando, logout, atualizarUbs } = useAuth();

  const [modalImportarPEC, setModalImportarPEC] = useState(false);
  const [modalConfigUBS, setModalConfigUBS] = useState(false);
  const [salvandoUBS, setSalvandoUBS] = useState(false);
  const [erroUBS, setErroUBS] = useState("");
  const [sucessoUBS, setSucessoUBS] = useState("");
  const [dadosUBS, setDadosUBS] = useState({
    nome: "",
    municipio: "",
    uf: "",
  });

  const [fonteSistema, setFonteSistema] = useState("padrao");
  const [tamanhoFonte, setTamanhoFonte] = useState("padrao");

  const fontesSistema = [
    {
      id: "padrao",
      nome: "Padrão",
      familia: 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif',
    },
    {
      id: "arial",
      nome: "Arial",
      familia: "Arial, sans-serif",
    },
    {
      id: "verdana",
      nome: "Verdana",
      familia: "Verdana, sans-serif",
    },
    {
      id: "tahoma",
      nome: "Tahoma",
      familia: "Tahoma, sans-serif",
    },
    {
      id: "trebuchet",
      nome: "Trebuchet MS",
      familia: '"Trebuchet MS", sans-serif',
    },
  ];

  const tamanhosFonte = [
    { id: "pequena", nome: "Pequena", valor: "14px", escala: "0.875" },
    { id: "padrao", nome: "Padrão", valor: "16px", escala: "1" },
    { id: "grande", nome: "Grande", valor: "18px", escala: "1.125" },
    { id: "extra-grande", nome: "Extra grande", valor: "20px", escala: "1.25" },
  ];

  useEffect(() => {
    if (ubs) {
      setDadosUBS({
        nome: typeof ubs.nome === "string" ? ubs.nome : "",
        municipio: typeof ubs.municipio === "string" ? ubs.municipio : "",
        uf: typeof ubs.uf === "string" ? ubs.uf : "",
      });
    }
  }, [ubs]);

  useEffect(() => {
    const fonteSalva =
      window.localStorage.getItem("brasil360_fonte_sistema_v1") || "padrao";
    const tamanhoSalvo =
      window.localStorage.getItem("brasil360_tamanho_fonte_v1") || "padrao";

    setFonteSistema(fonteSalva);
    setTamanhoFonte(tamanhoSalvo);
  }, []);

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

  if (carregando || !usuario) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F7FF]">
        <Loader2 size={34} className="animate-spin text-[#7C3AED]" />
      </main>
    );
  }

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  function abrirConfiguracaoUBS() {
  setErroUBS("");
  setSucessoUBS("");

  setDadosUBS({
    nome: typeof ubs?.nome === "string" ? ubs.nome : "",
    municipio: typeof ubs?.municipio === "string" ? ubs.municipio : "",
    uf: typeof ubs?.uf === "string" ? ubs.uf : "",
  });

  setModalConfigUBS(true);
}

  function reverTour() {
    window.localStorage.removeItem("brasil360_tour_enfermeira_v1");
    router.push("/dashboard");
  }

  function alterarFonteSistema(id: string) {
    const fonte = fontesSistema.find((item) => item.id === id);

    if (!fonte) return;

    setFonteSistema(id);
    window.localStorage.setItem("brasil360_fonte_sistema_v1", id);

    document.documentElement.style.setProperty(
      "--brasil360-font-family",
      fonte.familia,
    );
    document.documentElement.style.fontFamily = fonte.familia;
  }

  function alterarTamanhoFonte(id: string) {
    const tamanho = tamanhosFonte.find((item) => item.id === id);

    if (!tamanho) return;

    setTamanhoFonte(id);
    window.localStorage.setItem("brasil360_tamanho_fonte_v1", id);

    document.documentElement.style.setProperty(
      "--brasil360-font-scale",
      tamanho.escala,
    );
    document.documentElement.style.fontSize = tamanho.valor;
  }

  async function salvarConfiguracaoUBS() {
    setErroUBS("");
    setSucessoUBS("");

    const nome = dadosUBS.nome.trim();
    const municipio = dadosUBS.municipio.trim();
    const uf = dadosUBS.uf.trim().toUpperCase();

    if (!nome || !municipio || !uf) {
      setErroUBS("Preencha o nome da UBS, município e UF.");
      return;
    }

    if (uf.length !== 2) {
      setErroUBS("A UF deve ter 2 letras. Ex.: MA.");
      return;
    }

    try {
      setSalvandoUBS(true);

      const usuarioFirebase = auth.currentUser;

      if (!usuarioFirebase) {
        setErroUBS("Sessão não autenticada.");
        return;
      }

      const token = await usuarioFirebase.getIdToken();

      const resposta = await fetch("/api/ubs/configuracao", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nome,
          municipio,
          uf,
        }),
      });

      const resultado = await resposta.json();

      if (!resposta.ok || !resultado.sucesso) {
        throw new Error(
          resultado.mensagem || "Não foi possível salvar as informações da UBS.",
        );
      }

      const ubsAtualizada = {
        id: resultado.ubs.id,
        nome: resultado.ubs.nome,
        municipio: resultado.ubs.municipio,
        uf: resultado.ubs.uf,
        ativo: ubs?.ativo === true,
      };

      setDadosUBS({
        nome: ubsAtualizada.nome,
        municipio: ubsAtualizada.municipio,
        uf: ubsAtualizada.uf,
      });

      atualizarUbs(ubsAtualizada);
      setSucessoUBS("Informações da UBS atualizadas com sucesso.");

      window.setTimeout(() => {
        setModalConfigUBS(false);
        setSucessoUBS("");
      }, 700);
    } catch (error) {
      setErroUBS(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar as informações da UBS.",
      );
    } finally {
      setSalvandoUBS(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F7FF] text-[#211A4A]">
      <div className="flex min-h-screen">
        <aside className="hidden w-[150px] shrink-0 flex-col border-r border-[#E7E2F2] bg-white lg:flex">
          <div className="border-b border-[#E7E2F2] px-4 py-5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#003B8E]">
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

            <p className="mt-4 text-[8px] font-bold uppercase tracking-wide text-[#7C3AED]">
              Enfermeira Gestora
            </p>
          </div>

          <nav className="flex-1 px-3 py-4">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[10px] text-gray-500 transition hover:bg-[#F8F7FF] hover:text-[#7C3AED]"
            >
              <Database size={15} />
              Início
            </button>

            <button
              type="button"
              onClick={() => router.push("/equipe")}
              className="mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[10px] text-gray-500 transition hover:bg-[#F8F7FF] hover:text-[#7C3AED]"
            >
              <UsersRound size={15} />
              Equipe
            </button>

            <button
              type="button"
              onClick={() => router.push("/historico")}
              className="mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[10px] text-gray-500 transition hover:bg-[#F8F7FF] hover:text-[#7C3AED]"
            >
              <History size={15} />
              Histórico
            </button>

            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg bg-[#EEE7FF] px-3 py-3 text-left text-[10px] font-semibold text-[#7C3AED]"
            >
              <Settings size={15} />
              Config
            </button>
          </nav>

          <div className="border-t border-[#E7E2F2] p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EEE7FF]">
                <UserRound size={15} className="text-[#7C3AED]" />
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

        <section className="min-w-0 flex-1 pb-20 lg:pb-0">
          <header className="relative isolate overflow-hidden rounded-b-[28px] border border-emerald-200/60 bg-gradient-to-br from-[#009C3B]/95 via-[#00A9E8]/85 to-[#F2C300]/85 px-8 py-6 text-white shadow-[0_12px_30px_rgba(0,156,59,0.18),0_5px_12px_rgba(0,59,142,0.12)] backdrop-blur-md">
            <div className="pointer-events-none absolute -left-10 -top-14 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
            <div className="pointer-events-none absolute right-8 -top-16 h-40 w-40 rounded-full bg-[#F2C300]/25 blur-3xl" />
            <div className="pointer-events-none absolute bottom-[-70px] left-1/2 h-40 w-64 -translate-x-1/2 rounded-full bg-[#00A9E8]/20 blur-3xl" />

            <div className="relative">
              <p className="text-[11px] font-semibold text-white/85">
                Enfermeira Gestora
              </p>

              <h1 className="mt-1 text-2xl font-bold tracking-tight drop-shadow-sm">
                Configuração
              </h1>

              <p className="mt-1 text-[10px] text-white/90">
                {dadosUBS.nome || "UBS"} — {dadosUBS.municipio || ""}
                {dadosUBS.uf ? ` • ${dadosUBS.uf}` : ""}
              </p>
            </div>

            <img
              src="/brasil360-logo-header.png"
              alt="Brasil 360"
              width={88}
              height={88}
              className="absolute right-5 top-1/2 h-16 w-16 -translate-y-1/2 rounded-2xl object-cover shadow-[0_8px_18px_rgba(0,59,142,0.22)] ring-1 ring-white/50 sm:h-20 sm:w-20"
            />
          </header>

          <div className="px-7 py-7">
            <button
              type="button"
              onClick={abrirConfiguracaoUBS}
              className="group w-full rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/60 via-white to-fuchsia-50/30 p-5 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-violet-200 hover:shadow-lg hover:shadow-violet-100/60 active:translate-y-0"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EEE7FF]">
                    <Settings size={21} className="text-[#7C3AED]" />
                  </div>

                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-[#211A4A]">
                      Configurações da UBS
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-gray-500">
                      Gerencie o nome, município e UF da unidade utilizados pelo
                      Indicadores-UBS.
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#F5F1FF] px-2.5 py-1 text-[9px] font-semibold text-[#7C3AED]">
                        {dadosUBS.nome || "UBS"}
                      </span>
                      <span className="rounded-full bg-[#EFF6FF] px-2.5 py-1 text-[9px] font-semibold text-sky-600">
                        {ubs?.municipio || "Município"}{dadosUBS.uf ? ` • ${dadosUBS.uf}` : ""}
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            </button>

            <section className="group relative mt-4 overflow-hidden rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/60 via-white to-orange-50/30 p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-amber-200 hover:shadow-lg hover:shadow-amber-100/60">
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-200/30 blur-2xl transition duration-200 group-hover:scale-125" />

              <div className="relative flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                  <Type size={21} className="text-amber-600" />
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-bold text-[#211A4A]">
                    Fonte do sistema
                  </h2>

                  <p className="mt-1 text-xs leading-relaxed text-gray-500">
                    Escolha a fonte utilizada nas telas do Brasil 360. A
                    preferência fica salva neste dispositivo.
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {fontesSistema.map((fonte) => {
                      const selecionada = fonteSistema === fonte.id;

                      return (
                        <button
                          key={fonte.id}
                          type="button"
                          onClick={() => alterarFonteSistema(fonte.id)}
                          className={`rounded-xl border px-3 py-2.5 text-left transition ${
                            selecionada
                              ? "border-[#7C3AED] bg-[#EEE7FF] text-[#5B21B6] shadow-sm"
                              : "border-gray-200 bg-white text-gray-600 hover:-translate-y-0.5 hover:border-violet-200 hover:bg-violet-50/40"
                          }`}
                          style={{ fontFamily: fonte.familia }}
                        >
                          <span className="block text-[11px] font-bold">
                            {fonte.nome}
                          </span>
                          <span className="mt-0.5 block text-[9px] opacity-70">
                            Aa Bb 123
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>


            <section className="group relative mt-4 overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/60 via-white to-indigo-50/30 p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/60">
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-blue-200/30 blur-2xl transition duration-200 group-hover:scale-125" />

              <div className="relative flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100">
                  <Type size={21} className="text-blue-600" />
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-bold text-[#211A4A]">
                    Tamanho da fonte
                  </h2>

                  <p className="mt-1 text-xs leading-relaxed text-gray-500">
                    Aumente ou diminua o tamanho dos textos para facilitar a leitura.
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {tamanhosFonte.map((tamanho) => {
                      const selecionado = tamanhoFonte === tamanho.id;

                      return (
                        <button
                          key={tamanho.id}
                          type="button"
                          onClick={() => alterarTamanhoFonte(tamanho.id)}
                          className={`rounded-xl border px-3 py-2.5 text-left transition ${
                            selecionado
                              ? "border-[#7C3AED] bg-[#EEE7FF] text-[#5B21B6] shadow-sm"
                              : "border-gray-200 bg-white text-gray-600 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/40"
                          }`}
                        >
                          <span
                            className="block font-bold"
                            style={{ fontSize: tamanho.valor }}
                          >
                            Aa
                          </span>
                          <span className="mt-1 block text-[10px] font-semibold">
                            {tamanho.nome}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            <section className="group relative mt-4 overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/60 via-white to-cyan-50/30 p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-100/60"> 
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-200/30 blur-2xl transition duration-200 group-hover:scale-125" />
              <div className="relative flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EEE7FF]">
                    <FileUp size={21} className="text-[#7C3AED]" />
                  </div>

                  <div>
                    <h2 className="text-sm font-bold text-[#211A4A]">
                      Importar pacientes do e-SUS PEC
                    </h2>

                    <p className="mt-1 text-xs leading-relaxed text-gray-500">
                      Importe os relatórios oficiais em CSV para atualizar os
                      pacientes e os dados de acompanhamento da UBS.
                    </p>

                    <p className="mt-2 text-[10px] font-medium text-[#7C3AED]">
                      CSV oficial • histórico preservado • processamento por
                      microárea
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setModalImportarPEC(true)}
                  className="shrink-0 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-violet-200 transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  Importar
                </button>
              </div>
            </section>


            <button
              type="button"
              onClick={() => router.push("/historico")}
              className="group relative mt-4 w-full overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50/60 via-white to-indigo-50/30 p-5 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-sky-200 hover:shadow-lg hover:shadow-sky-100/60 active:translate-y-0"
            >
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-sky-200/30 blur-2xl transition duration-200 group-hover:scale-125" />
              <div className="relative flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F3F0FA]">
                  <History size={21} className="text-[#7C3AED]" />
                </div>

                <div>
                  <h2 className="text-sm font-bold text-[#211A4A]">
                    Histórico de importações
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">
                    O histórico das importações será exibido aqui para
                    acompanhar os arquivos processados e as atualizações
                    semanais.
                  </p>
                </div>
              </div>
            </button>

            <section className="group relative mt-4 overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/60 via-white to-fuchsia-50/30 p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-violet-200 hover:shadow-lg hover:shadow-violet-100/60">
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-violet-200/30 blur-2xl transition duration-200 group-hover:scale-125" />

              <div className="relative flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EEE7FF]">
                    <Info size={21} className="text-[#7C3AED]" />
                  </div>

                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-[#211A4A]">
                      Tour do sistema
                    </h2>

                    <p className="mt-1 text-xs leading-relaxed text-gray-500">
                      Reveja o tour guiado do Dashboard para relembrar onde
                      encontrar as principais informações e funções.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={reverTour}
                  className="shrink-0 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] px-4 py-2.5 text-[10px] font-bold text-white shadow-md shadow-violet-200 transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  Ver tour novamente
                </button>
              </div>
            </section>

            <div className="mt-4 flex items-start gap-3 rounded-xl bg-[#F3F0FA] px-4 py-3">
              <Info size={16} className="mt-0.5 shrink-0 text-[#7C3AED]" />
              <p className="text-[9px] leading-relaxed text-gray-500">
                A importação não define sozinha a elegibilidade oficial dos
                indicadores C1–C7. Os dados serão processados posteriormente
                pelas regras técnicas dos indicadores.
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="mt-5 flex items-center gap-2 text-xs font-semibold text-[#7C3AED]"
            >
              <ArrowLeft size={15} />
              Voltar ao início
            </button>
          </div>
        </section>
      </div>

      {/* =====================================================
          NAVEGAÇÃO INFERIOR
          Tablet e celular
      ====================================================== */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#E7E2F2] bg-white/95 px-3 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-4px_16px_rgba(33,26,74,0.08)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-around">
          {/* Início */}
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-gray-500 transition hover:bg-[#F8F7FF]"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg">
              <Database size={17} />
            </div>
            <span className="text-[9px] font-medium">Início</span>
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
              <History size={17} />
            </div>
            <span className="text-[9px] font-medium">Histórico</span>
          </button>

          {/* Configuração */}
          <button
            type="button"
            className="flex min-w-[64px] flex-col items-center gap-1 rounded-xl bg-[#EEE7FF] px-3 py-2 text-[#7C3AED]"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg">
              <Settings size={17} />
            </div>
            <span className="text-[9px] font-semibold">Config</span>
          </button>
        </div>
      </nav>

      {modalConfigUBS && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#211A4A]/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-2xl shadow-violet-200/40">
            <div className="flex items-center justify-between border-b border-violet-100 bg-gradient-to-r from-violet-50 to-indigo-50 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm">
                  <Building2 size={19} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#211A4A]">
                    Editar informações da UBS
                  </h2>
                  <p className="mt-0.5 text-[9px] text-gray-500">
                    Essas informações serão usadas no sistema e no dashboard.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!salvandoUBS) {
                    setModalConfigUBS(false);
                    setErroUBS("");
                    setSucessoUBS("");
                  }
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-white hover:text-violet-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-[10px] font-bold text-[#211A4A]">
                  Nome da UBS
                </label>
                <div className="relative">
                  <Building2
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-400"
                  />
                  <input
                    value={dadosUBS.nome}
                    onChange={(event) =>
                      setDadosUBS((atual) => ({
                        ...atual,
                        nome: event.target.value,
                      }))
                    }
                    placeholder="Ex.: UBS Porto Alegre"
                    className="h-11 w-full rounded-xl border border-violet-100 bg-violet-50/30 pl-10 pr-3 text-xs text-[#211A4A] outline-none transition placeholder:text-gray-400 focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_100px]">
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold text-[#211A4A]">
                    Município
                  </label>
                  <div className="relative">
                    <MapPin
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-400"
                    />
                    <input
                      value={dadosUBS.municipio}
                      onChange={(event) =>
                        setDadosUBS((atual) => ({
                          ...atual,
                          municipio: event.target.value,
                        }))
                      }
                      placeholder="Ex.: Governador Luiz Rocha"
                      className="h-11 w-full rounded-xl border border-sky-100 bg-sky-50/30 pl-10 pr-3 text-xs text-[#211A4A] outline-none transition placeholder:text-gray-400 focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-bold text-[#211A4A]">
                    UF
                  </label>
                  <input
                    maxLength={2}
                    value={dadosUBS.uf}
                    onChange={(event) =>
                      setDadosUBS((atual) => ({
                        ...atual,
                        uf: event.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="MA"
                    className="h-11 w-full rounded-xl border border-indigo-100 bg-indigo-50/30 px-3 text-center text-xs font-bold uppercase tracking-widest text-[#211A4A] outline-none transition placeholder:text-gray-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>

              {erroUBS && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-[9px] font-medium text-red-600">
                  {erroUBS}
                </div>
              )}

              {sucessoUBS && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-[9px] font-medium text-emerald-600">
                  {sucessoUBS}
                </div>
              )}

              <div className="rounded-xl border border-violet-100 bg-violet-50/50 px-3 py-2.5">
                <p className="text-[9px] leading-relaxed text-violet-700/80">
                  <strong>Importante:</strong> alterar esses dados não altera
                  os pacientes importados nem o histórico do PEC.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50/70 px-5 py-4">
              <button
                type="button"
                disabled={salvandoUBS}
                onClick={() => setModalConfigUBS(false)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[10px] font-bold text-gray-500 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={salvandoUBS}
                onClick={salvarConfiguracaoUBS}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] px-4 py-2.5 text-[10px] font-bold text-white shadow-md shadow-violet-200 transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
              >
                {salvandoUBS ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save size={13} />
                    Salvar alterações
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <ImportarPECModal
        aberto={modalImportarPEC}
        onFechar={() => setModalImportarPEC(false)}
        onConcluido={(resultado) => {
          console.log("Importação PEC concluída:", resultado);
        }}
      />
    </main>
  );
}
