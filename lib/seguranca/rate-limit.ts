import "server-only";

import { createHash } from "crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase-admin";

const JANELA_MS = 15 * 60 * 1000;
const MAX_TENTATIVAS = 10;

interface RegistroRateLimit {
  inicio: Timestamp;
  tentativas: number;
}

export interface ResultadoRateLimit {
  permitido: boolean;
  tentativasRestantes: number;
  retryAfterSeconds: number;
}

function gerarIdSeguro(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

/**
 * Controla tentativas de login do ACS por endereço IP.
 *
 * O endereço IP não é armazenado em texto puro. Apenas um hash SHA-256
 * é usado como identificador do documento no Firestore.
 */
export async function verificarLimiteLoginAcs(
  ip: string
): Promise<ResultadoRateLimit> {
  const ipNormalizado = ip.trim();

  if (!ipNormalizado) {
    return {
      permitido: true,
      tentativasRestantes: MAX_TENTATIVAS,
      retryAfterSeconds: 0,
    };
  }

  const id = gerarIdSeguro(ipNormalizado);
  const referencia = adminDb
    .collection("seguranca")
    .doc("rateLimitLoginAcs")
    .collection("enderecos")
    .doc(id);

  const agora = Date.now();

  return adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(referencia);

    if (!snapshot.exists) {
      transaction.set(referencia, {
        inicio: FieldValue.serverTimestamp(),
        tentativas: 1,
      });

      return {
        permitido: true,
        tentativasRestantes: MAX_TENTATIVAS - 1,
        retryAfterSeconds: 0,
      };
    }

    const dados = snapshot.data() as Partial<RegistroRateLimit>;
    const inicio = dados.inicio?.toMillis() ?? agora;
    const tentativas =
      typeof dados.tentativas === "number" ? dados.tentativas : 0;

    if (agora - inicio >= JANELA_MS) {
      transaction.set(referencia, {
        inicio: Timestamp.fromMillis(agora),
        tentativas: 1,
      });

      return {
        permitido: true,
        tentativasRestantes: MAX_TENTATIVAS - 1,
        retryAfterSeconds: 0,
      };
    }

    if (tentativas >= MAX_TENTATIVAS) {
      const restanteMs = JANELA_MS - (agora - inicio);

      return {
        permitido: false,
        tentativasRestantes: 0,
        retryAfterSeconds: Math.max(1, Math.ceil(restanteMs / 1000)),
      };
    }

    transaction.update(referencia, {
      tentativas: FieldValue.increment(1),
    });

    return {
      permitido: true,
      tentativasRestantes: MAX_TENTATIVAS - tentativas - 1,
      retryAfterSeconds: 0,
    };
  });
}
