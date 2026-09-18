"use client";
import { ArrowLeft, ChevronDown, ChevronUp, Filter, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { onIdTokenChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

type Pratica={codigo:string;titulo:string;pontos:number;atingida:boolean;status:"atingida"|"pendente"|"nao_aplicavel";detalhe:string};
type Paciente={id:string;nome:string;cpf:string;microarea:string;pontuacao:number;classificacao:string;fase:string;idadeGestacionalSemanas:number|null;diasPuerperio:number|null;praticas:Pratica[]};
type Relatorio={possuiDados:boolean;mensagem?:string;resumo?:{totalRegistros:number;totalElegiveis:number;pontuacao:number;classificacao:string;praticas:Record<string,{atingidos:number;pendentes:number;naoAplicaveis:number;percentual:number}>};pacientes?:Paciente[];importacao?:{arquivoNome:string;geradoEm:string;listaTematica:string;filtroProblemas:string}};
const nomes:Record<string,string>={A:"1ª consulta até 12 semanas",B:"7 consultas de pré-natal",C:"7 aferições de pressão",D:"7 registros de peso + altura",E:"3 visitas domiciliares",F:"dTpa a partir de 20 semanas",G:"Exames do 1º trimestre",H:"Exames do 3º trimestre",I:"Consulta no puerpério",J:"Visita no puerpério",K:"Saúde bucal"};
const codigos=Object.keys(nomes);
export default function C3Page(){
 const router=useRouter(); const [relatorio,setRelatorio]=useState<Relatorio|null>(null); const [erro,setErro]=useState(""); const [busca,setBusca]=useState(""); const [micro,setMicro]=useState("todas"); const [classif,setClassif]=useState("todas"); const [situacao,setSituacao]=useState("todas"); const [pratica,setPratica]=useState("todas"); const [fase,setFase]=useState("todas"); const [aberto,setAberto]=useState<string|null>(null); const [mostrarFiltros,setMostrarFiltros]=useState(false);
 useEffect(()=>{
  const unsub=onIdTokenChanged(auth,async(user)=>{
   if(!user){setErro("Sessão não autenticada.");return;}
   try{
    const token=await user.getIdToken();
    const r=await fetch("/api/indicadores/c3",{headers:{Authorization:`Bearer ${token}`}});
    const d=await r.json();
    if(!r.ok||!d.sucesso){setErro(d.mensagem??"Não foi possível carregar o C3.");return;}
    setRelatorio(d);
   }catch{setErro("Não foi possível carregar o C3.");}
  });
  return()=>unsub();
 },[]);
 const pacientes=relatorio?.pacientes??[]; const microareas=useMemo(()=>Array.from(new Set(pacientes.map(p=>p.microarea).filter(Boolean))).sort(),[pacientes]);
 const filtrados=useMemo(()=>pacientes.filter(p=>{const b=busca.toLowerCase().trim(); const okBusca=!b||p.nome.toLowerCase().includes(b)||p.cpf.includes(b); const okMicro=micro==="todas"||p.microarea===micro; const okClass=classif==="todas"||p.classificacao===classif; const pend=p.praticas.some(x=>x.status==="pendente"); const okSit=situacao==="todas"||(situacao==="pendentes"&&pend)||(situacao==="em-dia"&&!pend); const okPr=pratica==="todas"||p.praticas.some(x=>x.codigo===pratica&&x.status==="pendente"); const okF=fase==="todas"||p.fase===fase; return okBusca&&okMicro&&okClass&&okSit&&okPr&&okF;}),[pacientes,busca,micro,classif,situacao,pratica,fase]);
 const limpar=()=>{setBusca("");setMicro("todas");setClassif("todas");setSituacao("todas");setPratica("todas");setFase("todas");};
 if(erro)return <main className="min-h-screen bg-[#F6F9FC] p-5 text-[#003B8E]"><button onClick={()=>router.back()} className="mb-5 flex items-center gap-2 text-xs font-bold"><ArrowLeft size={16}/> Voltar</button><section className="rounded-2xl bg-white p-6 text-center shadow-sm"><b>{erro}</b></section></main>;
 if(!relatorio)return <main className="flex min-h-screen items-center justify-center bg-[#F6F9FC]"><div className="h-9 w-9 animate-spin rounded-full border-4 border-[#00A9E8]/20 border-t-[#00A9E8]"/></main>;
 if(!relatorio.possuiDados)return <main className="min-h-screen bg-[#F6F9FC] text-[#003B8E]"><header className="relative isolate overflow-hidden rounded-b-[28px] border border-emerald-200/60 bg-gradient-to-br from-[#009C3B]/95 via-[#00A9E8]/85 to-[#F2C300]/85 px-5 py-5 text-white shadow-[0_10px_24px_rgba(0,156,59,0.16),0_4px_10px_rgba(0,59,142,0.10)] backdrop-blur-md">
            <div className="pointer-events-none absolute -left-10 -top-14 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
            <div className="pointer-events-none absolute right-20 -top-12 h-32 w-32 rounded-full bg-[#F2C300]/20 blur-3xl" />
            <div className="relative pr-20">
              <button onClick={()=>router.back()} className="flex items-center gap-2 text-xs font-bold"><ArrowLeft size={17}/> Voltar</button>
              <p className="mt-4 text-[9px] font-bold uppercase tracking-wide text-white/85">Indicadores APS Brasil 360</p>
              <h1 className="text-lg font-extrabold">C3 — Gestação e Puerpério</h1>
            </div>
            <img src="/brasil360-logo-header.png" alt="Brasil 360" width={88} height={88} className="absolute right-5 top-1/2 h-16 w-16 -translate-y-1/2 rounded-2xl object-cover shadow-[0_8px_18px_rgba(0,59,142,0.22)] ring-1 ring-white/50 sm:h-20 sm:w-20" />
          </header><div className="p-5"><section className="rounded-2xl bg-white p-6 text-center shadow-sm"><p className="text-sm font-bold">Ainda não há dados para o C3</p><p className="mt-2 text-xs text-gray-500">{relatorio.mensagem}</p></section></div></main>;
 const resumo=relatorio.resumo!;
 return <main className="min-h-screen bg-[#F6F9FC] text-[#003B8E]"><header className="relative isolate overflow-hidden rounded-b-[28px] border border-emerald-200/60 bg-gradient-to-br from-[#009C3B]/95 via-[#00A9E8]/85 to-[#F2C300]/85 px-5 py-5 text-white shadow-[0_10px_24px_rgba(0,156,59,0.16),0_4px_10px_rgba(0,59,142,0.10)] backdrop-blur-md">
            <div className="pointer-events-none absolute -left-10 -top-14 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
            <div className="pointer-events-none absolute right-20 -top-12 h-32 w-32 rounded-full bg-[#F2C300]/20 blur-3xl" />
            <div className="relative pr-20">
              <button onClick={()=>router.back()} className="flex items-center gap-2 text-xs font-bold"><ArrowLeft size={17}/> Voltar</button>
              <p className="mt-4 text-[9px] font-bold uppercase tracking-wide text-white/85">Indicadores APS Brasil 360</p>
              <h1 className="text-lg font-extrabold">C3 — Gestação e Puerpério</h1>
            </div>
            <img src="/brasil360-logo-header.png" alt="Brasil 360" width={88} height={88} className="absolute right-5 top-1/2 h-16 w-16 -translate-y-1/2 rounded-2xl object-cover shadow-[0_8px_18px_rgba(0,59,142,0.22)] ring-1 ring-white/50 sm:h-20 sm:w-20" />
          </header>
 <div className="grid gap-3 p-4 pt-6 md:grid-cols-2">
    <section className="rounded-2xl border border-[#9EDFF2] bg-gradient-to-br from-[#EAF7FC] via-white to-[#D7F1FA] p-5 shadow-[0_6px_14px_rgba(0,169,232,0.12),0_2px_5px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(0,169,232,0.18)]">
      <span className="text-[9px] font-medium text-[#39708A]">Resultado C3</span>
      <p className="mt-1 text-3xl font-black text-[#003B8E]">{resumo.pontuacao.toLocaleString("pt-BR",{minimumFractionDigits:1})}%</p>
      <span className="text-xs font-bold text-[#003B8E]">{resumo.classificacao}</span>
    </section>
    <section className="rounded-2xl border border-[#A7E6C0] bg-gradient-to-br from-[#ECFDF3] via-white to-[#DDF7E7] p-5 shadow-[0_6px_14px_rgba(0,156,59,0.12),0_2px_5px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(0,156,59,0.18)]">
      <span className="text-[9px] font-medium text-[#39705A]">Elegíveis</span>
      <p className="mt-1 text-3xl font-black text-[#003B8E]">{resumo.totalElegiveis}</p>
      <span className="text-xs font-medium text-[#39705A]">gestantes/puérperas</span>
    </section>
  </div>
 <section className="mx-4 mb-4 rounded-2xl border border-[#9EDFF2] bg-gradient-to-r from-[#EAF7FC] to-[#F2FBFD] p-4 text-[9px] leading-relaxed text-[#003B8E] shadow-[0_3px_8px_rgba(0,169,232,0.08)]">Resultado operacional baseado no relatório do PEC. A apuração oficial do SIAPS considera também CBO, CNS, vínculo/equipe e demais regras da nota metodológica.</section>
 <section className="mx-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#DDEAF2]"><h2 className="text-sm font-extrabold">Boas práticas</h2><p className="mb-3 text-[9px] text-gray-400">A–K conforme a Nota Metodológica C3.</p><div className="grid gap-2 md:grid-cols-2">{codigos.map(c=>{const x=resumo.praticas[c];return <div key={c} className={`rounded-xl border p-3 shadow-[0_4px_10px_rgba(0,59,142,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_16px_rgba(0,59,142,0.12)] ${
              ["A","E","I"].includes(c)
                ? "border-[#9EDFF2] bg-gradient-to-br from-[#EAF7FC] via-white to-[#D7F1FA]"
                : ["B","F","J"].includes(c)
                  ? "border-[#A7E6C0] bg-gradient-to-br from-[#ECFDF3] via-white to-[#DDF7E7]"
                  : ["C","G","K"].includes(c)
                    ? "border-[#F5D66A] bg-gradient-to-br from-[#FFF9E5] via-white to-[#FFF1B8]"
                    : "border-[#B7C8F5] bg-gradient-to-br from-[#EEF2FF] via-white to-[#DDE7FF]"
            }`}><div className="flex justify-between text-[10px] font-bold"><span>{c}. {nomes[c]}</span><span className="text-[#003B8E]">{x.percentual.toLocaleString("pt-BR",{minimumFractionDigits:1})}%</span></div><div className="mt-2 h-1.5 rounded-full bg-slate-200/80">
                  <div
                    className={`h-1.5 rounded-full ${
                      ["A","E","I"].includes(c)
                        ? "bg-[#00A9E8]"
                        : ["B","F","J"].includes(c)
                          ? "bg-[#009C3B]"
                          : ["C","G","K"].includes(c)
                            ? "bg-[#F2C300]"
                            : "bg-[#003B8E]"
                    }`}
                    style={{width:`${x.percentual}%`}}
                  />
                </div><p className="mt-1 text-[8px] text-gray-400">{x.atingidos} atingiram · {x.pendentes} pendentes · {x.naoAplicaveis} ainda não aplicáveis</p></div>})}</div></section>
 <section className="mx-4 my-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#DDEAF2]"><div className="flex items-center justify-between"><div><h2 className="text-sm font-extrabold">Onde concentrar o acompanhamento</h2><p className="text-[9px] text-gray-400">Use os filtros para localizar rapidamente as gestantes/puérperas que precisam de atenção.</p></div><button onClick={()=>setMostrarFiltros(v=>!v)} className="flex items-center gap-2 rounded-xl bg-[#EAF7FC] px-3 py-2 text-[9px] font-bold text-[#003B8E]"><Filter size={14}/> Filtros</button></div>{mostrarFiltros&&<div className="mt-3 grid gap-2 md:grid-cols-3"><div className="relative md:col-span-3"><Search size={14} className="absolute left-3 top-2.5 text-gray-400"/><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar nome ou CPF" className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-[#00A9E8]"/></div><select value={micro} onChange={e=>setMicro(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-xs"><option value="todas">Todas as microáreas</option>{microareas.map(m=><option key={m} value={m}>Microárea {m}</option>)}</select><select value={classif} onChange={e=>setClassif(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-xs"><option value="todas">Todas as classificações</option>{["Ótimo","Bom","Suficiente","Regular"].map(x=><option key={x}>{x}</option>)}</select><select value={situacao} onChange={e=>setSituacao(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-xs"><option value="todas">Todas as situações</option><option value="pendentes">Com pendências</option><option value="em-dia">Sem pendências</option></select><select value={pratica} onChange={e=>setPratica(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-xs"><option value="todas">Todas as práticas</option>{codigos.map(c=><option key={c} value={c}>{c} — {nomes[c]}</option>)}</select><select value={fase} onChange={e=>setFase(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-xs"><option value="todas">Todas as fases</option><option>Gestação</option><option>Puerpério</option></select><button onClick={limpar} className="flex items-center justify-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-500"><X size={13}/> Limpar filtros</button></div>}</section>
 <section className="mx-4 mb-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#DDEAF2]"><h2 className="text-sm font-extrabold">Gestantes e puérperas</h2><p className="mb-3 text-[9px] text-gray-400">{filtrados.length} registro(s) exibido(s).</p><div className="space-y-2">{filtrados.map(p=>{const isOpen=aberto===p.id;return <article key={p.id} className="overflow-hidden rounded-xl border border-[#E7E2F2]"><button onClick={()=>setAberto(isOpen?null:p.id)} className="flex w-full items-center justify-between gap-3 p-3 text-left"><div className="min-w-0"><p className="truncate text-[10px] font-extrabold">{p.nome}</p><p className="text-[8px] text-gray-400">Microárea {p.microarea||"não informada"} · CPF {p.cpf||"não informado"} · {p.fase}{p.idadeGestacionalSemanas!==null?` · IG ${p.idadeGestacionalSemanas.toFixed(1)} sem`:""}</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-[#EAF7FC] px-2 py-1 text-[9px] font-bold text-[#003B8E]">{p.pontuacao.toLocaleString("pt-BR",{minimumFractionDigits:1})}%</span><span className="rounded-full bg-gray-50 px-2 py-1 text-[8px]">{p.classificacao}</span>{isOpen?<ChevronUp size={14}/>:<ChevronDown size={14}/>}</div></button>{isOpen&&<div className="grid gap-2 border-t border-[#E7E2F2] bg-[#F7FAFC] p-3 md:grid-cols-2">{p.praticas.map(x=><div key={x.codigo} className="rounded-xl bg-white p-3 ring-1 ring-[#DDEAF2]"><div className="flex items-center justify-between text-[9px] font-bold"><span>{x.codigo} — {x.titulo}</span><span className={x.status==="atingida"?"text-emerald-600":x.status==="nao_aplicavel"?"text-gray-400":"text-red-500"}>{x.status==="atingida"?"Atingida":x.status==="nao_aplicavel"?"Não aplicável":"Pendente"}</span></div><p className="mt-1 text-[8px] leading-relaxed text-gray-500">{x.detalhe}</p></div>)}</div>}</article>})}</div></section>
 </main>;
}
