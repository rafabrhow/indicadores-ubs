"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Filter, Search, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

type Pratica = {
  codigo: "A" | "B" | "C" | "D";
  titulo: string;
  pontos: number;
  atingida: boolean;
  percentual: number;
  detalhe: string;
};

type Paciente = {
  nome: string;
  cpf: string;
  cns: string;
  microarea: string;
  idade: string;
  praticas: Pratica[];
  pontuacao: number;
  classificacao: "Ótimo" | "Bom" | "Suficiente" | "Regular";
};

type Relatorio = {
  pontuacao: number;
  classificacao: Paciente["classificacao"];
  totalElegiveis: number;
  praticas: Record<"A" | "B" | "C" | "D", { atingidos: number; percentual: number }>;
};

export default function C6Page() {
  const router = useRouter();
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [microarea, setMicroarea] = useState("Todas");
  const [classificacao, setClassificacao] = useState("Todas");
  const [pratica, setPratica] = useState("Todas");

  useEffect(() => {
    let ativo = true;

    const unsubscribe = auth.onIdTokenChanged(async (user) => {
      if (!user) {
        if (ativo) setCarregando(false);
        return;
      }

      try {
        const token = await user.getIdToken();
        const resposta = await fetch("/api/indicadores/c6", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const dados = await resposta.json();

        if (!ativo) return;

        if (resposta.ok && dados.sucesso && dados.possuiDados) {
          setRelatorio(dados.resumo);
          setPacientes(dados.pacientes || []);
        } else {
          setRelatorio(null);
          setPacientes([]);
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    });

    return () => {
      ativo = false;
      unsubscribe();
    };
  }, []);

  const microareas = useMemo(
    () =>
      Array.from(new Set(pacientes.map((p) => p.microarea).filter(Boolean))).sort(),
    [pacientes],
  );

  const filtrados = useMemo(() => {
    const termo = busca.toLowerCase().trim();

    return pacientes.filter((p) => {
      const bateBusca =
        !termo ||
        p.nome.toLowerCase().includes(termo) ||
        p.cpf.includes(termo);

      const bateMicro = microarea === "Todas" || p.microarea === microarea;
      const bateClass =
        classificacao === "Todas" || p.classificacao === classificacao;
      const batePratica =
        pratica === "Todas" ||
        p.praticas.some(
          (item) =>
            item.codigo === pratica &&
            !item.atingida,
        );

      return bateBusca && bateMicro && bateClass && batePratica;
    });
  }, [pacientes, busca, microarea, classificacao, pratica]);

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7FAFC]">
        <div className="text-sm font-semibold text-[#003B8E]">Carregando C6...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F7FAFC] text-[#003B8E]">
      <header className="relative isolate overflow-hidden rounded-b-[28px] border border-emerald-200/60 bg-gradient-to-br from-[#009C3B]/95 via-[#00A9E8]/85 to-[#F2C300]/85 px-5 py-5 text-white shadow-[0_10px_24px_rgba(0,156,59,0.16),0_4px_10px_rgba(0,59,142,0.10)] backdrop-blur-md">
          <div className="pointer-events-none absolute -left-10 -top-14 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
          <div className="pointer-events-none absolute right-20 -top-12 h-32 w-32 rounded-full bg-[#F2C300]/20 blur-3xl" />
          <div className="relative pr-20">
            <button onClick={() => router.back()} className="flex items-center gap-2 text-xs font-bold text-white/95">
              <ArrowLeft size={17} /> Voltar
            </button>
            <div className="mt-4">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-white/85">Indicadores APS Brasil 360</p>
              <h1 className="mt-1 text-lg font-extrabold">C6 — Cuidado da Pessoa Idosa</h1>
              <p className="mt-1 text-[10px] text-white/90">Relatório operacional baseado na última importação válida do PEC.</p>
            </div>
          </div>
          <img src="/brasil360-logo-header.png" alt="Brasil 360" width={88} height={88} className="absolute right-5 top-1/2 h-16 w-16 -translate-y-1/2 rounded-2xl object-cover shadow-[0_8px_18px_rgba(0,59,142,0.22)] ring-1 ring-white/50 sm:h-20 sm:w-20" />
        </header>

      {!relatorio ? (
        <div className="p-5">
          <section className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-[#E7E2F2]">
            <p className="text-sm font-bold">Ainda não há dados para o C6</p>
            <p className="mt-2 text-xs text-gray-500">
              Importe o relatório temático Pessoa idosa do e-SUS PEC.
            </p>
          </section>
        </div>
      ) : (
        <div className="space-y-3 p-5 pt-6">
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#9EDFF2] bg-gradient-to-br from-[#EAF7FC] via-white to-[#D7F1FA] p-5 shadow-[0_6px_14px_rgba(0,169,232,0.12),0_2px_5px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(0,169,232,0.18)]">
              <p className="text-[9px] font-medium text-[#39708A]">Resultado C6</p>
              <p className="mt-1 text-3xl font-extrabold text-[#003B8E]">
                {relatorio.pontuacao.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
              </p>
              <p className="text-[9px] font-bold text-[#003B8E]">{relatorio.classificacao}</p>
            </div>
            <div className="rounded-2xl border border-[#A7E6C0] bg-gradient-to-br from-[#ECFDF3] via-white to-[#DDF7E7] p-5 shadow-[0_6px_14px_rgba(0,156,59,0.12),0_2px_5px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(0,156,59,0.18)]">
              <p className="text-[9px] font-medium text-[#39705A]">Elegíveis</p>
              <p className="mt-1 text-3xl font-extrabold text-[#003B8E]">{relatorio.totalElegiveis}</p>
              <p className="text-[9px] font-medium text-[#39705A]">pessoas idosas</p>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#E7E2F2]">
            <h2 className="text-sm font-bold">Boas práticas</h2>
            <p className="mt-1 text-[8px] text-gray-400">
              Cada prática vale 25 pontos.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {(["A", "B", "C", "D"] as const).map((codigo) => (
                <div key={codigo} className={`rounded-xl border p-3 shadow-[0_4px_10px_rgba(0,59,142,0.07)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_16px_rgba(0,59,142,0.11)] ${
                    codigo === "A" ? "border-[#9EDFF2] bg-gradient-to-br from-[#EAF7FC] to-[#D7F1FA]" :
                    codigo === "B" ? "border-[#A7E6C0] bg-gradient-to-br from-[#ECFDF3] to-[#DDF7E7]" :
                    codigo === "C" ? "border-[#F5D66A] bg-gradient-to-br from-[#FFF9E5] to-[#FFF1B8]" :
                    "border-[#B7C8F5] bg-gradient-to-br from-[#EEF2FF] to-[#DDE7FF]"
                  }`}>
                    <div className="flex justify-between text-[9px] font-bold">
                      <span>{codigo} — {codigo === "A" ? "Consulta" : codigo === "B" ? "Peso + altura" : codigo === "C" ? "Visitas domiciliares" : "Influenza"}</span>
                      <span className="text-[#003B8E]">{relatorio.praticas[codigo].percentual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-white/80">
                      <div className={`h-1.5 rounded-full ${
                        codigo === "A" ? "bg-[#00A9E8]" :
                        codigo === "B" ? "bg-[#009C3B]" :
                        codigo === "C" ? "bg-[#F2C300]" :
                        "bg-[#003B8E]"
                      }`} style={{ width: `${relatorio.praticas[codigo].percentual}%` }} />
                    </div>
                    <p className="mt-1 text-[7px] text-gray-400">{relatorio.praticas[codigo].atingidos} de {relatorio.totalElegiveis} pessoas</p>
                  </div>
                )
              )}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#E7E2F2]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold">Onde concentrar o acompanhamento</h2>
                <p className="text-[8px] text-gray-400">
                  Use os filtros para localizar rapidamente as pessoas idosas que precisam de atenção.
                </p>
              </div>
              <Filter size={16} className="text-[#10B981]" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="col-span-2 flex items-center gap-2 rounded-lg border border-[#DDEAF2] px-3 py-2">
                <Search size={14} className="text-gray-400" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar nome ou CPF"
                  className="w-full bg-transparent text-xs outline-none"
                />
              </div>

              <select value={microarea} onChange={(e) => setMicroarea(e.target.value)} className="rounded-lg border border-[#DDEAF2] bg-white px-2 py-2 text-[10px]">
                <option>Todas</option>
                {microareas.map((item) => <option key={item}>{item}</option>)}
              </select>

              <select value={classificacao} onChange={(e) => setClassificacao(e.target.value)} className="rounded-lg border border-[#DDEAF2] bg-white px-2 py-2 text-[10px]">
                <option>Todas</option>
                <option>Ótimo</option>
                <option>Bom</option>
                <option>Suficiente</option>
                <option>Regular</option>
              </select>

              <select value={pratica} onChange={(e) => setPratica(e.target.value)} className="rounded-lg border border-[#DDEAF2] bg-white px-2 py-2 text-[10px]">
                <option value="Todas">Todas as práticas</option>
                <option value="A">A — Consulta</option>
                <option value="B">B — Peso + altura</option>
                <option value="C">C — Visitas</option>
                <option value="D">D — Influenza</option>
              </select>
            </div>

            <div className="mt-4 space-y-2">
              {filtrados.map((p) => (
                <details key={`${p.nome}-${p.cpf}`} className="rounded-xl border border-[#DDEAF2] bg-white">
                  <summary className="flex cursor-pointer list-none items-center justify-between p-3">
                    <div>
                      <p className="text-[10px] font-bold">{p.nome}</p>
                      <p className="text-[7px] text-gray-400">
                        Microárea {p.microarea || "não informada"} • CPF {p.cpf || "não informado"} • {p.idade}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[#ECFDF5] px-2 py-1 text-[8px] font-bold text-[#059669]">
                        {p.pontuacao.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                      </span>
                      <span className="rounded-full bg-[#F7FAFC] px-2 py-1 text-[8px] font-semibold">
                        {p.classificacao}
                      </span>
                    </div>
                  </summary>

                  <div className="grid grid-cols-2 gap-2 border-t border-[#DDEAF2] p-3">
                    {p.praticas.map((item) => (
                      <div key={item.codigo} className="rounded-lg bg-[#F7FAFC] p-3">
                        <div className="flex justify-between gap-2">
                          <p className="text-[8px] font-bold">
                            {item.codigo} — {item.titulo}
                          </p>
                          <span className={item.atingida ? "text-[#059669]" : "text-[#EF4444]"}>
                            {item.atingida ? "Atingida" : "Pendente"}
                          </span>
                        </div>
                        <p className="mt-1 text-[7px] text-gray-500">{item.detalhe}</p>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
