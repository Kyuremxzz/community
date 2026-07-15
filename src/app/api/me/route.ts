/**
 * GET /api/me — usuário da sessão atual.
 */
import { userPublic } from "@/lib/db/queries";
import type { UserResponse } from "@/lib/types";
import { handle, json, requireUser } from "../_lib/http";

export async function GET() {
  return handle(async () => {
    const u = await requireUser();
    const payload: UserResponse = { user: userPublic(u) };
    return json(payload, 200);
  });
}
