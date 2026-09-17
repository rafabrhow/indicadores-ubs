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

const TAMANHOS: Record<string, string> = {
  pequena: "15px",
  padrao: "17px",
  grande: "19px",
  "extra-grande": "22px",
};

const ESCALAS: Record<string, string> = {
  pequena: "0.875",
  padrao: "1",
  grande: "1.125",
  "extra-grande": "1.25",
};

export default function FonteSistemaGlobal() {
  useEffect(() => {
    function aplicarConfiguracoes() {
      const fonteId =
        window.localStorage.getItem(CHAVE_FONTE) || "padrao";

      const tamanhoId =
        window.localStorage.getItem(CHAVE_TAMANHO) || "padrao";

      const familia = FONTES[fonteId] || FONTES.padrao;
      const tamanho = TAMANHOS[tamanhoId] || TAMANHOS.padrao;
      const escala = ESCALAS[tamanhoId] || ESCALAS.padrao;

      const root = document.documentElement;

      root.style.setProperty("--brasil360-font-family", familia);
      root.style.setProperty("--brasil360-font-scale", escala);

      root.style.fontFamily = familia;
      root.style.fontSize = tamanho;

      root.setAttribute("data-brasil360-fonte", fonteId);
      root.setAttribute("data-brasil360-tamanho", tamanhoId);
    }

    aplicarConfiguracoes();

    const atualizar = () => aplicarConfiguracoes();

    window.addEventListener("brasil360:config-fonte", atualizar);
    window.addEventListener("storage", atualizar);

    return () => {
      window.removeEventListener("brasil360:config-fonte", atualizar);
      window.removeEventListener("storage", atualizar);
    };
  }, []);

  return null;
}