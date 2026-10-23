import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
export const runtime = "nodejs";
function texto(v: unknown): string { return typeof v === "string" ? v.trim() : ""; }
function norm(v: string): string { return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR"); }
type Usuario = { uid: string; perfil?: unknown; nome?: unknown; email?: unknown; ativo?: unknown; ubsId?: unknown; municipio?: unknown; uf?: unknown; ultimoUbsId?: unknown; };
async function autenticar(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return { erro: NextResponse.json({ sucesso:false, mensagem:"Sessão não autenticada." }, {status:401}) } as const;
  const decoded = await adminAuth.verifyIdToken(auth.slice(7).trim());
  const snap = await adminDb.collection("usuarios").doc(decoded.uid).get();
  const d = snap.data(); const municipio = texto(d?.municipio); const uf = texto(d?.uf).toUpperCase();
  if (!snap.exists || d?.perfil !== "administrador_municipal" || d?.ativo !== true || !municipio || !/^[A-Z]{2}$/.test(uf)) return { erro: NextResponse.json({ sucesso:false, mensagem:"Somente administradores municipais ativos podem gerenciar profissionais." }, {status:403}) } as const;
  return { decoded, municipio, uf } as const;
}
async function validarUBS(ubsId: string, municipio: string, uf: string) {
  const ref=adminDb.collection("ubs").doc(ubsId); const snap=await ref.get();
  if (!snap.exists) return { erro: NextResponse.json({sucesso:false,mensagem:"UBS não encontrada."},{status:404}) } as const;
  const d=snap.data();
  if (d?.ativo !== true || norm(texto(d?.municipio)) !== norm(municipio) || texto(d?.uf).toUpperCase() !== uf) return {erro:NextResponse.json({sucesso:false,mensagem:"A UBS não pertence ao município autorizado ou está inativa."},{status:403})} as const;
  return {ref, ubs:d} as const;
}
/** Lista enfermeiras vinculadas a uma UBS ou todas as profissionais do município. */
export async function GET(request: Request) {
 try {
  const a=await autenticar(request); if("erro" in a) return a.erro;
  const url=new URL(request.url); const ubsId=texto(url.searchParams.get("ubsId")); const listarTodos=url.searchParams.get("listarTodos")==="1";
  if (ubsId) {
   const valid=await validarUBS(ubsId,a.municipio,a.uf); if("erro" in valid) return valid.erro;
   const snap=await adminDb.collection("usuarios").where("ubsId","==",ubsId).get();
   const enfermeiras=snap.docs.map(doc=>({...doc.data(),uid:doc.id} as Usuario)).filter(u=>u.perfil==="enfermeira"&&u.ativo===true).map(u=>({uid:u.uid,nome:texto(u.nome),email:texto(u.email),ubsId})).sort((x,y)=>x.nome.localeCompare(y.nome,"pt-BR"));
   return NextResponse.json({sucesso:true,enfermeiras});
  }
  if (!listarTodos) return NextResponse.json({sucesso:false,mensagem:"Informe ubsId ou listarTodos=1."},{status:400});
  // Busca vinculados pelas UBS do município e profissionais sem UBS pelo campo municipio.
  const ubsSnap=await adminDb.collection("ubs").where("municipio","==",a.municipio).get();
  const ubsDocs=ubsSnap.docs.filter(d=>texto(d.data()?.uf).toUpperCase()===a.uf);
  const porUid=new Map<string, Usuario>();
  const vinculados=await Promise.all(ubsDocs.map(d=>adminDb.collection("usuarios").where("ubsId","==",d.id).get()));
  for(const snap of vinculados) for(const doc of snap.docs){const u={...doc.data(),uid:doc.id} as Usuario;if(u.perfil==="enfermeira") porUid.set(u.uid,u);}
  const semVinculoSnap=await adminDb.collection("usuarios").where("municipio","==",a.municipio).get();
  for(const doc of semVinculoSnap.docs){const u={...doc.data(),uid:doc.id} as Usuario;if(u.perfil==="enfermeira"&&texto(u.uf).toUpperCase()===a.uf) porUid.set(u.uid,u);}
  const ubsNome=new Map(ubsDocs.map(d=>[d.id,texto(d.data()?.nome)]));
  const profissionais=[...porUid.values()].filter(u=>u.perfil==="enfermeira").map(u=>({uid:u.uid,nome:texto(u.nome),email:texto(u.email),ativo:u.ativo===true,ubsId:texto(u.ubsId),ubsNome:ubsNome.get(texto(u.ubsId))||"",municipio:a.municipio,uf:a.uf})).sort((x,y)=>x.nome.localeCompare(y.nome,"pt-BR"));
  return NextResponse.json({sucesso:true,profissionais});
 } catch(error) { console.error("Erro ao consultar profissionais:",error); return NextResponse.json({sucesso:false,mensagem:"Não foi possível consultar os profissionais."},{status:500}); }
}
/** Cadastra uma profissional sem vínculo com UBS. */
export async function POST(request: Request) {
 let uidCriado:string|null=null;
 try {
  const a=await autenticar(request); if("erro" in a) return a.erro;
  const body=await request.json().catch(()=>null); const nome=texto(body?.nome); const email=texto(body?.email).toLowerCase();
  if(!nome||nome.length>160) return NextResponse.json({sucesso:false,mensagem:"Informe o nome completo (até 160 caracteres)."},{status:400});
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254) return NextResponse.json({sucesso:false,mensagem:"Informe um e-mail válido."},{status:400});
  const conta=await adminAuth.createUser({email,displayName:nome,emailVerified:false,disabled:false}); uidCriado=conta.uid;
  await adminDb.collection("usuarios").doc(conta.uid).create({uid:conta.uid,nome,email,perfil:"enfermeira",ativo:true,municipio:a.municipio,uf:a.uf,criadoEm:FieldValue.serverTimestamp(),criadoPor:a.decoded.uid,primeiroAcesso:true,ubsId:null});
  return NextResponse.json({sucesso:true,mensagem:"Profissional cadastrada sem vínculo com UBS.",enfermeira:{uid:conta.uid,nome,email,ubsId:"",ubsNome:""}},{status:201});
 } catch(error:unknown) {
  console.error("Erro ao cadastrar profissional:",error);
  if(uidCriado){try{await adminDb.collection("usuarios").doc(uidCriado).delete();}catch(e){console.error("Falha ao limpar documento parcial",e)}try{await adminAuth.deleteUser(uidCriado);}catch(e){console.error("Falha ao limpar conta parcial",e)}}
  const code=typeof error==="object"&&error!==null&&"code" in error?String((error as {code?:unknown}).code):"";
  if(code==="auth/email-already-exists") return NextResponse.json({sucesso:false,mensagem:"Já existe uma conta no Firebase Authentication com esse e-mail."},{status:409});
  return NextResponse.json({sucesso:false,mensagem:"Não foi possível cadastrar a profissional."},{status:500});
 }
}
/** Gerencia vínculo, edição e ativação/desativação, sem alterar dados assistenciais. */
export async function PATCH(request: Request) {
 try {
  const a=await autenticar(request); if("erro" in a) return a.erro;
  const body=await request.json().catch(()=>null); const acao=texto(body?.acao); const uid=texto(body?.uid);
  if(!uid) return NextResponse.json({sucesso:false,mensagem:"Profissional não informada."},{status:400});
  const ref=adminDb.collection("usuarios").doc(uid); const snap=await ref.get();
  if(!snap.exists) return NextResponse.json({sucesso:false,mensagem:"Profissional não encontrada."},{status:404});
  const p={...snap.data(),uid} as Usuario;
  if(p.perfil!=="enfermeira") return NextResponse.json({sucesso:false,mensagem:"O usuário informado não é uma enfermeira."},{status:409});
  // Autoriza por vínculo com UBS do município ou pelos campos de município registrados no cadastro.
  let pertence=norm(texto(p.municipio))===norm(a.municipio)&&texto(p.uf).toUpperCase()===a.uf;
  const vinculoAtual=texto(p.ubsId);
  if(vinculoAtual){const u=await adminDb.collection("ubs").doc(vinculoAtual).get();const d=u.data();pertence=pertence||(u.exists&&norm(texto(d?.municipio))===norm(a.municipio)&&texto(d?.uf).toUpperCase()===a.uf);}
  if(!pertence) return NextResponse.json({sucesso:false,mensagem:"A profissional não pertence ao município autorizado."},{status:403});
  if(acao==="status"){
   const ativo=body?.ativo===true;
   if(ativo=== (p.ativo===true)) return NextResponse.json({sucesso:true,mensagem:"A situação já está atualizada."});
   if(!ativo){
    await adminAuth.updateUser(uid,{disabled:true});
    await ref.update({ativo:false,municipio:a.municipio,uf:a.uf,ultimoUbsId:vinculoAtual||texto(p.ultimoUbsId)||null,ubsId:null,desativadoEm:FieldValue.serverTimestamp(),desativadoPor:a.decoded.uid});
   } else {
    // Reativar somente sem vínculo; evita reativar acesso assistencial sem atribuição explícita.
    await adminAuth.updateUser(uid,{disabled:false});
    await ref.update({ativo:true,ubsId:null,reativadoEm:FieldValue.serverTimestamp(),reativadoPor:a.decoded.uid});
   }
   return NextResponse.json({sucesso:true,mensagem:ativo?"Profissional reativada sem vínculo com UBS.":"Profissional desativada. O vínculo foi encerrado e o histórico preservado."});
  }
  if(acao==="editar"){
   const nome=texto(body?.nome); const email=texto(body?.email).toLowerCase();
   if(!nome||nome.length>160||!/^\S+@\S+\.\S+$/.test(email)||email.length>254) return NextResponse.json({sucesso:false,mensagem:"Informe nome e e-mail válidos."},{status:400});
   await adminAuth.updateUser(uid,{displayName:nome,email});
   await ref.update({nome,email,atualizadoEm:FieldValue.serverTimestamp(),atualizadoPor:a.decoded.uid});
   return NextResponse.json({sucesso:true,mensagem:"Dados da profissional atualizados."});
  }
  if(acao==="vincular"){
   const ubsId=texto(body?.ubsId); const anteriorUid=texto(body?.anteriorUid);
   if(!ubsId) return NextResponse.json({sucesso:false,mensagem:"Selecione a UBS."},{status:400});
   const valid=await validarUBS(ubsId,a.municipio,a.uf);if("erro" in valid)return valid.erro;
   if(p.ativo!==true||vinculoAtual) return NextResponse.json({sucesso:false,mensagem:"Selecione uma profissional ativa e ainda sem vínculo com UBS."},{status:409});
   let anteriorRef:FirebaseFirestore.DocumentReference|undefined; let anteriorSnap:FirebaseFirestore.DocumentSnapshot|undefined;
   if(anteriorUid){anteriorRef=adminDb.collection("usuarios").doc(anteriorUid);anteriorSnap=await anteriorRef.get();const ant=anteriorSnap.data();if(!anteriorSnap.exists||ant?.perfil!=="enfermeira"||ant?.ativo!==true||texto(ant?.ubsId)!==ubsId)return NextResponse.json({sucesso:false,mensagem:"A responsável atual não é válida para esta UBS."},{status:409});}
   // Primeiro grava o vínculo da nova profissional; em seguida desativa a anterior. Se a desativação falhar, retorna erro para conferência administrativa.
   await ref.update({ubsId,municipio:a.municipio,uf:a.uf,vinculadoEm:FieldValue.serverTimestamp(),vinculadoPor:a.decoded.uid,ultimoUbsId:FieldValue.delete()});
   if(anteriorRef&&anteriorSnap){await adminAuth.updateUser(anteriorUid,{disabled:true});await anteriorRef.update({ativo:false,municipio:a.municipio,uf:a.uf,ubsId:null,ultimoUbsId:ubsId,desativadoEm:FieldValue.serverTimestamp(),desativadoPor:a.decoded.uid,substituidaPorUid:uid,motivoDesativacao:"substituicao_responsavel_ubs"});}
   return NextResponse.json({sucesso:true,mensagem:"Responsável da UBS atualizada. Os dados assistenciais e o histórico foram preservados."});
  }
  return NextResponse.json({sucesso:false,mensagem:"Ação de gerenciamento inválida."},{status:400});
 } catch(error:unknown) {
  console.error("Erro ao gerenciar profissional:",error);
  const code=typeof error==="object"&&error!==null&&"code" in error?String((error as {code?:unknown}).code):"";
  if(code==="auth/email-already-exists") return NextResponse.json({sucesso:false,mensagem:"Já existe uma conta com esse e-mail."},{status:409});
  return NextResponse.json({sucesso:false,mensagem:"Não foi possível concluir a operação. Confira a situação da conta e tente novamente."},{status:500});
 }
}
