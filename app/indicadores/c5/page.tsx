"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ChevronDown, Loader2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { onIdTokenChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

type Pratica = {
  codigo: "A" | "B" | "C" | "D";
  titulo: string;
  pontos: number;
  atingida: boolean;
  detalhe: string;
};

type Paciente = {
  id: string;
  nome: string;
  cpf: string;
  microarea: string;
  elegivel: boolean;
  motivoElegibilidade: string;
  pontuacao: number;
  classificacao: string;
  praticas: Pratica[];
};

type Relatorio = {
  possuiDados: boolean;
  mensagem?: string;
  importacao?: {
    arquivoNome: string;
    listaTematica: string;
    grupoCondicoes: string;
    filtroProblemas: string;
    geradoEm: string;
    quantidadeRegistros: number;
  };
  referencia?: string;
  resumo?: {
    totalRegistros: number;
    totalElegiveis: number;
    pontuacao: number;
    classificacao: string;
    praticas: Record<
      "A" | "B" | "C" | "D",
      { atingidos: number; percentual: number }
    >;
  };
  pacientes?: Paciente[];
};

function classePontuacao(valor: number) {
  if (valor > 75) return "text-[#059669]";
  if (valor > 50) return "text-[#2563EB]";
  if (valor > 25) return "text-[#D97706]";
  return "text-[#DC2626]";
}

