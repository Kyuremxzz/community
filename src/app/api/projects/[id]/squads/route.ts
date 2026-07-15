/**
 * POST /api/projects/:id/squads — abre um novo squad no projeto.
 * Sem nome no corpo, usa a sequência Alpha/Bravo/Charlie/... pelo nº de squads.
 */
import type { NextRequest } from "next/server";
import { createSquadForProject, getDb } from "@/lib/db";
import { countSquadsOfProject, SQUAD_NAMES, squadView } from "@/lib/db/queries";
import type { SquadResponse } from "@/lib/types";
import {
  ApiError,
  getProjectOr404,
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
    const p = getProjectOr404(parseId(id));

    const count = countSquadsOfProject(p.id);
    let name = String(body.name || "").trim();
    if (!name) name = `Squad ${SQUAD_NAMES[count % SQUAD_NAMES.length]}`;
    if (name.length > 24) {
      throw new ApiError(400, "invalid_name", "Nome do squad pode ter no máximo 24 caracteres.");
    }

    const squadId = createSquadForProject(getDb(), p.id, name, Date.now());
    const sq = getSquadOr404(squadId);
    const payload: SquadResponse = { squad: squadView(sq, u.id) };
    return json(payload, 201);
  });
}
