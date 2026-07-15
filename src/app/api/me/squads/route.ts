/**
 * GET /api/me/squads — squads em que o usuário ocupa alguma vaga,
 * cada um acompanhado do projeto (sem a lista de squads do projeto).
 */
import { projectView, squadRowsOfUser, squadView } from "@/lib/db/queries";
import type { MySquadsResponse } from "@/lib/types";
import { getProjectOr404, handle, json, requireUser } from "../../_lib/http";

export async function GET() {
  return handle(async () => {
    const u = await requireUser();
    const rows = squadRowsOfUser(u.id);
    const payload: MySquadsResponse = {
      squads: rows.map((sq) => {
        const p = getProjectOr404(sq.project_id);
        return {
          squad: squadView(sq, u.id),
          project: projectView(p, u.id, false),
        };
      }),
    };
    return json(payload, 200);
  });
}