export default function RelatorioC5Page() {
  const router = useRouter();
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [microarea, setMicroarea] = useState("Todas");
  const [filtroPratica, setFiltroPratica] = useState("Todos");
  const [aberto, setAberto] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (usuario) => {
      if (!usuario) {
        router.replace("/login");
        return;
      }

      try {
        const token = await usuario.getIdToken();
        const resposta = await fetch("/api/indicadores/c5", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const dados = await resposta.json();

        if (!resposta.ok || !dados.sucesso) {
          throw new Error(dados.mensagem || "Não foi possível carregar o C5.");
        }

        setRelatorio(dados);
      } catch (error) {
        setErro(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o relatório."
        );
      } finally {
        setCarregando(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const microareas = useMemo(() => {
    const valores = new Set(
      (relatorio?.pacientes ?? [])
        .map((p) => p.microarea)
        .filter(Boolean)
    );

    return ["Todas", ...Array.from(valores).sort()];
  }, [relatorio]);

  const pacientesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return (relatorio?.pacientes ?? []).filter((paciente) => {
      const correspondeBusca =
        !termo ||
        paciente.nome.toLowerCase().includes(termo) ||
        paciente.cpf.toLowerCase().includes(termo);

      const correspondeMicroarea =
        microarea === "Todas" || paciente.microarea === microarea;

      const correspondePratica =
        filtroPratica === "Todos" ||
        paciente.praticas.some(
          (pratica) =>
            pratica.codigo === filtroPratica && !pratica.atingida
        );

      return correspondeBusca && correspondeMicroarea && correspondePratica;
    });
  }, [relatorio, busca, microarea, filtroPratica]);

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F6F9FC]">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#003B8E]">
          <Loader2 className="animate-spin" size={20} />
          Calculando C5...
        </div>
      </main>
    );
  }

  if (erro) {
    return (
      <main className="min-h-screen bg-[#F6F9FC] p-6 text-[#003B8E]">
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-xs font-bold text-[#003B8E]"
        >
          <ArrowLeft size={16} /> Voltar
        </button>
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-[#E7E2F2]">
          <p className="font-bold text-red-600">Não foi possível carregar o C5.</p>
          <p className="mt-2 text-sm text-gray-500">{erro}</p>
        </section>
      </main>
    );
  }

  if (!relatorio?.possuiDados) {
    return (
      <main className="min-h-screen bg-[#F6F9FC] text-[#003B8E]">
        <header className="relative isolate overflow-hidden rounded-b-[28px] border border-emerald-200/60 bg-gradient-to-br from-[#009C3B]/95 via-[#00A9E8]/85 to-[#F2C300]/85 px-5 py-5 text-white shadow-[0_10px_24px_rgba(0,156,59,0.16),0_4px_10px_rgba(0,59,142,0.10)] backdrop-blur-md">
          <div className="pointer-events-none absolute -left-10 -top-14 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
          <div className="pointer-events-none absolute right-20 -top-12 h-32 w-32 rounded-full bg-[#F2C300]/20 blur-3xl" />
          <div className="relative pr-20">
            <button onClick={() => router.back()} className="flex items-center gap-2 text-xs font-bold text-white/95">
              <ArrowLeft size={17} /> Voltar
            </button>
            <div className="mt-4">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-white/85">Indicadores APS Brasil 360</p>
              <h1 className="mt-1 text-lg font-extrabold">C5 — Cuidado da pessoa com hipertensão</h1>
              <p className="mt-1 text-[10px] text-white/90">Relatório detalhado da última importação válida do PEC</p>
            </div>
          </div>
          <img src="/brasil360-logo-header.png" alt="Brasil 360" width={88} height={88} className="absolute right-5 top-1/2 h-16 w-16 -translate-y-1/2 rounded-2xl object-cover shadow-[0_8px_18px_rgba(0,59,142,0.22)] ring-1 ring-white/50 sm:h-20 sm:w-20" />
        </header>

        <div className="p-5">
          <section className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-[#E7E2F2]">
            <p className="text-sm font-bold text-[#003B8E]">Ainda não há dados para o C5</p>
            <p className="mt-2 text-xs leading-relaxed text-gray-500">
              {relatorio?.mensagem}
            </p>
          </section>
        </div>
      </main>
    );
  }

  const resumo = relatorio.resumo!;

  return (
    <main className="min-h-screen bg-[#F6F9FC] pb-8 text-[#003B8E]">
      <header className="relative isolate overflow-hidden rounded-b-[28px] border border-emerald-200/60 bg-gradient-to-br from-[#009C3B]/95 via-[#00A9E8]/85 to-[#F2C300]/85 px-5 py-5 text-white shadow-[0_10px_24px_rgba(0,156,59,0.16),0_4px_10px_rgba(0,59,142,0.10)] backdrop-blur-md">
          <div className="pointer-events-none absolute -left-10 -top-14 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
          <div className="pointer-events-none absolute right-20 -top-12 h-32 w-32 rounded-full bg-[#F2C300]/20 blur-3xl" />
          <div className="relative pr-20">
            <button onClick={() => router.back()} className="flex items-center gap-2 text-xs font-bold text-white/95">
              <ArrowLeft size={17} /> Voltar
            </button>
            <div className="mt-4">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-white/85">Indicadores APS Brasil 360</p>
              <h1 className="mt-1 text-lg font-extrabold">C5 — Cuidado da pessoa com hipertensão</h1>
              <p className="mt-1 text-[10px] text-white/90">Relatório detalhado da última importação válida do PEC</p>
            </div>
          </div>
          <img src="/brasil360-logo-header.png" alt="Brasil 360" width={88} height={88} className="absolute right-5 top-1/2 h-16 w-16 -translate-y-1/2 rounded-2xl object-cover shadow-[0_8px_18px_rgba(0,59,142,0.22)] ring-1 ring-white/50 sm:h-20 sm:w-20" />
        </header>

      <div className="space-y-4 p-5 pt-6">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#9EDFF2] bg-gradient-to-br from-[#EAF7FC] via-white to-[#D7F1FA] p-5 shadow-[0_6px_14px_rgba(0,169,232,0.12),0_2px_5px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(0,169,232,0.18)]">
            <p className="text-[9px] font-medium text-[#39708A]">Resultado C5</p>
            <p className={`mt-1 text-3xl font-extrabold ${classePontuacao(resumo.pontuacao)}`}>
              {resumo.pontuacao}
            </p>
            <p className="text-[9px] font-bold text-[#003B8E]">/ 100 • {resumo.classificacao}</p>
          </div>
          <div className="rounded-2xl border border-[#A7E6C0] bg-gradient-to-br from-[#ECFDF3] via-white to-[#DDF7E7] p-5 shadow-[0_6px_14px_rgba(0,156,59,0.12),0_2px_5px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(0,156,59,0.18)]">
            <p className="text-[9px] font-medium text-[#39705A]">Elegíveis</p>
            <p className="mt-1 text-3xl font-extrabold text-[#003B8E]">{resumo.totalElegiveis}</p>
            <p className="text-[9px] font-medium text-[#39705A]">pacientes no denominador</p>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#E7E2F2]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-extrabold">Boas práticas</h2>
              <p className="mt-1 text-[9px] text-gray-500">
                Percentual de pacientes elegíveis que atingiram cada prática.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(["A", "B", "C", "D"] as const).map((codigo) => {
              const dados = resumo.praticas[codigo];
              const titulos = {
                A: "Consulta médica/enfermagem",
                B: "Pressão arterial",
                C: "Peso + altura",
                D: "Visitas domiciliares",
              };

              return (
                <div key={codigo} className={`rounded-xl border p-3 shadow-[0_4px_10px_rgba(0,59,142,0.07)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_16px_rgba(0,59,142,0.11)] ${
                  codigo === "A" ? "border-[#9EDFF2] bg-gradient-to-br from-[#EAF7FC] to-[#D7F1FA]" :
                  codigo === "B" ? "border-[#A7E6C0] bg-gradient-to-br from-[#ECFDF3] to-[#DDF7E7]" :
                  codigo === "C" ? "border-[#F5D66A] bg-gradient-to-br from-[#FFF9E5] to-[#FFF1B8]" :
                  "border-[#B7C8F5] bg-gradient-to-br from-[#EEF2FF] to-[#DDE7FF]"
                }`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-bold">{codigo}. {titulos[codigo]}</p>
                    <p className="text-xs font-extrabold text-[#003B8E]">{dados.percentual}%</p>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/80">
                    <div className={`h-full rounded-full ${
                      codigo === "A" ? "bg-[#00A9E8]" :
                      codigo === "B" ? "bg-[#009C3B]" :
                      codigo === "C" ? "bg-[#F2C300]" :
                      "bg-[#003B8E]"
                    }`} style={{ width: `${Math.min(dados.percentual, 100)}%` }} />
                  </div>
                  <p className="mt-1 text-[8px] text-gray-400">{dados.atingidos} de {resumo.totalElegiveis} pacientes</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#E7E2F2]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-extrabold">Onde concentrar o acompanhamento</h2>
              <p className="mt-1 text-[9px] text-gray-500">
                Toque em uma prática para mostrar somente quem ainda não a atingiu.
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              { codigo: "Todos", titulo: "Todos", total: resumo.totalElegiveis },
              { codigo: "A", titulo: "A • Consulta", total: resumo.totalElegiveis - Math.round(resumo.praticas.A.atingidos) },
              { codigo: "B", titulo: "B • Pressão", total: resumo.totalElegiveis - Math.round(resumo.praticas.B.atingidos) },
              { codigo: "C", titulo: "C • Peso + altura", total: resumo.totalElegiveis - Math.round(resumo.praticas.C.atingidos) },
              { codigo: "D", titulo: "D • Visitas", total: resumo.totalElegiveis - Math.round(resumo.praticas.D.atingidos) },
            ].map((item) => (
              <button
                key={item.codigo}
                onClick={() => setFiltroPratica(item.codigo)}
                className={`rounded-xl border p-3 text-left transition ${
                  filtroPratica === item.codigo
                    ? "border-[#7C3AED] bg-[#EAF7FC]"
                    : "border-[#DDEAF2] bg-[#F7FAFC]"
                }`}
              >
                <p className="text-[9px] font-bold text-[#003B8E]">{item.titulo}</p>
                <p className="mt-1 text-lg font-extrabold text-[#003B8E]">{item.total}</p>
                <p className="text-[8px] text-gray-400">
                  {item.codigo === "Todos" ? "elegíveis" : "pendentes"}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#E7E2F2]">
          <h2 className="text-xs font-extrabold">Fonte da avaliação</h2>
          <div className="mt-3 space-y-2 text-[9px] text-gray-500">
            <p><strong>Arquivo:</strong> {relatorio.importacao?.arquivoNome}</p>
            <p><strong>Lista temática:</strong> {relatorio.importacao?.listaTematica}</p>
            <p><strong>Grupo:</strong> {relatorio.importacao?.grupoCondicoes}</p>
            <p><strong>Filtro:</strong> {relatorio.importacao?.filtroProblemas}</p>
            <p><strong>Registros:</strong> {relatorio.importacao?.quantidadeRegistros}</p>
            <p><strong>Referência:</strong> {relatorio.importacao?.geradoEm || "—"}</p>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#E7E2F2]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-extrabold">Pacientes avaliados</h2>
              <p className="mt-1 text-[9px] text-gray-500">
                Confira individualmente as quatro práticas.
              </p>
            </div>
            <span className="rounded-full bg-[#EAF7FC] px-3 py-1 text-[8px] font-bold text-[#003B8E]">
              {pacientesFiltrados.length}
            </span>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar paciente..."
              className="h-10 rounded-xl border border-[#DDEAF2] bg-[#F7FAFC] px-3 text-[10px] outline-none focus:border-[#A78BFA]"
            />

            <select
              value={microarea}
              onChange={(e) => setMicroarea(e.target.value)}
              className="h-10 rounded-xl border border-[#DDEAF2] bg-[#F7FAFC] px-3 text-[10px] outline-none"
            >
              {microareas.map((item) => (
                <option key={item} value={item}>
                  Microárea: {item}
                </option>
              ))}
            </select>

            <select
              value={filtroPratica}
              onChange={(e) => setFiltroPratica(e.target.value)}
              className="h-10 rounded-xl border border-[#DDEAF2] bg-[#F7FAFC] px-3 text-[10px] font-semibold outline-none"
            >
              <option value="Todos">Prática: todas</option>
              <option value="A">Pendentes: consulta</option>
              <option value="B">Pendentes: pressão</option>
              <option value="C">Pendentes: peso + altura</option>
              <option value="D">Pendentes: visitas</option>
            </select>
          </div>

          {filtroPratica !== "Todos" && (
            <div className="mt-2 flex items-center justify-between rounded-xl bg-[#EAF7FC] px-3 py-2">
              <p className="text-[8px] font-semibold text-[#6D5A91]">
                Mostrando pacientes pendentes na prática {filtroPratica}.
              </p>
              <button
                onClick={() => setFiltroPratica("Todos")}
                className="text-[8px] font-extrabold text-[#003B8E]"
              >
                Limpar filtro
              </button>
            </div>
          )}

          <div className="mt-3 space-y-2">
            {pacientesFiltrados.map((paciente) => {
              const estaAberto = aberto === paciente.id;

              return (
                <div
                  key={paciente.id}
                  className="overflow-hidden rounded-xl border border-[#DDEAF2] bg-[#F7FAFC]"
                >
                  <button
                    onClick={() => setAberto(estaAberto ? null : paciente.id)}
                    className="flex w-full items-center gap-3 p-3 text-left"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EAF7FC] text-[9px] font-extrabold text-[#003B8E]">
                      {paciente.nome.slice(0, 2).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] font-bold">{paciente.nome}</p>
                      <p className="mt-1 text-[8px] text-gray-400">
                        MA {paciente.microarea || "—"} • {paciente.pontuacao}/100
                      </p>
                    </div>

                    <span className="text-[9px] font-extrabold text-[#003B8E]">
                      {paciente.classificacao}
                    </span>

                    <ChevronDown
                      size={15}
                      className={`shrink-0 text-gray-400 transition-transform ${
                        estaAberto ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {estaAberto && (
                    <div className="border-t border-[#DDEAF2] bg-white p-3">
                      <div className="space-y-2">
                        {paciente.praticas.map((pratica) => (
                          <div
                            key={pratica.codigo}
                            className={`rounded-xl border p-3 ${
                              pratica.atingida
                                ? "border-[#A7F3D0] bg-[#F0FDF4]"
                                : "border-[#FECACA] bg-[#FFF7F7]"
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              {pratica.atingida ? (
                                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[#10B981]" />
                              ) : (
                                <XCircle size={15} className="mt-0.5 shrink-0 text-[#EF4444]" />
                              )}

                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-[9px] font-bold">
                                    {pratica.codigo}. {pratica.titulo}
                                  </p>
                                  <span className="shrink-0 text-[8px] font-extrabold">
                                    {pratica.pontos} pts
                                  </span>
                                </div>
                                <p className="mt-1 text-[8px] leading-relaxed text-gray-500">
                                  {pratica.detalhe}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <p className="mt-3 text-[8px] leading-relaxed text-gray-400">
                        Os dados acima refletem os campos disponíveis no relatório
                        temático de Hipertensão importado do PEC.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-[#9EDFF2] bg-[#EAF7FC] p-4">
          <p className="text-[9px] font-bold text-[#003B8E]">Importante</p>
          <p className="mt-1 text-[8px] leading-relaxed text-[#6D5A91]">
            Este relatório usa a última importação do PEC identificada como
            Hipertensão com problemas ativos. A ausência de um registro no PEC
            não deve ser interpretada automaticamente como ausência do cuidado
            na vida real.
          </p>
        </section>
      </div>
    </main>
  );
}
