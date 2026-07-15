/**
 * POST /api/me/subscribe — assinatura simulada (não há pagamento de verdade
 * no protótipo; só liga o flag `subscribed`).
 */
import { getUserPublicRow, subscribeUser, userPublic } from "@/lib/db/queries";
import type { SubscribeResponse } from "@/lib/types";
import { ApiError, handle, json, requireUser } from "../../_lib/http";

export async function POST() {
  return handle(async () => {
    const u = await requireUser();
    subscribeUser(u.id);
    const fresh = getUserPublicRow(u.id);
    if (!fresh) throw new ApiError(500, "internal", "Erro interno.");
    const payload: SubscribeResponse = {
      user: userPublic(fresh),
      message: "Assinatura ativada (pagamento simulado no protótipo).",
    };
    return json(payload, 200);
  });
}
