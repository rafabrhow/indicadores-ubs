"use client";

import { Loader2 } from "lucide-react";

type LoadingBrasil360Props = {
  mensagem?: string;
  subtitulo?: string;
};

export default function LoadingBrasil360({
  mensagem = "Carregando...",
  subtitulo = "Preparando o sistema",
}: LoadingBrasil360Props) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7FAFC] px-5">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <div className="relative mb-5">
          <div className="absolute inset-[-8px] rounded-full border-2 border-[#9EDFF2] border-t-[#00A9E8] animate-spin" />

          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[#B8DFF0] bg-gradient-to-br from-[#EAF7FC] via-white to-[#D7F1FA] text-[42px] shadow-[0_10px_22px_rgba(0,169,232,0.16)]">
            👩‍⚕️
          </div>

        </div>

        <p className="text-base font-extrabold text-[#003B8E]">
          {mensagem}
        </p>

        <p className="mt-1 text-[10px] font-medium text-[#64748B]">
          {subtitulo}
        </p>
      </div>
    </main>
  );
}
