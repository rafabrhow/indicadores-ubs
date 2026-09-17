import { getFirestore } from "firebase/firestore";
import { app } from "./firebase";

/**
 * Instância principal do Firestore.
 *
 * Todo acesso ao banco do Indicadores-UBS
 * deverá utilizar esta instância.
 */
export const db = getFirestore(app);