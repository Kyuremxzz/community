/**
 * GET /api/posts/:id — post único (auth opcional; muda `likedByMe`/`repostedByMe`).
 */
import { getSessionUser } from "@/lib/auth";
import { hydratePost } from "@/lib/db/community";
import type { PostResponse } from "@/lib/types";
import { getPostOr404, handle, json, parseId } from "../../_lib/http";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const row = getPostOr404(parseId(id));
    const u = await getSessionUser();
    const payload: PostResponse = { post: hydratePost(row, u?.id ?? null) };
    return json(payload, 200);
  });
}
