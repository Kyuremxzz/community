/**
 * POST /api/slots/:id/leave — desocupa a própria vaga.
 * Só é permitido enquanto o squad está `forming` (com prazo correndo não dá
 * para sair). Sair NÃO devolve o crédito do projeto grátis: project_entries
 * é histórico vitalício e não é apagado aqui.
 */
import { getSlotRow, squadView, vacateSlot } from "@/lib/db/queries";
import type { SquadResponse } from "@/lib/types";
import {
  ApiError,
  getSquadOr404,
  handle,
  json,
  parseId,
  requireUser,
} from "../../../_lib/http";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const u = await requireUser();
    const slot = getSlotRow(parseId(id));
    if (!slot) throw new ApiError(404, "not_found", "Vaga não encontrada.");
    if (slot.user_id !== u.id) {
      throw new ApiError(403, "not_yours", "Essa vaga não é sua.");
    }
    const sq = getSquadOr404(slot.squad_id);
    if (sq.status !== "forming") {
      throw new ApiError(409, "squad_locked", "O squad já está com prazo correndo; não dá para sair.");
    }
    vacateSlot(slot.id);
    const payload: SquadResponse = {
      squad: squadView(getSquadOr404(sq.id), u.id),
    };
    return json(payload, 200);
  });
}
