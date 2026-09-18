"use client";

import {
  AlertCircle,
  ArrowLeft,
  Check,
  ClipboardList,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { onIdTokenChanged } from "firebase/auth";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

type AcaoOperacional = {
  nome: string;
  status: "Registrado" | "Revisar";
  detalhe: string;
};

type Tematica = {
  nome: string;
  indicador: string;
  status: "Registrado" | "Revisar";
  detalhe: string;
  acoes?: AcaoOperacional[];
};

type Acompanhamento = {
  id: string;
  tipo: string;
  observacao: string;
  data: string | null;
  acsNome?: string;
};

type Dados = {
  sucesso: true;
  paciente: {
    id: string;
    nome: string;
    idade: number | string | null;
    cpf: string;
    cns: string;
    sexo: string;
    dataNascimento: string;
    microareaId: string;
    telefoneCelular: string;
    telefoneContato: string;
    endereco: Record<string, unknown>;
    tematicas: Tematica[];
    acompanhamentos: Acompanhamento[];
  };
};

export default function PacienteOperacionalPage() {
  const router = useRouter();
  const params = useParams<{ uid: string; pacienteId: string }>();
  const { usuario, carregando } = useAuth();

  const uid = typeof params.uid === "string" ? params.uid : "";
  const pacienteId =
    typeof params.pacienteId === "string" ? params.pacienteId : "";

  const [dados, setDados] = useState<Dados | null>(null);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [erro, setErro] = useState("");
  const [modalVisita, setModalVisita] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState("");

  useEffect(() => {
    if (carregando || !usuario || !uid || !pacienteId) return;

    let cancelado = false;

    const cancelar = onIdTokenChanged(auth, async (usuarioAuth) => {
      if (!usuarioAuth) {
        router.replace("/login");
        return;
      }

      try {
        setCarregandoDados(true);
        setErro("");

        const token = await usuarioAuth.getIdToken();

        const resposta = await fetch(
          `/api/acs/operacional/${encodeURIComponent(uid)}/paciente/${encodeURIComponent(pacienteId)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const json = await resposta.json();

        if (cancelado) return;

        if (!resposta.ok || !json.sucesso) {
          setErro(json.mensagem || "Não foi possível carregar o paciente.");
          return;
        }

        setDados(json);
      } catch (error) {
        console.error("Erro ao carregar paciente:", error);
        if (!cancelado) setErro("Não foi possível carregar o paciente.");
      } finally {
        if (!cancelado) setCarregandoDados(false);
      }
    });

    return () => {
      cancelado = true;
      cancelar();
    };
  }, [carregando, pacienteId, router, uid, usuario]);

  async function registrarVisita() {
    if (!observacao.trim()) return;

    const usuarioAuth = auth.currentUser;
    if (!usuarioAuth) {
      setErro("Sua sessão expirou. Faça login novamente.");
      return;
    }

    try {
      setSalvando(true);
      setErro("");
      setSucesso("");

      const token = await usuarioAuth.getIdToken();

      const resposta = await fetch(
        `/api/acs/operacional/${encodeURIComponent(uid)}/paciente/${encodeURIComponent(pacienteId)}/visita`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ observacao: observacao.trim() }),
        }
      );

      const json = await resposta.json();

      if (!resposta.ok || !json.sucesso) {
        throw new Error(json.mensagem || "Não foi possível registrar a visita.");
      }

      setModalVisita(false);
      setObservacao("");
      setSucesso("Visita domiciliar registrada com sucesso.");

      // Recarrega a ficha para exibir o novo acompanhamento.
      window.location.reload();
    } catch (error) {
      console.error("Erro ao registrar visita:", error);
      setErro(error instanceof Error ? error.message : "Não foi possível registrar a visita.");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando || carregandoDados) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7FAFC]">
        <div className="text-center">
          <Loader2 size={34} className="mx-auto mb-3 animate-spin text-[#00A9E8]" />
          <p className="text-sm font-semibold text-[#003B8E]">
            Carregando ficha...
          </p>
        </div>
      </main>
    );
  }

  if (erro && !dados) {
    return (
      <main className="min-h-screen bg-[#F7FAFC] px-5 py-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-100 bg-white p-7 shadow-sm">
          <AlertCircle size={28} className="text-red-500" />
          <h1 className="mt-4 text-xl font-bold text-[#003B8E]">
            Não foi possível abrir o paciente
          </h1>
          <p className="mt-2 text-sm text-gray-500">{erro}</p>
          <button
            type="button"
            onClick={() => router.back()}
            className="mt-6 flex items-center gap-2 rounded-xl bg-[#00A9E8] px-5 py-3 text-sm font-semibold text-white"
          >
            <ArrowLeft size={16} />
            Voltar
          </button>
        </div>
      </main>
    );
  }

  if (!dados) return null;

  return (
    <main className="min-h-screen bg-[#F7FAFC] text-[#003B8E]">
      <header
        className="relative isolate overflow-hidden rounded-b-[28px] border border-emerald-200/60 bg-gradient-to-br from-[#009C3B]/95 via-[#00A9E8]/85 to-[#F2C300]/85 px-5 py-5 text-white shadow-[0_10px_24px_rgba(0,156,59,0.16),0_4px_10px_rgba(0,59,142,0.10)] backdrop-blur-md"
      >
        <div className="pointer-events-none absolute -left-10 -top-14 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute right-10 -top-12 h-32 w-32 rounded-full bg-[#F2C300]/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-45px] left-1/2 h-24 w-48 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />

        <div className="relative mx-auto max-w-4xl">
          <button
            type="button"
            onClick={() => router.back()}
            className="group mb-5 flex items-center gap-2 text-[11px] font-bold text-white/95"
          >
            <ArrowLeft size={15} className="transition-transform group-hover:-translate-x-0.5" />
            Voltar para microárea
          </button>

          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 shadow-sm ring-1 ring-white/25">
                <UserRound size={23} />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-white/85">
                  Acompanhamento operacional
                </p>
                <h1 className="mt-1 truncate text-2xl font-extrabold">
                  {dados.paciente.nome}
                </h1>
                <p className="mt-1 text-xs text-white/90">
                  {dados.paciente.idade !== null && dados.paciente.idade !== ""
                    ? `${dados.paciente.idade} anos`
                    : "Idade não informada"}{" "}
                  • Microárea {dados.paciente.microareaId}
                </p>
              </div>
            </div>

            {(dados.paciente.telefoneCelular || dados.paciente.telefoneContato) && (
              <a
                href={`https://wa.me/55${(
                  dados.paciente.telefoneCelular || dados.paciente.telefoneContato
                ).replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="flex shrink-0 items-center gap-2 rounded-xl bg-[#22C55E] px-4 py-2 text-[10px] font-bold text-white shadow-[0_6px_14px_rgba(34,197,94,0.22)] transition-all hover:-translate-y-0.5 hover:bg-[#16A34A] hover:shadow-[0_9px_18px_rgba(34,197,94,0.28)]"
              >
                <MessageCircle size={14} />
                WhatsApp
              </a>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-6 pt-5 sm:px-5 md:pt-6">
        {erro && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600 shadow-sm">
            {erro}
          </div>
        )}

        {sucesso && (
          <div className="mb-4 rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-xs text-[#006B35]">
            {sucesso}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.5fr)]">
          <div>
<section className="rounded-2xl border border-[#B8DFF0] bg-gradient-to-br from-white via-[#F8FCFF] to-[#EFF9FD] p-5 shadow-[0_7px_16px_rgba(0,59,142,0.07),0_2px_5px_rgba(0,169,232,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_11px_22px_rgba(0,169,232,0.11)]">
          <div className="flex items-center gap-2">
            <ClipboardList size={17} className="text-[#00A9E8]" />
            <h2 className="text-sm font-bold">Dados básicos</h2>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Info label="Nome" value={dados.paciente.nome || "Não informado"} />
            <Info label="Nascimento" value={dados.paciente.dataNascimento || "Não informado"} />
            <Info
              label="Idade"
              value={
                dados.paciente.idade !== null && dados.paciente.idade !== ""
                  ? `${dados.paciente.idade} anos`
                  : "Não informado"
              }
            />
            <Info label="Sexo" value={dados.paciente.sexo || "Não informado"} />
            <Info label="CPF" value={dados.paciente.cpf || "Não informado"} />
            <Info label="CNS" value={dados.paciente.cns || "Não informado"} />
            <Info
              label="Telefone"
              value={dados.paciente.telefoneCelular || dados.paciente.telefoneContato || "Não informado"}
              icon={<Phone size={13} />}
            />
          </div>
        </section>
<section className="mt-4 rounded-2xl border border-[#B8DFF0] bg-gradient-to-br from-white via-[#F8FCFF] to-[#EFF9FD] p-5 shadow-[0_7px_16px_rgba(0,59,142,0.07),0_2px_5px_rgba(0,169,232,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_11px_22px_rgba(0,169,232,0.11)]">
          <div className="flex items-center gap-2">
            <MapPin size={17} className="text-[#00A9E8]" />
            <h2 className="text-sm font-bold">Território</h2>
          </div>

          <div className="mt-3">
            <p className="text-[8px] font-semibold uppercase tracking-wide text-gray-400">
              Microárea
            </p>
            <p className="mt-1 text-xs font-semibold">
              {dados.paciente.microareaId || "Não informado"}
            </p>
            <p className="mt-2 text-[9px] text-gray-500">
              {[
                dados.paciente.endereco?.logradouro,
                dados.paciente.endereco?.numero,
                dados.paciente.endereco?.bairro,
                dados.paciente.endereco?.municipio,
              ]
                .filter(Boolean)
                .join(", ") || "Endereço não informado"}
            </p>
          </div>
        </section>
          </div>

          <div>
<section className="mt-4 rounded-2xl border border-[#B8DFF0] bg-gradient-to-br from-white via-[#F8FCFF] to-[#EFF9FD] p-5 shadow-[0_7px_16px_rgba(0,59,142,0.07),0_2px_5px_rgba(0,169,232,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_11px_22px_rgba(0,169,232,0.11)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold">Acompanhamentos identificados</h2>
              <p className="mt-1 text-[10px] text-gray-400">
                Informações encontradas nos registros importados do PEC.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setModalVisita(true)}
              className="flex items-center gap-2 rounded-xl bg-[#00A9E8] px-4 py-2.5 text-[10px] font-bold text-white shadow-[0_5px_12px_rgba(0,169,232,0.20)] transition-all hover:-translate-y-0.5 hover:bg-[#008FC5] hover:shadow-[0_8px_16px_rgba(0,169,232,0.24)]"
            >
              <MapPin size={14} />
              Registrar visita
            </button>
          </div>

          {(dados.paciente.tematicas ?? []).length === 0 ? (
            <div className="mt-4 rounded-xl bg-[#FAF9FD] p-6 text-center">
              <p className="text-xs font-semibold text-gray-500">
                Nenhum tema foi identificado no histórico importado.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(dados.paciente.tematicas ?? []).map((item) => {
                const acoes = item.acoes ?? [];
                const temRevisao = acoes.some(
                  (acao) => acao.status === "Revisar"
                );

                return (
                  <div
                    key={item.indicador}
                    className={`rounded-xl border p-3 ${
                      temRevisao
                        ? "border-[#F5D66A] bg-gradient-to-br from-[#FFF9E5] to-white shadow-[0_4px_10px_rgba(242,195,0,0.07)]"
                        : "border-[#A7E6C0] bg-gradient-to-br from-[#ECFDF3] to-white shadow-[0_4px_10px_rgba(0,156,59,0.07)]"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {temRevisao ? (
                        <AlertCircle
                          size={15}
                          className="mt-0.5 shrink-0 text-[#C78A00]"
                        />
                      ) : (
                        <Check
                          size={15}
                          className="mt-0.5 shrink-0 text-[#009C3B]"
                        />
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-bold">{item.nome}</p>
                          <span className="text-[8px] font-bold text-[#00A9E8]">
                            {item.indicador}
                          </span>
                        </div>

                        <p
                          className={`mt-1 text-[8px] ${
                            temRevisao ? "text-[#8A6500]" : "text-[#006B35]"
                          }`}
                        >
                          {temRevisao
                            ? "Há ações que precisam ser conferidas."
                            : item.detalhe}
                        </p>

                        {acoes.length > 0 && (
                          <div className="mt-2 space-y-1.5 border-t border-black/5 pt-2">
                            {acoes.map((acao) => (
                              <div
                                key={`${item.indicador}-${acao.nome}`}
                                className="flex items-start justify-between gap-2 rounded-lg border border-[#E5EAF0] bg-white/80 px-2 py-1.5 shadow-sm"
                              >
                                <div className="min-w-0">
                                  <p className="text-[8px] font-semibold text-gray-700">
                                    {acao.nome}
                                  </p>
                                  <p className="mt-0.5 text-[7px] leading-tight text-gray-400">
                                    {acao.detalhe}
                                  </p>
                                </div>

                                <span
                                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[7px] font-bold ${
                                    acao.status === "Registrado"
                                      ? "bg-green-100 text-[#006B35]"
                                      : "bg-amber-100 text-[#8A6500]"
                                  }`}
                                >
                                  {acao.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
<section className="mt-4 rounded-2xl border border-[#B8DFF0] bg-gradient-to-br from-white via-[#F8FCFF] to-[#EFF9FD] p-5 shadow-[0_7px_16px_rgba(0,59,142,0.07),0_2px_5px_rgba(0,169,232,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_11px_22px_rgba(0,169,232,0.11)]">
          <h2 className="text-sm font-bold">Histórico de acompanhamentos</h2>

          {(dados.paciente.acompanhamentos ?? []).length === 0 ? (
            <div className="mt-4 rounded-xl bg-[#FAF9FD] px-4 py-8 text-center">
              <p className="text-xs font-semibold text-gray-500">
                Nenhum acompanhamento registrado ainda.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {(dados.paciente.acompanhamentos ?? []).map((item) => (
                <div key={item.id} className="rounded-xl border border-[#DDEAF2] bg-gradient-to-br from-white to-[#F7FBFD] p-3 shadow-[0_4px_10px_rgba(0,59,142,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_16px_rgba(0,169,232,0.09)]">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-bold">{item.tipo}</p>
                    <span className="text-[8px] text-gray-400">{item.data || "Data não informada"}</span>
                  </div>
                  <p className="mt-1 text-[9px] leading-relaxed text-gray-500">
                    {item.observacao || "Sem observação."}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
          </div>
        </div>

<div className="mt-4 flex items-center gap-3 rounded-2xl border border-[#C9E8F5] bg-gradient-to-r from-[#EFF9FD] to-[#F6FBFE] px-4 py-3 shadow-[0_4px_10px_rgba(0,169,232,0.06)]">
          <ShieldCheck size={18} className="shrink-0 text-[#00A9E8]" />
          <p className="text-[9px] leading-relaxed text-gray-500">
            Esta ficha é operacional. O ACS acessa somente pacientes da sua microárea.
          </p>
        </div>      </div>

      {modalVisita && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl border border-[#DDEAF2] bg-white p-6 shadow-[0_18px_40px_rgba(0,59,142,0.18)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wide text-[#00A9E8]">
                  Nova visita
                </p>
                <h2 className="mt-1 text-lg font-bold">Registrar visita domiciliar</h2>
                <p className="mt-1 text-xs text-gray-500">{dados.paciente.nome}</p>
              </div>
              <button
                type="button"
                onClick={() => setModalVisita(false)}
                disabled={salvando}
                className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <label className="mt-5 block text-xs font-semibold text-gray-700">
              Observação da visita
            </label>

            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Registre de forma objetiva o que foi observado ou orientado..."
              rows={6}
              disabled={salvando}
              className="mt-2 w-full resize-none rounded-2xl border border-gray-200 bg-[#FAF9FD] p-4 text-sm outline-none focus:border-[#00A9E8] focus:ring-2 focus:ring-[#00A9E8]/10"
            />

            <div className="mt-4 rounded-xl border border-[#C9E8F5] bg-[#EFF9FD] p-3 text-[9px] leading-relaxed text-[#16607A]">
              Registre somente informações necessárias para a atividade operacional do ACS.
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setModalVisita(false)}
                disabled={salvando}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={registrarVisita}
                disabled={salvando || !observacao.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#00A9E8] px-4 py-3 text-sm font-bold text-white shadow-[0_5px_12px_rgba(0,169,232,0.20)] transition-all hover:-translate-y-0.5 hover:bg-[#008FC5] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {salvando ? "Salvando..." : "Salvar visita"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Info({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#E5EDF3] bg-gradient-to-br from-[#F8FCFF] to-white p-3 shadow-sm">
      <p className="text-[8px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-[#003B8E]">
        {icon}
        {value}
      </p>
    </div>
  );
}
