import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { exigirDesenvolvedora, respostaErroDesenvolvedora } from "@/lib/desenvolvedor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dataISO(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  if (value instanceof Date) return value.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return null;
}

function statusCalculado(statusManual: string, vencimento: string | null, ultimaCompetenciaPaga: string) {
  if (statusManual === "cancelada") return "cancelada";
  if (statusManual === "suspensa_manual") return "suspensa_manual";
  if (!vencimento) return "pendente_configuracao";

  // O pagamento da competência atual deve prevalecer sobre o vencimento passado.
  const competenciaVencimento = vencimento.slice(0, 7);
  if (ultimaCompetenciaPaga && ultimaCompetenciaPaga === competenciaVencimento) return "recebido";

  const hojeTexto = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const hoje = new Date(`${hojeTexto}T00:00:00Z`);
  const vencimentoData = new Date(`${vencimento}T00:00:00Z`);
  const limite = new Date(vencimentoData);
  limite.setUTCDate(limite.getUTCDate() + 5);

  // A mensalidade fica pendente no mês do vencimento, antes de entrar em tolerância.
  if (hoje < vencimentoData) return hojeTexto.slice(0, 7) === competenciaVencimento ? "pendente" : "ativa";
  if (hoje <= limite) return "em_tolerancia";
  return "suspensa_por_atraso";
}

export async function GET(request: Request) {
  try {
    await exigirDesenvolvedora(request);
    const [usuariosSnap, ubsSnap, assinaturasSnap] = await Promise.all([
      adminDb.collection("usuarios").where("perfil", "==", "enfermeira").get(),
      adminDb.collection("ubs").get(),
      adminDb.collection("assinaturasProfissionais").get(),
    ]);
    const ubsMap = new Map(ubsSnap.docs.map((doc) => [doc.id, doc.data()]));
    const assinaturas = new Map(assinaturasSnap.docs.map((doc) => [doc.id, doc.data()]));
    const profissionais = usuariosSnap.docs.map((doc) => {
      const usuario = doc.data();
      const ubsId = typeof usuario.ubsId === "string" ? usuario.ubsId : "";
      const ubs = ubsMap.get(ubsId) ?? {};
      const assinatura = assinaturas.get(doc.id) ?? {};
      const vencimento = dataISO(assinatura.proximoVencimentoEm);
      return {
        profissionalUid: doc.id,
        nome: String(usuario.nome ?? usuario.email ?? doc.id),
        email: String(usuario.email ?? ""),
        ativo: usuario.ativo === true,
        ubsId,
        ubsNome: String(ubs.nome ?? (ubsId ? ubsId : "Sem UBS vinculada")),
        municipio: String(ubs.municipio ?? usuario.municipio ?? ""),
        uf: String(ubs.uf ?? usuario.uf ?? ""),
        valorMensal: Number(assinatura.valorMensal ?? 0),
        proximoVencimentoEm: vencimento,
        ultimoPagamentoEm: dataISO(assinatura.ultimoPagamentoEm),
        ultimaCompetenciaPaga: String(assinatura.ultimaCompetenciaPaga ?? ""),
        status: statusCalculado(String(assinatura.statusManual ?? ""), vencimento, String(assinatura.ultimaCompetenciaPaga ?? "")),
        observacao: String(assinatura.observacao ?? ""),
      };
    }).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return Response.json({ sucesso: true, profissionais });
  } catch (error) { return respostaErroDesenvolvedora(error); }
}

