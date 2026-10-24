import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { exigirDesenvolvedora, respostaErroDesenvolvedora } from "@/lib/desenvolvedor";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await exigirDesenvolvedora(request);
    const profissionalUid = new URL(request.url).searchParams.get("profissionalUid")?.trim() ?? "";
    if (!profissionalUid) return Response.json({ sucesso: false, mensagem: "Informe o profissional para consultar o histórico." }, { status: 400 });
    const snapshot = await adminDb.collection("pagamentosAssinaturasProfissionais").where("profissionalUid", "==", profissionalUid).get();
    const pagamentos = snapshot.docs.map((doc) => {
      const dados = doc.data();
      return { id: doc.id, valor: Number(dados.valor ?? 0), referencia: String(dados.referencia ?? ""), observacao: String(dados.observacao ?? ""), confirmadoPor: String(dados.confirmadoPor ?? ""), confirmadoEm: dados.confirmadoEm instanceof Timestamp ? dados.confirmadoEm.toDate().toISOString() : null };
    }).sort((a, b) => (b.confirmadoEm ?? "").localeCompare(a.confirmadoEm ?? "")).slice(0, 20);
    return Response.json({ sucesso: true, pagamentos });
  } catch (error) { return respostaErroDesenvolvedora(error); }
}

export async function POST(request: Request) {
  try {
    const autora = await exigirDesenvolvedora(request);
    const body = await request.json();
    const profissionalUid = typeof body.profissionalUid === "string" ? body.profissionalUid.trim() : "";
    const valor = Number(body.valor);
    const referencia = typeof body.referencia === "string" ? body.referencia.trim() : "";
    const observacao = typeof body.observacao === "string" ? body.observacao.trim().slice(0, 500) : "";
    if (!profissionalUid || !Number.isFinite(valor) || valor <= 0 || !/^\d{4}-\d{2}$/.test(referencia)) return Response.json({ sucesso: false, mensagem: "Informe profissional, valor pago e competência no formato AAAA-MM." }, { status: 400 });
    const usuarioSnap = await adminDb.collection("usuarios").doc(profissionalUid).get();
    if (!usuarioSnap.exists || usuarioSnap.data()?.perfil !== "enfermeira") return Response.json({ sucesso: false, mensagem: "Profissional não encontrada." }, { status: 404 });
    const ubsId = typeof usuarioSnap.data()?.ubsId === "string" ? usuarioSnap.data()?.ubsId : "";
    const assinaturaRef = adminDb.collection("assinaturasProfissionais").doc(profissionalUid);
    // ID determinístico: dois cliques ou duas requisições concorrentes não geram dois pagamentos para a mesma competência.
    const pagamentoRef = adminDb.collection("pagamentosAssinaturasProfissionais").doc(`${profissionalUid}_${referencia}`);
    await adminDb.runTransaction(async (tx) => {
      const pagamentosLegadosQuery = adminDb.collection("pagamentosAssinaturasProfissionais")
        .where("profissionalUid", "==", profissionalUid).where("referencia", "==", referencia);
      const [assinaturaSnap, pagamentoSnap, pagamentosLegadosSnap] = await Promise.all([
        tx.get(assinaturaRef), tx.get(pagamentoRef), tx.get(pagamentosLegadosQuery),
      ]);
      if (!assinaturaSnap.exists) throw new Error("ASSINATURA_NAO_CONFIGURADA");
      if (pagamentoSnap.exists || !pagamentosLegadosSnap.empty) throw new Error("COMPETENCIA_JA_PAGA");
      const assinatura = assinaturaSnap.data() ?? {};
      if (assinatura.statusManual === "cancelada") throw new Error("ASSINATURA_CANCELADA");
      const vencimento = assinatura.proximoVencimentoEm instanceof Timestamp ? assinatura.proximoVencimentoEm.toDate() : null;
      if (!vencimento) throw new Error("VENCIMENTO_AUSENTE");
      const competenciaVencimento = `${vencimento.getFullYear()}-${String(vencimento.getMonth()+1).padStart(2,"0")}`;
      if (referencia !== competenciaVencimento) throw new Error("COMPETENCIA_DIVERGENTE");
      tx.create(pagamentoRef, { profissionalUid, ubsId, valor, referencia, observacao, confirmadoManualmente: true, confirmadoPor: autora.uid, confirmadoEm: FieldValue.serverTimestamp() });
      // O pagamento NÃO gera a próxima mensalidade automaticamente.
      tx.set(assinaturaRef, { profissionalUid, ubsId, ultimaCompetenciaPaga: referencia, ultimoPagamentoEm: FieldValue.serverTimestamp(), statusManual: "normal", atualizadoEm: FieldValue.serverTimestamp(), atualizadoPor: autora.uid }, { merge: true });
      tx.create(adminDb.collection("auditoriaComercial").doc(), { acao: "pagamento_profissional_confirmado", profissionalUid, ubsId, valor, referencia, realizadoPor: autora.uid, realizadoEm: FieldValue.serverTimestamp() });
    });
    return Response.json({ sucesso: true, mensagem: "Pagamento registrado. A próxima mensalidade só será gerada quando você solicitar." });
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "";
    const mensagens: Record<string, string> = {
      ASSINATURA_NAO_CONFIGURADA: "Configure a assinatura do profissional antes de registrar o pagamento.",
      COMPETENCIA_JA_PAGA: "Esta competência já foi paga. Nenhum pagamento duplicado foi criado.",
      ASSINATURA_CANCELADA: "Esta assinatura está cancelada e não aceita novos pagamentos.",
      VENCIMENTO_AUSENTE: "A assinatura não possui vencimento configurado.",
      COMPETENCIA_DIVERGENTE: "A competência informada não corresponde à mensalidade atual.",
    };
    if (mensagens[mensagem]) return Response.json({ sucesso: false, mensagem: mensagens[mensagem] }, { status: 409 });
    return respostaErroDesenvolvedora(error);
  }
}
