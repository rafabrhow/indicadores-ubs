import "server-only";

import {
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

function carregarCredencial() {
  // Produção/Vercel:
  // a credencial fica armazenada em Base64 para evitar
  // problemas com quebras de linha e caracteres especiais.
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const json = Buffer.from(
      process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
      "base64",
    ).toString("utf-8");

    return JSON.parse(json);
  }

  // Desenvolvimento local:
  // mantém compatibilidade com o enfermagem.json existente.
  const caminhoCredencial = process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS)
    : path.join(process.cwd(), "enfermagem.json");

  return JSON.parse(
    fs.readFileSync(caminhoCredencial, "utf-8"),
  );
}
const credencial = carregarCredencial();

const adminApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert(credencial),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);