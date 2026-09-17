"use client";

import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Info,
  UsersRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

type ResultadoC1 = {
  sucesso: boolean;
  possuiDados?: boolean;
  pontuacao?: number | null;
  percentualProgramado?: number | null;
  classificacao?:
    | "Ótimo"
    | "Bom"
    | "Suficiente"
    | "Regular"
    | "Indisponível";
  atendimentosProgramados?: number;
  atendimentosEspontaneos?: number;
  atendimentosNaoInformados?: number;
  totalAtendimentos?: number;
  competencias?: string[];
  competencia?: string;
  periodo?: string | null;
  equipe?: string | null;
  mensagem?: string;
};

function formatarCompetencia(valor?: string) {
  if (!valor || !/^\d{4}-\d{2}$/.test(valor)) return valor || "—";

  const [ano, mes] = valor.split("-");
  const nomes = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  return `${nomes[Number(mes) - 1] || mes} de ${ano}`;
}

function formatarNumero(valor: number | undefined) {
  return Number(valor ?? 0).toLocaleString("pt-BR");
}

export default function C1MaisAcessoPage() {
  const router = useRouter();
  const { usuario, carregando } = useAuth();

  const [resultado, setResultado] = useState<ResultadoC1 | null>(null);
  const [carregandoC1, setCarregandoC1] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (carregando || !usuario) return;

    if (usuario.perfil !== "enfermeira") {
      router.replace("/acs");
      return;
    }

    let cancelado = false;

    async function carregarC1() {
      try {
        setCarregandoC1(true);
        setErro("");

        const usuarioFirebase = auth.currentUser;

        if (!usuarioFirebase) {
          setErro("Sessão não autenticada.");
          return;
        }

        const token = await usuarioFirebase.getIdToken();

        const resposta = await fetch("/api/indicadores/c1", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const dados = await resposta.json();

        if (cancelado) return;

        if (!resposta.ok || !dados.sucesso) {
          throw new Error(
            dados.mensagem || "Não foi possível consultar o C1.",
          );
        }

        setResultado(dados);
      } catch (error) {
        if (!cancelado) {
          setErro(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar o C1.",
          );
        }
      } finally {
        if (!cancelado) {
          setCarregandoC1(false);
        }
      }
    }

    carregarC1();

    return () => {
      cancelado = true;
    };
  }, [carregando, usuario, router]);

  if (carregando || !usuario) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F7FF]">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#7C3AED]/20 border-t-[#7C3AED]" />
          <p className="mt-3 text-sm font-semibold text-[#4C1D95]">
            Carregando...
          </p>
        </div>
      </main>
    );
  }

  if (usuario.perfil !== "enfermeira") {
    return null;
  }

  const percentual =
    resultado?.percentualProgramado !== null &&
    resultado?.percentualProgramado !== undefined
      ? Number(resultado.percentualProgramado)
      : null;

  const programados = Number(resultado?.atendimentosProgramados ?? 0);
  const espontaneos = Number(resultado?.atendimentosEspontaneos ?? 0);
  const naoInformados = Number(resultado?.atendimentosNaoInformados ?? 0);
  const total = Number(
    resultado?.totalAtendimentos ?? programados + espontaneos,
  );

  return (
    <main className="min-h-screen bg-[#F8F7FF] text-[#211A4A]">
      <div className="mx-auto min-h-screen max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="group flex items-center gap-2 rounded-xl px-2 py-2 text-[11px] font-semibold text-gray-500 transition hover:bg-white hover:text-[#7C3AED]"
          >
            <ArrowLeft
              size={16}
              className="transition-transform group-hover:-translate-x-1"
            />
            Voltar
          </button>

          <div className="flex items-center gap-2 text-[10px] font-semibold text-[#7C3AED]">
            <CalendarDays size={14} />
            {formatarCompetencia(resultado?.competencia)}
          </div>
        </header>

        <section className="mt-5 rounded-3xl border border-[#E5E0EC] bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEE7FF]">
                  <CalendarDays size={22} className="text-[#7C3AED]" />
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#7C3AED]">
                    C1
                  </p>
                  <h1 className="text-xl font-bold text-[#211A4A]">
                    Mais acesso
                  </h1>
                </div>
              </div>

              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-gray-500">
                Acompanhamento da proporção de atendimentos de demanda
                programada em relação ao total de atendimentos de demanda
                programada e espontânea.
              </p>
            </div>

            <div className="rounded-2xl bg-[#F8F7FF] px-6 py-4 text-right">
              <p className="text-[10px] font-medium text-gray-400">
                Resultado do C1
              </p>

              <p className="mt-1 text-3xl font-extrabold text-[#7C3AED]">
                {carregandoC1
                  ? "..."
                  : percentual !== null
                    ? `${percentual.toLocaleString("pt-BR", {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}%`
                    : "Indisponível"}
              </p>

              <p className="mt-1 text-[10px] font-semibold text-gray-500">
                {resultado?.classificacao || "Sem dados"}
              </p>
            </div>
          </div>

          {erro && (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <Info size={18} className="mt-0.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {!erro && !carregandoC1 && resultado?.possuiDados === false && (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <Info size={18} className="mt-0.5 shrink-0" />
              <span>
                {resultado.mensagem ||
                  "Ainda não existe resultado consolidado do C1 para esta competência."}
              </span>
            </div>
          )}
        </section>

        {!erro && resultado?.possuiDados && (
          <>
            <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100">
                  <CheckCircle2 size={17} className="text-emerald-600" />
                </div>
                <p className="mt-4 text-2xl font-bold text-emerald-900">
                  {formatarNumero(programados)}
                </p>
                <p className="mt-1 text-[10px] font-medium text-emerald-700">
                  Atendimentos programados
                </p>
              </div>

              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100">
                  <Clock3 size={17} className="text-sky-600" />
                </div>
                <p className="mt-4 text-2xl font-bold text-sky-900">
                  {formatarNumero(espontaneos)}
                </p>
                <p className="mt-1 text-[10px] font-medium text-sky-700">
                  Atendimentos espontâneos
                </p>
              </div>

              <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100">
                  <UsersRound size={17} className="text-violet-600" />
                </div>
                <p className="mt-4 text-2xl font-bold text-violet-900">
                  {formatarNumero(total)}
                </p>
                <p className="mt-1 text-[10px] font-medium text-violet-700">
                  Total considerado no cálculo
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
                  <ClipboardList size={17} className="text-amber-600" />
                </div>
                <p className="mt-4 text-2xl font-bold text-amber-900">
                  {formatarNumero(naoInformados)}
                </p>
                <p className="mt-1 text-[10px] font-medium text-amber-700">
                  Não informados/ignorados
                </p>
              </div>
            </section>

            <section className="mt-4 rounded-2xl border border-[#E5E0EC] bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-sm font-bold text-[#211A4A]">
                Composição do indicador
              </h2>

              <div className="mt-5 space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between text-[10px]">
                    <span className="font-medium text-gray-500">
                      Demanda programada
                    </span>
                    <span className="font-bold text-[#7C3AED]">
                      {formatarNumero(programados)}
                    </span>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-[#EEE7FF]">
                    <div
                      className="h-full rounded-full bg-[#7C3AED] transition-all"
                      style={{
                        width: `${
                          total > 0
                            ? Math.min(100, (programados / total) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-[10px]">
                    <span className="font-medium text-gray-500">
                      Demanda espontânea
                    </span>
                    <span className="font-bold text-gray-600">
                      {formatarNumero(espontaneos)}
                    </span>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-gray-400 transition-all"
                      style={{
                        width: `${
                          total > 0
                            ? Math.min(100, (espontaneos / total) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-xl bg-[#F8F7FF] p-4 text-[10px] leading-relaxed text-gray-500">
                <strong className="text-[#211A4A]">Fórmula:</strong>{" "}
                atendimentos de demanda programada ÷ (atendimentos de demanda
                programada + atendimentos de demanda espontânea) × 100.
              </div>
            </section>

            <section className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-[#E5E0EC] bg-white p-5 shadow-sm">
                <h2 className="text-sm font-bold">Período e equipe</h2>

                <div className="mt-4 space-y-3 text-[10px]">
                  <div className="flex justify-between gap-4 border-b border-gray-100 pb-3">
                    <span className="text-gray-400">Competência</span>
                    <span className="font-semibold">
                      {formatarCompetencia(resultado.competencia)}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4 border-b border-gray-100 pb-3">
                    <span className="text-gray-400">Período</span>
                    <span className="text-right font-semibold">
                      {resultado.periodo || "Não informado"}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-gray-400">Equipe</span>
                    <span className="text-right font-semibold">
                      {resultado.equipe || "Não informada"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#E5E0EC] bg-white p-5 shadow-sm">
                <h2 className="text-sm font-bold">Critérios do C1</h2>

                <ul className="mt-4 space-y-3 text-[10px] leading-relaxed text-gray-500">
                  <li className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7C3AED]" />
                    O cálculo utiliza registros de Atendimento Individual.
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7C3AED]" />
                    O tipo de demanda precisa estar explicitamente informado.
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7C3AED]" />
                    O registro precisa possuir CBO profissional compatível.
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7C3AED]" />
                    Registros sem tipo de demanda ou CBO válido não entram no
                    cálculo.
                  </li>
                </ul>
              </div>
            </section>
          </>
        )}

      </div>
    </main>
  );
}
