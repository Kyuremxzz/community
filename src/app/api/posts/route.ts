/**
 * GET  /api/posts — feed da Comunidade (auth opcional; muda `likedByMe`/
 *      `repostedByMe`). Filtros: `type`, `q` (busca em título/corpo),
 *      `sort` (recent|popular), `authorId`, `limit`/`offset`.
 * POST /api/posts — cria post (auth obrigatória). Corpo é
 *      `multipart/form-data` — única rota do projeto que foge do `readBody`
 *      JSON, por causa do upload de imagem.
 */
import type { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  hydratePosts,
  insertPost,
  isPostType,
  listPostJoinRows,
  type ListPostsFilters,
} from "@/lib/db/community";
import { projectsJoinedBy } from "@/lib/db/queries";
import { saveUploadedImage } from "@/lib/uploads";
import type { PostResponse, PostsResponse } from "@/lib/types";
import { ApiError, getPostOr404, handle, json, requireUser } from "../_lib/http";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function parseLimit(raw: string | null): number {
  const n = Number(raw);
  if (!raw || !Number.isInteger(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function parseOffset(raw: string | null): number {
  const n = Number(raw);
  if (!raw || !Number.isInteger(n) || n < 0) return 0;
  return n;
}

export async function GET(req: NextRequest) {
  return handle(async () => {
    const sp = req.nextUrl.searchParams;

    const typeRaw = sp.get("type");
    const type = typeRaw && isPostType(typeRaw) ? typeRaw : null;

    const q = sp.get("q")?.trim() || null;

    const sort: ListPostsFilters["sort"] = sp.get("sort") === "popular" ? "popular" : "recent";

    const authorIdRaw = sp.get("authorId");
    const authorId = authorIdRaw && /^\d+$/.test(authorIdRaw) ? Number(authorIdRaw) : null;

    const limit = parseLimit(sp.get("limit"));
    const offset = parseOffset(sp.get("offset"));

    const rows = listPostJoinRows({ type, q, sort, authorId, limit, offset });
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    const viewer = await getSessionUser();
    const payload: PostsResponse = {
      posts: hydratePosts(pageRows, viewer?.id ?? null),
      hasMore,
    };
    return json(payload, 200);
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const u = await requireUser();

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new ApiError(400, "bad_form", "Corpo multipart/form-data inválido.");
    }

    const typeRaw = String(form.get("type") ?? "");
    if (!isPostType(typeRaw)) {
      throw new ApiError(
        400,
        "invalid_type",
        "Tipo precisa ser projeto, duvida, discussao ou ajuda."
      );
    }

    const title = String(form.get("title") ?? "").trim();
    if (title.length < 1 || title.length > 140) {
      throw new ApiError(400, "invalid_title", "Título precisa ter entre 1 e 140 caracteres.");
    }

    const body = String(form.get("body") ?? "").trim();
    if (body.length < 1 || body.length > 5000) {
      throw new ApiError(400, "invalid_body", "Corpo precisa ter entre 1 e 5000 caracteres.");
    }

    let linkUrl: string | null = null;
    const linkRaw = String(form.get("linkUrl") ?? "").trim();
    if (linkRaw) {
      if (!/^https?:\/\//i.test(linkRaw)) {
        throw new ApiError(400, "invalid_link", "Link precisa começar com http:// ou https://.");
      }
      linkUrl = linkRaw;
    }

    let projectId: number | null = null;
    const projectIdRaw = form.get("projectId");
    const projectIdStr = typeof projectIdRaw === "string" ? projectIdRaw.trim() : "";
    if (projectIdStr) {
      const pid = Number(projectIdStr);
      if (!Number.isInteger(pid) || pid <= 0) {
        throw new ApiError(400, "invalid_project", "Projeto inválido.");
      }
      const joined = projectsJoinedBy(u.id);
      if (!joined.includes(pid)) {
        throw new ApiError(
          403,
          "not_your_project",
          "Você só pode marcar projetos em que já participou."
        );
      }
      projectId = pid;
    }

    let imagePath: string | null = null;
    const image = form.get("image");
    if (image instanceof File && image.size > 0) {
      imagePath = await saveUploadedImage(image);
    }

    const now = Date.now();
    const postId = insertPost({
      authorId: u.id,
      type: typeRaw,
      title,
      body,
      imagePath,
      linkUrl,
      projectId,
      now,
    });

    const row = getPostOr404(postId);
    const payload: PostResponse = { post: hydratePosts([row], u.id)[0] };
    return json(payload, 201);
  });
}
