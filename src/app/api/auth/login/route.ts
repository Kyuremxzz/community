/**
 * POST /api/auth/login — { email, password }
 */
import type { NextRequest } from "next/server";
import { verifyPassword } from "@/lib/db";
import { findUserByEmail, userPublic } from "@/lib/db/queries";
import { createSession, setSessionCookie } from "@/lib/auth";
import type { UserResponse } from "@/lib/types";
import { ApiError, handle, json, readBody } from "../../_lib/http";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    const u = findUserByEmail(email);
    // Mensagem única para e-mail inexistente e senha errada (não vaza qual foi).
    if (!u || !verifyPassword(password, u.password_hash)) {
      throw new ApiError(401, "bad_credentials", "E-mail ou senha incorretos.");
    }

    const token = createSession(u.id);
    await setSessionCookie(token);

    const payload: UserResponse = { user: userPublic(u) };
    return json(payload, 200);
  });
}
