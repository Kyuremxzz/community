/**
 * GET /api/projects/:id — projeto com a lista de squads (auth opcional).
 */
import { projectView } from "@/lib/db/queries";
import { getSessionUser } from "@/lib/auth";
import type { ProjectResponse } from "@/lib/types";
import { getProjectOr404, handle, json, parseId } from "../../_lib/http";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const u = await getSessionUser();
    const p = getProjectOr404(parseId(id));
    const payload: ProjectResponse = {
      project: projectView(p, u?.id ?? null, true),
    };
    return json(payload, 200);
  });
}
