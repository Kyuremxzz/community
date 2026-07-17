/**
 * POST /api/posts/:id/like — alterna curtida (auth obrigatória).
 */
import { togglePostLike } from "@/lib/db/community";
import type { PostLikeResponse } from "@/lib/types";
import { getPostOr404, handle, json, parseId, requireUser } from "../../../_lib/http";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const postId = parseId(id);
    const u = await requireUser();
    getPostOr404(postId);

    const { likedByMe, likeCount } = togglePostLike(postId, u.id, Date.now());
    const payload: PostLikeResponse = { id: postId, likeCount, likedByMe };
    return json(payload, 200);
  });
}
