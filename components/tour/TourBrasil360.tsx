"use client";

import { useEffect, useState } from "react";

export type TourEtapa = {
  alvo: string;
  titulo: string;
  descricao: string;
};

type TourBrasil360Props = {
  etapas: TourEtapa[];
  storageKey: string;
  ativo: boolean;
};

type Retangulo = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export default function TourBrasil360({
  etapas,
  storageKey,
  ativo,
}: TourBrasil360Props) {
  const [aberto, setAberto] = useState(false);
  const [etapa, setEtapa] = useState(0);
  const [alvoRect, setAlvoRect] = useState<Retangulo | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!ativo || etapas.length === 0) return;

    const jaConcluiu = window.localStorage.getItem(storageKey) === "true";

    if (!jaConcluiu) {
      setEtapa(0);
      setAberto(true);
    }
  }, [ativo, etapas.length, storageKey]);

  useEffect(() => {
    const atualizarViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    atualizarViewport();
    window.addEventListener("resize", atualizarViewport);

    return () => {
      window.removeEventListener("resize", atualizarViewport);
    };
  }, []);

  useEffect(() => {
    if (!aberto || etapas.length === 0) return;

    const etapaAtual = etapas[etapa];
    if (!etapaAtual) return;

    const elemento = document.querySelector(
      `[data-tour="${etapaAtual.alvo}"]`,
    ) as HTMLElement | null;

    if (!elemento) {
      setAlvoRect(null);
      return;
    }

    const atualizarPosicao = () => {
      const rect = elemento.getBoundingClientRect();

      setAlvoRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };

    // Garante que a etapa fique visível antes de calcular o destaque.
    elemento.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });

    const timeout = window.setTimeout(atualizarPosicao, 180);

    window.addEventListener("resize", atualizarPosicao);
    window.addEventListener("scroll", atualizarPosicao, true);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("resize", atualizarPosicao);
      window.removeEventListener("scroll", atualizarPosicao, true);
    };
  }, [aberto, etapa, etapas]);

  if (!aberto || etapas.length === 0) {
    return null;
  }

  const etapaAtual = etapas[etapa];

  function encerrarTour() {
    window.localStorage.setItem(storageKey, "true");
    setAberto(false);
    setEtapa(0);
    setAlvoRect(null);
  }

  function proximaEtapa() {
    if (etapa >= etapas.length - 1) {
      encerrarTour();
      return;
    }

    setEtapa((atual) => atual + 1);
  }

  function etapaAnterior() {
    setEtapa((atual) => Math.max(0, atual - 1));
  }

  // Mantém uma margem para o destaque não encostar na borda do elemento.
  const destaque = alvoRect
    ? {
        top: Math.max(6, alvoRect.top - 6),
        left: Math.max(6, alvoRect.left - 6),
        width: Math.min(
          viewport.width - Math.max(6, alvoRect.left - 6) - 6,
          alvoRect.width + 12,
        ),
        height: Math.min(
          viewport.height - Math.max(6, alvoRect.top - 6) - 6,
          alvoRect.height + 12,
        ),
      }
    : null;

  // Posicionamento do balão:
  // 1. tenta ficar abaixo do alvo;
  // 2. se não couber, tenta ficar acima;
  // 3. se não couber em nenhum dos dois, escolhe o lado com mais espaço,
  //    mantendo o balão dentro da viewport.
  let painelTop: number | undefined;
  let painelBottom: number | undefined;

  const margem = 14;
  // Altura aproximada usada somente para decidir onde o balão cabe.
  // O tamanho real continua sendo determinado pelo conteúdo.
  const alturaEstimadaPainel = viewport.width <= 900 ? 155 : 175;

  if (destaque) {
    const alvoOcupaViewport =
      destaque.height >= viewport.height - 80 ||
      destaque.width >= viewport.width - 40;

    if (alvoOcupaViewport) {
      painelBottom = 16;
    } else {
      const espacoAbaixo =
        viewport.height - (destaque.top + destaque.height);
      const espacoAcima = destaque.top;

      if (espacoAbaixo >= alturaEstimadaPainel + margem) {
        painelTop = destaque.top + destaque.height + margem;
      } else if (espacoAcima >= alturaEstimadaPainel + margem) {
        painelBottom = viewport.height - destaque.top + margem;
      } else if (espacoAbaixo >= espacoAcima) {
        painelTop = Math.min(
          destaque.top + destaque.height + margem,
          Math.max(12, viewport.height - alturaEstimadaPainel - 12),
        );
      } else {
        painelBottom = Math.min(
          viewport.height - destaque.top + margem,
          Math.max(12, viewport.height - alturaEstimadaPainel - 12),
        );
      }
    }
  } else {
    painelBottom = 16;
  }

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Escurece toda a tela.
          O fundo é apenas visual e não encerra o tour.
          O tour só pode ser encerrado por Pular ou Concluir. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[#211A4A]/45"
      />

      {destaque && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed rounded-2xl border-2 border-white bg-transparent shadow-[0_0_0_9999px_rgba(33,26,74,0.55)] transition-all duration-300"
          style={{
            top: destaque.top,
            left: destaque.left,
            width: destaque.width,
            height: destaque.height,
          }}
        />
      )}

      <div
        className="pointer-events-auto absolute inset-x-3 z-[110] mx-auto w-auto max-w-[380px] rounded-2xl border border-[#E5E0EC] bg-white p-4 opacity-100 shadow-2xl transition-all duration-300 sm:left-1/2 sm:right-auto sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 lg:max-w-md lg:p-5"
        style={
          destaque && painelBottom === undefined
            ? { top: painelTop }
            : { bottom: painelBottom }
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wide text-[#7C3AED]">
              Tour Brasil 360
            </p>
            <h2 className="mt-1 text-sm font-bold text-[#211A4A] lg:text-base">
              {etapaAtual.titulo}
            </h2>
          </div>

          <button
            type="button"
            onClick={encerrarTour}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            Pular
          </button>
        </div>

        <p className="mt-2 text-[11px] leading-relaxed text-gray-500 lg:mt-3 lg:text-xs">
          {etapaAtual.descricao}
        </p>

        <div className="mt-3 flex items-center justify-between gap-3 lg:mt-5">
          <div className="flex items-center gap-1.5">
            {etapas.map((_, indice) => (
              <span
                key={indice}
                className={`h-1.5 rounded-full transition-all ${
                  indice === etapa
                    ? "w-5 bg-[#7C3AED]"
                    : "w-1.5 bg-[#DDD7EA]"
                }`}
              />
            ))}
          </div>

          <span className="text-[9px] font-semibold text-gray-400">
            {etapa + 1} de {etapas.length}
          </span>
        </div>

        <div className="mt-3 flex justify-end gap-2 lg:mt-4">
          {etapa > 0 && (
            <button
              type="button"
              onClick={etapaAnterior}
              className="rounded-xl border border-[#E5E0EC] px-3 py-1.5 text-[10px] font-semibold text-gray-600 transition hover:bg-gray-50 lg:px-4 lg:py-2"
            >
              Voltar
            </button>
          )}

          <button
            type="button"
            onClick={proximaEtapa}
            className="rounded-xl bg-[#7C3AED] px-3 py-1.5 text-[10px] font-semibold text-white transition hover:bg-[#6D28D9] lg:px-4 lg:py-2"
          >
            {etapa === etapas.length - 1 ? "Concluir" : "Próximo"}
          </button>
        </div>
      </div>
    </div>
  );
}
