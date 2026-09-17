import { HeartPulse, Stethoscope, Users } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#F8F7FF] px-4 py-8">
      <div className="mx-auto flex min-h-[90vh] w-full max-w-md flex-col justify-center">

        {/* Logo */}
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#7C3AED]">
              <HeartPulse className="h-7 w-7 text-white" />
            </div>
          </div>

          <h1 className="mt-5 text-3xl font-bold tracking-tight text-[#211A4A]">
            Indicadores-UBS
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Controle e acompanhamento de indicadores da UBS
          </p>
        </div>

        {/* Pergunta */}
        <div className="mt-10 text-center">
          <h2 className="text-2xl font-bold text-[#211A4A]">
            Quem é você?
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Selecione seu perfil para continuar
          </p>
        </div>

        {/* Perfis */}
        <div className="mt-6 space-y-4">

          {/* Enfermeira */}
          <Link
            href="/login"
            className="group flex min-h-[116px] items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:border-[#7C3AED]/30 hover:shadow-md"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#EDE9FE]">
              <Stethoscope className="h-7 w-7 text-[#7C3AED]" />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-[#211A4A]">
                Enfermeira
              </h3>

              <p className="mt-1 text-sm leading-5 text-slate-500">
                Gerencie pacientes e acompanhe os indicadores da UBS.
              </p>
            </div>

            <span className="text-2xl text-slate-400 transition-transform group-hover:translate-x-1">
              ›
            </span>
          </Link>

          {/* ACS */}
          <Link
            href="/acs-login"
            className="group flex min-h-[116px] items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:border-emerald-300 hover:shadow-md"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-50">
              <Users className="h-7 w-7 text-emerald-500" />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-[#211A4A]">
                Agente Comunitário de Saúde
              </h3>

              <p className="mt-1 text-sm leading-5 text-slate-500">
                Consulte o acompanhamento dos pacientes da sua área.
              </p>
            </div>

            <span className="text-2xl text-slate-400 transition-transform group-hover:translate-x-1">
              ›
            </span>
          </Link>

        </div>

        <p className="mt-8 text-center text-xs text-slate-400">
          Indicadores-UBS
        </p>
      </div>
    </main>
  );
}