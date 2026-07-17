/**
 * GET /api/users/:id — perfil público (auth opcional; muda `likedByMe`/
 * `repostedByMe`/`isMember`/`mine` dos posts e squads do perfil).
 */
import { getSessionUser } from "@/lib/auth";
import { hydratePosts, listPostJoinRowsByAuthor } from "@/lib/db/community";
import { getUserPublicRow, squadsWithProjectForUser } from "@/lib/db/queries";
import type { ProfileResponse } from "@/lib/types";
import { ApiError, handle, json, parseId } from "../../_lib/http";

const PROFILE_POSTS_LIMIT = 50;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const targetId = parseId(id);
    const target = getUserPublicRow(targetId);
    if (!target) throw new ApiError(404, "not_found", "Usuário não encontrado.");

    const viewer = await getSessionUser();
    const viewerId = viewer?.id ?? null;

    const postRows = listPostJoinRowsByAuthor(targetId, PROFILE_POSTS_LIMIT);
    const payload: ProfileResponse = {
      profile: { id: target.id, name: target.name, subscribed: !!target.subscribed },
      posts: hydratePosts(postRows, viewerId),
      squads: squadsWithProjectForUser(targetId, viewerId),
    };
    return json(payload, 200);
  });
}
