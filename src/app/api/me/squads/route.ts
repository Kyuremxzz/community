/**
 * GET /api/me/squads — squads em que o usuário ocupa alguma vaga,
 * cada um acompanhado do projeto (sem a lista de squads do projeto).
 */
import { squadsWithProjectForUser } from "@/lib/db/queries";
import type { MySquadsResponse } from "@/lib/types";
import { handle, json, requireUser } from "../../_lib/http";

export async function GET() {
  return handle(async () => {
    const u = await requireUser();
    const payload: MySquadsResponse = {
      squads: squadsWithProjectForUser(u.id, u.id),
    };
    return json(payload, 200);
  });
}
