/**
 * C3 — Cuidado na gestação e puerpério.
 *
 * Baseado na Nota Metodológica C3 do Ministério da Saúde.
 * Pesos oficiais: A 10 | B-K 9 = 100 pontos.
 *
 * Esta implementação é operacional a partir do relatório temático do e-SUS PEC.
 * O relatório não expõe todos os CBO/CNS/vínculos usados no SIAPS; portanto,
 * a tela deve identificar o resultado como cálculo operacional/preliminar.
 */

export type DadosPEC_Gestacao = Record<string, unknown>;
export type CodigoC3 = "A"|"B"|"C"|"D"|"E"|"F"|"G"|"H"|"I"|"J"|"K";
export type StatusPraticaC3 = "atingida"|"pendente"|"nao_aplicavel";

export type ResultadoPraticaC3 = {
  codigo: CodigoC3;
  titulo: string;
  pontos: number;
  atingida: boolean;
  status: StatusPraticaC3;
  detalhe: string;
};

export type ResultadoC3Gestacao = {
  elegivel: boolean;
  motivoElegibilidade: string;
  pontuacao: number;
  classificacao: "Ótimo"|"Bom"|"Suficiente"|"Regular";
  fase: "Gestação"|"Puerpério";
  idadeGestacionalSemanas: number|null;
  diasPuerperio: number|null;
  praticas: ResultadoPraticaC3[];
};

const pesos: Record<CodigoC3, number> = { A:10,B:9,C:9,D:9,E:9,F:9,G:9,H:9,I:9,J:9,K:9 };

