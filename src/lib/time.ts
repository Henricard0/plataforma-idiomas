import "server-only";
import { connection } from "next/server";

/**
 * Horário da requisição. `connection()` avisa o Next que este trecho depende da
 * requisição (não pode ser pré-renderizado) antes de ler o relógio.
 */
export async function requestNow() {
  await connection();
  return Date.now();
}
