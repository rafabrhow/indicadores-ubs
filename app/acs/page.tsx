"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  LogOut,
  MapPin,
  Search,
  ShieldCheck,
  UsersRound,
  ChevronRight,
} from "lucide-react";
import { onIdTokenChanged } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import TourBrasil360 from "@/components/tour/TourBrasil360";

type Paciente = {
  id: string;
  nome: string;
  idade: number | null;
  identificador: string;
  ultimoAtendimento: string | null;
  situacao: "Em dia" | "Atenção";
};

type Dados = {
  sucesso: true;
  acs: {
    uid: string;
    nome: string;
    microareaId: string;
    ativo: boolean;
    ultimoAcesso: string | null;
  };
  resumo: {
    pacientes: number;
    atencao: number;
    emDia: number;
  };
  pacientes: Paciente[];
};

export default function ACSPage() {
  const router = useRouter();
  const { usuario, ubs, carregando, logout } = useAuth();

  const [dados, setDados] = useState<Dados | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "atencao" | "emDia">("todos");
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [erro, setErro] = useState("");

  const tourEtapas = [
    {
      alvo: "tour-acs-cabecalho",
      titulo: "Bem-vindo à sua área 👋",
      descricao:
        "Esta é a sua área operacional. Aqui você acompanha os pacientes da sua microárea e os acompanhamentos que precisam da sua atenção.",
    },
    {
      alvo: "tour-acs-microarea",
      titulo: "Sua microárea",
      descricao:
        "Aqui você identifica a microárea vinculada ao seu cadastro e encontra um resumo do que precisa ser acompanhado.",
    },
    {
      alvo: "tour-acs-resumo",
      titulo: "Resumo dos pacientes",
      descricao:
        "Estes cards mostram rapidamente quantos pacientes estão na sua microárea, quantos estão em atenção e quantos estão em dia.",
    },
    {
      alvo: "tour-acs-pacientes",
      titulo: "Pacientes da microárea",
      descricao:
        "Nesta lista aparecem somente os pacientes vinculados à sua microárea. Toque em um paciente para abrir a ficha.",
    },
    {
      alvo: "tour-acs-filtros",
      titulo: "Busca e filtros",
      descricao:
        "Use a busca para localizar um paciente pelo nome ou identificador e os filtros para visualizar todos, os que estão em atenção ou os que estão em dia.",
    },
    {
      alvo: "tour-acs-sair",
      titulo: "Sair do sistema",
      descricao:
        "Quando terminar, use este botão para sair com segurança da área do ACS.",
    },
  ];

  useEffect(() => {
    if (carregando) return;

    if (!usuario) {
      router.replace("/acs-login");
      return;
    }

    if (usuario.perfil !== "acs") {
      router.replace("/dashboard");
      return;
    }

    let cancelado = false;

    const remover = onIdTokenChanged(auth, async (firebaseUser) => {
      if (cancelado) return;

      if (!firebaseUser) {
        router.replace("/acs-login");
        return;
      }

      try {
        // O primeiro acesso é verificado no claim criado pelo login do ACS.
        // Isso evita que uma sessão já aberta consiga pular a troca de senha.
        const tokenResult = await firebaseUser.getIdTokenResult(true);
        const primeiroAcesso = tokenResult.claims.primeiroAcesso === true;

        if (primeiroAcesso) {
          router.replace("/acs/primeiro-acesso");
          return;
        }

        const token = await firebaseUser.getIdToken();

        const resposta = await fetch(
          `/api/acs/operacional/${encodeURIComponent(firebaseUser.uid)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const dadosResposta = await resposta.json();

        if (cancelado) return;

        if (!resposta.ok || !dadosResposta.sucesso) {
          setErro(
            dadosResposta.mensagem ||
              "Não foi possível carregar sua área operacional."
          );
          return;
        }

        setDados(dadosResposta);
      } catch (error) {
        console.error("Erro ao carregar área do ACS:", error);

        if (!cancelado) {
          setErro("Não foi possível carregar sua área operacional.");
        }
      } finally {
        if (!cancelado) {
          setCarregandoDados(false);
        }
      }
    });

    return () => {
      cancelado = true;
      remover();
    };
  }, [carregando, usuario, router]);

  async function sair() {
    await logout();
    router.replace("/acs-login");
  }

  const pacientesFiltrados =
    dados?.pacientes.filter((paciente) => {
      const termo = busca.trim().toLocaleLowerCase("pt-BR");

      const buscaOk =
        !termo ||
        paciente.nome.toLocaleLowerCase("pt-BR").includes(termo) ||
        paciente.identificador.toLocaleLowerCase("pt-BR").includes(termo);

      const filtroOk =
        filtro === "todos" ||
        (filtro === "atencao" && paciente.situacao === "Atenção") ||
        (filtro === "emDia" && paciente.situacao === "Em dia");

      return buscaOk && filtroOk;
    }) ?? [];

  if (carregando || carregandoDados) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7FAFC]">
        <div className="text-center">
          <Loader2 size={36} className="mx-auto animate-spin text-[#00A9E8]" />
          <p className="mt-3 text-sm font-semibold text-[#003B8E]">
            Carregando sua área...
          </p>
        </div>
      </main>
    );
  }

  if (!usuario || usuario.perfil !== "acs") {
    return null;
  }

  if (erro) {
    return (
      <main className="min-h-screen bg-[#F7FAFC] px-5 py-8 text-[#211A4A]">
        <div className="mx-auto max-w-2xl rounded-3xl bg-white p-6 text-center shadow-sm">
          <AlertCircle size={32} className="mx-auto text-red-500" />
          <h1 className="mt-4 text-lg font-bold">Não foi possível abrir sua área</h1>
          <p className="mt-2 text-sm text-gray-500">{erro}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-2xl bg-[#00A9E8] px-5 py-3 text-sm font-bold text-white"
          >
            Tentar novamente
          </button>
        </div>
      </main>
    );
  }

  if (!dados) return null;

  return (
    <main className="min-h-screen bg-[#F7FAFC] text-[#003B8E]">
      <header
        data-tour="tour-acs-cabecalho"
        className="relative isolate overflow-hidden rounded-b-[28px] border border-emerald-200/60 bg-gradient-to-br from-[#009C3B]/95 via-[#00A9E8]/85 to-[#F2C300]/85 px-5 pb-7 pt-5 text-white shadow-[0_10px_24px_rgba(0,156,59,0.16),0_4px_10px_rgba(0,59,142,0.10)] backdrop-blur-md"
      >
        <div className="pointer-events-none absolute -left-10 -top-14 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute right-10 -top-12 h-32 w-32 rounded-full bg-[#F2C300]/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-45px] left-1/2 h-24 w-48 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />

        <div className="relative mx-auto w-full max-w-3xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 shadow-sm ring-1 ring-white/25">
                <ShieldCheck size={23} />
              </div>

              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-white/85">Área do ACS</p>
                <h1 className="text-xl font-extrabold">{dados.acs.nome}</h1>
              </div>
            </div>

            <button
              data-tour="tour-acs-sair"
              type="button"
              onClick={sair}
              className="rounded-xl bg-white/15 p-3 shadow-sm ring-1 ring-white/25 transition-all hover:-translate-y-0.5 hover:bg-white/25 hover:shadow-md"
              aria-label="Sair"
            >
              <LogOut size={20} />
            </button>
          </div>

          <div className="relative mt-6 overflow-hidden rounded-2xl border border-white/20 bg-white/15 px-4 py-3 shadow-[0_6px_14px_rgba(0,59,142,0.10)] backdrop-blur-sm">
            <p className="text-[10px] font-semibold text-white/85">Unidade</p>
            <p className="mt-1 font-semibold">{ubs?.nome || "UBS"}</p>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-3xl px-5 py-6">
        <div data-tour="tour-acs-microarea" className="rounded-3xl border border-[#9EDFF2] bg-gradient-to-br from-[#F8FCFF] via-white to-[#EAF7FC] p-5 shadow-[0_8px_18px_rgba(0,169,232,0.10),0_3px_7px_rgba(0,59,142,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(0,169,232,0.14)]">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E5F5FB] text-[#00A9E8] shadow-sm ring-1 ring-[#9EDFF2]">
              <MapPin size={23} />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Minha microárea
              </p>
              <p className="mt-1 text-2xl font-bold">{dados.acs.microareaId || "—"}</p>
              <p className="mt-1 text-sm text-gray-500">
                Aqui estão os pacientes vinculados à sua microárea e os
                acompanhamentos que precisam da sua atenção.
              </p>
            </div>
          </div>
        </div>

        <div data-tour="tour-acs-resumo" className="mt-4 grid grid-cols-3 gap-3">
          <Resumo
            valor={dados.resumo.pacientes}
            label="Pacientes"
            icon={<UsersRound size={17} />}
          />
          <Resumo
            valor={dados.resumo.atencao}
            label="Em atenção"
            icon={<AlertCircle size={17} />}
          />
          <Resumo
            valor={dados.resumo.emDia}
            label="Em dia"
            icon={<CheckCircle2 size={17} />}
          />
        </div>

        <section data-tour="tour-acs-pacientes" className="mt-4 rounded-2xl border border-[#B8DFF0] bg-gradient-to-br from-white via-[#F8FCFF] to-[#EFF9FD] p-4 shadow-[0_7px_16px_rgba(0,59,142,0.07),0_2px_5px_rgba(0,169,232,0.05)] transition-all duration-200 hover:shadow-[0_10px_20px_rgba(0,169,232,0.10)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold">Pacientes da microárea</h2>
              <p className="mt-1 text-[10px] text-gray-400">
                Somente pacientes vinculados à sua microárea.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar paciente..."
                className="w-full rounded-xl border border-gray-200 bg-[#FAF9FD] py-2.5 pl-9 pr-3 text-xs outline-none focus:border-[#7C3AED]"
              />
            </div>
          </div>

          <div data-tour="tour-acs-filtros" className="mt-4 flex gap-2 overflow-x-auto pb-1">
            <Filtro ativo={filtro === "todos"} onClick={() => setFiltro("todos")}>
              Todos ({dados.resumo.pacientes})
            </Filtro>
            <Filtro
              ativo={filtro === "atencao"}
              onClick={() => setFiltro("atencao")}
            >
              Atenção ({dados.resumo.atencao})
            </Filtro>
            <Filtro
              ativo={filtro === "emDia"}
              onClick={() => setFiltro("emDia")}
            >
              Em dia ({dados.resumo.emDia})
            </Filtro>
          </div>

          {pacientesFiltrados.length === 0 ? (
            <div className="mt-5 rounded-2xl bg-[#FAF9FD] px-5 py-10 text-center">
              <UsersRound size={27} className="mx-auto text-gray-300" />
              <p className="mt-3 text-sm font-semibold text-gray-500">
                Nenhum paciente encontrado.
              </p>
              <p className="mt-1 text-[10px] text-gray-400">
                Tente outro nome ou altere o filtro.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {pacientesFiltrados.map((paciente) => (
                <button
                  key={paciente.id}
                  type="button"
                  onClick={() =>
                    router.push(
                      `/equipe/acs/${encodeURIComponent(dados.acs.uid)}/paciente/${encodeURIComponent(paciente.id)}`
                    )
                  }
                  className="group w-full rounded-2xl border border-[#DDEAF2] bg-gradient-to-br from-white to-[#F7FBFD] p-3 text-left shadow-[0_4px_10px_rgba(0,59,142,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#9EDFF2] hover:shadow-[0_9px_18px_rgba(0,169,232,0.12)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold">{paciente.nome}</p>
                      <p className="mt-1 text-[10px] text-gray-500">
                        {paciente.idade !== null
                          ? `${paciente.idade} anos`
                          : "Idade não informada"}
                        {paciente.identificador ? ` • ${paciente.identificador}` : ""}
                      </p>
                      <p className="mt-1 text-[10px] text-gray-400">
                        Último atendimento: {paciente.ultimoAtendimento || "Não informado"}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[8px] font-bold ${
                          paciente.situacao === "Atenção"
                            ? "bg-[#FEE2E2] text-[#DC2626]"
                            : "bg-[#D9F6E5] text-[#009C3B]"
                        }`}
                      >
                        {paciente.situacao}
                      </span>
                      <ChevronRight size={15} className="text-[#00A9E8] transition-transform duration-200 group-hover:translate-x-0.5" />
                    </div>
                  </div>

                  <p className="mt-2 text-[9px] font-semibold text-[#00A9E8]">
                    Ver ficha →
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[#C9E8F5] bg-gradient-to-r from-[#EFF9FD] to-[#F6FBFE] px-4 py-3 shadow-[0_4px_10px_rgba(0,169,232,0.06)]">
          <ShieldCheck size={18} className="shrink-0 text-[#00A9E8]" />
          <p className="text-[9px] leading-relaxed text-gray-500">
            O ACS visualiza somente os pacientes autorizados para sua
            microárea. A validação também ocorre no servidor.
          </p>
        </div>
      </section>

      <TourBrasil360
        etapas={tourEtapas}
        storageKey="brasil360_tour_acs_v1"
        ativo={!carregando && !carregandoDados && usuario?.perfil === "acs" && !!dados}
      />
    </main>
  );
}

function Resumo({
  valor,
  label,
  icon,
}: {
  valor: number;
  label: string;
  icon: React.ReactNode;
}) {
  const estilo =
    label === "Pacientes"
      ? {
          card: "border-[#9EDFF2] bg-gradient-to-br from-[#EAF7FC] via-white to-[#D7F1FA] shadow-[0_6px_14px_rgba(0,169,232,0.12),0_2px_5px_rgba(0,0,0,0.05)] hover:shadow-[0_10px_20px_rgba(0,169,232,0.18)]",
          icon: "text-[#00A9E8]",
        }
      : label === "Em atenção"
        ? {
            card: "border-[#F5D66A] bg-gradient-to-br from-[#FFF9E5] via-white to-[#FFF1B8] shadow-[0_6px_14px_rgba(242,195,0,0.12),0_2px_5px_rgba(0,0,0,0.05)] hover:shadow-[0_10px_20px_rgba(242,195,0,0.18)]",
            icon: "text-[#C78A00]",
          }
        : {
            card: "border-[#A7E6C0] bg-gradient-to-br from-[#ECFDF3] via-white to-[#DDF7E7] shadow-[0_6px_14px_rgba(0,156,59,0.12),0_2px_5px_rgba(0,0,0,0.05)] hover:shadow-[0_10px_20px_rgba(0,156,59,0.18)]",
            icon: "text-[#009C3B]",
          };

  return (
    <div className={`group rounded-2xl border p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 ${estilo.card}`}>
      <div className={`flex items-center gap-2 ${estilo.icon}`}>
        {icon}
        <span className="text-[9px] font-semibold uppercase">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-extrabold text-[#003B8E]">{valor}</p>
    </div>
  );
}

function Filtro({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-2 text-[9px] font-semibold ${
        ativo ? "bg-[#00A9E8] text-white shadow-[0_4px_10px_rgba(0,169,232,0.20)]" : "bg-[#EEF5F9] text-[#64748B]"
      }`}
    >
      {children}
    </button>
  );
}
