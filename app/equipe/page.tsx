"use client";

import {
  Copy,
  UserPlus,
  UsersRound,
  ShieldCheck,
  Check,
  Loader2,
  LogOut,
  LayoutDashboard,
  FileBarChart,
  History,
  Settings,
  UserRound,
  X,
  ChevronRight,
  HeartPulse,
} from "lucide-react";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useState } from "react";

import {
  collection,
  getCountFromServer,
  getDocs,
  getFirestore,
  query,
  where,
} from "firebase/firestore";

import { useAuth } from "@/context/AuthContext";
import ModalCadastrarACS, { type ACSCadastrado } from "@/components/acs/ModalCadastrarACS";
import { auth } from "@/lib/firebase";

function formatarUltimoAcesso(valor: unknown): string | undefined {
  if (!valor) return undefined;

  let data: Date | null = null;

  if (valor instanceof Date) {
    data = valor;
  } else if (
    typeof valor === "object" &&
    valor !== null &&
    "toDate" in valor &&
    typeof (valor as { toDate?: unknown }).toDate === "function"
  ) {
    data = (valor as { toDate: () => Date }).toDate();
  } else if (typeof valor === "string") {
    const convertida = new Date(valor);
    if (!Number.isNaN(convertida.getTime())) {
      data = convertida;
    }
  }

  if (!data || Number.isNaN(data.getTime())) return undefined;

  return data.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function EquipePage() {
  const router = useRouter();

  const {
    usuario,
    ubs,
    carregando,
    logout,
  } = useAuth();

  // ============================================================
  // ESTADOS DA PÁGINA
  // ============================================================

  const [copiado, setCopiado] = useState(false);

  // Controla o modal compartilhado de cadastro de ACS
  const [modalCadastro, setModalCadastro] = useState(false);

  // ============================================================
  // ESTADO E CARREGAMENTO DOS ACS
  // ============================================================

  type ACS = {
    id: string;
    uid: string;
    nome: string;
    microareaId: string;
    ativo: boolean;
    codigoAcesso?: string;
    ultimoAcesso?: string;
    quantidadePacientes?: number;
  };

  const [acs, setAcs] = useState<ACS[]>([]);
  const [carregandoACS, setCarregandoACS] = useState(false);
  const [acsSelecionado, setAcsSelecionado] = useState<ACS | null>(null);
  const [resumoMicroarea, setResumoMicroarea] = useState<{
    atencao: number;
    emDia: number;
  } | null>(null);
  const [carregandoResumoMicroarea, setCarregandoResumoMicroarea] =
    useState(false);

  // Busca os ACS diretamente na coleção da UBS.
  // O ubsId é extraído antes da função assíncrona para que o TypeScript
  // saiba que ele existe durante toda a execução do carregamento.
  useEffect(() => {
    const ubsId =
      typeof usuario?.ubsId === "string"
        ? usuario.ubsId.trim()
        : "";

    // A página Equipe é exclusiva da enfermeira gestora.
    // O ACS deve permanecer na área operacional.
    if (carregando || !ubsId || usuario?.perfil !== "enfermeira") {
      return;
    }

    let cancelado = false;

    async function carregarACS() {
      try {
        setCarregandoACS(true);

        // Usa a instância padrão do Firestore já inicializada em lib/firebase.ts.
        const db = getFirestore();

        const referencia = collection(
          db,
          "ubs",
          ubsId,
          "acs"
        );

        const snapshot = await getDocs(referencia);

        if (cancelado) {
          return;
        }

        const listaBase: ACS[] = snapshot.docs.map((doc) => {
          const dados = doc.data();

          return {
            id: doc.id,
            uid:
              typeof dados.uid === "string"
                ? dados.uid
                : doc.id,
            nome:
              typeof dados.nome === "string"
                ? dados.nome
                : "ACS sem nome",
            microareaId:
              typeof dados.microareaId === "string"
                ? dados.microareaId
                : "",
            ativo: dados.ativo === true,
            codigoAcesso:
              typeof dados.codigoAcesso === "string"
                ? dados.codigoAcesso
                : undefined,
            ultimoAcesso: formatarUltimoAcesso(dados.ultimoAcesso),
            quantidadePacientes:
              typeof dados.quantidadePacientes === "number"
                ? dados.quantidadePacientes
                : undefined,
          };
        });

        // A quantidade de pacientes é calculada pela microárea real
        // vinculada a cada ACS. O count evita baixar toda a coleção de pacientes.
        const lista = await Promise.all(
          listaBase.map(async (item) => {
            if (!item.microareaId) {
              return { ...item, quantidadePacientes: 0 };
            }

            const pacientesQuery = query(
              collection(db, "ubs", ubsId, "pacientes"),
              where("microareaId", "==", item.microareaId),
            );

            const contador = await getCountFromServer(pacientesQuery);

            return {
              ...item,
              quantidadePacientes: contador.data().count,
            };
          }),
        );

        if (cancelado) {
          return;
        }

        setAcs(lista);
      } catch (error) {
        console.error(
          "Erro ao carregar ACS da equipe:",
          error
        );
      } finally {
        if (!cancelado) {
          setCarregandoACS(false);
        }
      }
    }

    carregarACS();

    return () => {
      cancelado = true;
    };
  }, [carregando, usuario?.ubsId]);

  // O limite de 20 considera somente ACS ativos.
  const quantidadeACS = acs.filter(
    (item) => item.ativo
  ).length;

  // ============================================================
  // CÓDIGO DA EQUIPE
  // ============================================================
  //
  // Mantemos temporariamente o código visual da equipe.
  // A geração/armazenamento real do código da equipe será feita
  // em uma etapa posterior.
  //

  const codigoEquipe = "09A-79EB";

  // ============================================================
  // PROTEÇÃO DA PÁGINA
  // ============================================================
  //
  // O redirecionamento precisa acontecer dentro de useEffect.
  // Fazer router.replace() diretamente durante o render provoca
  // o warning do React durante o logout.
  //
  useEffect(() => {
    if (carregando) {
      return;
    }

    if (!usuario) {
      router.replace("/login");
      return;
    }

    // O ACS não pode visualizar a gestão da equipe.
    if (usuario.perfil !== "enfermeira") {
      router.replace("/acs");
    }
  }, [carregando, usuario, router]);

  // ============================================================
  // CARREGAMENTO
  // ============================================================

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F7FF]">
        <div className="text-center">
          <Loader2
            size={36}
            className="mx-auto mb-3 animate-spin text-[#7C3AED]"
          />

          <p className="text-sm font-semibold text-[#4C1D95]">
            Carregando...
          </p>
        </div>
      </main>
    );
  }

  if (!usuario) {
    return null;
  }

  if (usuario.perfil !== "enfermeira") {
    return null;
  }

  async function abrirDetalhesACS(item: ACS) {
    setAcsSelecionado(item);
    setResumoMicroarea(null);

    if (!item.uid) return;

    const usuarioFirebase = auth.currentUser;
    if (!usuarioFirebase) return;

    try {
      setCarregandoResumoMicroarea(true);

      const token = await usuarioFirebase.getIdToken();
      const resposta = await fetch(
        `/api/acs/operacional/${encodeURIComponent(item.uid)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        },
      );

      const dados = await resposta.json();

      if (!resposta.ok || !dados.sucesso) return;

      setResumoMicroarea({
        atencao: Number(dados.resumo?.atencao ?? 0),
        emDia: Number(dados.resumo?.emDia ?? 0),
      });
    } catch (error) {
      console.error("Erro ao carregar resumo da microárea:", error);
    } finally {
      setCarregandoResumoMicroarea(false);
    }
  }

  // ============================================================
  // COPIAR CÓDIGO DA EQUIPE
  // ============================================================

  async function copiarCodigo() {
    try {
      await navigator.clipboard.writeText(codigoEquipe);

      setCopiado(true);

      setTimeout(() => {
        setCopiado(false);
      }, 2000);
    } catch (error) {
      console.error("Não foi possível copiar o código:", error);
    }
  }

  // ============================================================
  // ABRIR MODAL DE CADASTRO
  // ============================================================

  function abrirModalCadastro() {
    setModalCadastro(true);
  }

  // ============================================================
  // LOGOUT
  // ============================================================

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  // ============================================================
  // INTERFACE
  // ============================================================

  return (
    <main className="min-h-screen bg-[#F8F7FF] text-[#211A4A]">
      <div className="flex min-h-screen">

        {/* =====================================================
            SIDEBAR
        ====================================================== */}

        <aside className="hidden w-[150px] shrink-0 flex-col border-r border-[#E7E2F2] bg-white lg:flex">

          {/* Logo Brasil 360 */}
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

          {/* Navegação */}
          <nav className="flex-1 px-3 py-4">

            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[10px] text-gray-500 transition hover:bg-[#F8F7FF] hover:text-[#7C3AED]"
            >
              <LayoutDashboard size={15} />
              Início
            </button>

            <button
              type="button"
              className="mb-2 flex w-full items-center gap-3 rounded-lg bg-[#EEE7FF] px-3 py-3 text-left text-[10px] font-semibold text-[#7C3AED]"
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
              onClick={() => router.push("/config")}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[10px] text-gray-500 transition hover:bg-[#F8F7FF] hover:text-[#7C3AED]"
            >
              <Settings size={15} />
              Config
            </button>

          </nav>

          {/* Usuário */}
          <div className="border-t border-[#E7E2F2] p-3">

            <div className="flex items-center gap-2">

              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EEE7FF]">
                <UserRound
                  size={15}
                  className="text-[#7C3AED]"
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
            CONTEÚDO
        ====================================================== */}

        <section className="min-w-0 flex-1 pb-20 lg:pb-0">

          {/* Cabeçalho Brasil 360 */}
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
                  Minha Equipe
                </h1>

                <p className="mt-1 text-[10px] text-white/90">
                  {ubs?.nome || "UBS"} • {ubs?.municipio || ""} {ubs?.uf ? `• ${ubs.uf}` : ""}
                </p>
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

          <div className="px-7 py-7">

            {/* =================================================
                CÓDIGO DA EQUIPE
            ================================================== */}

            <section className="rounded-2xl border border-[#E7E2F2] bg-white p-5 shadow-sm">

              <div className="flex items-start justify-between gap-4">

                <div>

                  <p className="text-[10px] font-medium text-gray-500">
                    Código da Equipe
                  </p>

                  <div className="mt-2 flex items-center gap-3">

                    <p className="font-mono text-2xl font-bold tracking-[0.25em] text-[#211A4A]">
                      {codigoEquipe}
                    </p>

                    <button
                      type="button"
                      onClick={copiarCodigo}
                      className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-[9px] font-semibold text-gray-600 transition hover:bg-[#EEE7FF] hover:text-[#7C3AED]"
                    >
                      {copiado ? (
                        <>
                          <Check size={13} />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          Copiar
                        </>
                      )}
                    </button>

                  </div>

                </div>

              </div>

              {/* Informação */}
              <div className="mt-5 rounded-xl bg-[#FAF9FD] px-4 py-3">

                <p className="text-[9px] text-gray-500">
                  Cadastre diretamente os ACS da sua equipe.
                  Cada ACS receberá um código de acesso e uma
                  senha provisória exclusivos.
                </p>

              </div>

              {/* Rodapé do card */}
              <div className="mt-5 flex items-center justify-between">

                <p className="text-[9px] text-gray-500">
                  <strong className="text-[#211A4A]">
                    {quantidadeACS}
                  </strong>{" "}
                  de 20 acessos utilizados
                </p>

                <button
                  type="button"
                  onClick={abrirModalCadastro}
                  className="flex items-center gap-2 rounded-lg bg-[#7C3AED] px-4 py-2.5 text-[9px] font-semibold text-white shadow-sm transition hover:bg-[#6D28D9]"
                >
                  <UserPlus size={13} />
                  Cadastrar ACS
                </button>

              </div>

            </section>

            {/* =================================================
                ACS VINCULADOS
            ================================================== */}

            <section className="mt-4 rounded-2xl border border-[#E7E2F2] bg-white p-5 shadow-sm">

              <div className="flex items-center justify-between">

                <div>
                  <h2 className="text-[12px] font-bold text-[#211A4A]">
                    ACS vinculados ({acs.length})
                  </h2>

                  <p className="mt-1 text-[8px] text-gray-400">
                    Agentes vinculados à sua UBS.
                  </p>
                </div>

                {carregandoACS && (
                  <Loader2
                    size={16}
                    className="animate-spin text-[#7C3AED]"
                  />
                )}

              </div>

              {carregandoACS ? (

                <div className="flex min-h-[180px] items-center justify-center">
                  <p className="text-[9px] text-gray-400">
                    Carregando ACS...
                  </p>
                </div>

              ) : acs.length === 0 ? (

                <div className="flex min-h-[180px] flex-col items-center justify-center text-center">

                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F3F0FA]">
                    <UsersRound
                      size={24}
                      className="text-gray-300"
                    />
                  </div>

                  <p className="mt-4 text-[10px] font-medium text-gray-500">
                    Nenhum ACS cadastrado ainda.
                  </p>

                  <p className="mt-1 max-w-[320px] text-[8px] text-gray-400">
                    Cadastre os ACS da sua equipe utilizando o
                    botão acima.
                  </p>

                </div>

              ) : (

                <div className="mt-4 space-y-2">

                  {acs.map((item) => (

                    <button
                      key={item.id}
                      type="button"
                      onClick={() => abrirDetalhesACS(item)}
                      className="flex w-full items-center justify-between rounded-xl border border-[#E7E2F2] bg-[#FAF9FD] p-3 text-left transition hover:-translate-y-0.5 hover:border-[#C4B5FD] hover:bg-white hover:shadow-sm"
                    >

                      <div className="flex min-w-0 items-center gap-3">

                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEE7FF]">
                          <UsersRound
                            size={17}
                            className="text-[#7C3AED]"
                          />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-[10px] font-semibold text-[#211A4A]">
                            {item.nome}
                          </p>

                          <p className="mt-0.5 text-[8px] text-gray-500">
                            Microárea:{" "}
                            {item.microareaId || "Não informada"}
                          </p>
                        </div>

                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-1 text-[7px] font-bold ${
                            item.ativo
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {item.ativo ? "Ativo" : "Inativo"}
                        </span>

                        <ChevronRight
                          size={15}
                          className="text-gray-300"
                        />
                      </div>

                    </button>

                  ))}

                </div>

              )}

            </section>

            {/* =================================================
                INFORMAÇÃO DE SEGURANÇA
            ================================================== */}

            <div className="mt-4 flex items-center gap-3 rounded-xl bg-[#F3F0FA] px-4 py-3">

              <ShieldCheck
                size={16}
                className="shrink-0 text-[#7C3AED]"
              />

              <p className="text-[8px] leading-relaxed text-gray-500">
                Cada ACS possui credenciais próprias e terá
                acesso somente às informações permitidas para
                seu perfil e sua microárea.
              </p>

            </div>

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
              <LayoutDashboard size={17} />
            </div>
            <span className="text-[9px] font-medium">Início</span>
          </button>

          {/* Equipe */}
          <button
            type="button"
            className="flex min-w-[64px] flex-col items-center gap-1 rounded-xl bg-[#EEE7FF] px-3 py-2 text-[#7C3AED]"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg">
              <UsersRound size={17} />
            </div>
            <span className="text-[9px] font-semibold">Equipe</span>
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

          {/* Config */}
          <button
            type="button"
            onClick={() => router.push("/config")}
            className="flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-gray-500 transition hover:bg-[#F8F7FF]"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg">
              <Settings size={17} />
            </div>
            <span className="text-[9px] font-medium">Config</span>
          </button>
        </div>
      </nav>

      {/* ========================================================
          MODAL — DETALHES DO ACS
      ========================================================= */}

      {acsSelecionado && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">

            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EEE7FF]">
                  <UsersRound
                    size={22}
                    className="text-[#7C3AED]"
                  />
                </div>

                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-[#7C3AED]">
                    Detalhes do ACS
                  </p>

                  <h2 className="mt-0.5 truncate text-lg font-bold text-[#211A4A]">
                    {acsSelecionado.nome}
                  </h2>

                  <p className="mt-0.5 text-xs text-gray-500">
                    Microárea:{" "}
                    {acsSelecionado.microareaId || "Não informada"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => { setAcsSelecionado(null); setResumoMicroarea(null); }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                aria-label="Fechar detalhes"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">
                  Status
                </p>
                <p
                  className={`mt-2 text-sm font-bold ${
                    acsSelecionado.ativo
                      ? "text-green-600"
                      : "text-gray-500"
                  }`}
                >
                  {acsSelecionado.ativo ? "Ativo" : "Inativo"}
                </p>
              </div>

              <div className="rounded-2xl bg-purple-50 p-4">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-purple-500">
                  Código de acesso
                </p>
                <p className="mt-2 font-mono text-sm font-bold tracking-wide text-[#4C1D95]">
                  {acsSelecionado.codigoAcesso || "Não disponível"}
                </p>
              </div>

              <div className="rounded-2xl bg-blue-50 p-4">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-blue-500">
                  Último acesso
                </p>
                <p className="mt-2 text-sm font-bold text-gray-700">
                  {acsSelecionado.ultimoAcesso || "Ainda não registrado"}
                </p>
              </div>

              <div className="rounded-2xl bg-green-50 p-4">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-green-600">
                  Pacientes da microárea
                </p>
                <p className="mt-2 text-sm font-bold text-gray-700">
                  {typeof acsSelecionado.quantidadePacientes === "number"
                    ? acsSelecionado.quantidadePacientes
                    : "Não calculado"}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[#DCE8F5] bg-[#F7FBFF] p-4">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-[#003B8E]">
                    Resumo da microárea
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Situação atual dos pacientes vinculados a esta microárea.
                  </p>
                </div>

                {carregandoResumoMicroarea ? (
                  <Loader2 size={18} className="animate-spin text-[#003B8E]" />
                ) : (
                  <div className="grid shrink-0 grid-cols-2 gap-2 text-center">
                    <div className="w-12 shrink-0 rounded-xl bg-white px-1.5 py-2 shadow-sm ring-1 ring-green-100 sm:w-14">
                      <p className="text-[8px] font-semibold uppercase tracking-wide text-green-600">
                        Em dia
                      </p>
                      <p className="mt-0.5 text-lg font-bold text-green-700">
                        {resumoMicroarea?.emDia ?? "—"}
                      </p>
                    </div>

                    <div className="w-12 shrink-0 rounded-xl bg-white px-1.5 py-2 shadow-sm ring-1 ring-amber-100 sm:w-14">
                      <p className="text-[8px] font-semibold uppercase tracking-wide text-amber-600">
                        Atenção
                      </p>
                      <p className="mt-0.5 text-lg font-bold text-amber-700">
                        {resumoMicroarea?.atencao ?? "—"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => { setAcsSelecionado(null); setResumoMicroarea(null); }}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
              >
                Fechar
              </button>

              <button
                type="button"
                onClick={() => {
                  const uid = acsSelecionado.uid;
                  setAcsSelecionado(null);
                  router.push(`/equipe/acs/${encodeURIComponent(uid)}`);
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#6D28D9]"
              >
                Área operacional
                <ChevronRight size={16} />
              </button>
            </div>

          </div>
        </div>
      )}

      <ModalCadastrarACS
        aberto={modalCadastro}
        onFechar={() => setModalCadastro(false)}
        onSucesso={(novoACS: ACSCadastrado) => {
          setAcs((listaAtual) => [...listaAtual, novoACS]);
        }}
      />

    </main>
  );
}