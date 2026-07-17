/**
 * POST /api/posts/:id/repost — { comment?: string } (auth obrigatória).
 * Toggle: repostar de novo quando já existe repost do usuário desfaz o
 * repost. `post` na resposta é sempre o ORIGINAL, com contadores atualizados.
 */
import type { NextRequest } from "next/server";
import { hydratePost, togglePostRepost } from "@/lib/db/community";
import type { RepostResponse } from "@/lib/types";
import {
  ApiError,
  getPostOr404,
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
    const postId = parseId(id);
    const u = await requireUser();
    const original = getPostOr404(postId);

    const body = await readBody(req);
    let comment: string | null = null;
    if (body.comment !== undefined && body.comment !== null) {
      const c = String(body.comment).trim();
      if (c.length > 280) {
        throw new ApiError(
          400,
          "invalid_comment",
          "Comentário da citação pode ter no máximo 280 caracteres."
        );
      }
      comment = c || null;
    }

    const reposted = togglePostRepost(original, u.id, comment, Date.now());

    const fresh = getPostOr404(postId);
    const payload: RepostResponse = { reposted, post: hydratePost(fresh, u.id) };
    return json(payload, 200);
  });
}
