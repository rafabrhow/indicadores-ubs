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
      <main className="flex min-h-screen items-center justify-center bg-[#F8F7FF]">
        <div className="text-sm font-semibold text-[#4C1D95]">Carregando C6...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F7FF] text-[#211A4A]">
      <header className="bg-gradient-to-r from-[#10B981] to-[#047857] px-5 py-4 text-white">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-xs font-bold">
          <ArrowLeft size={17} /> Voltar
        </button>
        <p className="mt-4 text-[8px] font-bold uppercase tracking-wide opacity-80">
          Indicadores APS Brasil 360
        </p>
        <h1 className="mt-1 text-lg font-extrabold">C6 — Cuidado da Pessoa Idosa</h1>
        <p className="mt-1 text-[8px] text-white/80">
          Relatório operacional baseado na última importação válida do PEC.
        </p>
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
        <div className="space-y-3 p-5">
          <section className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#E7E2F2]">
              <p className="text-[9px] text-gray-400">Resultado C6</p>
              <p className="mt-1 text-3xl font-extrabold text-[#10B981]">
                {relatorio.pontuacao.toLocaleString("pt-BR", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}%
              </p>
              <p className="text-[9px] font-bold">{relatorio.classificacao}</p>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#E7E2F2]">
              <p className="text-[9px] text-gray-400">Elegíveis</p>
              <p className="mt-1 text-3xl font-extrabold text-[#7C3AED]">
                {relatorio.totalElegiveis}
              </p>
              <p className="text-[9px]">pessoas idosas</p>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#E7E2F2]">
            <h2 className="text-sm font-bold">Boas práticas</h2>
            <p className="mt-1 text-[8px] text-gray-400">
              Cada prática vale 25 pontos.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {(["A", "B", "C", "D"] as const).map((codigo) => (
                <div key={codigo} className="rounded-xl bg-[#F8F7FF] p-3">
                  <div className="flex justify-between text-[9px] font-bold">
                    <span>{codigo} — {codigo === "A" ? "Consulta" : codigo === "B" ? "Peso + altura" : codigo === "C" ? "Visitas domiciliares" : "Influenza"}</span>
                    <span className="text-[#10B981]">
                      {relatorio.praticas[codigo].percentual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-[#D1FAE5]">
                    <div
                      className="h-1.5 rounded-full bg-[#10B981]"
                      style={{ width: `${relatorio.praticas[codigo].percentual}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[7px] text-gray-400">
                    {relatorio.praticas[codigo].atingidos} de {relatorio.totalElegiveis} pessoas
                  </p>
                </div>
              ))}
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
              <div className="col-span-2 flex items-center gap-2 rounded-lg border border-[#E7E2F2] px-3 py-2">
                <Search size={14} className="text-gray-400" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar nome ou CPF"
                  className="w-full bg-transparent text-xs outline-none"
                />
              </div>

              <select value={microarea} onChange={(e) => setMicroarea(e.target.value)} className="rounded-lg border border-[#E7E2F2] bg-white px-2 py-2 text-[10px]">
                <option>Todas</option>
                {microareas.map((item) => <option key={item}>{item}</option>)}
              </select>

              <select value={classificacao} onChange={(e) => setClassificacao(e.target.value)} className="rounded-lg border border-[#E7E2F2] bg-white px-2 py-2 text-[10px]">
                <option>Todas</option>
                <option>Ótimo</option>
                <option>Bom</option>
                <option>Suficiente</option>
                <option>Regular</option>
              </select>

              <select value={pratica} onChange={(e) => setPratica(e.target.value)} className="rounded-lg border border-[#E7E2F2] bg-white px-2 py-2 text-[10px]">
                <option value="Todas">Todas as práticas</option>
                <option value="A">A — Consulta</option>
                <option value="B">B — Peso + altura</option>
                <option value="C">C — Visitas</option>
                <option value="D">D — Influenza</option>
              </select>
            </div>

            <div className="mt-4 space-y-2">
              {filtrados.map((p) => (
                <details key={`${p.nome}-${p.cpf}`} className="rounded-xl border border-[#E7E2F2] bg-white">
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
                      <span className="rounded-full bg-[#F8F7FF] px-2 py-1 text-[8px] font-semibold">
                        {p.classificacao}
                      </span>
                    </div>
                  </summary>

                  <div className="grid grid-cols-2 gap-2 border-t border-[#E7E2F2] p-3">
                    {p.praticas.map((item) => (
                      <div key={item.codigo} className="rounded-lg bg-[#F8F7FF] p-3">
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
