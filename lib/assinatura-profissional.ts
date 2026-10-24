import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";

export type ResultadoAssinatura = { permitido: true; status: "ativa" | "em_tolerancia" } | { permitido: false; status: string; mensagem: string };

function dataISO(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  if (value instanceof Date) return value.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return null;
}

export async function verificarAssinaturaProfissional(uid: string): Promise<ResultadoAssinatura> {
  const snap = await adminDb.collection("assinaturasProfissionais").doc(uid).get();
  if (!snap.exists) return { permitido: false, status: "sem_assinatura", mensagem: "Este perfil ainda não possui uma assinatura configurada. Entre em contato com o administrador do sistema." };
  const assinatura = snap.data() ?? {};
  if (assinatura.statusManual === "cancelada" || assinatura.statusManual === "suspensa_manual") {
    return { permitido: false, status: String(assinatura.statusManual), mensagem: "O acesso deste perfil está suspenso. Entre em contato com o suporte para regularizar a assinatura." };
  }
  const vencimento = dataISO(assinatura.proximoVencimentoEm);
  if (!vencimento) return { permitido: false, status: "pendente_configuracao", mensagem: "A assinatura deste perfil ainda não possui vencimento configurado." };
  const hojeTexto = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const hoje = new Date(`${hojeTexto}T00:00:00Z`);
  const venceEm = new Date(`${vencimento}T00:00:00Z`);
  if (hoje < venceEm) return { permitido: true, status: "ativa" };
  const limite = new Date(venceEm);
  limite.setUTCDate(limite.getUTCDate() + Math.max(0, Number(assinatura.diasTolerancia ?? 5)));
  if (hoje <= limite) return { permitido: true, status: "em_tolerancia" };
  return { permitido: false, status: "suspensa_por_atraso", mensagem: "A assinatura deste perfil está vencida e o prazo de tolerância terminou. Regularize o pagamento para recuperar o acesso." };
}

export function respostaAssinaturaNegada(resultado: Exclude<ResultadoAssinatura, { permitido: true }>) {
  return Response.json({ sucesso: false, codigo: "ASSINATURA_PROFISSIONAL_INATIVA", statusAssinatura: resultado.status, mensagem: resultado.mensagem }, { status: 403 });
}
