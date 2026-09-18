"use client";

import {
  Activity,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  HeartPulse,
  Home,
  Loader2,
  MapPin,
  MessageCircle,
  Scale,
  ShieldCheck,
  Stethoscope,
  Syringe,
  UserRound,
  UsersRound,
  XCircle,
} from "lucide-react";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { db } from "@/lib/firestore";
import { useAuth } from "@/context/AuthContext";
import { avaliarC5, type ResultadoC5 } from "@/lib/indicadores/c5";

type DadosPaciente = Record<string, unknown>;

function texto(v: unknown) {
  return typeof v === "string" ? v : "";
}

function nomeFormatado(v: string) {
  return v || "Paciente";
}

function campo(dados: DadosPaciente, ...nomes: string[]) {
  for (const nome of nomes) {
    const valor = dados[nome];
    if (typeof valor === "string" && valor.trim()) return valor;
  }
  return "";
}

function valorHistorico(valor: unknown) {
  if (valor === null || valor === undefined) return "—";

  if (typeof valor === "string") {
    const limpo = valor.trim();
    return limpo || "—";
  }

  if (typeof valor === "number" || typeof valor === "boolean") {
    return String(valor);
  }

  return String(valor);
}

function IconeCampo({ chave }: { chave: string }) {
  const textoChave = chave.toLowerCase();

  if (textoChave.includes("pressão") || textoChave.includes("pressao")) {
    return <HeartPulse size={19} />;
  }

  if (textoChave.includes("data") || textoChave.includes("dias") || textoChave.includes("meses")) {
    return <CalendarDays size={19} />;
  }

  if (textoChave.includes("peso") || textoChave.includes("altura")) {
    return <Scale size={19} />;
  }

  if (textoChave.includes("câncer") || textoChave.includes("cancer")) {
    return <Activity size={19} />;
  }

  if (textoChave.includes("hpv") || textoChave.includes("hepatite") || textoChave.includes("hiv")) {
    return <Syringe size={19} />;
  }

  if (textoChave.includes("odont") || textoChave.includes("dente")) {
    return <Stethoscope size={19} />;
  }

  if (textoChave.includes("enfermagem") || textoChave.includes("consulta")) {
    return <ClipboardCheck size={19} />;
  }

  if (textoChave.includes("visita domiciliar")) {
    return <Home size={19} />;
  }

  return <Activity size={19} />;
}

