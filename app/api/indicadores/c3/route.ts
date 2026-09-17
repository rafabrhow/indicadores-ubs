import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { avaliarC3Gestacao, type ResultadoC3Gestacao, type CodigoC3 } from "@/lib/indicadores/c3-gestacao";

export const runtime = "nodejs";
type Documento = FirebaseFirestore.DocumentData;

function dataReferencia(valor: unknown, fallback: Date) {
  const t=typeof valor === "string" ? valor : "";
  const m=t.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if(!m) return fallback;
  const d=new Date(Number(m[3]),Number(m[2])-1,Number(m[1]));
  return Number.isNaN(d.getTime())?fallback:d;
}
function base(r:Documento){return r.dadosBase && typeof r.dadosBase === "object" ? r.dadosBase : {};}
function nome(r:Documento){return typeof base(r).Nome === "string" ? base(r).Nome : "Paciente sem nome";}
function cpf(r:Documento){return typeof base(r).CPF === "string" ? base(r).CPF : "";}
function microarea(r:Documento){return String(r.microareaId ?? base(r).Microárea ?? "").replace(/^"+|"+$/g,"").trim();}

export async function GET(request:Request){
 try{
  const authHeader=request.headers.get("authorization");
  if(!authHeader?.startsWith("Bearer ")) return NextResponse.json({sucesso:false,mensagem:"Sessão não autenticada."},{status:401});
  const decoded=await adminAuth.verifyIdToken(authHeader.slice(7).trim());
  const usuarioSnap=await adminDb.collection("usuarios").doc(decoded.uid).get();
  if(!usuarioSnap.exists) return NextResponse.json({sucesso:false,mensagem:"Usuário não encontrado."},{status:403});
  const usuario=usuarioSnap.data();
  if(usuario?.perfil!=="enfermeira" || usuario?.ativo!==true || typeof usuario?.ubsId!=="string") return NextResponse.json({sucesso:false,mensagem:"Somente a enfermeira ativa pode consultar o C3."},{status:403});

  const ubsRef=adminDb.collection("ubs").doc(usuario.ubsId);
  const imports=await ubsRef.collection("importacoesPEC").get();
  const norm=(v:unknown)=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const candidatas=imports.docs.map(doc=>({id:doc.id,...doc.data()} as Documento & {id:string})).filter(i=>{
    const lista=norm(i.listaTematica), grupo=norm(i.grupoCondicoes);
    return lista.includes("gestacao") || lista.includes("gestacao e puerperio") || grupo.includes("gestacao");
  }).sort((a,b)=>(b.criadoEm?.toMillis?.()??0)-(a.criadoEm?.toMillis?.()??0));
  const importacao=candidatas[0];
  if(!importacao) return NextResponse.json({sucesso:true,possuiDados:false,mensagem:"Ainda não existe uma importação de Gestação e puerpério para calcular o C3."});

  const registros=await ubsRef.collection("importacoesPEC").doc(importacao.id).collection("registros").get();
  const referencia=dataReferencia(importacao.geradoEm,importacao.criadoEm?.toDate?.()??new Date());
  const pacientes=registros.docs.map(doc=>{
    const r=doc.data();
    const resultado:ResultadoC3Gestacao=avaliarC3Gestacao(r.dadosEspecificos??{}, {referencia,metadados:{listaTematica:importacao.listaTematica,grupoCondicoes:importacao.grupoCondicoes,filtroProblemas:importacao.filtroProblemas}});
    return {id:doc.id,nome:nome(r),cpf:cpf(r),microarea:microarea(r),...resultado};
  });
  const elegiveis=pacientes.filter(p=>p.elegivel);
  const codigos:CodigoC3[]=["A","B","C","D","E","F","G","H","I","J","K"];
  const praticas=Object.fromEntries(codigos.map(c=>{
    const atingidos=elegiveis.filter(p=>p.praticas.some(x=>x.codigo===c&&x.atingida)).length;
    const pendentes=elegiveis.filter(p=>p.praticas.some(x=>x.codigo===c&&x.status==="pendente")).length;
    const naoAplicaveis=elegiveis.filter(p=>p.praticas.some(x=>x.codigo===c&&x.status==="nao_aplicavel")).length;
    return [c,{atingidos,pendentes,naoAplicaveis,percentual:elegiveis.length?Number((atingidos/elegiveis.length*100).toFixed(1)):0}];
  }));
  const pontuacao=elegiveis.length?Number((elegiveis.reduce((s,p)=>s+p.pontuacao,0)/elegiveis.length).toFixed(1)):0;
  const classificacao=pontuacao>75?"Ótimo":pontuacao>50?"Bom":pontuacao>25?"Suficiente":"Regular";
  return NextResponse.json({sucesso:true,possuiDados:true,importacao:{id:importacao.id,arquivoNome:importacao.arquivoNome??"Relatório do PEC",listaTematica:importacao.listaTematica??"",grupoCondicoes:importacao.grupoCondicoes??"",filtroProblemas:importacao.filtroProblemas??"",geradoEm:importacao.geradoEm??"",quantidadeRegistros:importacao.quantidadeRegistros??registros.size},referencia:referencia.toISOString(),resumo:{totalRegistros:pacientes.length,totalElegiveis:elegiveis.length,pontuacao,classificacao,praticas},pacientes});
 }catch(error){
  console.error("Erro ao calcular C3:",error);
  return NextResponse.json({sucesso:false,mensagem:"Não foi possível calcular o C3."},{status:500});
 }
}
