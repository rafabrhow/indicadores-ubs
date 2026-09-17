"use client";

import { ChangeEvent, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";

import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

type ResultadoImportacao = {
  id: string;
  arquivoNome: string;
  listaTematica: string;
  quantidadeRegistros: number;
  novosPacientes: number;
  pacientesAtualizados: number;
  processados: number;
};

type Props = {
  aberto: boolean;
  onFechar: () => void;
  onConcluido?: (resultado: ResultadoImportacao) => void;
};

const ETAPAS = ["Upload", "Validação", "Processamento", "Concluído"];

export default function ImportarPECModal({
  aberto,
  onFechar,
  onConcluido,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { usuarioAuth } = useAuth();

  const [etapa, setEtapa] = useState(1);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);

  if (!aberto) return null;

  function selecionarArquivo(event: ChangeEvent<HTMLInputElement>) {
    const selecionado = event.target.files?.[0] ?? null;

    setErro("");
    setResultado(null);

    if (!selecionado) return;

    if (!selecionado.name.toLowerCase().endsWith(".csv")) {
      setArquivo(null);
      setErro("Selecione um arquivo CSV exportado do e-SUS PEC.");
      return;
    }

    setArquivo(selecionado);
    setEtapa(2);
  }

  function removerArquivo() {
    setArquivo(null);
    setErro("");
    setEtapa(1);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function importar() {
    if (!arquivo) {
      setErro("Selecione um arquivo CSV.");
      return;
    }

    if (!usuarioAuth) {
      setErro("Sua sessão expirou. Faça login novamente.");
      return;
    }

    try {
      setErro("");
      setCarregando(true);
      setEtapa(3);

      const token = await usuarioAuth.getIdToken();

      const formData = new FormData();
      formData.append("arquivo", arquivo);

      const resposta = await fetch("/api/pec/importar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const dados = await resposta.json();

      if (!resposta.ok || !dados.sucesso) {
        throw new Error(
          dados.mensagem || "Não foi possível importar o CSV."
        );
      }

      setResultado(dados.importacao);
      setEtapa(4);
      onConcluido?.(dados.importacao);
    } catch (error) {
      console.error("Erro ao importar PEC:", error);
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível importar o CSV."
      );
      setEtapa(2);
    } finally {
      setCarregando(false);
    }
  }

  function fechar() {
    if (carregando) return;

    setEtapa(1);
    setArquivo(null);
    setErro("");
    setResultado(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }

    onFechar();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
      <div className="w-full max-w-[560px] overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold text-[#7C3AED]">
              e-SUS PEC
            </p>
            <h2 className="text-lg font-bold text-[#211A4A]">
              Importar do e-SUS PEC
            </h2>
          </div>

          <button
            type="button"
            onClick={fechar}
            disabled={carregando}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </header>

        <div className="px-5 pt-5">
          <div className="flex items-center gap-2">
            {ETAPAS.map((nome, index) => {
              const numero = index + 1;
              const ativo = numero <= etapa;

              return (
                <div key={nome} className="flex flex-1 items-center gap-2">
                  <div
                    className={[
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                      ativo
                        ? "bg-[#7C3AED] text-white"
                        : "bg-gray-100 text-gray-400",
                    ].join(" ")}
                  >
                    {numero}
                  </div>

                  <span
                    className={[
                      "hidden text-[10px] sm:block",
                      ativo ? "font-semibold text-[#4C1D95]" : "text-gray-400",
                    ].join(" ")}
                  >
                    {nome}
                  </span>

                  {index < ETAPAS.length - 1 && (
                    <div className="h-px flex-1 bg-gray-200" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-5 pb-6 pt-6">
          {etapa === 1 && (
            <>
              <p className="text-sm leading-relaxed text-gray-600">
                Exporte o relatório de acompanhamento de condições de saúde
                no e-SUS PEC e importe o arquivo CSV aqui.
              </p>

              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={selecionarArquivo}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-5 flex min-h-[190px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-[#D8C9FF] bg-[#FAF8FF] px-5 text-center transition hover:bg-[#F5F0FF]"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEE7FF]">
                  <Upload size={26} className="text-[#7C3AED]" />
                </span>

                <span className="mt-4 text-sm font-bold text-[#4C1D95]">
                  Arraste o CSV aqui
                </span>

                <span className="mt-1 text-xs text-gray-500">
                  ou toque para selecionar
                </span>

                <span className="mt-3 rounded-full bg-white px-3 py-1 text-[9px] font-semibold text-gray-400 shadow-sm">
                  CSV — e-SUS PEC
                </span>
              </button>
            </>
          )}

          {etapa === 2 && arquivo && (
            <>
              <div className="rounded-2xl border border-[#E7E2F2] bg-[#FAF9FD] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EEE7FF]">
                    <FileSpreadsheet size={21} className="text-[#7C3AED]" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#211A4A]">
                      {arquivo.name}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {(arquivo.size / 1024).toFixed(1)} KB
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={removerArquivo}
                    className="text-xs font-semibold text-red-500"
                  >
                    Trocar
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-[#F8F7FF] p-4">
                <p className="text-xs font-semibold text-[#4C1D95]">
                  O sistema irá:
                </p>

                <ul className="mt-2 space-y-1.5 text-xs text-gray-600">
                  <li>• validar a estrutura do relatório;</li>
                  <li>• identificar os pacientes;</li>
                  <li>• preservar o histórico da importação;</li>
                  <li>• atualizar a base da UBS;</li>
                  <li>• registrar a microárea informada pelo PEC.</li>
                </ul>
              </div>

              {erro && (
                <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
                  {erro}
                </div>
              )}

              <button
                type="button"
                onClick={importar}
                disabled={carregando}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#7C3AED] text-sm font-bold text-white shadow-lg shadow-purple-100 disabled:opacity-60"
              >
                {carregando ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    Importar dados
                    <ChevronRight size={18} />
                  </>
                )}
              </button>
            </>
          )}

          {etapa === 3 && (
            <div className="flex min-h-[270px] flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEE7FF]">
                <Loader2 size={30} className="animate-spin text-[#7C3AED]" />
              </div>

              <h3 className="mt-5 text-lg font-bold text-[#211A4A]">
                Processando o PEC
              </h3>

              <p className="mt-2 max-w-[380px] text-sm leading-relaxed text-gray-500">
                Estamos identificando os pacientes e registrando a
                importação. Não feche esta janela.
              </p>
            </div>
          )}

          {etapa === 4 && resultado && (
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                <Check size={30} className="text-emerald-600" />
              </div>

              <h3 className="mt-4 text-xl font-bold text-[#211A4A]">
                Importação concluída
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                {resultado.listaTematica}
              </p>

              <div className="mt-5 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-[#F8F7FF] p-3">
                  <p className="text-lg font-bold text-[#4C1D95]">
                    {resultado.quantidadeRegistros}
                  </p>
                  <p className="text-[9px] text-gray-500">registros</p>
                </div>

                <div className="rounded-2xl bg-emerald-50 p-3">
                  <p className="text-lg font-bold text-emerald-700">
                    {resultado.novosPacientes}
                  </p>
                  <p className="text-[9px] text-gray-500">novos</p>
                </div>

                <div className="rounded-2xl bg-blue-50 p-3">
                  <p className="text-lg font-bold text-blue-700">
                    {resultado.pacientesAtualizados}
                  </p>
                  <p className="text-[9px] text-gray-500">atualizados</p>
                </div>
              </div>

              <button
                type="button"
                onClick={fechar}
                className="mt-6 flex h-12 w-full items-center justify-center rounded-2xl bg-[#7C3AED] text-sm font-bold text-white"
              >
                Concluído
              </button>
            </div>
          )}

          {erro && etapa !== 2 && (
            <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
              {erro}
            </div>
          )}

          {etapa > 1 && etapa < 4 && !carregando && (
            <button
              type="button"
              onClick={() => setEtapa(1)}
              className="mt-3 flex w-full items-center justify-center gap-1 text-xs font-semibold text-gray-500"
            >
              <ChevronLeft size={14} />
              Voltar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
