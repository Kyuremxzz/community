/**
 * GET /uploads/**  — serve os arquivos enviados pelos usuários (imagens de
 * post), que vivem em `data/uploads/` (fora de `public/` — ver
 * `src/lib/uploads.ts` sobre por que `public/` não funciona aqui em
 * produção). Lê do disco a cada request, então arquivos novos aparecem sem
 * rebuild — ao contrário do `public/` estático do Next em `next start`.
 */
import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { UPLOAD_ROOT } from "@/lib/uploads";

const CONTENT_TYPE: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const { path: segments } = await params;

  // Cada segmento vem separado por `/` (o Next não deixa `..` virar `/` de
  // novo), mas um segmento pode SER `..` — resolve e confirma que o
  // caminho final continua dentro de UPLOAD_ROOT antes de ler.
  const filePath = path.join(UPLOAD_ROOT, ...segments);
  if (filePath !== UPLOAD_ROOT && !filePath.startsWith(UPLOAD_ROOT + path.sep)) {
    return new NextResponse(null, { status: 404 });
  }

  const contentType = CONTENT_TYPE[path.extname(filePath).toLowerCase()];
  if (!contentType) {
    return new NextResponse(null, { status: 404 });
  }

  let data: Buffer;
  try {
    data = fs.readFileSync(filePath);
  } catch {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
