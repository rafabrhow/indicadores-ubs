"use client";

import { useEffect } from "react";

const CHAVE_FONTE = "brasil360_fonte_sistema_v1";
const CHAVE_TAMANHO = "brasil360_tamanho_fonte_v1";
const CHAVE_FONTE_LEGADA = "brasil360:admin:fonte";
const CHAVE_TAMANHO_LEGADA = "brasil360:admin:tamanhoFonte";

const FONTES: Record<string, string> = {
  padrao: "ui-sans-serif, system-ui, sans-serif",
  arial: "Arial, sans-serif",
  verdana: "Verdana, sans-serif",
  tahoma: "Tahoma, sans-serif",
  trebuchet: '"Trebuchet MS", sans-serif',
};

const TAMANHOS: Record<string, string> = {
  pequena: "14px",
  padrao: "16px",
  grande: "18px",
  "extra-grande": "20px",
};

const ESCALAS: Record<string, string> = {
  pequena: "0.9",
  padrao: "1",
  grande: "1.1",
  "extra-grande": "1.2",
};

function normalizarFonte(valor: string | null): string {
  if (!valor || valor === "sistema") return "padrao";
  const fonte = valor.toLowerCase();
  if (fonte === "trebuchet ms" || fonte === "trebuchet") return "trebuchet";
  return ["arial", "verdana", "tahoma"].includes(fonte) ? fonte : "padrao";
}

export default function FonteSistemaGlobal() {
  useEffect(() => {
    function aplicarConfiguracoes() {
      const fonteId = normalizarFonte(
        window.localStorage.getItem(CHAVE_FONTE) || window.localStorage.getItem(CHAVE_FONTE_LEGADA),
      );
      const tamanhoId =
        window.localStorage.getItem(CHAVE_TAMANHO) ||
        window.localStorage.getItem(CHAVE_TAMANHO_LEGADA) ||
        "padrao";
      const tamanhoValido = TAMANHOS[tamanhoId] ? tamanhoId : "padrao";
      const root = document.documentElement;
      root.style.setProperty("--brasil360-font-family", FONTES[fonteId]);
      root.style.setProperty("--brasil360-font-scale", ESCALAS[tamanhoValido]);
      root.style.fontFamily = FONTES[fonteId];
      root.style.fontSize = "16px";
      root.style.zoom = ESCALAS[tamanhoValido];
      root.setAttribute("data-brasil360-fonte", fonteId);
      root.setAttribute("data-brasil360-tamanho", tamanhoValido);
    }
    aplicarConfiguracoes();
    window.addEventListener("brasil360:config-fonte", aplicarConfiguracoes);
    window.addEventListener("storage", aplicarConfiguracoes);
    return () => {
      window.removeEventListener("brasil360:config-fonte", aplicarConfiguracoes);
      window.removeEventListener("storage", aplicarConfiguracoes);
    };
  }, []);
  return null;
}
