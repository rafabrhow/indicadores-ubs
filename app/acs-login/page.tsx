"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { onIdTokenChanged, signInWithCustomToken } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

export default function ACSLoginPage() {
  const router = useRouter();
  const { usuario, carregando } = useAuth();

  const [codigoAcesso, setCodigoAcesso] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregandoLogin, setCarregandoLogin] = useState(false);
  const [erro, setErro] = useState("");

 

  async function entrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");

    const codigo = codigoAcesso.trim().toUpperCase();

    if (!codigo || !senha) {
      setErro("Informe o código de acesso e a senha.");
      return;
    }

    try {
      setCarregandoLogin(true);

      const resposta = await fetch("/api/auth/acs-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          codigoAcesso: codigo,
          senha,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok || !dados.sucesso) {
        throw new Error(
          dados.mensagem || "Não foi possível realizar o login."
        );
      }

      await signInWithCustomToken(auth, dados.customToken);

      if (dados.primeiroAcesso) {
        router.replace("/acs/primeiro-acesso");
      } else {
        router.replace("/acs");
      }
    } catch (error) {
      console.error("Erro no login do ACS:", error);

      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível entrar. Tente novamente."
      );
    } finally {
      setCarregandoLogin(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F7FF] px-5 py-8 text-[#211A4A]">
      <div className="w-full max-w-md">
        <div className="mb-7 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#7C3AED] shadow-lg shadow-purple-200">
            <ShieldCheck size={31} className="text-white" />
          </div>

          <h1 className="mt-5 text-2xl font-bold">Acesso do ACS</h1>

          <p className="mt-2 text-sm text-gray-500">
            Entre com o código de acesso fornecido pela enfermeira.
          </p>
        </div>

        <form
          onSubmit={entrar}
          className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100"
        >
          <label className="block text-sm font-semibold">Código de acesso</label>

          <div className="relative mt-2">
            <KeyRound
              size={19}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7C3AED]"
            />

            <input
              value={codigoAcesso}
              onChange={(event) =>
                setCodigoAcesso(event.target.value.toUpperCase())
              }
              placeholder="ACS-XXXXXX"
              autoCapitalize="characters"
              autoComplete="username"
              className="h-14 w-full rounded-2xl border border-gray-200 bg-gray-50 pl-12 pr-4 font-mono font-semibold tracking-wide outline-none transition focus:border-[#7C3AED] focus:bg-white focus:ring-4 focus:ring-purple-100"
            />
          </div>

          <label className="mt-5 block text-sm font-semibold">Senha</label>

          <div className="relative mt-2">
            <input
              type={mostrarSenha ? "text" : "password"}
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              placeholder="Digite sua senha"
              autoComplete="current-password"
              className="h-14 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 pr-12 outline-none transition focus:border-[#7C3AED] focus:bg-white focus:ring-4 focus:ring-purple-100"
            />

            <button
              type="button"
              onClick={() => setMostrarSenha((valor) => !valor)}
              aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
            >
              {mostrarSenha ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {erro && (
            <div className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={carregandoLogin}
            className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#7C3AED] text-base font-bold text-white shadow-lg shadow-purple-200 transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {carregandoLogin ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Entrando...
              </>
            ) : (
              "Entrar"
            )}
          </button>

          <button
            type="button"
            onClick={() => router.replace("/login")}
            className="mt-4 w-full text-center text-sm font-semibold text-[#7C3AED]"
          >
            Sou enfermeira
          </button>
        </form>
      </div>
    </main>
  );
}
