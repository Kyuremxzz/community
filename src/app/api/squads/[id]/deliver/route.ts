/**
 * POST /api/squads/:id/deliver — { repoUrl }
 * Só membros entregam; só squad `active`; URL precisa ser um repositório
 * GitHub https no formato https://github.com/usuario/repo.
 * `deliveredLate` sai calculado na view (entrega após o fim do prazo).
 */
import type { NextRequest } from "next/server";
import { deliverSquad, findUserSlotInSquad, squadView } from "@/lib/db/queries";
import type { DeliverResponse } from "@/lib/types";
import {
  ApiError,
  getSquadOr404,
  handle,
  json,
  parseId,
  readBody,
  requireUser,
} from "../../../_lib/http";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const u = await requireUser();
    const body = await readBody(req);
    const sq = getSquadOr404(parseId(id));

    const member = findUserSlotInSquad(sq.id, u.id);
    if (!member) {
      throw new ApiError(403, "not_member", "Só membros do squad podem entregar.");
    }
    if (sq.status === "delivered") {
      throw new ApiError(409, "already_delivered", "Esse squad já entregou.");
    }
    if (sq.status !== "active") {
      throw new ApiError(409, "not_active", "O squad ainda não está completo — nada a entregar.");
    }

    const repoUrl = String(body.repoUrl || "").trim();
    let ok = false;
    try {
      const parsed = new URL(repoUrl);
      const segments = parsed.pathname.split("/").filter(Boolean);
      ok =
        parsed.protocol === "https:" &&
        parsed.hostname.toLowerCase() === "github.com" &&
        !parsed.username &&
        !parsed.password &&
        segments.length === 2 &&
        segments.every((s) => /^[\w.-]+$/.test(s));
    } catch {
      ok = false;
    }
    if (!ok) {
      throw new ApiError(
        400,
        "invalid_repo",
        "Envie a URL https de um repositório do GitHub, no formato https://github.com/usuario/repo."
      );
    }

    const now = Date.now();
    deliverSquad(sq.id, repoUrl, now);
    const fresh = getSquadOr404(sq.id);
    const payload: DeliverResponse = {
      squad: squadView(fresh, u.id),
      showGithubTutorial: true,
      message: "Entrega registrada! Veja como adicionar seus colegas como colaboradores no GitHub.",
    };
    return json(payload, 200);
  });
}
