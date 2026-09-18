"use client";

import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Search, ShieldCheck, UsersRound } from "lucide-react";
import { onIdTokenChanged } from "firebase/auth";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import LoadingBrasil360 from "@/components/ui/LoadingBrasil360";

type Paciente = {
  id: string; nome: string; idade: number | null; identificador: string;
  ultimoAtendimento: string | null; situacao: "Em dia" | "Atenção";
};
type Dados = {
  sucesso: true;
  acs: { uid: string; nome: string; microareaId: string; ativo: boolean; ultimoAcesso: string | null };
  resumo: { pacientes: number; atencao: number; emDia: number };
  pacientes: Paciente[];
};

export default function AreaOperacionalACSPage() {
  const router = useRouter();
  const params = useParams<{ uid: string }>();
  const { usuario, carregando } = useAuth();
  const uid = typeof params.uid === "string" ? params.uid : "";
  const [dados, setDados] = useState<Dados | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "atencao" | "emDia">("todos");
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (carregando || !usuario || !uid) return;
    let cancelado = false;

    const cancelar = onIdTokenChanged(auth, async (usuarioAuth) => {
      if (!usuarioAuth) { router.replace("/login"); return; }
      try {
        setCarregandoDados(true); setErro("");
        const token = await usuarioAuth.getIdToken();
        const res = await fetch(`/api/acs/operacional/${encodeURIComponent(uid)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (cancelado) return;
        if (!res.ok || !json.sucesso) {
          setErro(json.mensagem || "Não foi possível carregar a área operacional.");
          return;
        }
        setDados(json);
      } catch (e) {
        console.error("Erro na área operacional:", e);
        if (!cancelado) setErro("Não foi possível carregar os dados da microárea.");
      } finally {
        if (!cancelado) setCarregandoDados(false);
      }
    });
    return () => { cancelado = true; cancelar(); };
  }, [carregando, router, uid, usuario]);

  const filtrados = useMemo(() => {
    if (!dados) return [];
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return dados.pacientes.filter(p => {
      const buscaOk = !termo ||
        p.nome.toLocaleLowerCase("pt-BR").includes(termo) ||
        p.identificador.toLocaleLowerCase("pt-BR").includes(termo);
      const filtroOk = filtro === "todos" ||
        (filtro === "atencao" && p.situacao === "Atenção") ||
        (filtro === "emDia" && p.situacao === "Em dia");
      return buscaOk && filtroOk;
    });
  }, [dados, busca, filtro]);

 if (carregando || carregandoDados) {
  return (
    <LoadingBrasil360
      mensagem="Carregando área operacional..."
      subtitulo="Preparando os dados da sua microárea"
    />
  );
}

  if (erro) return (
    <main className="min-h-screen bg-[#F7FAFC] px-5 py-8">
      <div className="mx-auto max-w-3xl rounded-3xl border border-red-100 bg-white p-7 shadow-sm">
        <AlertCircle size={28} className="text-red-500" />
        <h1 className="mt-4 text-xl font-bold text-[#003B8E]">Não foi possível abrir a área</h1>
        <p className="mt-2 text-sm text-gray-500">{erro}</p>
        <button onClick={() => router.back()} className="mt-6 flex items-center gap-2 rounded-xl bg-[#00A9E8] px-5 py-3 text-sm font-semibold text-white">
          <ArrowLeft size={16} /> Voltar
        </button>
      </div>
    </main>
  );

  if (!dados) return null;

  return (
    <main className="min-h-screen bg-[#F7FAFC] text-[#003B8E]">
      <header
        className="relative isolate overflow-hidden rounded-b-[28px] border border-emerald-200/60 bg-gradient-to-br from-[#009C3B]/95 via-[#00A9E8]/85 to-[#F2C300]/85 px-5 py-5 text-white shadow-[0_10px_24px_rgba(0,156,59,0.16),0_4px_10px_rgba(0,59,142,0.10)] backdrop-blur-md"
      >
        <div className="pointer-events-none absolute -left-10 -top-14 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute right-10 -top-12 h-32 w-32 rounded-full bg-[#F2C300]/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-45px] left-1/2 h-24 w-48 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />

        <div className="relative mx-auto max-w-5xl">
          <button
            onClick={() => router.back()}
            className="group mb-5 flex items-center gap-2 pr-20 text-[11px] font-bold text-white/95"
          >
            <ArrowLeft size={15} className="transition-transform group-hover:-translate-x-0.5" />
            Voltar para equipe
          </button>

          <div className="flex items-center gap-3 pr-20">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 shadow-sm ring-1 ring-white/25">
              <UsersRound size={23} />
            </div>

            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-white/85">
                Área operacional do ACS
              </p>
              <h1 className="mt-1 truncate text-2xl font-extrabold">
                {dados.acs.nome}
              </h1>
              <p className="mt-1 text-xs text-white/90">
                Microárea {dados.acs.microareaId || "não informada"}
              </p>
            </div>
          </div>

          <img
            src="/brasil360-logo-header.png"
            alt="Brasil 360"
            width={88}
            height={88}
            className="absolute right-3 top-1/2 h-16 w-16 -translate-y-1/2 rounded-2xl object-cover shadow-[0_8px_18px_rgba(0,59,142,0.22)] ring-1 ring-white/50 sm:h-20 sm:w-20"
          />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 pb-6 pt-5 sm:px-5 md:pt-6">
        <div className="grid grid-cols-3 gap-3">
          <Resumo valor={dados.resumo.pacientes} label="Pacientes" icon={<UsersRound size={17} />} />
          <Resumo valor={dados.resumo.atencao} label="Em atenção" icon={<AlertCircle size={17} />} />
          <Resumo valor={dados.resumo.emDia} label="Em dia" icon={<CheckCircle2 size={17} />} />
        </div>

        <section className="mt-4 rounded-2xl border border-[#B8DFF0] bg-gradient-to-br from-white via-[#F8FCFF] to-[#EFF9FD] p-4 shadow-[0_8px_18px_rgba(0,59,142,0.07),0_2px_5px_rgba(0,169,232,0.05)] transition-all duration-200 hover:shadow-[0_12px_24px_rgba(0,169,232,0.10)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-sm font-bold">Pacientes da microárea</h2>
              <p className="mt-1 text-[10px] text-gray-400">Somente pacientes vinculados à microárea deste ACS.</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar paciente..."
                className="w-full rounded-xl border border-gray-200 bg-[#FAF9FD] py-2.5 pl-9 pr-3 text-xs outline-none focus:border-[#7C3AED]" />
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            <Filtro ativo={filtro === "todos"} onClick={() => setFiltro("todos")}>Todos ({dados.resumo.pacientes})</Filtro>
            <Filtro ativo={filtro === "atencao"} onClick={() => setFiltro("atencao")}>Atenção ({dados.resumo.atencao})</Filtro>
            <Filtro ativo={filtro === "emDia"} onClick={() => setFiltro("emDia")}>Em dia ({dados.resumo.emDia})</Filtro>
          </div>

          {filtrados.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-[#DDEAF2] bg-gradient-to-br from-[#F8FCFF] to-white px-5 py-10 text-center shadow-sm">
              <UsersRound size={27} className="mx-auto text-gray-300" />
              <p className="mt-3 text-sm font-semibold text-gray-500">Nenhum paciente encontrado.</p>
              <p className="mt-1 text-[10px] text-gray-400">Tente outro nome ou altere o filtro.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {filtrados.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    router.push(
                      `/equipe/acs/${encodeURIComponent(uid)}/paciente/${encodeURIComponent(p.id)}`
                    )
                  }
                  className="group w-full rounded-2xl border border-[#DDEAF2] bg-gradient-to-br from-white to-[#F7FBFD] p-3 text-left shadow-[0_4px_10px_rgba(0,59,142,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#9EDFF2] hover:shadow-[0_9px_18px_rgba(0,169,232,0.12)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold">{p.nome}</p>
                      <p className="mt-1 text-[10px] text-gray-500">
                        {p.idade !== null ? `${p.idade} anos` : "Idade não informada"}
                        {p.identificador ? ` • ${p.identificador}` : ""}
                      </p>
                      <p className="mt-1 text-[10px] text-gray-400">
                        Último atendimento: {p.ultimoAtendimento || "Não informado"}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[8px] font-bold ${p.situacao === "Atenção" ? "bg-[#FEE2E2] text-[#DC2626]" : "bg-[#D9F6E5] text-[#009C3B]"}`}>
                        {p.situacao}
                      </span>
                      <span className="text-[8px] font-semibold text-[#00A9E8]">
                        Ver ficha →
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[#C9E8F5] bg-gradient-to-r from-[#EFF9FD] to-[#F6FBFE] px-4 py-3 shadow-[0_4px_10px_rgba(0,169,232,0.06)]">
          <ShieldCheck size={18} className="shrink-0 text-[#00A9E8]" />
          <p className="text-[9px] leading-relaxed text-gray-500">
            Acesso organizado por microárea. A proteção definitiva deve permanecer também nas regras do Firestore.
          </p>
        </div>
      </div>
    </main>
  );
}

function Resumo({ valor, label, icon }: { valor: number; label: string; icon: React.ReactNode }) {
  const estilo =
    label === "Pacientes"
      ? {
          card: "border-[#9EDFF2] bg-gradient-to-br from-[#EAF7FC] via-white to-[#D7F1FA] shadow-[0_7px_16px_rgba(0,169,232,0.12),0_2px_5px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_22px_rgba(0,169,232,0.18)]",
          icon: "text-[#00A9E8]",
        }
      : label === "Em atenção"
        ? {
            card: "border-[#F5D66A] bg-gradient-to-br from-[#FFF9E5] via-white to-[#FFF1B8] shadow-[0_7px_16px_rgba(242,195,0,0.12),0_2px_5px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_22px_rgba(242,195,0,0.18)]",
            icon: "text-[#C78A00]",
          }
        : {
            card: "border-[#A7E6C0] bg-gradient-to-br from-[#ECFDF3] via-white to-[#DDF7E7] shadow-[0_7px_16px_rgba(0,156,59,0.12),0_2px_5px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_22px_rgba(0,156,59,0.18)]",
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

function Filtro({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick}
    className={`shrink-0 rounded-full px-3 py-2 text-[9px] font-semibold ${ativo ? "bg-[#00A9E8] text-white shadow-[0_4px_10px_rgba(0,169,232,0.20)]" : "bg-[#EEF5F9] text-[#64748B]"}`}>
    {children}
  </button>;
}
