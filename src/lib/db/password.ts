/**
 * Hash de senha — mesma abordagem do legado (`legacy/server/db.js`):
 * scrypt + salt aleatório, comparação com timingSafeEqual.
 * Formato armazenado: "<salt-hex>:<hash-hex>".
 */
import crypto from "node:crypto";

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = String(stored).split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  // timingSafeEqual exige buffers do mesmo tamanho — checar antes evita throw.
  return (
    candidate.length === expected.length &&
    crypto.timingSafeEqual(candidate, expected)
  );
}
