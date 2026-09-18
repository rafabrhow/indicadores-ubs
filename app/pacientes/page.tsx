"use client";

import {
  ChevronRight,
  FileBarChart,
  House,
  Loader2,
  LogOut,
  MapPin,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { db } from "@/lib/firestore";
import { useAuth } from "@/context/AuthContext";

type Paciente = {
  id: string;
  nome: string;
  dataNascimento: string;
  idade: string;
  sexo: string;
  cpf: string;
  cns: string;
  telefoneCelular: string;
  microareaId: string;
  bairro: string;
  rua: string;
  numero: string;
  tematicasPEC: string[];
  indicadoresOrigemPEC: string[];
};

const INDICADORES = [
  ["C2", "Desenvolvimento infantil"],
  ["C3", "Gestação e puerpério"],
  ["C4", "Diabetes"],
  ["C5", "Hipertensão"],
  ["C6", "Pessoa idosa"],
  ["C7", "Saúde da mulher"],
] as const;

function texto(valor: unknown) {
  return typeof valor === "string" ? valor : "";
}

// C2 é exclusivo para crianças com até 2 anos.
// A temática do PEC indica a origem do relatório, não a elegibilidade oficial.
function normalizarTexto(valor: unknown) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function idadeEmAnos(valor: unknown): number | null {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;

  const valorTexto = String(valor ?? "").trim();
  if (!valorTexto) return null;

  const match = valorTexto.match(/(\d+(?:[.,]\d+)?)\s*ano/i);

  if (match) {
    const idade = Number(match[1].replace(",", "."));
    return Number.isFinite(idade) ? idade : null;
  }

  const somenteNumero = Number(valorTexto.replace(",", "."));
  return Number.isFinite(somenteNumero) ? somenteNumero : null;
}

function ehTematicaC2(valor: unknown) {
  const tema = normalizarTexto(valor);
  return (
    tema.includes("desenvolvimento infantil") ||
    tema.includes("infantil") ||
    tema.includes("crianca")
  );
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] || "") + (partes[1]?.[0] || "")).toUpperCase();
}

