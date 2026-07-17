/**
 * Upload de imagens de post da Comunidade — zero dependências novas
 * (`crypto.randomUUID` + `node:fs`, mesmo padrão de `mkdirSync` de
 * `src/lib/db/index.ts` para a pasta `data/`).
 *
 * Regras de segurança: mime allowlist fixo (nunca confia no nome/extensão do
 * arquivo original), tamanho máximo de 5 MiB, nome de arquivo gerado por
 * `randomUUID()` (evita path traversal e colisão).
 *
 * IMPORTANTE: os arquivos NÃO ficam em `public/` — o Next.js em produção
 * (`next build && next start`) serve `public/` a partir de um snapshot
 * calculado no build; um arquivo criado em runtime ali fica inacessível
 * (404) até o próximo build (confirmado manualmente: funciona em `next dev`,
 * quebra em `next start`). Por isso os arquivos vão para `data/uploads/`
 * (fora de `public/`, ao lado do banco) e são servidos por uma rota dinâmica
 * (`src/app/uploads/[...path]/route.ts`), que lê do disco a cada request —
 * a URL pública continua `/uploads/posts/<nome>`, sem mudar nada pra quem
 * consome `imageUrl`.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ApiError } from "@/app/api/_lib/http";

const MAX_BYTES = 5 * 1024 * 1024;

/** Mapa fixo mime -> extensão. Nunca deriva a extensão do nome original. */
const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const UPLOAD_ROOT = path.join(process.cwd(), "data", "uploads");
const UPLOAD_DIR = path.join(UPLOAD_ROOT, "posts");

/**
 * Valida e salva a imagem enviada num post. Retorna o caminho público
 * (sempre com `/` inicial — servido pela rota dinâmica de uploads).
 */
export async function saveUploadedImage(file: File): Promise<string> {
  const ext = MIME_EXT[file.type];
  if (!ext) {
    throw new ApiError(
      400,
      "invalid_image",
      "Formato de imagem não suportado — use JPEG, PNG, WEBP ou GIF."
    );
  }
  if (file.size > MAX_BYTES) {
    throw new ApiError(400, "invalid_image", "Imagem muito grande — máximo de 5 MiB.");
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    throw new ApiError(400, "invalid_image", "Imagem muito grande — máximo de 5 MiB.");
  }

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const name = `${crypto.randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return `/uploads/posts/${name}`;
}
