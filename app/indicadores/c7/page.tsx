"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, Filter, Search, Venus } from "lucide-react";
import { auth } from "@/lib/firebase";

type Pratica = {
  codigo: "A" | "B" | "C" | "D";
  titulo: string;
  peso: number;
  elegiveis: number;
  atingidos: number;
  percentual: number | null;
  pontos: number | null;
  disponivel: boolean;
  descricao: string;
};

type Paciente = {
  id: string;
  nome: string;
  cpf?: string;
  cns?: string;
  dataNascimento?: string;
  idade?: number;
  sexo?: string;
  identidadeGenero?: string;
  microarea?: string;
  praticas: { A: boolean; B: boolean; C: boolean; D: boolean };
  detalhes: { A?: string; B?: string; C?: string; D?: string };
  pontuacaoDisponivel: number;
};

type Resultado = {
  sucesso: boolean;
  possuiDados?: boolean;
  completo?: boolean;
  motivoIncompleto?: string;
  totalElegiveis?: number;
  pontuacao?: number | null;
  pontuacaoParcial?: number;
  pontosDisponiveis?: number;
  classificacao?: string;
  praticas?: Record<"A" | "B" | "C" | "D", Pratica>;
  pacientes?: Paciente[];
  mensagem?: string;
};

function formatarPercentual(valor: number | null | undefined) {
  return valor == null
    ? "N/A"
    : `${valor.toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}%`;
}