export default function PacientesPage() {
  const router = useRouter();
  const { usuario, ubs, carregando, logout } = useAuth();

  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [carregandoPacientes, setCarregandoPacientes] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [microarea, setMicroarea] = useState("todas");
  const [indicador, setIndicador] = useState("todos");

  useEffect(() => {
  if (carregando) return;

  if (!usuario) {
    router.replace("/login");
    return;
  }

  if (usuario.perfil !== "enfermeira") {
    router.replace("/acs");
    return;
  }

  const ubsId = usuario.ubsId;

  async function carregar() {
    try {
      setErro("");

      const snapshot = await getDocs(
        collection(db, "ubs", ubsId, "pacientes")
      );

      const lista: Paciente[] = snapshot.docs.map((item) => {
        const d = item.data();

        return {
          id: item.id,
          nome: texto(d.nome),
          dataNascimento: texto(d.dataNascimento),
          idade: texto(d.idade),
          sexo: texto(d.sexo),
          cpf: texto(d.cpf),
          cns: texto(d.cns),
          telefoneCelular: texto(d.telefoneCelular),
          microareaId: texto(d.microareaId),
          bairro: texto(d.bairro || d.endereco?.bairro),
          rua: texto(d.rua || d.endereco?.rua),
          numero: texto(d.numero || d.endereco?.numero),
          tematicasPEC: Array.isArray(d.tematicasPEC)
            ? d.tematicasPEC.filter(
                (v: unknown): v is string =>
                  typeof v === "string"
              )
            : [],
          indicadoresOrigemPEC: Array.isArray(
            d.indicadoresOrigemPEC
          )
            ? d.indicadoresOrigemPEC.filter(
                (v: unknown): v is string =>
                  typeof v === "string"
              )
            : [],
        };
      });

      lista.sort((a, b) =>
        a.nome.localeCompare(b.nome, "pt-BR")
      );

      setPacientes(lista);
    } catch (error) {
      console.error("Erro ao carregar pacientes:", error);
      setErro(
        "Não foi possível carregar os pacientes da UBS."
      );
    } finally {
      setCarregandoPacientes(false);
    }
  }

  carregar();
}, [carregando, usuario, router]);

  const microareas = useMemo(
    () =>
      Array.from(
        new Set(pacientes.map((p) => p.microareaId).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true })),
    [pacientes]
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");

    return pacientes.filter((p) => {
      const buscaOK =
        !termo ||
        p.nome.toLocaleLowerCase("pt-BR").includes(termo) ||
        p.cpf.includes(termo) ||
        p.cns.includes(termo) ||
        p.microareaId.includes(termo);

      const microOK =
        microarea === "todas" || p.microareaId === microarea;

      const idade = idadeEmAnos(p.idade);
      const c2Elegivel = idade !== null && idade <= 2;

      const indicadoresVisiveis = p.indicadoresOrigemPEC.filter(
        (valor) => !ehTematicaC2(valor) || c2Elegivel
      );

      const indicadorOK =
        indicador === "todos" ||
        indicadoresVisiveis.includes(indicador);

      return buscaOK && microOK && indicadorOK;
    });
  }, [pacientes, busca, microarea, indicador]);

  if (carregando || !usuario) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7FAFC]">
        <Loader2 size={34} className="animate-spin text-[#003B8E]" />
      </main>
    );
  }

  async function sair() {
    await logout();
    router.replace("/login");
  }

  return (
    <main className="min-h-screen bg-[#F7FAFC] text-[#003B8E]">
      <div className="flex min-h-screen">
        <aside className="hidden w-[150px] shrink-0 flex-col border-r border-[#DDEAF2] bg-white lg:flex">
          <div className="border-b border-[#E7E2F2] px-4 py-5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00A9E8]">
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

          <nav className="flex-1 px-3 py-4">
            <button onClick={() => router.push("/dashboard")} className="mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[10px] text-gray-500 transition-colors hover:bg-[#F7FAFC] hover:text-[#003B8E]">
              <House size={15} /> Início
            </button>
            <button className="mb-2 flex w-full items-center gap-3 rounded-lg bg-[#E5F5FB] px-3 py-3 text-left text-[10px] font-semibold text-[#003B8E]">
              <UserRound size={15} /> Pacientes
            </button>
            <button onClick={() => router.push("/equipe")} className="mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[10px] text-gray-500 transition-colors hover:bg-[#F7FAFC] hover:text-[#003B8E]">
              <UsersRound size={15} /> Equipe
            </button>
            <button onClick={() => router.push("/config")} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[10px] text-gray-500 transition-colors hover:bg-[#F7FAFC] hover:text-[#003B8E]">
              <FileBarChart size={15} /> Config
            </button>
          </nav>

          <div className="border-t border-[#DDEAF2] p-3">
            <p className="truncate text-[9px] font-semibold">{usuario.nome}</p>
            <p className="truncate text-[8px] text-gray-400">Enfermeira</p>
            <button onClick={sair} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-2 py-2 text-[9px] font-semibold text-gray-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500">
              <LogOut size={13} /> Sair
            </button>
          </div>
        </aside>

        <section className="min-w-0 flex-1 pb-24 lg:pb-0">
          <header className="relative isolate overflow-hidden rounded-b-[28px] border border-emerald-200/60 bg-gradient-to-br from-[#009C3B]/95 via-[#00A9E8]/85 to-[#F2C300]/85 px-5 py-5 text-white shadow-[0_10px_24px_rgba(0,156,59,0.16),0_4px_10px_rgba(0,59,142,0.10)] backdrop-blur-md">
            <div className="pointer-events-none absolute -left-10 -top-14 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
            <div className="pointer-events-none absolute right-24 -top-12 h-32 w-32 rounded-full bg-[#F2C300]/20 blur-3xl" />

            <div className="relative pr-24">
              <button
                onClick={() => router.push("/dashboard")}
                className="group flex items-center gap-2 text-xs font-bold text-white/95"
              >
                <ChevronRight size={14} className="rotate-180 transition-transform group-hover:-translate-x-1" />
                Voltar
              </button>

              <div className="mt-4">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-white/85">
                  Gestão da UBS • Enfermeira Gestora
                </p>
                <h1 className="mt-1 text-lg font-extrabold">Pacientes da Equipe</h1>
                <p className="mt-1 text-[10px] text-white/90">
                  {pacientes.length} pacientes • {ubs?.nome || "UBS"}
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

          <div className="px-4 pb-6 pt-5 sm:px-6 md:pt-6 lg:px-7">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#9EDFF2] bg-gradient-to-br from-[#EAF7FC] via-white to-[#D7F1FA] p-4 shadow-[0_6px_14px_rgba(0,169,232,0.12),0_2px_5px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(0,169,232,0.18)]">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#DDF4FC] shadow-sm ring-1 ring-[#9EDFF2]">
                  <UserRound size={15} className="text-[#00A9E8]" />
                </div>
                <p className="mt-3 text-[9px] font-medium text-[#39708A]">Pacientes</p>
                <p className="mt-1 text-2xl font-extrabold text-[#003B8E]">{pacientes.length}</p>
              </div>

              <div className="rounded-2xl border border-[#F5D66A] bg-gradient-to-br from-[#FFF9E5] via-white to-[#FFF1B8] p-4 shadow-[0_6px_14px_rgba(242,195,0,0.12),0_2px_5px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(242,195,0,0.18)]">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF1B8] shadow-sm ring-1 ring-[#F5D66A]">
                  <ShieldCheck size={15} className="text-[#C78A00]" />
                </div>
                <p className="mt-3 text-[9px] font-medium text-[#8A6500]">Sem registro</p>
                <p className="mt-1 text-2xl font-extrabold text-[#003B8E]">
                  {pacientes.filter((p) => p.tematicasPEC.length === 0).length}
                </p>
              </div>

              <div className="rounded-2xl border border-[#A7E6C0] bg-gradient-to-br from-[#ECFDF3] via-white to-[#DDF7E7] p-4 shadow-[0_6px_14px_rgba(0,156,59,0.12),0_2px_5px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(0,156,59,0.18)]">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#D9F6E5] shadow-sm ring-1 ring-[#A7E6C0]">
                  <FileBarChart size={15} className="text-[#009C3B]" />
                </div>
                <p className="mt-3 text-[9px] font-medium text-[#39705A]">Com dados PEC</p>
                <p className="mt-1 text-2xl font-extrabold text-[#003B8E]">
                  {pacientes.filter((p) => {
                    const idade = idadeEmAnos(p.idade);
                    const c2Elegivel = idade !== null && idade <= 2;

                    return p.tematicasPEC.some(
                      (tema) => !ehTematicaC2(tema) || c2Elegivel
                    );
                  }).length}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[#DDEAF2] bg-white p-4 shadow-[0_5px_14px_rgba(0,59,142,0.07)] transition-all duration-200 hover:shadow-[0_8px_18px_rgba(0,59,142,0.10)]">
              <div className="relative">
                <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#003B8E]" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por nome, CPF ou CNS..."
                  className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 pl-11 pr-4 text-sm outline-none focus:border-[#00A9E8] focus:bg-white"
                />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <select value={microarea} onChange={(e) => setMicroarea(e.target.value)} className="h-10 rounded-xl border border-gray-200 px-3 text-[10px] font-semibold">
                  <option value="todas">Todas as microáreas</option>
                  {microareas.map((m) => <option key={m} value={m}>Microárea {m}</option>)}
                </select>

                <select value={indicador} onChange={(e) => setIndicador(e.target.value)} className="h-10 rounded-xl border border-gray-200 px-3 text-[10px] font-semibold">
                  <option value="todos">Por indicador</option>
                  {INDICADORES.map(([id, nome]) => <option key={id} value={id}>{id} — {nome}</option>)}
                </select>
              </div>
            </div>

            {erro && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 shadow-sm">{erro}</div>}

            <div className="mt-5 space-y-3">
              {carregandoPacientes ? (
                <div className="rounded-2xl border border-[#DDEAF2] bg-white p-10 text-center shadow-[0_5px_14px_rgba(0,59,142,0.07)]">
                  <Loader2 size={28} className="mx-auto animate-spin text-[#003B8E]" />
                </div>
              ) : filtrados.map((p) => (
                <button
                  key={p.id}
                  onClick={() => router.push(`/pacientes/${encodeURIComponent(p.id)}`)}
                  className="w-full rounded-2xl border border-[#DDEAF2] bg-white p-4 text-left shadow-[0_5px_14px_rgba(0,59,142,0.07)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#9EDFF2] hover:shadow-[0_10px_20px_rgba(0,169,232,0.14)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E5F5FB] text-xs font-bold text-[#003B8E]">
                      {iniciais(p.nome)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{p.nome}</p>
                      <p className="mt-1 text-[10px] text-gray-500">
                        {p.idade || "Idade não informada"} {p.sexo ? `• ${p.sexo}` : ""}
                        {p.microareaId ? ` • MA ${p.microareaId}` : ""}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(() => {
                          const idade = idadeEmAnos(p.idade);
                          const c2Elegivel = idade !== null && idade <= 2;

                          // Não exibe Desenvolvimento infantil para maiores de 2 anos.
                          const tematicasVisiveis = p.tematicasPEC.filter(
                            (tema) => !ehTematicaC2(tema) || c2Elegivel
                          );

                          return (
                            <>
                              {tematicasVisiveis.slice(0, 3).map((tema) => (
                                <span
                                  key={tema}
                                  className="rounded-full bg-[#ECFDF5] px-2 py-1 text-[8px] font-semibold text-[#059669]"
                                >
                                  {tema}
                                </span>
                              ))}

                              {tematicasVisiveis.length === 0 && (
                                <span className="text-[9px] italic text-gray-400">
                                  Nenhuma boa prática registrada ainda
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    <ChevronRight size={18} className="text-gray-300" />
                  </div>
                </button>
              ))}

              {!carregandoPacientes && filtrados.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[#9EDFF2] bg-gradient-to-br from-[#F4FBFE] to-white p-10 text-center shadow-[0_5px_14px_rgba(0,59,142,0.06)]">
                  <p className="text-sm font-bold text-[#003B8E]">Nenhum paciente encontrado</p>
                  <p className="mt-1 text-xs text-gray-500">Tente alterar a busca ou os filtros.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Menu inferior para tablet e telas menores. */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#DDEAF2] bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_18px_rgba(0,59,142,0.08)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-medium text-gray-500 transition-colors hover:bg-[#F7FAFC] hover:text-[#003B8E]"
          >
            <House size={18} />
            <span>Início</span>
          </button>

          <button
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl bg-[#E5F5FB] text-[9px] font-semibold text-[#003B8E]"
          >
            <UserRound size={18} />
            <span>Pacientes</span>
          </button>

          <button
            onClick={() => router.push("/equipe")}
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-medium text-gray-500 transition-colors hover:bg-[#F7FAFC] hover:text-[#003B8E]"
          >
            <UsersRound size={18} />
            <span>Equipe</span>
          </button>

          <button
            onClick={() => router.push("/config")}
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-medium text-gray-500 transition-colors hover:bg-[#F7FAFC] hover:text-[#003B8E]"
          >
            <FileBarChart size={18} />
            <span>Config</span>
          </button>

          <button
            onClick={sair}
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-medium text-gray-500 transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <LogOut size={18} />
            <span>Sair</span>
          </button>
        </div>
      </nav>
    </main>
  );
}