export async function PUT(request: Request) {
  try {
    const autora = await exigirDesenvolvedora(request);
    const body = await request.json();
    const profissionalUid = typeof body.profissionalUid === "string" ? body.profissionalUid.trim() : "";
    const acao = typeof body.acao === "string" ? body.acao : "configurar";
    if (!profissionalUid) return Response.json({ sucesso: false, mensagem: "Informe o profissional." }, { status: 400 });

    const usuarioRef = adminDb.collection("usuarios").doc(profissionalUid);
    const usuarioSnap = await usuarioRef.get();
    if (!usuarioSnap.exists || usuarioSnap.data()?.perfil !== "enfermeira") return Response.json({ sucesso: false, mensagem: "Profissional não encontrada." }, { status: 404 });
    const ubsId = typeof usuarioSnap.data()?.ubsId === "string" ? usuarioSnap.data()?.ubsId : "";
    const assinaturaRef = adminDb.collection("assinaturasProfissionais").doc(profissionalUid);

    if (acao === "cancelar") {
      await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(assinaturaRef);
        if (!snap.exists) throw new Error("ASSINATURA_NAO_EXISTE");
        if (snap.data()?.statusManual === "cancelada") return;
        tx.set(assinaturaRef, { statusManual: "cancelada", canceladaEm: FieldValue.serverTimestamp(), canceladaPor: autora.uid, atualizadoEm: FieldValue.serverTimestamp(), atualizadoPor: autora.uid }, { merge: true });
        tx.create(adminDb.collection("auditoriaComercial").doc(), { acao: "assinatura_profissional_cancelada", profissionalUid, ubsId, realizadoPor: autora.uid, realizadoEm: FieldValue.serverTimestamp() });
      });
      return Response.json({ sucesso: true, mensagem: "Assinatura cancelada. O histórico e os dados foram preservados." });
    }

    if (acao === "gerar_proxima_mensalidade") {
      await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(assinaturaRef);
        if (!snap.exists) throw new Error("ASSINATURA_NAO_EXISTE");
        const dados = snap.data() ?? {};
        if (dados.statusManual === "cancelada") throw new Error("ASSINATURA_CANCELADA");
        const vencimentoAtual = dados.proximoVencimentoEm instanceof Timestamp ? dados.proximoVencimentoEm.toDate() : null;
        if (!vencimentoAtual) throw new Error("VENCIMENTO_AUSENTE");
        const competenciaAtual = `${vencimentoAtual.getFullYear()}-${String(vencimentoAtual.getMonth()+1).padStart(2,"0")}`;
        if (String(dados.ultimaCompetenciaPaga ?? "") !== competenciaAtual) throw new Error("PAGAMENTO_PENDENTE");
        const proximoVencimento = new Date(vencimentoAtual);
        proximoVencimento.setMonth(proximoVencimento.getMonth() + 1);
        tx.set(assinaturaRef, { proximoVencimentoEm: Timestamp.fromDate(proximoVencimento), statusManual: "normal", atualizadoEm: FieldValue.serverTimestamp(), atualizadoPor: autora.uid }, { merge: true });
        tx.create(adminDb.collection("auditoriaComercial").doc(), { acao: "proxima_mensalidade_gerada", profissionalUid, ubsId, competenciaAnterior: competenciaAtual, proximoVencimentoEm: proximoVencimento.toISOString(), realizadoPor: autora.uid, realizadoEm: FieldValue.serverTimestamp() });
      });
      return Response.json({ sucesso: true, mensagem: "Próxima mensalidade gerada manualmente." });
    }

    const valorMensal = Number(body.valorMensal);
    const vencimento = typeof body.proximoVencimentoEm === "string" ? body.proximoVencimentoEm : "";
    const observacao = typeof body.observacao === "string" ? body.observacao.trim().slice(0, 500) : "";
    if (!Number.isFinite(valorMensal) || valorMensal <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(vencimento)) {
      return Response.json({ sucesso: false, mensagem: "Informe um valor mensal maior que zero e uma data de vencimento válida." }, { status: 400 });
    }
    const novoVencimento = Timestamp.fromDate(new Date(`${vencimento}T12:00:00-03:00`));
    const resultado = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(assinaturaRef);
      if (snap.exists) {
        const atual = snap.data() ?? {};
        const vencimentoAtual = dataISO(atual.proximoVencimentoEm);
        if (atual.statusManual === "cancelada") throw new Error("ASSINATURA_CANCELADA");
        if (vencimentoAtual === vencimento && Number(atual.valorMensal) === valorMensal && String(atual.observacao ?? "") === observacao) return "inalterada";
        throw new Error("ASSINATURA_JA_CONFIGURADA");
      }
      tx.create(assinaturaRef, { profissionalUid, ubsId, valorMensal, proximoVencimentoEm: novoVencimento, diasTolerancia: 5, observacao, statusManual: "normal", criadoEm: FieldValue.serverTimestamp(), atualizadoEm: FieldValue.serverTimestamp(), atualizadoPor: autora.uid });
      tx.create(adminDb.collection("auditoriaComercial").doc(), { acao: "configuracao_assinatura_profissional", profissionalUid, ubsId, valorMensal, proximoVencimentoEm: vencimento, realizadoPor: autora.uid, realizadoEm: FieldValue.serverTimestamp() });
      return "criada";
    });
    return Response.json({ sucesso: true, mensagem: resultado === "inalterada" ? "Esta configuração já estava salva; nenhum registro duplicado foi criado." : "Configuração da assinatura profissional salva." });
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "";
    const mensagens: Record<string, string> = {
      ASSINATURA_NAO_EXISTE: "Não existe assinatura para este profissional.",
      ASSINATURA_JA_CONFIGURADA: "A assinatura já está configurada. Para gerar a próxima mensalidade, confirme o pagamento atual e use a opção de geração manual.",
      ASSINATURA_CANCELADA: "Esta assinatura está cancelada.",
      PAGAMENTO_PENDENTE: "Confirme o pagamento da mensalidade atual antes de gerar a próxima.",
      VENCIMENTO_AUSENTE: "A assinatura não possui vencimento configurado.",
    };
    if (mensagens[mensagem]) return Response.json({ sucesso: false, mensagem: mensagens[mensagem] }, { status: 409 });
    return respostaErroDesenvolvedora(error);
  }
}
