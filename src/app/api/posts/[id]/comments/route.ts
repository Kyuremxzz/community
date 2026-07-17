/**
 * GET  /api/posts/:id/comments — árvore completa de comentários (auth
 *      opcional; muda `likedByMe`).
 * POST /api/posts/:id/comments — { body, parentId? } (auth obrigatória).
 *      Se `parentId` for informado, precisa pertencer ao mesmo post.
 */
import type { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  commentTreeForPost,
  commentView,
  getCommentJoinRow,
  getCommentRow,
  insertComment,
} from "@/lib/db/community";
import type { CommentResponse, CommentsResponse } from "@/lib/types";
import {
  ApiError,
  getPostOr404,
  handle,
  json,
  parseId,
  readBody,
  requireUser,
} from "../../../_lib/http";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const postId = parseId(id);
    getPostOr404(postId);

    const u = await getSessionUser();
    const payload: CommentsResponse = {
      comments: commentTreeForPost(postId, u?.id ?? null),
    };
    return json(payload, 200);
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const postId = parseId(id);
    const u = await requireUser();
    getPostOr404(postId);

    const body = await readBody(req);
    const text = String(body.body || "").trim();
    if (text.length < 1 || text.length > 2000) {
      throw new ApiError(
        400,
        "invalid_body",
        "Comentário precisa ter entre 1 e 2000 caracteres."
      );
    }

    let parentId: number | null = null;
    if (body.parentId !== undefined && body.parentId !== null && body.parentId !== "") {
      const pid = Number(body.parentId);
      if (!Number.isInteger(pid)) {
        throw new ApiError(400, "invalid_parent", "Comentário pai inválido.");
      }
      const parent = getCommentRow(pid);
      if (!parent || parent.post_id !== postId) {
        throw new ApiError(400, "invalid_parent", "Comentário pai não pertence a esse post.");
      }
      parentId = pid;
    }

    const now = Date.now();
    const commentId = insertComment(postId, u.id, parentId, text, now);
    const row = getCommentJoinRow(commentId);
    if (!row) throw new ApiError(500, "internal", "Erro ao criar comentário.");

    const payload: CommentResponse = { comment: commentView(row, false) };
    return json(payload, 201);
  });
}
