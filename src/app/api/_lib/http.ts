/**
 * Helpers compartilhados das rotas da API — porte dos helpers do legado
 * (`ApiError`, `readBody`, `requireUser`, `getProjectOr404`, `getSquadOr404`),
 * adaptados para Route Handlers do Next (NextResponse + cookies).
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  getCommentRow,
  getPostJoinRow,
  type CommentDbRow,
  type PostJoinRow,
} from "@/lib/db/community";
import {
  getProjectRow,
  getSquadRow,
  type ProjectRow,
  type SessionUser,
  type SquadRow,
} from "@/lib/db/queries";
import type { ApiErrorPayload } from "@/lib/types";

/** Erro de API com status + código — vira `{ error: { code, message } }`. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Resposta JSON com os mesmos headers do legado (no-store). */
export function json<T>(body: T, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Envolve o handler e converte exceções no shape de erro do legado:
 * ApiError → status/código próprios; resto → 500 `internal`.
 */
export async function handle(
  fn: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) {
      const body: ApiErrorPayload = {
        error: { code: err.code, message: err.message },
      };
      return json(body, err.status);
    }
    console.error(err);
    const body: ApiErrorPayload = {
      error: { code: "internal", message: "Erro interno." },
    };
    return json(body, 500);
  }
}

/**
 * Lê o corpo JSON como no legado: corpo vazio vira `{}`, JSON inválido é
 * 400 `bad_json`, corpo acima de 64 KiB é 413 `too_large`.
 */
export async function readBody(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (Buffer.byteLength(text, "utf8") > 64 * 1024) {
    throw new ApiError(413, "too_large", "Corpo da requisição grande demais.");
  }
  if (!text) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ApiError(400, "bad_json", "JSON inválido.");
  }
  return typeof parsed === "object" && parsed !== null
    ? (parsed as Record<string, unknown>)
    : {};
}

/** Exige sessão válida — 401 `unauthorized` caso contrário. */
export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) throw new ApiError(401, "unauthorized", "Faça login para continuar.");
  return u;
}

/**
 * Converte o param dinâmico em id numérico. No legado o roteamento era por
 * regex `\d+`, então um id não numérico caía em "Rota não encontrada" (404).
 */
export function parseId(raw: string): number {
  if (!/^\d+$/.test(raw)) {
    throw new ApiError(404, "not_found", "Rota não encontrada.");
  }
  return Number(raw);
}

export function getProjectOr404(id: number): ProjectRow {
  const p = getProjectRow(id);
  if (!p) throw new ApiError(404, "not_found", "Projeto não encontrado.");
  return p;
}

export function getSquadOr404(id: number): SquadRow {
  const s = getSquadRow(id);
  if (!s) throw new ApiError(404, "not_found", "Squad não encontrado.");
  return s;
}

export function getPostOr404(id: number): PostJoinRow {
  const p = getPostJoinRow(id);
  if (!p) throw new ApiError(404, "not_found", "Post não encontrado.");
  return p;
}

export function getCommentOr404(id: number): CommentDbRow {
  const c = getCommentRow(id);
  if (!c) throw new ApiError(404, "not_found", "Comentário não encontrado.");
  return c;
}
