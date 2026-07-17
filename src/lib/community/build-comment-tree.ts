/**
 * Monta a árvore de comentários de um post a partir das linhas FLAT vindas do
 * banco (já ordenadas por `created_at ASC`). Módulo puro — zero DOM, zero
 * DB — só transforma dados, para poder ser testado isoladamente.
 */
import type { Comment, PostAuthor } from "@/lib/types";

/** Forma "achatada" de uma linha de comentário (já com o nome do autor). */
export interface CommentRow {
  id: number;
  postId: number;
  parentId: number | null;
  authorId: number;
  authorName: string;
  body: string;
  createdAt: number;
  likeCount: number;
}

/**
 * Aninha `rows` por `parentId`. Comentários órfãos (parent_id apontando para
 * um comentário que não está em `rows` — caso raríssimo, ex.: pai apagado)
 * viram comentários de nível raiz em vez de sumir da resposta.
 */
export function buildCommentTree(
  rows: CommentRow[],
  likedCommentIds: Set<number>,
  viewerId: number | null
): Comment[] {
  const byId = new Map<number, Comment>();
  for (const row of rows) {
    const author: PostAuthor = { id: row.authorId, name: row.authorName };
    byId.set(row.id, {
      id: row.id,
      postId: row.postId,
      parentId: row.parentId,
      author,
      body: row.body,
      createdAt: row.createdAt,
      likeCount: row.likeCount,
      likedByMe: viewerId != null && likedCommentIds.has(row.id),
      replies: [],
    });
  }

  const roots: Comment[] = [];
  for (const row of rows) {
    const node = byId.get(row.id);
    if (!node) continue;
    const parent = row.parentId != null ? byId.get(row.parentId) : undefined;
    if (parent) {
      parent.replies.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
