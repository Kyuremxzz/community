/**
 * POST /api/slots/:id/join — ocupa uma vaga.
 * Regras (idênticas ao legado):
 * - squad precisa estar `forming`; vaga precisa estar livre;
 * - uma vaga por usuário por squad;
 * - 1º projeto grátis; entrar em projeto NOVO depois disso exige assinatura
 *   (402 `paywall`) — lido do histórico vitalício `project_entries`;
 * - quando o último slot é ocupado, o squad ativa e o prazo dispara
 *   (deadline_started_at / deadline_ends_at = now + deadlineWeeks semanas).
 */
import { getDb, recordProjectEntry } from "@/lib/db";
import {
  activateSquad,
  countEmptySlots,
  findUserSlotInSquad,
  getSlotRow,
  occupySlot,
  projectsJoinedBy,
  squadView,
  WEEK_MS,
} from "@/lib/db/queries";
import type { JoinSlotResponse } from "@/lib/types";
import {
  ApiError,
  getProjectOr404,
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
    const sq = getSquadOr404(slot.squad_id);
    const p = getProjectOr404(sq.project_id);

    if (sq.status !== "forming") {
      throw new ApiError(409, "squad_locked", "Esse squad já fechou a formação.");
    }
    if (slot.user_id != null) {
      throw new ApiError(409, "slot_taken", "Essa vaga já foi ocupada.");
    }

    const inSquad = findUserSlotInSquad(sq.id, u.id);
    if (inSquad) {
      throw new ApiError(409, "already_in_squad", "Você já ocupa uma vaga nesse squad.");
    }

    // Regra do projeto grátis: 1º projeto liberado; novos projetos exigem assinatura.
    const joined = projectsJoinedBy(u.id);
    const isNewProject = !joined.includes(p.id);
    if (isNewProject && joined.length >= 1 && !u.subscribed) {
      throw new ApiError(402, "paywall", "Seu projeto grátis já foi usado. Assine para entrar em novos projetos.");
    }

    const now = Date.now();
    // UPDATE condicional (user_id IS NULL) protege contra corrida de requisições.
    const changes = occupySlot(slot.id, u.id, now);
    if (changes === 0) {
      throw new ApiError(409, "slot_taken", "Essa vaga acabou de ser ocupada.");
    }
    recordProjectEntry(getDb(), u.id, p.id, now);

    // Squad completo? Prazo começa a contar agora.
    const remaining = countEmptySlots(sq.id);
    let started = false;
    if (remaining === 0) {
      activateSquad(sq.id, now, now + p.deadline_weeks * WEEK_MS);
      started = true;
    }

    const fresh = getSquadOr404(sq.id);
    const payload: JoinSlotResponse = {
      squad: squadView(fresh, u.id),
      deadlineStarted: started,
      message: started
        ? "Squad completo! O prazo começou a contar agora."
        : "Vaga ocupada. O prazo começa quando o squad estiver completo.",
    };
    return json(payload, 200);
  });
}
