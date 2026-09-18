"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, CheckCircle2, XCircle, Filter, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { onIdTokenChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

type Codigo = "A" | "B" | "C" | "D" | "E";
type Pratica = { codigo: Codigo; titulo: string; pontos: number; atingida: boolean; status: string; detalhe: string };
type Paciente = { id:string; nome:string; cpf:string; microarea:string; idade:string; idadeMeses:number|null; pontuacao:number; classificacao:string; situacaoAcompanhamento:string; praticas:Pratica[]; elegivel:boolean };
type Relatorio = { possuiDados:boolean; mensagem?:string; importacao?:{arquivoNome:string;listaTematica:string;geradoEm:string;quantidadeRegistros:number}; resumo?:{totalRegistros:number;totalElegiveis:number;totalForaDoC2?:number;pontuacao:number;classificacao:string;praticas:Record<Codigo,{atingidos:number;percentual:number}>}; pacientes?:Paciente[] };

const titulos: Record<Codigo,string> = { A:"1ª consulta até 30 dias", B:"9 consultas até 2 anos", C:"9 registros de peso + altura", D:"2 visitas domiciliares", E:"Esquema vacinal completo" };

export default function C2Page(){
 const router=useRouter(); const [relatorio,setRelatorio]=useState<Relatorio|null>(null); const [carregando,setCarregando]=useState(true); const [erro,setErro]=useState("");
 const [busca,setBusca]=useState(""); const [microarea,setMicroarea]=useState("Todas"); const [pratica,setPratica]=useState("Todos"); const [classificacao,setClassificacao]=useState("Todas"); const [situacao,setSituacao]=useState("Todas"); const [aberto,setAberto]=useState<string|null>(null); const [mostrarFiltros,setMostrarFiltros]=useState(false);
 useEffect(()=>{ const unsub=onIdTokenChanged(auth,async(user)=>{ if(!user){router.replace("/login");return;} try{const token=await user.getIdToken();const r=await fetch("/api/indicadores/c2",{headers:{Authorization:`Bearer ${token}`}});const d=await r.json();if(!r.ok||!d.sucesso)throw new Error(d.mensagem||"Não foi possível carregar o C2.");setRelatorio(d);}catch(e){setErro(e instanceof Error?e.message:"Não foi possível carregar o C2.");}finally{setCarregando(false);}});return()=>unsub();},[router]);
 const microareas=useMemo(()=>["Todas",...Array.from(new Set((relatorio?.pacientes??[]).map(p=>p.microarea).filter(Boolean))).sort()],[relatorio]);
 const filtrados=useMemo(()=>{const q=busca.toLowerCase().trim();return(relatorio?.pacientes??[]).filter(p=>{const okBusca=!q||`${p.nome} ${p.cpf}`.toLowerCase().includes(q);const okMicro=microarea==="Todas"||p.microarea===microarea;const okPratica=pratica==="Todos"||p.praticas.some(x=>x.codigo===pratica&&!x.atingida);const okClass=classificacao==="Todas"||p.classificacao===classificacao;const pend=p.praticas.some(x=>!x.atingida);const okSit=situacao==="Todas"||(situacao==="Pendentes"&&pend)||(situacao==="Em acompanhamento"&&!pend);return okBusca&&okMicro&&okPratica&&okClass&&okSit;});},[relatorio,busca,microarea,pratica,classificacao,situacao]);
 if(carregando)return <main className="min-h-screen bg-[#F6F9FC] flex items-center justify-center"><div className="h-9 w-9 animate-spin rounded-full border-4 border-[#7C3AED]/20 border-t-[#7C3AED]"/></main>;
 if(erro)return <main className="min-h-screen bg-[#F6F9FC] p-6"><button onClick={()=>router.back()} className="font-bold text-sm">← Voltar</button><div className="mt-6 rounded-2xl bg-white p-6 text-center">{erro}</div></main>;
 if(!relatorio)return null;
 if(!relatorio.possuiDados)return <main className="min-h-screen bg-[#F6F9FC]"><header className="relative isolate overflow-hidden rounded-b-[28px] border border-emerald-200/60 bg-gradient-to-br from-[#009C3B]/95 via-[#00A9E8]/85 to-[#F2C300]/85 px-5 py-5 text-white shadow-[0_10px_24px_rgba(0,156,59,0.16),0_4px_10px_rgba(0,59,142,0.10)] backdrop-blur-md">
            <div className="pointer-events-none absolute -left-10 -top-14 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
            <div className="pointer-events-none absolute right-8 -top-12 h-32 w-32 rounded-full bg-[#F2C300]/20 blur-3xl" />
            <div className="relative">
              <button onClick={()=>router.back()} className="flex items-center gap-2 text-xs font-bold"><ArrowLeft size={16}/>Voltar</button>
              <p className="mt-4 text-[8px] font-bold uppercase tracking-wide text-white/85">Indicadores APS Brasil 360</p>
              <h1 className="mt-1 text-lg font-extrabold">C2 — Desenvolvimento Infantil</h1>
            </div>
          </header><div className="p-5"><section className="rounded-2xl bg-white p-6 text-center shadow-sm"><p className="font-bold">Ainda não há dados para o C2</p><p className="mt-2 text-xs text-gray-500">{relatorio.mensagem}</p></section></div></main>;
 const r=relatorio.resumo!;
 return <main className="min-h-screen bg-[#F6F9FC] text-[#003B8E] pb-8"><header className="relative isolate overflow-hidden rounded-b-[28px] border border-emerald-200/60 bg-gradient-to-br from-[#009C3B]/95 via-[#00A9E8]/85 to-[#F2C300]/85 px-5 py-5 text-white shadow-[0_10px_24px_rgba(0,156,59,0.16),0_4px_10px_rgba(0,59,142,0.10)] backdrop-blur-md">
            <div className="pointer-events-none absolute -left-10 -top-14 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
            <div className="pointer-events-none absolute right-8 -top-12 h-32 w-32 rounded-full bg-[#F2C300]/20 blur-3xl" />
            <div className="relative">
              <button onClick={()=>router.back()} className="flex items-center gap-2 text-xs font-bold"><ArrowLeft size={16}/>Voltar</button>
              <p className="mt-4 text-[8px] font-bold uppercase tracking-wide text-white/85">Indicadores APS Brasil 360</p>
              <h1 className="mt-1 text-lg font-extrabold">C2 — Cuidado no Desenvolvimento Infantil</h1>
              <p className="mt-1 text-[8px] text-white/90">Cálculo operacional baseado na última importação válida do PEC.</p>
            </div>
             <img
              src="/brasil360-logo-header.png"
              alt="Brasil 360"
              width={88}
              height={88}
              className="absolute right-5 top-1/2 h-16 w-16 -translate-y-1/2 rounded-2xl object-cover shadow-[0_8px_18px_rgba(0,59,142,0.22)] ring-1 ring-white/50 sm:h-20 sm:w-20"
            />
          </header>
 <div className="p-2 pt-5 sm:p-5 sm:pt-6 space-y-3"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
    <div className="rounded-2xl border border-[#9EDFF2] bg-gradient-to-br from-[#EAF7FC] via-white to-[#D7F1FA] p-4 shadow-[0_6px_14px_rgba(0,169,232,0.12),0_2px_5px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(0,169,232,0.18)]">
      <p className="text-[8px] font-medium text-[#39708A]">Resultado C2</p>
      <p className="text-2xl font-extrabold text-[#003B8E]">{r.pontuacao.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})}%</p>
      <p className="text-[8px] font-bold text-[#003B8E]">{r.classificacao}</p>
    </div>
    <div className="rounded-2xl border border-[#A7E6C0] bg-gradient-to-br from-[#ECFDF3] via-white to-[#DDF7E7] p-4 shadow-[0_6px_14px_rgba(0,156,59,0.12),0_2px_5px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(0,156,59,0.18)]">
      <p className="text-[8px] font-medium text-[#39705A]">Elegíveis</p>
      <p className="text-2xl font-extrabold text-[#003B8E]">{r.totalElegiveis}</p>
      <p className="text-[8px] font-medium text-[#39705A]">crianças até 2 anos</p>
    </div>
  </div>
 <section className="rounded-2xl border border-[#9EDFF2] bg-[#EAF7FC] p-4 text-[9px] leading-relaxed text-[#003B8E]">Resultado operacional baseado no relatório do PEC. A apuração oficial do SIAPS utiliza também CBO, CNS, vínculo/equipe e demais regras metodológicas.</section>
 <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#DDEAF2]"><h2 className="text-sm font-extrabold">Boas práticas</h2><div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">{(["A","B","C","D","E"] as Codigo[]).map(c=><div key={c} className={`rounded-xl border p-3 shadow-[0_4px_10px_rgba(0,59,142,0.07)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_16px_rgba(0,59,142,0.11)] ${
    c === "A" ? "border-[#9EDFF2] bg-gradient-to-br from-[#EAF7FC] to-[#D7F1FA]" :
    c === "B" ? "border-[#A7E6C0] bg-gradient-to-br from-[#ECFDF3] to-[#DDF7E7]" :
    c === "C" ? "border-[#F5D66A] bg-gradient-to-br from-[#FFF9E5] to-[#FFF1B8]" :
    c === "D" ? "border-[#B7C8F5] bg-gradient-to-br from-[#EEF2FF] to-[#DDE7FF]" :
    "border-[#A7E6C0] bg-gradient-to-br from-[#ECFDF3] to-[#DDF7E7]"
  }`}>
    <div className="flex justify-between text-[9px] font-bold"><span>{c}. {titulos[c]}</span><span className="text-[#003B8E]">{r.praticas[c].percentual.toLocaleString("pt-BR",{minimumFractionDigits:1})}%</span></div>
    <div className="mt-2 h-1.5 rounded-full bg-white/80">
      <div className={`h-1.5 rounded-full ${
        c === "A" ? "bg-[#00A9E8]" :
        c === "B" ? "bg-[#009C3B]" :
        c === "C" ? "bg-[#F2C300]" :
        c === "D" ? "bg-[#003B8E]" :
        "bg-[#009C3B]"
      }`} style={{width:`${r.praticas[c].percentual}%`}}/>
    </div>
    <p className="mt-1 text-[7px] text-gray-500">{r.praticas[c].atingidos} de {r.totalElegiveis} crianças</p>
  </div>)}</div></section>
 <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#DDEAF2]"><div className="flex items-center justify-between"><div><h2 className="text-sm font-extrabold">Onde concentrar o acompanhamento</h2><p className="text-[8px] text-gray-500">Use os filtros para localizar rapidamente as crianças.</p></div><button onClick={()=>setMostrarFiltros(v=>!v)} className="flex items-center gap-1 rounded-full bg-[#EAF7FC] px-3 py-2 text-[8px] font-bold text-[#003B8E]"><Filter size={13}/>Filtros</button></div>{mostrarFiltros&&<div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5"><div className="col-span-2 flex items-center rounded-xl border bg-white px-3"><Search size={13} className="text-gray-400"/><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Nome ou CPF" className="w-full p-2 text-xs outline-none"/></div><select value={microarea} onChange={e=>setMicroarea(e.target.value)} className="rounded-xl border p-2 text-xs"><option>Todas</option>{microareas.slice(1).map(m=><option key={m}>{m}</option>)}</select><select value={classificacao} onChange={e=>setClassificacao(e.target.value)} className="rounded-xl border p-2 text-xs"><option>Todas</option>{["Ótimo","Bom","Suficiente","Regular"].map(x=><option key={x}>{x}</option>)}</select><select value={situacao} onChange={e=>setSituacao(e.target.value)} className="rounded-xl border p-2 text-xs"><option>Todas</option><option>Pendentes</option><option>Em acompanhamento</option></select><select value={pratica} onChange={e=>setPratica(e.target.value)} className="rounded-xl border p-2 text-xs"><option>Todos</option>{(["A","B","C","D","E"] as Codigo[]).map(c=><option key={c}>{c}</option>)}</select><button onClick={()=>{setBusca("");setMicroarea("Todas");setClassificacao("Todas");setSituacao("Todas");setPratica("Todos")}} className="rounded-xl border bg-white p-2 text-xs font-bold">Limpar filtros</button></div>}
 <div className="mt-3 space-y-2"><p className="text-[8px] text-gray-500">{filtrados.length} criança(s) elegível(is) exibida(s). {r.totalForaDoC2 ? `${r.totalForaDoC2} registro(s) fora do critério do C2 não entram no indicador.` : ""}</p>{filtrados.map((p,index)=>{
  const pacienteKey = `${p.id || "paciente"}-${p.cpf || "sem-cpf"}-${index}`;
  return <div key={pacienteKey} className="overflow-hidden rounded-2xl border border-[#DDEAF2] bg-white shadow-[0_4px_10px_rgba(0,59,142,0.06)]">
    <button onClick={()=>setAberto(aberto===pacienteKey?null:pacienteKey)} className="flex w-full items-center gap-3 p-3 text-left"><div className="flex-1"><p className="text-[10px] font-extrabold">{p.nome}</p><p className="mt-1 text-[7px] text-gray-500">Microárea {p.microarea||"Não informada"} • CPF {p.cpf||"—"} • {p.idade||"idade não informada"}</p></div><span className="rounded-full bg-[#EAF7FC] px-2 py-1 text-[8px] font-extrabold text-[#003B8E]">{p.pontuacao.toLocaleString("pt-BR",{minimumFractionDigits:1})}%</span><span className="rounded-full bg-[#F6F9FC] px-2 py-1 text-[8px] font-bold">{p.classificacao}</span><ChevronDown size={14} className={aberto===p.id?"rotate-180":""}/></button>{aberto===pacienteKey&&<div className="border-t border-[#EEEAF5] p-3 grid grid-cols-1 md:grid-cols-2 gap-2">{p.praticas.map(x=><div key={x.codigo} className="rounded-xl border bg-[#F7FAFC] p-3"><div className="flex justify-between gap-2"><p className="text-[8px] font-extrabold">{x.codigo} — {x.titulo}</p>{x.atingida?<CheckCircle2 size={14} className="text-emerald-500"/>:<XCircle size={14} className="text-red-500"/>}</div><p className="mt-1 text-[8px] text-gray-500">{x.detalhe}</p><p className={`mt-2 text-[8px] font-bold ${x.atingida?"text-emerald-600":"text-red-500"}`}>{x.atingida?"Atingida":"Pendente"}</p></div>)}</div>}</div>})}</div></section></div></main>;
}
