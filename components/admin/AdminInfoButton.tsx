
"use client";

import { Info, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type AdminInfoButtonProps = {
  titulo: string;
  children: string;
  className?: string;
};

export default function AdminInfoButton({
  titulo,
  children,
  className = "",
}: AdminInfoButtonProps) {
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState({ top: 0, left: 0 });
  const [montado, setMontado] = useState(false);

  const containerRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    if (!aberto) return;

    const atualizarPosicao = () => {
      const botao = buttonRef.current;
      const popup = popupRef.current;

      if (!botao || !popup) return;

      const margem = 12;
      const espacamento = 8;
      const largura = Math.min(288, window.innerWidth - margem * 2);
      const altura = popup.offsetHeight;
      const rect = botao.getBoundingClientRect();

      let left = rect.right - largura;

      left = Math.max(
        margem,
        Math.min(left, window.innerWidth - largura - margem)
      );

      let top = rect.bottom + espacamento;

      if (top + altura > window.innerHeight - margem) {
        const acima = rect.top - altura - espacamento;

        top =
          acima >= margem
            ? acima
            : Math.max(
                margem,
                window.innerHeight - altura - margem
              );
      }

      setPosicao({ top, left });
    };

    const fecharFora = (event: PointerEvent) => {
      const alvo = event.target;

      if (!(alvo instanceof Node)) return;

      if (
        !containerRef.current?.contains(alvo) &&
        !popupRef.current?.contains(alvo)
      ) {
        setAberto(false);
      }
    };

    const fecharEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAberto(false);
        buttonRef.current?.focus();
      }
    };

    atualizarPosicao();

    window.addEventListener("resize", atualizarPosicao);
    window.addEventListener("scroll", atualizarPosicao, true);
    document.addEventListener("pointerdown", fecharFora);
    document.addEventListener("keydown", fecharEscape);

    return () => {
      window.removeEventListener("resize", atualizarPosicao);
      window.removeEventListener("scroll", atualizarPosicao, true);
      document.removeEventListener("pointerdown", fecharFora);
      document.removeEventListener("keydown", fecharEscape);
    };
  }, [aberto, children, titulo]);

  return (
    <span
      ref={containerRef}
      className={`relative inline-flex shrink-0 ${className}`}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Informações: ${titulo}`}
        aria-expanded={aberto}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setAberto((valor) => !valor);
        }}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sky-600 transition hover:bg-sky-50 hover:text-sky-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
      >
        <Info size={16} aria-hidden="true" />
      </button>

      {aberto &&
        montado &&
        createPortal(
          <div
            ref={popupRef}
            role="dialog"
            aria-label={titulo}
            style={{
              position: "fixed",
              top: posicao.top,
              left: posicao.left,
              width: "min(18rem, calc(100vw - 1.5rem))",
              maxHeight: "calc(100vh - 1.5rem)",
              overflowY: "auto",
              visibility: posicao.top === 0 ? "hidden" : "visible",
            }}
            className="z-[9999] rounded-xl border border-sky-100 bg-white p-4 text-left text-sm font-normal normal-case leading-relaxed text-slate-700 shadow-[0_12px_35px_rgba(15,23,42,0.18)]"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <strong className="text-sm font-bold text-[#211A4A]">
                {titulo}
              </strong>

              <button
                type="button"
                aria-label="Fechar explicação"
                onClick={() => {
                  setAberto(false);
                  buttonRef.current?.focus();
                }}
                className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <X size={15} aria-hidden="true" />
              </button>
            </div>

            <div>{children}</div>
          </div>,
          document.body
        )}
    </span>
  );
}
