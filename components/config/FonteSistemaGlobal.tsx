"use client";

import { useEffect } from "react";

const CHAVE_FONTE = "brasil360_fonte_sistema_v1";
const CHAVE_TAMANHO = "brasil360_tamanho_fonte_v1";

const FONTES: Record<string, string> = {
  padrao: 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif',
  arial: "Arial, sans-serif",
  verdana: "Verdana, sans-serif",
  tahoma: "Tahoma, sans-serif",
  trebuchet: '"Trebuchet MS", sans-serif',
};

export default function FonteSistemaGlobal() {
  useEffect(() => {
    const id = window.localStorage.getItem(CHAVE_FONTE) || "padrao";
    const tamanhoId =
      window.localStorage.getItem(CHAVE_TAMANHO) || "padrao";

    const familia = FONTES[id] || FONTES.padrao;
    const tamanhos: Record<string, string> = {
      pequena: "14px",
      padrao: "16px",
      grande: "18px",
      "extra-grande": "20px",
    };
    const tamanho = tamanhos[tamanhoId] || tamanhos.padrao;

    document.documentElement.style.setProperty(
      "--brasil360-font-family",
      familia,
    );
    document.documentElement.style.setProperty(
      "--brasil360-font-scale",
      tamanhoId === "pequena"
        ? "0.875"
        : tamanhoId === "grande"
          ? "1.125"
          : tamanhoId === "extra-grande"
            ? "1.25"
            : "1",
    );
    document.documentElement.style.fontFamily = familia;
    document.documentElement.style.fontSize = tamanho;
  }, []);

  return null;
}
