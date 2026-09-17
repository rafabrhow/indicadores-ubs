"use client";

import { useState } from "react";
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  UserPlus,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

type CredenciaisACS = {
  uid: string;
  nome: string;
  microareaId: string;
  codigoAcesso: string;
  senhaProvisoria: string;
};

export type ACSCadastrado = {
  id: string;
  uid: string;
  nome: string;
  microareaId: string;
  ativo: boolean;
  codigoAcesso?: string;
  ultimoAcesso?: string;
  quantidadePacientes?: number;
};

type Props = {
  aberto: boolean;
  onFechar: () => void;
  onSucesso?: (acs: ACSCadastrado) => void;
};

export default function ModalCadastrarACS({
  aberto,
  onFechar,
  onSucesso,
}: Props) {
  const { usuarioAuth } = useAuth();

  const [nomeACS, setNomeACS] = useState("");
  const [microareaId, setMicroareaId] = useState("");
  const [cadastrandoACS, setCadastrandoACS] = useState(false);
  const [erroCadastro, setErroCadastro] = useState("");
  const [credenciaisACS, setCredenciaisACS] =
    useState<CredenciaisACS | null>(null);

  function fecharModalCadastro() {
    if (cadastrandoACS) return;

    setErroCadastro("");
    setNomeACS("");
    setMicroareaId("");
    onFechar();
  }

  async function cadastrarACS() {
    setErroCadastro("");

    if (!nomeACS.trim()) {
      setErroCadastro("Informe o nome completo do ACS.");
      return;
    }

    if (!microareaId.trim()) {
      setErroCadastro("Informe o código da microárea.");
      return;
    }

    if (!usuarioAuth) {
      setErroCadastro("Sua sessão expirou. Faça login novamente.");
      return;
    }

    try {
      setCadastrandoACS(true);

      const idToken = await usuarioAuth.getIdToken();

      const resposta = await fetch("/api/acs/cadastrar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          nome: nomeACS.trim(),
          microareaId: microareaId.trim(),
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok || !dados.sucesso) {
        throw new Error(
          dados.mensagem || "Não foi possível cadastrar o ACS."
        );
      }

      const acsCadastrado: ACSCadastrado = {
        id: dados.acs.uid,
        uid: dados.acs.uid,
        nome: dados.acs.nome,
        microareaId: dados.acs.microareaId,
        ativo: true,
        codigoAcesso: dados.acs.codigoAcesso,
        ultimoAcesso: undefined,
        quantidadePacientes: 0,
      };

      onSucesso?.(acsCadastrado);
      setCredenciaisACS(dados.acs);
      setNomeACS("");
      setMicroareaId("");
      onFechar();
    } catch (error) {
      console.error("Erro ao cadastrar ACS:", error);
      setErroCadastro(
        error instanceof Error
          ? error.message
          : "Não foi possível cadastrar o ACS."
      );
    } finally {
      setCadastrandoACS(false);
    }
  }

  async function copiarAcessoACS() {
    if (!credenciaisACS) return;

    try {
      const texto = [
        "ACESSO DO ACS",
        "",
        `Nome: ${credenciaisACS.nome}`,
        `Código da microárea: ${credenciaisACS.microareaId}`,
        `Código de acesso: ${credenciaisACS.codigoAcesso}`,
        `Senha provisória: ${credenciaisACS.senhaProvisoria}`,
        "",
        "No primeiro acesso, será necessário trocar a senha.",
      ].join("\n");

      await navigator.clipboard.writeText(texto);
      alert("Acesso copiado com sucesso!");
    } catch (error) {
      console.error("Não foi possível copiar o acesso:", error);
    }
  }

  function fecharCredenciais() {
    setCredenciaisACS(null);
  }

  if (!aberto && !credenciaisACS) return null;

  return (
    <>
      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEE7FF]">
                  <UserPlus size={21} className="text-[#7C3AED]" />
                </div>

                <h2 className="text-xl font-bold text-[#211A4A]">
                  Cadastrar ACS
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Cadastre o profissional e informe o código da microárea.
                </p>
              </div>

              <button
                type="button"
                onClick={fecharModalCadastro}
                disabled={cadastrandoACS}
                className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
                aria-label="Fechar cadastro de ACS"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Nome do ACS
                </label>
                <input
                  type="text"
                  value={nomeACS}
                  onChange={(e) => setNomeACS(e.target.value)}
                  placeholder="Digite o nome completo"
                  disabled={cadastrandoACS}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition placeholder:text-gray-300 focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/10 disabled:bg-gray-50"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Código da microárea
                </label>
                <input
                  type="text"
                  value={microareaId}
                  onChange={(e) => setMicroareaId(e.target.value)}
                  placeholder="Ex.: MA-01"
                  disabled={cadastrandoACS}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition placeholder:text-gray-300 focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/10 disabled:bg-gray-50"
                />
              </div>

              {erroCadastro && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {erroCadastro}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={fecharModalCadastro}
                  disabled={cadastrandoACS}
                  className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={cadastrarACS}
                  disabled={cadastrandoACS}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {cadastrandoACS ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Cadastrando...
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      Cadastrar ACS
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {credenciaisACS && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-5 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <Check size={28} className="text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-[#211A4A]">
                ACS cadastrado!
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Guarde ou compartilhe os dados de acesso com o ACS.
              </p>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Nome
                </p>
                <p className="mt-1 font-semibold text-[#211A4A]">
                  {credenciaisACS.nome}
                </p>
              </div>

              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Código da microárea
                </p>
                <p className="mt-1 font-mono font-semibold text-[#211A4A]">
                  {credenciaisACS.microareaId}
                </p>
              </div>

              <div className="rounded-2xl bg-purple-50 p-4">
                <div className="flex items-center gap-2">
                  <KeyRound size={15} className="text-purple-500" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-purple-500">
                    Código de acesso
                  </p>
                </div>
                <p className="mt-1 font-mono text-xl font-bold tracking-wider text-[#4C1D95]">
                  {credenciaisACS.codigoAcesso}
                </p>
              </div>

              <div className="rounded-2xl bg-yellow-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-yellow-600">
                  Senha provisória
                </p>
                <p className="mt-1 font-mono text-xl font-bold tracking-wider text-gray-800">
                  {credenciaisACS.senhaProvisoria}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-blue-50 p-3 text-sm leading-relaxed text-blue-700">
              <strong>Importante:</strong> essa senha é provisória. No primeiro acesso,
              o ACS deverá criar uma nova senha.
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={copiarAcessoACS}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                <Copy size={16} />
                Copiar acesso
              </button>

              <button
                type="button"
                onClick={fecharCredenciais}
                className="flex flex-1 items-center justify-center rounded-xl bg-[#7C3AED] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#6D28D9]"
              >
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
