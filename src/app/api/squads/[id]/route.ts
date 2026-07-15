/**
 * GET /api/squads/:id — squad + projeto (sem a lista de squads do projeto).
 */
import { projectView, squadView } from "@/lib/db/queries";
import { getSessionUser } from "@/lib/auth";
import type { SquadWithProjectResponse } from "@/lib/types";
import {
  getProjectOr404,
  getSquadOr404,
  handle,
  json,
  parseId,
} from "../../_lib/http";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const u = await getSessionUser();
    const sq = getSquadOr404(parseId(id));
    const p = getProjectOr404(sq.project_id);
    const payload: SquadWithProjectResponse = {
      squad: squadView(sq, u?.id ?? null),
      project: projectView(p, u?.id ?? null, false),
    };
    return json(payload, 200);
  });
}