export default function C7Page() {
  const router = useRouter();
  const [dados, setDados] = useState<Resultado | null>(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [microarea, setMicroarea] = useState("Todas");
  const [pratica, setPratica] = useState("Todas");
  const [aberto, setAberto] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

 useEffect(() => {
  let cancelado = false;
  let iniciou = false;

  const pararObservador = auth.onIdTokenChanged(async (usuario) => {
    if (cancelado || iniciou) return;

    // Aguarda o Firebase restaurar a sessão antes de verificar
    // se o usuário realmente está sem autenticação.
    if (!usuario) return;

    iniciou = true;

    try {
      setCarregando(true);

      const token = await usuario.getIdToken();

      const resposta = await fetch("/api/indicadores/c7", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await resposta.json();

      if (cancelado) return;

      if (resposta.status === 401) {
        router.replace("/login");
        return;
      }

      if (!resposta.ok || !json.sucesso) {
        setErro(json.mensagem || "Erro ao carregar o C7.");
        return;
      }

      setDados(json);
    } catch (e) {
      console.error("Erro ao carregar C7:", e);

      if (!cancelado) {
        setErro("Não foi possível carregar o C7.");
      }
    } finally {
      if (!cancelado) {
        setCarregando(false);
      }
    }
  });

  return () => {
    cancelado = true;
    pararObservador();
  };
}, [router]);

  const pacientes = useMemo(() => {
    const lista = dados?.pacientes ?? [];
    const termo = busca.trim().toLowerCase();

    return lista.filter((p) => {
      const bateBusca =
        !termo ||
        p.nome.toLowerCase().includes(termo) ||
        (p.cpf || "").includes(termo) ||
        (p.cns || "").includes(termo);

      const bateMicroarea =
        microarea === "Todas" || (p.microarea || "Sem microárea") === microarea;

      const batePratica =
        pratica === "Todas" ||
        p.praticas[pratica as keyof typeof p.praticas] === false;

      return bateBusca && bateMicroarea && batePratica;
    });
  }, [dados, busca, microarea, pratica]);

  const microareas = useMemo(() => {
    return Array.from(
      new Set(
        (dados?.pacientes ?? []).map((p) => p.microarea || "Sem microárea")
      )
    ).sort();
  }, [dados]);

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F7FF]">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-[#10B981]/20 border-t-[#10B981]" />
      </main>
    );
  }

  if (erro) {
    return (
      <main className="min-h-screen bg-[#F8F7FF] p-6 text-[#211A4A]">
        <button
          onClick={() => router.back()}
          className="mb-5 flex items-center gap-1 text-xs font-semibold text-[#7C3AED]"
        >
          <ChevronLeft size={15} /> Voltar
        </button>
        <section className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="font-bold">Não foi possível carregar o C7</p>
          <p className="mt-2 text-xs text-gray-500">{erro}</p>
        </section>
      </main>
    );
  }

  if (!dados?.possuiDados) {
    return (
      <main className="min-h-screen bg-[#F8F7FF] text-[#211A4A]">
        <header className="bg-[#8B5CF6] px-6 py-4 text-white">
          <button onClick={() => router.back()} className="flex items-center gap-1 text-xs">
            <ChevronLeft size={14} /> Voltar
          </button>
          <p className="mt-3 text-[8px] font-bold uppercase">Indicadores APS Brasil 360</p>
          <h1 className="text-lg font-extrabold">C7 — Saúde da Mulher</h1>
        </header>
        <section className="p-6">
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <Venus className="mx-auto text-[#8B5CF6]" />
            <p className="mt-3 text-sm font-bold">Ainda não há dados para o C7</p>
            <p className="mt-1 text-xs text-gray-500">
              Importe o relatório temático Saúde da mulher do e-SUS PEC.
            </p>
          </div>
        </section>
      </main>
    );
  }

  const praticas = dados.praticas;
  const incompleto = dados.completo === false;

  return (
    <main className="min-h-screen bg-[#F8F7FF] text-[#211A4A]">
      <header className="bg-[#8B5CF6] px-6 py-4 text-white">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-xs">
          <ChevronLeft size={14} /> Voltar
        </button>
        <p className="mt-3 text-[8px] font-bold uppercase">Indicadores APS Brasil 360</p>
        <h1 className="text-lg font-extrabold">C7 — Cuidado da Mulher</h1>
        <p className="text-[9px] text-white/80">
          Prevenção do câncer, HPV e saúde sexual e reprodutiva
        </p>
      </header>

      <section className="p-4 md:p-6">
        {incompleto && (
          <div className="mb-3 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-xs text-[#92400E]">
            <strong>Cálculo preliminar:</strong> este relatório foi exportado de
            14 a 69 anos. A prática B (HPV, 9 a 14 anos) ficou sem denominador.
            Para o indicador completo, importe um C7 de 9 a 69 anos.
          </div>
        )}

        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-[8px] text-gray-400">Resultado C7</p>
            <p className="mt-1 text-3xl font-extrabold text-[#8B5CF6]">
              {dados.pontuacao == null
                ? `${formatarPercentual(dados.pontuacaoParcial)}*`
                : formatarPercentual(dados.pontuacao)}
            </p>
            <p className="text-[9px] font-semibold text-gray-500">
              {dados.classificacao}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-[8px] text-gray-400">Elegíveis</p>
            <p className="mt-1 text-3xl font-extrabold text-[#8B5CF6]">
              {dados.totalElegiveis}
            </p>
            <p className="text-[9px] text-gray-500">pessoas 9–69 anos</p>
          </div>
        </section>

        <section className="mt-3 rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Filter size={14} className="text-[#8B5CF6]" />
            <h2 className="text-[11px] font-bold">Boas práticas</h2>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(["A", "B", "C", "D"] as const).map((codigo) => {
              const p = praticas?.[codigo];
              if (!p) return null;

              return (
                <div key={codigo} className="rounded-xl bg-[#F8F7FF] p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-bold">
                      {codigo} — {p.titulo}
                    </p>
                    <span className="text-[9px] font-bold text-[#8B5CF6]">
                      {formatarPercentual(p.percentual)}
                    </span>
                  </div>
                  <p className="mt-1 text-[7px] text-gray-500">{p.descricao}</p>
                  <div className="mt-2 h-1.5 rounded-full bg-gray-200">
                    <div
                      className="h-1.5 rounded-full bg-[#8B5CF6]"
                      style={{ width: `${Math.min(p.percentual ?? 0, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[7px] text-gray-400">
                    {p.atingidos}/{p.elegiveis} • {p.disponivel ? `${p.pontos?.toFixed(1)} pts` : "sem denominador"}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-3 rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Search size={14} className="text-[#8B5CF6]" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar nome ou CPF"
              className="w-full rounded-lg border border-[#E5E0EC] px-3 py-2 text-xs outline-none focus:border-[#8B5CF6]"
            />
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <select
              value={microarea}
              onChange={(e) => setMicroarea(e.target.value)}
              className="rounded-lg border border-[#E5E0EC] px-3 py-2 text-[10px]"
            >
              <option>Todas</option>
              {microareas.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>

            <select
              value={pratica}
              onChange={(e) => setPratica(e.target.value)}
              className="rounded-lg border border-[#E5E0EC] px-3 py-2 text-[10px]"
            >
              <option>Todas</option>
              <option value="A">A — Colo do útero</option>
              <option value="B">B — HPV</option>
              <option value="C">C — Saúde sexual</option>
              <option value="D">D — Mama</option>
            </select>
          </div>
        </section>

        <section className="mt-3 space-y-2">
          {pacientes.map((paciente) => {
            const expandido = aberto === paciente.id;

            return (
              <div key={paciente.id} className="overflow-hidden rounded-xl bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setAberto(expandido ? null : paciente.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <div>
                    <p className="text-[9px] font-bold">{paciente.nome}</p>
                    <p className="mt-0.5 text-[7px] text-gray-400">
                      {paciente.idade} anos • Microárea {paciente.microarea || "—"}
                    </p>
                  </div>
                  <ChevronDown
                    size={14}
                    className={`text-[#8B5CF6] transition ${expandido ? "rotate-180" : ""}`}
                  />
                </button>

                {expandido && (
                  <div className="border-t border-gray-100 px-4 py-3">
                    <div className="grid grid-cols-2 gap-2">
                      {(["A", "B", "C", "D"] as const).map((codigo) => (
                        <div key={codigo} className="rounded-lg bg-[#F8F7FF] p-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-bold">{codigo}</span>
                            <span className={`text-[8px] font-bold ${paciente.praticas[codigo] ? "text-emerald-600" : "text-red-500"}`}>
                              {paciente.praticas[codigo] ? "Atingida" : "Pendente"}
                            </span>
                          </div>
                          <p className="mt-1 text-[7px] text-gray-500">
                            {paciente.detalhes[codigo]}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {pacientes.length === 0 && (
          <div className="mt-4 rounded-xl bg-white p-6 text-center text-xs text-gray-400">
            Nenhuma pessoa encontrada com os filtros atuais.
          </div>
        )}

        {incompleto && (
          <p className="mt-4 text-[8px] leading-relaxed text-gray-400">
            * Pontuação parcial disponível: {dados.pontuacaoParcial?.toFixed(1)} de{" "}
            {dados.pontosDisponiveis} pontos. Não é uma classificação oficial
            enquanto a prática B não possuir denominador.
          </p>
        )}
      </section>
    </main>
  );
}
