/**
 * POST /api/auth/logout — apaga a sessão do banco e limpa o cookie.
 * Como no legado, é idempotente: sem sessão válida ainda responde { ok: true }.
 */
import { destroySession } from "@/lib/auth";
import type { OkResponse } from "@/lib/types";
import { handle, json } from "../../_lib/http";

export async function POST() {
  return handle(async () => {
    await destroySession();
    const payload: OkResponse = { ok: true };
    return json(payload, 200);
  });
}
