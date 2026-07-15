/**
 * Sessões TaskForge.
 *
 * Como no legado, o token de sessão é aleatório (crypto.randomBytes) e vive na
 * tabela `sessions`. A diferença da refatoração: em vez de localStorage +
 * header Authorization, o token é entregue em cookie httpOnly
 * (`taskforge_token`) — o JS do cliente nunca vê o token.
 */
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import type { SessionUser } from "@/lib/db/queries";

export const SESSION_COOKIE = "taskforge_token";

// 24 bytes → 48 chars hex, mesmo formato validado pelo legado.
const TOKEN_RE = /^[a-f0-9]{48}$/i;

/** Cria a sessão no banco e retorna o token. */
export function createSession(userId: number): string {
  const token = crypto.randomBytes(24).toString("hex");
  getDb()
    .prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)`)
    .run(token, userId, Date.now());
  return token;
}

/** Grava o cookie httpOnly de sessão (login/registro). */
export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
}

/** Apaga a sessão do banco e limpa o cookie (logout). */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token && TOKEN_RE.test(token)) {
    getDb().prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
  }
  jar.delete(SESSION_COOKIE);
}

/**
 * Usuário da sessão atual (via cookie) ou null.
 * Equivalente ao `getUser(req)` do legado, trocando Bearer por cookie.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || !TOKEN_RE.test(token)) return null;
  const row = getDb()
    .prepare(
      `SELECT u.id, u.name, u.email, u.subscribed FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`
    )
    .get(token) as unknown as SessionUser | undefined;
  return row ?? null;
}
