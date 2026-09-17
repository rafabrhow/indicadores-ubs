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
      <main className="flex min-h-screen items-center justify-center bg-[#F8F7FF]">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#4C1D95]">
          <Loader2 className="animate-spin" size={20} />
          Calculando C5...
        </div>
      </main>
    );
  }

  if (erro) {
    return (
      <main className="min-h-screen bg-[#F8F7FF] p-6 text-[#211A4A]">
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-xs font-bold text-[#7C3AED]"
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
      <main className="min-h-screen bg-[#F8F7FF] text-[#211A4A]">
        <header className="bg-gradient-to-r from-[#7C3AED] to-[#5B21B6] px-5 py-4 text-white">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-xs font-bold">
            <ArrowLeft size={17} /> Voltar
          </button>
          <h1 className="mt-5 text-lg font-extrabold">C5 — Hipertensão</h1>
          <p className="mt-1 text-[10px] text-white/75">
            Relatório detalhado das boas práticas
          </p>
        </header>

        <div className="p-5">
          <section className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-[#E7E2F2]">
            <p className="text-sm font-bold text-[#211A4A]">Ainda não há dados para o C5</p>
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
    <main className="min-h-screen bg-[#F8F7FF] pb-8 text-[#211A4A]">
      <header className="bg-gradient-to-r from-[#7C3AED] to-[#5B21B6] px-5 pb-5 pt-4 text-white">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-xs font-bold text-white/90"
        >
          <ArrowLeft size={17} /> Voltar
        </button>

        <div className="mt-5">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-white/70">
            Indicadores APS Brasil 360
          </p>
          <h1 className="mt-1 text-lg font-extrabold">
            C5 — Cuidado da pessoa com hipertensão
          </h1>
          <p className="mt-1 text-[10px] text-white/75">
            Relatório detalhado da última importação válida do PEC
          </p>
        </div>
      </header>

      <div className="space-y-4 p-5">
        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#E7E2F2]">
            <p className="text-[9px] font-semibold text-gray-400">Resultado C5</p>
            <p className={`mt-1 text-3xl font-extrabold ${classePontuacao(resumo.pontuacao)}`}>
              {resumo.pontuacao}
            </p>
            <p className="text-[9px] font-bold text-gray-500">/ 100 • {resumo.classificacao}</p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#E7E2F2]">
            <p className="text-[9px] font-semibold text-gray-400">Elegíveis</p>
            <p className="mt-1 text-3xl font-extrabold text-[#7C3AED]">
              {resumo.totalElegiveis}
            </p>
            <p className="text-[9px] text-gray-500">pacientes no denominador</p>
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
                <div key={codigo} className="rounded-xl bg-[#FAF9FD] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-bold">
                      {codigo}. {titulos[codigo]}
                    </p>
                    <p className="text-xs font-extrabold text-[#7C3AED]">
                      {dados.percentual}%
                    </p>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EDE9FE]">
                    <div
                      className="h-full rounded-full bg-[#7C3AED]"
                      style={{ width: `${Math.min(dados.percentual, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[8px] text-gray-400">
                    {dados.atingidos} de {resumo.totalElegiveis} pacientes
                  </p>
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
                    ? "border-[#7C3AED] bg-[#F5F3FF]"
                    : "border-[#E7E2F2] bg-[#FAF9FD]"
                }`}
              >
                <p className="text-[9px] font-bold text-[#211A4A]">{item.titulo}</p>
                <p className="mt-1 text-lg font-extrabold text-[#7C3AED]">{item.total}</p>
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
            <span className="rounded-full bg-[#EEE7FF] px-3 py-1 text-[8px] font-bold text-[#7C3AED]">
              {pacientesFiltrados.length}
            </span>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar paciente..."
              className="h-10 rounded-xl border border-[#E7E2F2] bg-[#FAF9FD] px-3 text-[10px] outline-none focus:border-[#A78BFA]"
            />

            <select
              value={microarea}
              onChange={(e) => setMicroarea(e.target.value)}
              className="h-10 rounded-xl border border-[#E7E2F2] bg-[#FAF9FD] px-3 text-[10px] outline-none"
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
              className="h-10 rounded-xl border border-[#E7E2F2] bg-[#FAF9FD] px-3 text-[10px] font-semibold outline-none"
            >
              <option value="Todos">Prática: todas</option>
              <option value="A">Pendentes: consulta</option>
              <option value="B">Pendentes: pressão</option>
              <option value="C">Pendentes: peso + altura</option>
              <option value="D">Pendentes: visitas</option>
            </select>
          </div>

          {filtroPratica !== "Todos" && (
            <div className="mt-2 flex items-center justify-between rounded-xl bg-[#F5F3FF] px-3 py-2">
              <p className="text-[8px] font-semibold text-[#6D5A91]">
                Mostrando pacientes pendentes na prática {filtroPratica}.
              </p>
              <button
                onClick={() => setFiltroPratica("Todos")}
                className="text-[8px] font-extrabold text-[#7C3AED]"
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
                  className="overflow-hidden rounded-xl border border-[#E7E2F2] bg-[#FAF9FD]"
                >
                  <button
                    onClick={() => setAberto(estaAberto ? null : paciente.id)}
                    className="flex w-full items-center gap-3 p-3 text-left"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEE7FF] text-[9px] font-extrabold text-[#7C3AED]">
                      {paciente.nome.slice(0, 2).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] font-bold">{paciente.nome}</p>
                      <p className="mt-1 text-[8px] text-gray-400">
                        MA {paciente.microarea || "—"} • {paciente.pontuacao}/100
                      </p>
                    </div>

                    <span className="text-[9px] font-extrabold text-[#7C3AED]">
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
                    <div className="border-t border-[#E7E2F2] bg-white p-3">
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

        <section className="rounded-2xl border border-[#DDD6FE] bg-[#F5F3FF] p-4">
          <p className="text-[9px] font-bold text-[#4C1D95]">Importante</p>
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
