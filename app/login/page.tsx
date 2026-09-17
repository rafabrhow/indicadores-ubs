"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  HeartPulse,
  Loader2,
} from "lucide-react";

import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth } from "@/lib/firebase";
import { db } from "@/lib/firestore";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [enviandoRecuperacao, setEnviandoRecuperacao] = useState(false);

  /**
   * Realiza o login através do Firebase Authentication.
   *
   * Depois de autenticar, buscamos o documento do usuário
   * no Firestore para descobrir:
   *
   * - nome
   * - perfil
   * - UBS vinculada
   * - situação da conta
   */
  async function handleRecuperarSenha() {
    setErro("");
    setSucesso("");

    const emailInformado = email.trim();

    if (!emailInformado) {
      setErro("Digite seu e-mail para receber o link de recuperação da senha.");
      return;
    }

    setEnviandoRecuperacao(true);

    try {
      await sendPasswordResetEmail(auth, emailInformado);

      setSucesso(
        "Enviamos um link de recuperação para o seu e-mail. Verifique também a caixa de spam."
      );
    } catch (error: unknown) {
      console.error("Erro ao recuperar senha:", error);

      if (error instanceof Error) {
        const codigo = (error as { code?: string }).code;

        if (codigo === "auth/user-not-found") {
          setErro("Não encontramos uma conta com este e-mail.");
        } else if (codigo === "auth/invalid-email") {
          setErro("Digite um e-mail válido.");
        } else if (codigo === "auth/too-many-requests") {
          setErro("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
        } else {
          setErro("Não foi possível enviar o link de recuperação. Tente novamente.");
        }
      } else {
        setErro("Não foi possível enviar o link de recuperação. Tente novamente.");
      }
    } finally {
      setEnviandoRecuperacao(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErro("");
    setCarregando(true);

    try {
      // 1. Autentica o usuário no Firebase
      const resultado = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        senha
      );

      const uid = resultado.user.uid;

      // 2. Busca o cadastro do usuário no Firestore
      const usuarioRef = doc(db, "usuarios", uid);
      const usuarioSnap = await getDoc(usuarioRef);

      if (!usuarioSnap.exists()) {
        throw new Error(
          "Usuário autenticado, mas seu cadastro não foi encontrado no sistema."
        );
      }

      const usuario = usuarioSnap.data();

      // 3. Verifica se a conta está ativa
      if (usuario.ativo !== true) {
        throw new Error(
          "Esta conta está desativada. Procure o administrador da UBS."
        );
      }

      // 4. Verifica se existe uma UBS vinculada
      if (!usuario.ubsId) {
        throw new Error(
          "Este usuário ainda não está vinculado a uma UBS."
        );
      }

      // 5. Login concluído
      // Neste momento vamos apenas encaminhar para o início.
      router.push("/dashboard");

    } catch (error: unknown) {
      console.error("Erro no login:", error);

      if (error instanceof Error) {
        setErro(error.message);
      } else {
        setErro("Não foi possível realizar o login.");
      }
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F7FF] px-6 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1100px] items-center justify-center">

        <div className="grid w-full overflow-hidden rounded-3xl bg-white shadow-xl md:grid-cols-2">

          {/* Área de apresentação */}
          <div className="hidden bg-[#7C3AED] p-10 text-white md:flex md:flex-col md:justify-between">

            <div>
              <Link
                href="/"
                className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-white/90 hover:text-white"
              >
                <ArrowLeft size={18} />
                Voltar
              </Link>

              <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15">
                <HeartPulse size={34} />
              </div>

              <h1 className="text-4xl font-bold tracking-tight">
                Indicadores-UBS 
              </h1>

              <p className="mt-4 max-w-md text-lg leading-relaxed text-white/85">
                Gestão e acompanhamento dos indicadores da Atenção
                Primária à Saúde.
              </p>
            </div>

            <p className="text-sm text-white/70">
              Acesso seguro para profissionais autorizados. v1.5
            </p>
          </div>

          {/* Formulário */}
          <div className="p-8 md:p-12">

            <div className="mb-8">
              <h2 className="text-3xl font-bold text-[#211A4A]">
                Entrar
              </h2>

              <p className="mt-2 text-gray-500">
                Acesse sua conta para continuar.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold text-gray-700"
                >
                  E-mail
                </label>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="seu@email.com"
                  required
                  autoComplete="email"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20"
                />
              </div>

              <div>
                <label
                  htmlFor="senha"
                  className="mb-2 block text-sm font-semibold text-gray-700"
                >
                  Senha
                </label>

                <input
                  id="senha"
                  type="password"
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  placeholder="Digite sua senha"
                  required
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20"
                />
              </div>

              {erro && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {erro}
                </div>
              )}

              {sucesso && (
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  {sucesso}
                </div>
              )}

              <button
                type="submit"
                disabled={carregando}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-3.5 font-semibold text-white transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {carregando ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Entrando...
                  </>
                ) : (
                  "Entrar"
                )}
              </button>

            </form>

            <div className="mt-6 flex flex-col gap-3 text-center text-sm">

              <button
                type="button"
                onClick={handleRecuperarSenha}
                disabled={enviandoRecuperacao || carregando}
                className="font-medium text-[#7C3AED] hover:underline disabled:cursor-not-allowed disabled:opacity-60"
              >
                {enviandoRecuperacao ? "Enviando..." : "Esqueci minha senha"}
              </button>

              <p className="text-gray-500">
                Ainda não possui uma conta?
              </p>

              <button
                type="button"
                className="font-semibold text-[#211A4A] hover:underline"
              >
                Criar conta
              </button>

            </div>

          </div>
        </div>
      </div>
    </main>
  );
}