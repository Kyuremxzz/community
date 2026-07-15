/**
 * POST /api/auth/register — { name, email, password }
 * Regras idênticas ao legado; o token vai em cookie httpOnly (não no corpo).
 */
import type { NextRequest } from "next/server";
import { hashPassword } from "@/lib/db";
import { findUserByEmail, insertUser, userPublic } from "@/lib/db/queries";
import { createSession, setSessionCookie } from "@/lib/auth";
import type { UserResponse } from "@/lib/types";
import { ApiError, handle, json, readBody } from "../../_lib/http";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await readBody(req);
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (name.length < 2) {
      throw new ApiError(400, "invalid_name", "Nome precisa de pelo menos 2 caracteres.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ApiError(400, "invalid_email", "E-mail inválido.");
    }
    if (password.length < 6) {
      throw new ApiError(400, "invalid_password", "Senha precisa de pelo menos 6 caracteres.");
    }
    const exists = findUserByEmail(email);
    if (exists) {
      throw new ApiError(409, "email_taken", "Já existe uma conta com esse e-mail.");
    }

    const id = insertUser(name, email, hashPassword(password), Date.now());
    const token = createSession(id);
    await setSessionCookie(token);

    const payload: UserResponse = {
      user: userPublic({ id, name, email, subscribed: 0 }),
    };
    return json(payload, 201);
  });
}
