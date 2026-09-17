"use client";

import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Search, ShieldCheck, UsersRound } from "lucide-react";
import { onIdTokenChanged } from "firebase/auth";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

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

  if (carregando || carregandoDados) return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F7FF]">
      <div className="text-center"><Loader2 size={34} className="mx-auto mb-3 animate-spin text-[#7C3AED]" />
        <p className="text-sm font-semibold text-[#4C1D95]">Carregando área operacional...</p>
      </div>
    </main>
  );

  if (erro) return (
    <main className="min-h-screen bg-[#F8F7FF] px-5 py-8">
      <div className="mx-auto max-w-3xl rounded-3xl border border-red-100 bg-white p-7 shadow-sm">
        <AlertCircle size={28} className="text-red-500" />
        <h1 className="mt-4 text-xl font-bold text-[#211A4A]">Não foi possível abrir a área</h1>
        <p className="mt-2 text-sm text-gray-500">{erro}</p>
        <button onClick={() => router.back()} className="mt-6 flex items-center gap-2 rounded-xl bg-[#7C3AED] px-5 py-3 text-sm font-semibold text-white">
          <ArrowLeft size={16} /> Voltar
        </button>
      </div>
    </main>
  );

  if (!dados) return null;

  return (
    <main className="min-h-screen bg-[#F8F7FF] text-[#211A4A]">
      <header className="rounded-b-[28px] bg-gradient-to-r from-[#7C3AED] to-[#5B21B6] px-6 py-6 text-white">
        <div className="mx-auto max-w-5xl">
          <button onClick={() => router.back()} className="mb-5 flex items-center gap-2 text-[11px] font-semibold text-white/80">
            <ArrowLeft size={15} /> Voltar para equipe
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><UsersRound size={23} /></div>
            <div><p className="text-[9px] font-semibold uppercase tracking-wide text-white/70">Área operacional do ACS</p>
              <h1 className="mt-1 text-2xl font-bold">{dados.acs.nome}</h1>
              <p className="mt-1 text-xs text-white/80">Microárea {dados.acs.microareaId || "não informada"}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-6">
        <div className="grid grid-cols-3 gap-3">
          <Resumo valor={dados.resumo.pacientes} label="Pacientes" icon={<UsersRound size={17} />} />
          <Resumo valor={dados.resumo.atencao} label="Em atenção" icon={<AlertCircle size={17} />} />
          <Resumo valor={dados.resumo.emDia} label="Em dia" icon={<CheckCircle2 size={17} />} />
        </div>

        <section className="mt-4 rounded-2xl border border-[#E7E2F2] bg-white p-4 shadow-sm">
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
            <div className="mt-5 rounded-2xl bg-[#FAF9FD] px-5 py-10 text-center">
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
                  className="w-full rounded-2xl border border-[#E7E2F2] bg-[#FAF9FD] p-3 text-left transition hover:border-[#C4B5FD] hover:bg-white hover:shadow-sm"
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
                      <span className={`rounded-full px-2.5 py-1 text-[8px] font-bold ${p.situacao === "Atenção" ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}>
                        {p.situacao}
                      </span>
                      <span className="text-[8px] font-semibold text-[#7C3AED]">
                        Ver ficha →
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#F3F0FA] px-4 py-3">
          <ShieldCheck size={18} className="shrink-0 text-[#7C3AED]" />
          <p className="text-[9px] leading-relaxed text-gray-500">
            Acesso organizado por microárea. A proteção definitiva deve permanecer também nas regras do Firestore.
          </p>
        </div>
      </div>
    </main>
  );
}

function Resumo({ valor, label, icon }: { valor: number; label: string; icon: React.ReactNode }) {
  return <div className="rounded-2xl border border-[#E7E2F2] bg-white p-4 shadow-sm">
    <div className="flex items-center gap-2 text-[#7C3AED]">{icon}<span className="text-[9px] font-semibold uppercase">{label}</span></div>
    <p className="mt-3 text-2xl font-bold">{valor}</p>
  </div>;
}

function Filtro({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick}
    className={`shrink-0 rounded-full px-3 py-2 text-[9px] font-semibold ${ativo ? "bg-[#7C3AED] text-white" : "bg-gray-100 text-gray-500"}`}>
    {children}
  </button>;
}
