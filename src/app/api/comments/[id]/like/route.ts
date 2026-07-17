/**
 * POST /api/comments/:id/like — alterna curtida (auth obrigatória).
 */
import { toggleCommentLike } from "@/lib/db/community";
import type { CommentLikeResponse } from "@/lib/types";
import { getCommentOr404, handle, json, parseId, requireUser } from "../../../_lib/http";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const commentId = parseId(id);
    const u = await requireUser();
    getCommentOr404(commentId);

    const { likedByMe, likeCount } = toggleCommentLike(commentId, u.id, Date.now());
    const payload: CommentLikeResponse = { id: commentId, likeCount, likedByMe };
    return json(payload, 200);
  });
}
