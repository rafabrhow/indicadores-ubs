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

const caminhoCredencial = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ? path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS)
  : path.join(process.cwd(), "enfermagem.json");

const credencial = JSON.parse(
  fs.readFileSync(caminhoCredencial, "utf-8")
);

const adminApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert(credencial),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);