function texto(d: DadosPEC_Gestacao, campo: string): string {
  const v=d[campo]; return v == null ? "" : String(v).trim();
}
function numero(d: DadosPEC_Gestacao, campo: string): number|null {
  const v=texto(d,campo); if(!v || v === "-") return null;
  const n=Number(v.replace(",",".")); return Number.isFinite(n)?n:null;
}
function dataISO(valor:string): Date|null {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const [a,m,d]=valor.split("-").map(Number); const x=new Date(a,m-1,d);
  return Number.isNaN(x.getTime())?null:x;
}
function dataBR(valor:string): Date|null {
  const m=valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if(!m)return null;
  const x=new Date(Number(m[3]),Number(m[2])-1,Number(m[1])); return Number.isNaN(x.getTime())?null:x;
}
function normalizar(v:string){return v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();}
function classificacao(p:number): ResultadoC3Gestacao["classificacao"] { return p>75?"Ótimo":p>50?"Bom":p>25?"Suficiente":"Regular"; }
function sim(v:string){return ["sim","true","1"].includes(normalizar(v));}
function quantidade(d:DadosPEC_Gestacao,campo:string, minimo:number){ const n=numero(d,campo)??0; return n>=minimo; }
function testePositivo(v: string): boolean {
  const n = normalizar(v);
  return Boolean(
    n &&
    n !== "nao" &&
    n !== "nao se aplica" &&
    n !== "-"
  );
}
export function avaliarC3Gestacao(d:DadosPEC_Gestacao, opcoes:{referencia?:Date;metadados?:{listaTematica?:string;grupoCondicoes?:string;filtroProblemas?:string}}={}):ResultadoC3Gestacao {
  const referencia=opcoes.referencia??new Date();
  const lista=normalizar(opcoes.metadados?.listaTematica??"");
  const grupo=normalizar(opcoes.metadados?.grupoCondicoes??"");
  const ativo=normalizar(opcoes.metadados?.filtroProblemas??"");
  const elegivel=lista.includes("gestacao") || grupo.includes("gestacao") || ativo.includes("todos") || ativo.includes("problemas ativos");
  const dum=dataISO(texto(d,"DUM"));
  const ig=numero(d,"IG (DUM) (semanas)");
  const diasIG=numero(d,"IG (DUM) (dias)")??0;
  const inicio= dataISO(texto(d,"DUM"));
  const maxFim=inicio?new Date(inicio.getTime()+294*86400000):null;
  const fim=maxFim;
  const diasPuerperio=fim ? Math.floor((referencia.getTime()-fim.getTime())/86400000) : null;
  const puerperio=diasPuerperio!==null && diasPuerperio>=0 && diasPuerperio<=42;
  const fase=puerperio?"Puerpério":"Gestação";
  const terceira=ig!==null && ig>=28;
  const pos20=ig!==null && ig>=20;
  const pratica=(codigo:CodigoC3,titulo:string,atingida:boolean,aplicavel:boolean,detalhe:string):ResultadoPraticaC3=>({codigo,titulo,pontos:atingida?pesos[codigo]:0,atingida,status:!aplicavel?"nao_aplicavel":atingida?"atingida":"pendente",detalhe});
  const praticas:ResultadoPraticaC3[]=[
    pratica("A","1ª consulta até 12 semanas",quantidade(d,"Quantidade de atendimentos até 12 semanas no pré-natal",1),true,quantidade(d,"Quantidade de atendimentos até 12 semanas no pré-natal",1)?"Há atendimento de pré-natal registrado até 12 semanas.":"Não há atendimento de pré-natal registrado até 12 semanas."),
    pratica("B","Pelo menos 7 consultas no pré-natal",quantidade(d,"Quantidade de atendimentos no pré-natal",7),true,`Consultas no pré-natal: ${numero(d,"Quantidade de atendimentos no pré-natal")??0}/7.`),
    pratica("C","Pelo menos 7 aferições de pressão arterial",quantidade(d,"Quantidade de medições de pressão arterial",7),true,`Medições de pressão: ${numero(d,"Quantidade de medições de pressão arterial")??0}/7.`),
    pratica("D","Pelo menos 7 registros simultâneos de peso e altura",quantidade(d,"Quantidade de medições simultâneas de peso e altura",7),true,`Medições simultâneas: ${numero(d,"Quantidade de medições simultâneas de peso e altura")??0}/7.`),
    pratica("E","3 visitas domiciliares após a primeira consulta",quantidade(d,"Quantidade de visitas domiciliares no pré-natal",3),true,`Visitas no pré-natal: ${numero(d,"Quantidade de visitas domiciliares no pré-natal")??0}/3.`),
    pratica("F","dTpa a partir da 20ª semana",testePositivo(texto(d,"dTpa")),pos20,pos20?(testePositivo(texto(d,"dTpa"))?"dTpa registrada.":"dTpa não identificada no relatório."):"Ainda não atingiu 20 semanas; prática ainda não aplicável."),
    pratica("G","Exames de sífilis, HIV e hepatites B e C no 1º trimestre",["Exame de HIV no primeiro trimestre","Exame de Sífilis no primeiro trimestre)","Exame de Hepatite B no primeiro trimestre","Exame de Hepatite C no primeiro trimestre"].every(c=>testePositivo(texto(d,c))),true,"São necessários registros positivos dos quatro exames/testes do 1º trimestre."),
    pratica("H","Exames de sífilis e HIV no 3º trimestre",testePositivo(texto(d,"Exame de HIV no terceiro trimestre"))&&testePositivo(texto(d,"Exame de Sifilis no terceiro trimestre")),terceira||puerperio,terceira||puerperio?(testePositivo(texto(d,"Exame de HIV no terceiro trimestre"))&&testePositivo(texto(d,"Exame de Sifilis no terceiro trimestre"))?"Exames do 3º trimestre registrados.":"Exames do 3º trimestre incompletos ou ausentes."):"Ainda não atingiu 28 semanas; prática ainda não aplicável."),
    pratica("I","Consulta médica/enfermagem no puerpério",(numero(d,"Quantidade de atendimentos no puerpério")??0)>=1,puerperio||fase==="Puerpério",puerperio||fase==="Puerpério"?(numero(d,"Quantidade de atendimentos no puerpério")??0)>=1?"Consulta puerperal registrada.":"Consulta puerperal não registrada.":"Puerpério ainda não iniciado."),
    pratica("J","Visita domiciliar no puerpério",(numero(d,"Quantidade de visitas domiciliares no puerpério")??0)>=1,puerperio,puerperio?(numero(d,"Quantidade de visitas domiciliares no puerpério")??0)>=1?"Visita puerperal registrada.":"Visita puerperal não registrada.":"Puerpério ainda não iniciado."),
    pratica("K","Atividade em saúde bucal durante a gestação",(numero(d,"Quantidade de atendimentos odontológicos no pré-natal")??0)>=1,true,`Atendimentos odontológicos no pré-natal: ${numero(d,"Quantidade de atendimentos odontológicos no pré-natal")??0}.`),
  ];
  const pontuacao=praticas.reduce((s,p)=>s+p.pontos,0);
  return {elegivel,motivoElegibilidade:elegivel?"Registro proveniente do relatório temático de Gestação e puerpério do PEC.":"Registro sem evidência suficiente de gestação/puerpério.",pontuacao,classificacao:classificacao(pontuacao),fase,idadeGestacionalSemanas:ig!==null?ig+diasIG/7:null,diasPuerperio,praticas};
}
