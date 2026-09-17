"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { onIdTokenChanged } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

export default function ACSPrimeiroAcessoPage() {
  const router = useRouter();
  const { usuario, carregando } = useAuth();

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [mostrarNova, setMostrarNova] = useState(false);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);
  const [carregandoSalvar, setCarregandoSalvar] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (carregando) return;

    let cancelado = false;

    const remover = onIdTokenChanged(auth, async (firebaseUser) => {
      if (cancelado) return;

      if (!firebaseUser) {
        router.replace("/acs-login");
        return;
      }

      try {
        const tokenResult = await firebaseUser.getIdTokenResult(true);

        if (tokenResult.claims.perfil !== "acs") {
          router.replace("/dashboard");
          return;
        }

        // Se a senha já foi alterada, não deixa voltar para esta tela.
        if (tokenResult.claims.primeiroAcesso !== true) {
          router.replace("/acs");
        }
      } catch (error) {
        console.error("Erro ao validar primeiro acesso:", error);
      }
    });

    return () => {
      cancelado = true;
      remover();
    };
  }, [carregando, usuario, router]);

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");

    if (novaSenha.length < 6) {
      setErro("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (novaSenha === novaSenha.toLowerCase() && !/[0-9]/.test(novaSenha)) {
      // A senha pode ser simples, mas recomendamos combinar letras e números.
      // Não bloqueamos apenas por não conter número.
    }

    if (novaSenha !== confirmacao) {
      setErro("As senhas não conferem.");
      return;
    }

    const firebaseUser = auth.currentUser;

    if (!firebaseUser) {
      setErro("Sua sessão expirou. Faça login novamente.");
      return;
    }

    try {
      setCarregandoSalvar(true);

      const token = await firebaseUser.getIdToken(true);

      const resposta = await fetch("/api/auth/acs-alterar-senha", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ novaSenha }),
      });

      const dados = await resposta.json();

      if (!resposta.ok || !dados.sucesso) {
        throw new Error(
          dados.mensagem || "Não foi possível alterar a senha."
        );
      }

      // Atualiza o token para receber primeiroAcesso=false.
      await firebaseUser.getIdToken(true);

      router.replace("/acs");
    } catch (error) {
      console.error("Erro ao alterar senha:", error);
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível alterar a senha."
      );
    } finally {
      setCarregandoSalvar(false);
    }
  }

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F7FF]">
        <Loader2 size={36} className="animate-spin text-[#7C3AED]" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F7FF] px-5 py-8 text-[#211A4A]">
      <div className="w-full max-w-md">
        <div className="mb-7 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#7C3AED] shadow-lg shadow-purple-200">
            <ShieldCheck size={31} className="text-white" />
          </div>

          <h1 className="mt-5 text-2xl font-bold">Crie sua nova senha</h1>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            Este é o seu primeiro acesso. A senha provisória fornecida pela
            enfermeira deve ser substituída por uma senha pessoal.
          </p>
        </div>

        <form
          onSubmit={salvar}
          className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100"
        >
          <label className="block text-sm font-semibold">Nova senha</label>

          <div className="relative mt-2">
            <KeyRound
              size={19}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7C3AED]"
            />

            <input
              type={mostrarNova ? "text" : "password"}
              value={novaSenha}
              onChange={(event) => setNovaSenha(event.target.value)}
              placeholder="Mínimo de 6 caracteres"
              autoComplete="new-password"
              className="h-14 w-full rounded-2xl border border-gray-200 bg-gray-50 pl-12 pr-12 outline-none transition focus:border-[#7C3AED] focus:bg-white focus:ring-4 focus:ring-purple-100"
            />

            <button
              type="button"
              onClick={() => setMostrarNova((valor) => !valor)}
              aria-label={mostrarNova ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
            >
              {mostrarNova ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <label className="mt-5 block text-sm font-semibold">
            Confirmar nova senha
          </label>

          <div className="relative mt-2">
            <input
              type={mostrarConfirmacao ? "text" : "password"}
              value={confirmacao}
              onChange={(event) => setConfirmacao(event.target.value)}
              placeholder="Digite novamente"
              autoComplete="new-password"
              className="h-14 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 pr-12 outline-none transition focus:border-[#7C3AED] focus:bg-white focus:ring-4 focus:ring-purple-100"
            />

            <button
              type="button"
              onClick={() => setMostrarConfirmacao((valor) => !valor)}
              aria-label={
                mostrarConfirmacao ? "Ocultar senha" : "Mostrar senha"
              }
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
            >
              {mostrarConfirmacao ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {erro && (
            <div className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={carregandoSalvar}
            className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#7C3AED] text-base font-bold text-white shadow-lg shadow-purple-200 transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {carregandoSalvar ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar nova senha"
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
