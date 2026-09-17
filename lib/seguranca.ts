import "server-only";

import {
  randomBytes,
  randomInt,
  scrypt,
  timingSafeEqual,
} from "crypto";

import { promisify } from "util";

const scryptAsync = promisify(scrypt);

/**
 * Gera uma senha provisória numérica de 6 dígitos.
 *
 * Usamos crypto.randomInt em vez de Math.random()
 * porque estamos tratando de uma credencial de acesso.
 */
export function gerarSenhaProvisoria(): string {
  return randomInt(100000, 1000000).toString();
}

/**
 * Gera um código de acesso exclusivo para o ACS.
 *
 * Exemplo:
 * ACS-7K42P9
 */
export function gerarCodigoAcesso(): string {
  const caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let codigo = "";

  const bytes = randomBytes(6);

  for (let i = 0; i < 6; i++) {
    codigo += caracteres[bytes[i] % caracteres.length];
  }

  return `ACS-${codigo}`;
}

/**
 * Cria um hash seguro da senha.
 *
 * A senha original NÃO é armazenada no Firestore.
 */
export async function gerarHashSenha(
  senha: string
): Promise<string> {
  const salt = randomBytes(16).toString("hex");

  const derivedKey = (await scryptAsync(
    senha,
    salt,
    64
  )) as Buffer;

  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verifica uma senha comparando-a com o hash armazenado.
 */
export async function verificarSenha(
  senha: string,
  hashArmazenado: string
): Promise<boolean> {
  const [salt, hashHex] = hashArmazenado.split(":");

  if (!salt || !hashHex) {
    return false;
  }

  const hashEsperado = Buffer.from(hashHex, "hex");

  const derivedKey = (await scryptAsync(
    senha,
    salt,
    64
  )) as Buffer;

  if (derivedKey.length !== hashEsperado.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, hashEsperado);
}