"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, Filter, Search, Smile } from "lucide-react";
import { auth } from "@/lib/firebase";
import { onIdTokenChanged } from "firebase/auth";

type Pratica = {
  codigo: "B1" | "B2" | "B3" | "B4" | "B5" | "B6";
  titulo: string;
  peso: number;
  numerador: number;
  denominador: number | null;
  percentual: number | null;
  status: "Disponível" | "Indisponível";
  descricao: string;
  motivo?: string;
};

type Paciente = {
  id: string;
  nome: string;
  cpf?: string;
  cns?: string;
  idade?: number;
  microarea?: string;
  b1: boolean; b2: boolean; b3: boolean; b4: boolean; b5: boolean; b6: boolean;
  detalhes: Record<string, string>;
};

type Resultado = {
  sucesso: boolean;
  possuiDados?: boolean;
  totalRegistros?: number;
  praticas?: Record<"B1" | "B2" | "B3" | "B4" | "B5" | "B6", Pratica>;
  pacientes?: Paciente[];
  mensagem?: string;
};

const codigos = ["B1", "B2", "B3", "B4", "B5", "B6"] as const;

function pct(v: number | null | undefined) {
  return v == null ? "N/D" : `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function cor(status: Pratica["status"], percentual: number | null) {
  if (status === "Indisponível") return "text-gray-500";
  if ((percentual ?? 0) >= 75) return "text-[#10B981]";
  if ((percentual ?? 0) >= 50) return "text-[#F59E0B]";
  return "text-[#EF4444]";
}

function estiloCard(codigo: (typeof codigos)[number]) {
  const estilos = {
    B1: "from-emerald-50 via-white to-teal-50 border-emerald-100 hover:border-emerald-300 hover:shadow-emerald-100/70",
    B2: "from-sky-50 via-white to-cyan-50 border-sky-100 hover:border-sky-300 hover:shadow-sky-100/70",
    B3: "from-violet-50 via-white to-fuchsia-50 border-violet-100 hover:border-violet-300 hover:shadow-violet-100/70",
    B4: "from-amber-50 via-white to-yellow-50 border-amber-100 hover:border-amber-300 hover:shadow-amber-100/70",
    B5: "from-rose-50 via-white to-pink-50 border-rose-100 hover:border-rose-300 hover:shadow-rose-100/70",
    B6: "from-indigo-50 via-white to-blue-50 border-indigo-100 hover:border-indigo-300 hover:shadow-indigo-100/70",
  };
  return estilos[codigo];
}

function estiloDetalhe(codigo: (typeof codigos)[number]) {
  const estilos = {
    B1: "border-l-4 border-l-emerald-400 bg-emerald-50/60",
    B2: "border-l-4 border-l-sky-400 bg-sky-50/60",
    B3: "border-l-4 border-l-violet-400 bg-violet-50/60",
    B4: "border-l-4 border-l-amber-400 bg-amber-50/60",
    B5: "border-l-4 border-l-rose-400 bg-rose-50/60",
    B6: "border-l-4 border-l-indigo-400 bg-indigo-50/60",
  };
  return estilos[codigo];
}

export default function BucalPage() {
  const router = useRouter();
  const [dados, setDados] = useState<Resultado | null>(null);
  const [busca, setBusca] = useState("");
  const [microarea, setMicroarea] = useState("Todas");
  const [pratica, setPratica] = useState("Todas");
  const [aberto, setAberto] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
  let cancelado = false;

  const cancelarObservador = onIdTokenChanged(
    auth,
    async (usuario) => {
      if (!usuario) {
        if (!cancelado) {
          router.replace("/login");
        }
        return;
      }

      try {
        const token = await usuario.getIdToken();

        const res = await fetch("/api/indicadores/bucal", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const json = await res.json();

        if (cancelado) return;

        if (!res.ok || !json.sucesso) {
          setErro(
            json.mensagem ||
              "Erro ao carregar Saúde Bucal."
          );
          return;
        }

        setDados(json);
      } catch (e) {
        console.error(
          "Erro ao carregar Saúde Bucal:",
          e
        );

        if (!cancelado) {
          setErro(
            "Não foi possível carregar Saúde Bucal."
          );
        }
      } finally {
        if (!cancelado) {
          setCarregando(false);
        }
      }
    }
  );

  return () => {
    cancelado = true;
    cancelarObservador();
  };
}, [router]);
  const pacientes = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (dados?.pacientes ?? []).filter((p) => {
      const okBusca = !termo || p.nome.toLowerCase().includes(termo) || (p.cpf || "").includes(termo) || (p.cns || "").includes(termo);
      const okMicro = microarea === "Todas" || (p.microarea || "Sem microárea") === microarea;
      const okPratica = pratica === "Todas" || p[pratica.toLowerCase() as keyof Paciente] === false;
      return okBusca && okMicro && okPratica;
    });
  }, [dados, busca, microarea, pratica]);

  const microareas = useMemo(() => Array.from(new Set((dados?.pacientes ?? []).map((p) => p.microarea || "Sem microárea"))).sort(), [dados]);

  if (carregando) return <main className="flex min-h-screen items-center justify-center bg-[#F8F7FF]"><div className="h-9 w-9 animate-spin rounded-full border-4 border-[#10B981]/20 border-t-[#10B981]" /></main>;

  if (erro) return <main className="min-h-screen bg-[#F8F7FF] p-6 text-[#211A4A]"><button onClick={() => router.back()} className="mb-5 flex items-center gap-1 text-xs font-semibold text-[#7C3AED]"><ChevronLeft size={15}/> Voltar</button><section className="rounded-2xl bg-white p-8 text-center shadow-sm"><p className="font-bold">Não foi possível carregar Saúde Bucal</p><p className="mt-2 text-xs text-gray-500">{erro}</p></section></main>;

  if (!dados?.possuiDados) return <main className="min-h-screen bg-[#F8F7FF] text-[#211A4A]"><header className="relative isolate overflow-hidden rounded-b-[28px] border border-emerald-200/60 bg-gradient-to-br from-[#009C3B]/95 via-[#00A9E8]/85 to-[#F2C300]/85 px-5 py-5 text-white shadow-[0_10px_24px_rgba(0,156,59,0.16),0_4px_10px_rgba(0,59,142,0.10)] backdrop-blur-md"><div className="pointer-events-none absolute -left-10 -top-14 h-28 w-28 rounded-full bg-white/15 blur-2xl" /><div className="pointer-events-none absolute right-20 -top-12 h-32 w-32 rounded-full bg-[#F2C300]/20 blur-3xl" /><div className="relative pr-20"><button onClick={() => router.back()} className="flex items-center gap-2 text-xs font-bold text-white/95"><ChevronLeft size={14}/> Voltar</button><div className="mt-4"><p className="text-[9px] font-semibold uppercase tracking-wider text-white/85">Indicadores APS Brasil 360</p><h1 className="mt-1 text-lg font-extrabold">Saúde Bucal</h1></div></div><img src="/brasil360-logo-header.png" alt="Brasil 360" width={88} height={88} className="absolute right-5 top-1/2 h-16 w-16 -translate-y-1/2 rounded-2xl object-cover shadow-[0_8px_18px_rgba(0,59,142,0.22)] ring-1 ring-white/50 sm:h-20 sm:w-20" /></header><section className="p-6"><div className="rounded-2xl bg-white p-8 text-center shadow-sm"><Smile className="mx-auto text-[#10B981]"/><p className="mt-3 text-sm font-bold">Ainda não há dados de Saúde Bucal</p><p className="mt-1 text-xs text-gray-500">Importe o relatório temático Saúde bucal do e-SUS PEC.</p></div></section></main>;

  const praticas = dados.praticas!;
  return <main className="min-h-screen bg-[#F8F7FF] text-[#211A4A]">
    <header className="relative isolate overflow-hidden rounded-b-[28px] border border-emerald-200/60 bg-gradient-to-br from-[#009C3B]/95 via-[#00A9E8]/85 to-[#F2C300]/85 px-5 py-5 text-white shadow-[0_10px_24px_rgba(0,156,59,0.16),0_4px_10px_rgba(0,59,142,0.10)] backdrop-blur-md">
      <div className="pointer-events-none absolute -left-10 -top-14 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
      <div className="pointer-events-none absolute right-20 -top-12 h-32 w-32 rounded-full bg-[#F2C300]/20 blur-3xl" />

      <div className="relative pr-20">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-xs font-bold text-white/95"
        >
          <ChevronLeft size={14} /> Voltar
        </button>

        <div className="mt-4">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-white/85">
            Indicadores APS Brasil 360
          </p>
          <h1 className="mt-1 text-lg font-extrabold">Saúde Bucal</h1>
          <p className="mt-1 text-[10px] text-white/90">
            Acompanhamento dos indicadores B1 a B6
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
    <section className="p-4 md:p-6">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {codigos.map((codigo) => { const p = praticas[codigo]; return <div key={codigo} className={`group rounded-2xl border bg-gradient-to-br p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${estiloCard(codigo)}`}><div className="flex items-center justify-between"><span className="rounded-lg bg-white/80 px-2 py-1 text-[9px] font-extrabold shadow-sm">{codigo}</span><span className={`text-sm font-extrabold ${cor(p.status,p.percentual)}`}>{pct(p.percentual)}</span></div><p className="mt-2 text-[10px] font-bold">{p.titulo}</p><p className="mt-2 text-[8px] text-gray-500">{p.numerador}{p.denominador != null ? ` de ${p.denominador}` : " registros"}</p><span className={`mt-2 inline-block rounded-full px-2 py-1 text-[7px] font-bold ${p.status === "Disponível" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{p.status}</span></div> })}
      </section>

      <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-emerald-100"><div className="flex items-center gap-2"><Filter size={14} className="text-[#10B981]"/><h2 className="text-[11px] font-bold">Detalhes dos indicadores</h2></div><div className="mt-3 space-y-2">{codigos.map((codigo) => { const p = praticas[codigo]; return <div key={codigo} className={`rounded-xl p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm ${estiloDetalhe(codigo)}`}><div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-bold">{codigo} — {p.titulo}</p><p className="mt-1 text-[8px] text-gray-500">{p.descricao}</p></div><span className="shrink-0 rounded-full bg-white/80 px-2 py-1 text-[8px] font-bold shadow-sm">Peso {p.peso}</span></div>{p.motivo && <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-[8px] text-[#92400E]">{p.motivo}</p>}</div> })}</div></section>

      <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-teal-100"><div className="flex items-center gap-2"><Search size={14} className="text-[#10B981]"/><h2 className="text-[11px] font-bold">Acompanhamento nominal</h2></div><div className="mt-3 grid gap-2 md:grid-cols-3"><input value={busca} onChange={(e)=>setBusca(e.target.value)} placeholder="Nome, CPF ou CNS" className="rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-[#10B981]"/><select value={microarea} onChange={(e)=>setMicroarea(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-xs"><option>Todas</option>{microareas.map((m)=><option key={m}>{m}</option>)}</select><select value={pratica} onChange={(e)=>setPratica(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-xs"><option>Todas</option>{codigos.map((c)=><option key={c}>{c}</option>)}</select></div><div className="mt-4 space-y-2">{pacientes.map((p)=><div key={p.id} className="rounded-xl border border-gray-100 bg-[#FCFBFF]"><button onClick={()=>setAberto(aberto===p.id?null:p.id)} className="flex w-full items-center justify-between px-3 py-3 text-left"><div><p className="text-[10px] font-bold">{p.nome}</p><p className="mt-1 text-[8px] text-gray-500">{p.microarea ? `Microárea ${p.microarea}` : "Sem microárea"}{p.idade ? ` • ${p.idade} anos` : ""}</p></div><ChevronDown size={15} className={aberto===p.id?"rotate-180":""}/></button>{aberto===p.id && <div className="grid grid-cols-2 gap-2 border-t px-3 py-3 md:grid-cols-3">{codigos.map(c=><div key={c} className="rounded-lg bg-white p-2"><p className="text-[8px] font-bold">{c}</p><p className={`text-[8px] font-semibold ${p[c.toLowerCase() as keyof Paciente] ? "text-[#10B981]":"text-gray-400"}`}>{p[c.toLowerCase() as keyof Paciente] ? "Registrado":"Sem registro"}</p>{p.detalhes[c] && <p className="mt-1 text-[7px] text-gray-500">{p.detalhes[c]}</p>}</div>)}</div>}</div>)}{pacientes.length===0 && <div className="py-8 text-center text-xs text-gray-500">Nenhum paciente encontrado.</div>}</div></section>
    </section>
  </main>;
}