export default function PacienteDetalhePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { usuario, ubs, carregando } = useAuth();

  const [paciente, setPaciente] = useState<DadosPaciente | null>(null);
  const [carregandoPaciente, setCarregandoPaciente] = useState(true);
  const [erro, setErro] = useState("");
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [historico, setHistorico] = useState<
    Array<{
      id: string;
      arquivoNome: string;
      listaTematica: string;
      criadoEm: string;
      dataAvaliacao: Date | null;
      dadosEspecificos: Record<string, unknown>;
    }>
  >([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [c5, setC5] = useState<ResultadoC5 | null>(null);

  async function carregarC5(pacienteId: string, ubsId: string) {
    try {
      const importsSnapshot = await getDocs(
        collection(db, "ubs", ubsId, "importacoesPEC")
      );

      const candidatos: Array<{
        criadoEm: Date | null;
        dadosEspecificos: Record<string, unknown>;
      }> = [];

      for (const importDoc of importsSnapshot.docs) {
        const importacao = importDoc.data();
        const listaTematica =
          typeof importacao.listaTematica === "string"
            ? importacao.listaTematica
            : "";

        if (!listaTematica.toLowerCase().includes("hipertens")) {
          continue;
        }

        const registroRef = doc(
          db,
          "ubs",
          ubsId,
          "importacoesPEC",
          importDoc.id,
          "registros",
          pacienteId
        );

        const registroSnapshot = await getDoc(registroRef);

        if (!registroSnapshot.exists()) continue;

        const registro = registroSnapshot.data();

        candidatos.push({
          criadoEm: importacao.criadoEm?.toDate?.() || null,
          dadosEspecificos:
            registro.dadosEspecificos &&
            typeof registro.dadosEspecificos === "object"
              ? registro.dadosEspecificos
              : {},
        });
      }

      candidatos.sort(
        (a, b) =>
          (b.criadoEm?.getTime() ?? 0) - (a.criadoEm?.getTime() ?? 0)
      );

      const maisRecente = candidatos[0];

      if (!maisRecente) {
        setC5(null);
        return;
      }

      setC5(
        avaliarC5(
          maisRecente.dadosEspecificos,
          maisRecente.criadoEm ?? new Date()
        )
      );
    } catch (error) {
      console.error("Erro ao calcular C5 do paciente:", error);
      setC5(null);
    }
  }

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

    async function carregar() {
      if (!usuario) {
        return;
      }

      const ubsId = usuario.ubsId;

      try {
        const id = decodeURIComponent(params.id);
        const referencia = doc(
          db,
          "ubs",
          ubsId,
          "pacientes",
          id
        );
        const snapshot = await getDoc(referencia);

        if (!snapshot.exists()) {
          setErro("Paciente não encontrado.");
          return;
        }

        setPaciente({
          id: snapshot.id,
          ...snapshot.data(),
        });

        // O C5 é calculado a partir da importação temática de Hipertensão
        // mais recente, preservando o histórico sem duplicar dados.
        await carregarC5(snapshot.id, ubsId);

        // Carrega o histórico somente quando o usuário abrir a seção.
        // Cada importação preserva seu próprio registro, sem sobrescrever o anterior.
      } catch (error) {
        console.error("Erro ao carregar paciente:", error);
        setErro("Não foi possível carregar os dados do paciente.");
      } finally {
        setCarregandoPaciente(false);
      }
    }

    carregar();
  }, [carregando, usuario, router, params.id]);

  function normalizarTexto(valor: unknown) {
    return String(valor ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function idadeEmAnos(valor: unknown): number | null {
    if (typeof valor === "number" && Number.isFinite(valor)) {
      return valor;
    }

    const valorTexto = String(valor ?? "").trim();
    if (!valorTexto) return null;

    // Exemplos aceitos: "3", "3 anos", "3 anos e 1 mês".
    const match = valorTexto.match(/(\d+(?:[.,]\d+)?)\s*ano/i);
    if (match) {
      const idade = Number(match[1].replace(",", "."));
      return Number.isFinite(idade) ? idade : null;
    }

    const somenteNumero = Number(valorTexto.replace(",", "."));
    return Number.isFinite(somenteNumero) ? somenteNumero : null;
  }

  const tematicas = useMemo(() => {
    if (!paciente || !Array.isArray(paciente.tematicasPEC)) return [];

    const idade = idadeEmAnos(paciente.idade);

    return paciente.tematicasPEC.filter((valor): valor is string => {
      if (typeof valor !== "string") return false;

      const tema = normalizarTexto(valor);

      // A temática pode continuar existindo no histórico do PEC,
      // mas não deve ser apresentada como acompanhamento C2
      // quando o paciente já passou de 2 anos.
      if (
        (tema.includes("desenvolvimento infantil") ||
          tema.includes("infantil") ||
          tema.includes("crianca")) &&
        (idade === null || idade > 2)
      ) {
        return false;
      }

      return true;
    });
  }, [paciente]);

  if (carregando || !usuario || carregandoPaciente) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7FAFC]">
        <Loader2 size={34} className="animate-spin text-[#003B8E]" />
      </main>
    );
  }

  if (erro || !paciente) {
    return (
      <main className="min-h-screen bg-[#F7FAFC] p-6">
        <button onClick={() => router.push("/pacientes")} className="text-sm font-semibold text-[#003B8E]">
          ← Voltar para pacientes
        </button>
        <div className="mt-6 rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="font-bold">{erro || "Paciente não encontrado."}</p>
        </div>
      </main>
    );
  }

  const nome = nomeFormatado(texto(paciente.nome));
  const nascimento = campo(paciente, "dataNascimento", "Data de nascimento");
  const idade = campo(paciente, "idade");
  const sexo = campo(paciente, "sexo");
  const cpf = campo(paciente, "cpf", "CPF");
  const cns = campo(paciente, "cns", "CNS");
  const microarea = campo(paciente, "microareaId", "Microárea");
  const telefone = campo(paciente, "telefoneCelular", "telefone", "Telefone celular");
  const bairro = campo(paciente, "bairro") || campo((paciente.endereco as DadosPaciente) || {}, "bairro");
  const rua = campo(paciente, "rua") || campo((paciente.endereco as DadosPaciente) || {}, "rua");
  const numero = campo(paciente, "numero") || campo((paciente.endereco as DadosPaciente) || {}, "numero");

  async function carregarHistorico() {
    if (!usuario || !paciente) {
      return;
    }

    const ubsId = usuario.ubsId;

    try {
      setCarregandoHistorico(true);

      const importsSnapshot = await getDocs(
        collection(db, "ubs", ubsId, "importacoesPEC")
      );

      const registros: Array<{
        id: string;
        arquivoNome: string;
        listaTematica: string;
        criadoEm: string;
        dataAvaliacao: Date | null;
        dadosEspecificos: Record<string, unknown>;
      }> = [];

      for (const importDoc of importsSnapshot.docs) {
        const importacao = importDoc.data();

        // Os registros da importação usam o mesmo ID do paciente.
        const registroRef = doc(
          db,
          "ubs",
          ubsId,
          "importacoesPEC",
          importDoc.id,
          "registros",
          paciente.id as string
        );

        const registroSnapshot = await getDoc(registroRef);

        if (!registroSnapshot.exists()) continue;

        const registro = registroSnapshot.data();

        registros.push({
          id: importDoc.id,
          arquivoNome:
            typeof importacao.arquivoNome === "string"
              ? importacao.arquivoNome
              : "Relatório do PEC",
          listaTematica:
            typeof importacao.listaTematica === "string"
              ? importacao.listaTematica
              : "Não informada",
          criadoEm:
            importacao.criadoEm?.toDate?.()?.toLocaleString("pt-BR") ||
            "Data não informada",
          dataAvaliacao: importacao.criadoEm?.toDate?.() || null,
          dadosEspecificos:
            registro.dadosEspecificos &&
            typeof registro.dadosEspecificos === "object"
              ? registro.dadosEspecificos
              : {},
        });
      }

      registros.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
      setHistorico(registros);

      // O C5 usa somente a importação mais recente da temática Hipertensão.
      // A classificação é feita pelo motor técnico, não pela simples presença da temática.
      const importacaoHipertensao = registros.find((item) =>
        item.listaTematica.toLowerCase().includes("hipertens")
      );

      if (importacaoHipertensao) {
        setC5(
          avaliarC5(
            importacaoHipertensao.dadosEspecificos,
            importacaoHipertensao.dataAvaliacao ?? new Date()
          )
        );
      } else {
        setC5(null);
      }
    } catch (error) {
      console.error("Erro ao carregar histórico do paciente:", error);
      setErro("Não foi possível carregar o histórico deste paciente.");
    } finally {
      setCarregandoHistorico(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F7FAFC] text-[#003B8E]">
      <header className="relative isolate overflow-hidden rounded-b-[28px] border border-emerald-200/60 bg-gradient-to-br from-[#009C3B]/95 via-[#00A9E8]/85 to-[#F2C300]/85 px-5 py-5 text-white shadow-[0_10px_24px_rgba(0,156,59,0.16),0_4px_10px_rgba(0,59,142,0.10)] backdrop-blur-md">
        <div className="pointer-events-none absolute -left-10 -top-14 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute right-16 -top-12 h-32 w-32 rounded-full bg-[#F2C300]/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-45px] left-1/2 h-24 w-48 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/pacientes")}
              className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 shadow-sm ring-1 ring-white/25 transition-all hover:bg-white/25"
            >
              <ArrowLeft size={17} className="transition-transform group-hover:-translate-x-0.5" />
            </button>

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 text-xs font-extrabold shadow-sm ring-1 ring-white/30">
              {nome.slice(0, 2).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-extrabold">{nome}</p>
              <p className="truncate text-[9px] text-white/85">
                {cpf || cns || "Cadastro PEC"}
              </p>
            </div>

            {telefone && (
              <a
                href={`https://wa.me/55${telefone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#22C55E] px-3 py-2 text-[9px] font-extrabold shadow-[0_5px_12px_rgba(0,0,0,0.12)] transition-all hover:-translate-y-0.5 hover:bg-[#16A34A]"
              >
                <MessageCircle size={14} />
                <span className="hidden sm:inline">WhatsApp</span>
              </a>
            )}
          </div>

          <div className="mt-4 pl-1">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-white/85">
              Cadastro e acompanhamento do paciente
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1000px] px-4 pb-6 pt-5 sm:px-5 md:pt-6">
        <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-2xl border border-[#DDEAF2] bg-white px-4 py-3 text-[9px] text-[#64748B] shadow-[0_5px_14px_rgba(0,59,142,0.06)]">
          <span>📅 {nascimento || "Nascimento não informado"}</span>
          <span>•</span>
          <span>{sexo || "Sexo não informado"}</span>
          <span>•</span>
          <span>📍 MA {microarea || "—"}</span>
          <span>•</span>
          <span>{telefone || "Telefone não informado"}</span>
        </div>

        <div className="grid gap-5 md:grid-cols-[300px_1fr]">
          <aside className="space-y-4">
            <section className="rounded-2xl border border-[#DDEAF2] bg-white p-5 shadow-[0_6px_14px_rgba(0,59,142,0.07)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(0,169,232,0.10)]">
              <h2 className="text-xs font-bold">Dados do Paciente</h2>

              <div className="mt-4 space-y-3 text-[10px]">
                <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                  <span className="text-gray-400">ENDEREÇO</span>
                  <span className="text-right font-semibold">
                    {rua || "Não informado"}{numero ? `, ${numero}` : ""}
                    {bairro ? ` • ${bairro}` : ""}
                  </span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-400">MICROÁREA</span>
                  <span className="font-semibold">{microarea || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-400">NASCIMENTO</span>
                  <span className="font-semibold">{nascimento || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-400">IDADE</span>
                  <span className="font-semibold">{idade || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-400">SEXO</span>
                  <span className="font-semibold">{sexo || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">CPF</span>
                  <span className="font-semibold">{cpf || "—"}</span>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-[#DDEAF2] bg-white p-5 shadow-[0_6px_14px_rgba(0,59,142,0.07)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(0,169,232,0.10)]">
              <div className="flex items-center gap-2">
                <MapPin size={15} className="text-[#00A9E8]" />
                <h2 className="text-xs font-bold text-[#003B8E]">Território</h2>
              </div>
              <p className="mt-3 text-[10px] leading-relaxed text-gray-600">
                {ubs?.nome || "UBS"} • Microárea {microarea || "—"}
              </p>
            </section>
          </aside>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold">Indicadores / Boas Práticas</h2>

            </div>

            {c5 ? (
              <section className="overflow-hidden rounded-2xl border border-[#9EDFF2] bg-white shadow-[0_7px_16px_rgba(0,169,232,0.09)] transition-all duration-200">
                <div className="border-b border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold text-[#003B8E]">
                        C5 — Cuidado da pessoa com hipertensão
                      </p>
                      <p className="mt-1 text-[9px] text-gray-500">
                        Avaliação das 4 boas práticas do acompanhamento longitudinal.
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-[9px] text-gray-400">Pontuação</p>
                      <p className="text-2xl font-extrabold text-[#003B8E]">
                        {c5.pontuacao}/100
                      </p>
                      <span className="text-[8px] font-bold text-gray-500">
                        {c5.classificacao}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 p-4 sm:grid-cols-2">
                  {c5.praticas.map((pratica) => (
                    <div
                      key={pratica.codigo}
                      className={`rounded-xl border p-3 ${
                        pratica.atingida
                          ? "border-[#A7E6C0] bg-gradient-to-br from-[#ECFDF3] to-white shadow-[0_4px_10px_rgba(0,156,59,0.07)]"
                          : "border-[#FECACA] bg-gradient-to-br from-[#FFF7F7] to-white shadow-[0_4px_10px_rgba(239,68,68,0.06)]"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {pratica.atingida ? (
                          <CheckCircle2
                            size={17}
                            className="mt-0.5 shrink-0 text-[#009C3B]"
                          />
                        ) : (
                          <XCircle
                            size={17}
                            className="mt-0.5 shrink-0 text-[#EF4444]"
                          />
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[10px] font-bold text-[#003B8E]">
                              {pratica.codigo}. {pratica.titulo}
                            </p>
                            <span
                              className={`shrink-0 rounded-full px-2 py-1 text-[8px] font-bold ${
                                pratica.atingida
                                  ? "bg-[#D9F6E5] text-[#009C3B]"
                                  : "bg-[#FEE2E2] text-[#B91C1C]"
                              }`}
                            >
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

                <div className="border-t border-[#DDEAF2] bg-gradient-to-r from-[#F4F8FF] to-[#F7FBFD] px-4 py-3">
                  <p className="text-[8px] leading-relaxed text-gray-500">
                    Regra técnica: 25 pontos por boa prática. O C5 considera consulta
                    médica/enfermagem em até 6 meses, pressão em até 6 meses, peso e
                    altura em até 12 meses e 2 visitas domiciliares em 12 meses com
                    intervalo mínimo de 30 dias.
                  </p>
                  <p className="mt-1 text-[8px] leading-relaxed text-gray-400">
                    Resultado calculado a partir dos campos disponíveis no relatório
                    temático de Hipertensão importado do PEC.
                  </p>
                </div>
              </section>
            ) : (
              <section className="overflow-hidden rounded-2xl border border-[#9EDFF2] bg-white shadow-[0_7px_16px_rgba(0,169,232,0.09)] transition-all duration-200">
                <div className="border-b border-gray-100 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-[#003B8E]">
                        Acompanhamentos identificados no PEC
                      </p>
                      <p className="mt-1 text-[9px] text-gray-500">
                        {tematicas.length} temática(s) registrada(s) nesta base.
                      </p>
                    </div>
                    <span className="rounded-full bg-[#D9F6E5] px-2 py-1 text-[8px] font-bold text-[#009C3B]">
                      Dados reais
                    </span>
                  </div>
                </div>

                {tematicas.length ? (
                  <div className="grid gap-3 p-4 sm:grid-cols-2">
                    {tematicas.map((tema) => (
                      <div
                        key={tema}
                        className="rounded-xl border border-[#A7E6C0] bg-gradient-to-br from-[#ECFDF3] to-white p-3 shadow-[0_4px_10px_rgba(0,156,59,0.06)]"
                      >
                        <div className="flex items-start gap-2">
                          <CheckCircle2
                            size={15}
                            className="mt-0.5 shrink-0 text-[#009C3B]"
                          />
                          <div>
                            <p className="text-[10px] font-bold text-[#006B35]">
                              {tema}
                            </p>
                            <p className="mt-1 text-[8px] text-gray-500">
                              Registro originado do relatório importado do PEC.
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <XCircle size={24} className="mx-auto text-gray-300" />
                    <p className="mt-2 text-xs font-semibold text-gray-500">
                      Nenhum acompanhamento identificado ainda.
                    </p>
                  </div>
                )}

                <div className="border-t border-[#DDEAF2] bg-gradient-to-r from-[#F4F8FF] to-[#F7FBFD] p-4">
                  <p className="text-[9px] leading-relaxed text-gray-500">
                    As temáticas acima representam a origem dos dados do PEC.
                    Os indicadores oficiais são calculados somente quando a
                    importação contém os dados necessários para a regra técnica.
                  </p>
                </div>
              </section>
            )}

            <section className="mt-4 rounded-2xl border border-[#DDEAF2] bg-white shadow-[0_6px_14px_rgba(0,59,142,0.07)] transition-all duration-200">
              <button
                onClick={() => {
                  const novoEstado = !historicoAberto;
                  setHistoricoAberto(novoEstado);
                  if (novoEstado && historico.length === 0) {
                    carregarHistorico();
                  }
                }}
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <div>
                  <p className="text-xs font-bold">Histórico de Registros</p>
                  <p className="mt-1 text-[9px] text-gray-500">
                    Dados preservados das importações do PEC.
                  </p>
                </div>
                {historicoAberto ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
              </button>

              {historicoAberto && (
                <div className="border-t border-gray-100 p-4">
                  {carregandoHistorico ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2
                        size={24}
                        className="animate-spin text-[#003B8E]"
                      />
                    </div>
                  ) : historico.length === 0 ? (
                    <div className="py-6 text-center">
                      <p className="text-xs font-semibold text-gray-500">
                        Nenhum registro histórico encontrado.
                      </p>
                      <p className="mt-1 text-[9px] text-gray-400">
                        O paciente ainda não possui registros preservados nas importações.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {historico.map((item, index) => (
                        <div
                          key={`${item.id}-${index}`}
                          className="rounded-xl border border-[#DDEAF2] bg-gradient-to-br from-[#F7FBFD] to-white p-4 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-bold text-[#003B8E]">
                                {item.listaTematica}
                              </p>
                              <p className="mt-1 text-[8px] text-gray-500">
                                {item.arquivoNome}
                              </p>
                            </div>
                            <span className="shrink-0 rounded-full bg-[#E5F5FB] px-2 py-1 text-[8px] font-bold text-[#003B8E]">
                              Importação
                            </span>
                          </div>

                          <p className="mt-3 text-[8px] text-gray-400">
                            {item.criadoEm}
                          </p>

                          {Object.keys(item.dadosEspecificos).length > 0 && (
                            <details className="mt-3">
                              <summary className="cursor-pointer text-[9px] font-semibold text-[#003B8E]">
                                Ver dados específicos desta importação
                              </summary>
                              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                {Object.entries(item.dadosEspecificos).map(
                                  ([chave, valor]) => {
                                    const valorExibido = valorHistorico(valor);
                                    const possuiValor = valorExibido !== "—";

                                    return (
                                      <div
                                        key={chave}
                                        className={`min-w-0 rounded-xl border p-3 transition ${
                                          possuiValor
                                            ? "border-[#C9DFF0] bg-gradient-to-br from-[#F4FAFD] to-white"
                                            : "border-gray-100 bg-[#FAFAFA]"
                                        }`}
                                      >
                                        <div className="flex items-start gap-2.5">
                                          <div
                                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                                              possuiValor
                                                ? "bg-[#E5F5FB] text-[#00A9E8]"
                                                : "bg-gray-100 text-gray-400"
                                            }`}
                                          >
                                            <IconeCampo chave={chave} />
                                          </div>

                                          <div className="min-w-0 flex-1">
                                            <p className="text-[8px] font-medium leading-snug text-gray-500">
                                              {chave}
                                            </p>
                                            <p
                                              className={`mt-1 break-words text-[11px] font-bold leading-snug ${
                                                possuiValor
                                                  ? "text-[#003B8E]"
                                                  : "text-gray-400"
                                              }`}
                                            >
                                              {valorExibido}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }
                                )}
                              </div>

                              <div className="mt-3 rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] px-3 py-2.5">
                                <p className="text-[8px] leading-relaxed text-[#475569]">
                                  Estes dados pertencem exclusivamente a esta importação do PEC e são preservados no histórico.
                                </p>
                              </div>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          </section>
        </div>
      </div>
    </main>
  );
}
