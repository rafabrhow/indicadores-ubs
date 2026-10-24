"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  HeartPulse,
} from "lucide-react";

import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth } from "@/lib/firebase";
import { db } from "@/lib/firestore";
import LoadingBrasil360 from "@/components/ui/LoadingBrasil360";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [enviandoRecuperacao, setEnviandoRecuperacao] = useState(false);

  useEffect(() => {
    const parametros = new URLSearchParams(window.location.search);
    if (parametros.get("motivo") === "assinatura-pendente") {
      setErro("Acesso suspenso por pagamento pendente. Regularize sua assinatura para voltar a acessar o sistema.");
    }
  }, []);

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
      const resultado = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        senha
      );

      const usuarioRef = doc(db, "usuarios", resultado.user.uid);
      const usuarioSnap = await getDoc(usuarioRef);

      if (!usuarioSnap.exists()) {
        throw new Error(
          "Usuário autenticado, mas seu cadastro não foi encontrado no sistema."
        );
      }

      const usuario = usuarioSnap.data();

      if (usuario.ativo !== true) {
        throw new Error(
          "Esta conta está desativada. Procure o administrador responsável."
        );
      }

      if (usuario.perfil === "administrador_municipal") {
        const municipio =
          typeof usuario.municipio === "string" ? usuario.municipio.trim() : "";
        const uf =
          typeof usuario.uf === "string" ? usuario.uf.trim().toUpperCase() : "";

        if (!municipio || !/^[A-Z]{2}$/.test(uf)) {
          throw new Error(
            "O cadastro administrativo está incompleto. Procure o suporte."
          );
        }

        router.replace("/admin");
        return;
      }

      if (
        !["enfermeira", "acs"].includes(usuario.perfil) ||
        typeof usuario.ubsId !== "string" ||
        !usuario.ubsId.trim()
      ) {
        throw new Error("Este usuário não possui um vínculo válido com uma UBS.");
      }

      // Não redireciona a enfermeira para a área interna até o servidor
      // confirmar que a assinatura individual está autorizada.
      if (usuario.perfil === "enfermeira") {
        const token = await resultado.user.getIdToken();
        const respostaAcesso = await fetch("/api/dashboard", {
          method: "GET",
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}`, "Cache-Control": "no-cache" },
        });
        const dadosAcesso = await respostaAcesso.json().catch(() => ({}));

        if (
          respostaAcesso.status === 403 &&
          dadosAcesso?.codigo === "ASSINATURA_PROFISSIONAL_INATIVA"
        ) {
          throw new Error(
            dadosAcesso.mensagem ||
              "Acesso suspenso por pagamento pendente. Regularize sua assinatura para voltar a acessar o sistema.",
          );
        }
      }

      router.push(usuario.perfil === "acs" ? "/acs" : "/dashboard");
    } catch (error: unknown) {
      console.error("Erro no login:", error);

      // Evita deixar uma sessão inválida aberta após falha na validação.
      try {
        await signOut(auth);
      } catch (signOutError) {
        console.error("Erro ao encerrar sessão inválida:", signOutError);
      }

      if (error instanceof Error) {
        setErro(error.message);
      } else {
        setErro("Não foi possível realizar o login.");
      }
    } finally {
      setCarregando(false);
    }
  }

  if (carregando) {
    return (
      <LoadingBrasil360
        mensagem="Entrando no sistema..."
        subtitulo="Autenticando seu acesso"
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F7FF] px-6 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1100px] items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-3xl bg-white shadow-xl md:grid-cols-2">
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
                Gestão e acompanhamento dos indicadores da Atenção Primária à Saúde.
              </p>
            </div>

            <p className="text-sm text-white/70">
              Acesso seguro para profissionais autorizados. V.9
            </p>
          </div>

          <div className="p-8 md:p-12">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-[#211A4A]">Entrar</h2>
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
                Entrar
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

              <p className="text-xs text-gray-400">
                O cadastro de profissionais é feito por um administrador autorizado.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
