"use client";

import { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import LoadingBrasil360 from "@/components/ui/LoadingBrasil360";

type LoadingGlobalBrasil360Props = {
  children: ReactNode;
};

export default function LoadingGlobalBrasil360({
  children,
}: LoadingGlobalBrasil360Props) {
  const { carregando } = useAuth();

  if (carregando) {
    return (
      <LoadingBrasil360
        mensagem="Carregando Brasil 360..."
        subtitulo="Preparando seu acesso ao sistema"
      />
    );
  }

  return <>{children}</>;
}
