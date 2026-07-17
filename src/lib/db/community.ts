/**
 * Queries e "views" de serialização da Comunidade (posts, comentários,
 * curtidas, reposts) — feature nova, sem equivalente no legado. Mesmo padrão
 * de `src/lib/db/queries.ts`: tipos Row (schema bruto) + funções View (shape
 * da API), `node:sqlite` síncrono — sequências de `.run()` dentro do mesmo
 * handler já são atômicas porque não há `await` entre elas.
 */
import { buildCommentTree, type CommentRow } from "@/lib/community/build-comment-tree";
import type { Comment, Post, PostSummary, PostType } from "@/lib/types";
import { getDb } from "./index";

export const POST_TYPES: readonly PostType[] = ["projeto", "duvida", "discussao", "ajuda"];

export function isPostType(value: string): value is PostType {
  return (POST_TYPES as readonly string[]).includes(value);
}

/* ------------------------------------------------------------------ */
/* Tipos de linha (schema do SQLite)                                   */
/* ------------------------------------------------------------------ */

export interface PostRow {
  id: number;
  author_id: number;
  type: PostType;
  title: string;
  body: string;
  image_path: string | null;
  link_url: string | null;
  project_id: number | null;
  repost_of_id: number | null;
  repost_comment: string | null;
  like_count: number;
  comment_count: number;
  repost_count: number;
  created_at: number;
}

/** PostRow + colunas de JOIN (nome do autor, título do projeto marcado). */
export interface PostJoinRow extends PostRow {
  author_name: string;
  project_title: string | null;
}

export interface CommentDbRow {
  id: number;
  post_id: number;
  author_id: number;
  parent_id: number | null;
  body: string;
  like_count: number;
  created_at: number;
}

export interface CommentJoinRow extends CommentDbRow {
  author_name: string;
}

/* ------------------------------------------------------------------ */
/* Posts — leitura                                                     */
/* ------------------------------------------------------------------ */

const POST_JOIN_SELECT = `
  SELECT p.*, u.name AS author_name, pr.title AS project_title
    FROM posts p
    JOIN users u ON u.id = p.author_id
    LEFT JOIN projects pr ON pr.id = p.project_id
`;

export function getPostJoinRow(id: number): PostJoinRow | undefined {
  return getDb()
    .prepare(`${POST_JOIN_SELECT} WHERE p.id = ?`)
    .get(id) as unknown as PostJoinRow | undefined;
}

function postJoinRowsByIds(ids: number[]): PostJoinRow[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(", ");
  return getDb()
    .prepare(`${POST_JOIN_SELECT} WHERE p.id IN (${placeholders})`)
    .all(...ids) as unknown as PostJoinRow[];
}

/** Escapa `%`, `_` e `\` para uso seguro dentro de um LIKE (evita "wildcard injection"). */
function escapeLike(raw: string): string {
  return raw.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export interface ListPostsFilters {
  type: PostType | null;
  q: string | null;
  sort: "recent" | "popular";
  authorId: number | null;
  limit: number;
  offset: number;
}

/**
 * Busca `limit + 1` linhas (a linha extra é usada pela rota para decidir
 * `hasMore` sem precisar de um segundo `COUNT(*)`).
 */
export function listPostJoinRows(filters: ListPostsFilters): PostJoinRow[] {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (filters.type) {
    clauses.push("p.type = ?");
    params.push(filters.type);
  }
  if (filters.authorId != null) {
    clauses.push("p.author_id = ?");
    params.push(filters.authorId);
  }
  if (filters.q) {
    clauses.push("(p.title LIKE ? ESCAPE '\\' OR p.body LIKE ? ESCAPE '\\')");
    const like = `%${escapeLike(filters.q)}%`;
    params.push(like, like);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const orderBy =
    filters.sort === "popular"
      ? "(p.like_count + p.comment_count + p.repost_count) DESC, p.created_at DESC"
      : "p.created_at DESC";
  params.push(filters.limit + 1, filters.offset);
  return getDb()
    .prepare(`${POST_JOIN_SELECT} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .all(...params) as unknown as PostJoinRow[];
}

/** Posts de um autor, mais recentes primeiro (usado no perfil público). */
export function listPostJoinRowsByAuthor(authorId: number, limit: number): PostJoinRow[] {
  return getDb()
    .prepare(`${POST_JOIN_SELECT} WHERE p.author_id = ? ORDER BY p.created_at DESC LIMIT ?`)
    .all(authorId, limit) as unknown as PostJoinRow[];
}

/* ------------------------------------------------------------------ */
/* Posts — escrita                                                     */
/* ------------------------------------------------------------------ */

export interface InsertPostInput {
  authorId: number;
  type: PostType;
  title: string;
  body: string;
  imagePath: string | null;
  linkUrl: string | null;
  projectId: number | null;
  now: number;
}

export function insertPost(input: InsertPostInput): number {
  const r = getDb()
    .prepare(
      `INSERT INTO posts (author_id, type, title, body, image_path, link_url, project_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.authorId,
      input.type,
      input.title,
      input.body,
      input.imagePath,
      input.linkUrl,
      input.projectId,
      input.now
    );
  return Number(r.lastInsertRowid);
}

/** Repost existente do usuário para esse post original, se houver. */
export function findRepostRow(originalId: number, authorId: number): PostRow | undefined {
  return getDb()
    .prepare(`SELECT * FROM posts WHERE repost_of_id = ? AND author_id = ?`)
    .get(originalId, authorId) as unknown as PostRow | undefined;
}

/**
 * Alterna repost: se o usuário já repostou esse post, desfaz (apaga a linha
 * extra + `repost_count - 1` no original); senão cria a linha extra (tipo
 * copiado do original, título/corpo vazios) + `repost_count + 1`. Retorna se
 * ficou repostado depois da chamada.
 */
export function togglePostRepost(
  original: PostRow,
  userId: number,
  comment: string | null,
  now: number
): boolean {
  const db = getDb();
  const existing = findRepostRow(original.id, userId);
  if (existing) {
    db.prepare(`DELETE FROM posts WHERE id = ?`).run(existing.id);
    db.prepare(`UPDATE posts SET repost_count = repost_count - 1 WHERE id = ?`).run(original.id);
    return false;
  }
  db.prepare(
    `INSERT INTO posts (author_id, type, title, body, repost_of_id, repost_comment, created_at)
     VALUES (?, ?, '', '', ?, ?, ?)`
  ).run(userId, original.type, original.id, comment, now);
  db.prepare(`UPDATE posts SET repost_count = repost_count + 1 WHERE id = ?`).run(original.id);
  return true;
}

/** Alterna curtida em post; retorna o estado (curtido?) e o contador já atualizados. */
export function togglePostLike(
  postId: number,
  userId: number,
  now: number
): { likedByMe: boolean; likeCount: number } {
  const db = getDb();
  const ins = db
    .prepare(`INSERT OR IGNORE INTO post_likes (post_id, user_id, created_at) VALUES (?, ?, ?)`)
    .run(postId, userId, now);
  let liked: boolean;
  if (Number(ins.changes) > 0) {
    db.prepare(`UPDATE posts SET like_count = like_count + 1 WHERE id = ?`).run(postId);
    liked = true;
  } else {
    const del = db
      .prepare(`DELETE FROM post_likes WHERE post_id = ? AND user_id = ?`)
      .run(postId, userId);
    if (Number(del.changes) > 0) {
      db.prepare(`UPDATE posts SET like_count = like_count - 1 WHERE id = ?`).run(postId);
    }
    liked = false;
  }
  const row = db.prepare(`SELECT like_count FROM posts WHERE id = ?`).get(postId) as unknown as {
    like_count: number;
  };
  return { likedByMe: liked, likeCount: row.like_count };
}

/* ------------------------------------------------------------------ */
/* Posts — hidratação (Row -> shape da API)                            */
/* ------------------------------------------------------------------ */

function likedPostIdSet(ids: number[], userId: number): Set<number> {
  if (ids.length === 0) return new Set();
  const placeholders = ids.map(() => "?").join(", ");
  const rows = getDb()
    .prepare(`SELECT post_id FROM post_likes WHERE user_id = ? AND post_id IN (${placeholders})`)
    .all(userId, ...ids) as unknown as Array<{ post_id: number }>;
  return new Set(rows.map((r) => r.post_id));
}

/** Ids de posts que o usuário já repostou, dentre os informados. */
function repostedByViewerSet(ids: number[], userId: number): Set<number> {
  if (ids.length === 0) return new Set();
  const placeholders = ids.map(() => "?").join(", ");
  const rows = getDb()
    .prepare(
      `SELECT repost_of_id FROM posts WHERE author_id = ? AND repost_of_id IN (${placeholders})`
    )
    .all(userId, ...ids) as unknown as Array<{ repost_of_id: number }>;
  return new Set(rows.map((r) => r.repost_of_id));
}

function postSummaryFromJoinRow(row: PostJoinRow): PostSummary {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    imageUrl: row.image_path,
    linkUrl: row.link_url,
    projectId: row.project_id,
    projectTitle: row.project_title,
    author: { id: row.author_id, name: row.author_name },
    createdAt: row.created_at,
  };
}

/** Hidrata várias linhas de uma vez (feed) evitando N+1: 2-3 queries no total. */
export function hydratePosts(rows: PostJoinRow[], viewerId: number | null): Post[] {
  const ids = rows.map((r) => r.id);
  const likedSet = viewerId != null ? likedPostIdSet(ids, viewerId) : new Set<number>();
  const repostedSet = viewerId != null ? repostedByViewerSet(ids, viewerId) : new Set<number>();

  const originalIds = [
    ...new Set(rows.filter((r) => r.repost_of_id != null).map((r) => r.repost_of_id as number)),
  ];
  const originalsMap = new Map(
    postJoinRowsByIds(originalIds).map((r) => [r.id, postSummaryFromJoinRow(r)] as const)
  );

  return rows.map((r) => ({
    ...postSummaryFromJoinRow(r),
    likeCount: r.like_count,
    commentCount: r.comment_count,
    repostCount: r.repost_count,
    likedByMe: likedSet.has(r.id),
    repostedByMe: repostedSet.has(r.id),
    repostOf: r.repost_of_id != null ? originalsMap.get(r.repost_of_id) ?? null : null,
    repostComment: r.repost_comment,
  }));
}

export function hydratePost(row: PostJoinRow, viewerId: number | null): Post {
  return hydratePosts([row], viewerId)[0];
}

/* ------------------------------------------------------------------ */
/* Comentários                                                         */
/* ------------------------------------------------------------------ */

export function getCommentRow(id: number): CommentDbRow | undefined {
  return getDb()
    .prepare(`SELECT * FROM comments WHERE id = ?`)
    .get(id) as unknown as CommentDbRow | undefined;
}

export function getCommentJoinRow(id: number): CommentJoinRow | undefined {
  return getDb()
    .prepare(
      `SELECT c.*, u.name AS author_name FROM comments c JOIN users u ON u.id = c.author_id WHERE c.id = ?`
    )
    .get(id) as unknown as CommentJoinRow | undefined;
}

function commentJoinRowsForPost(postId: number): CommentJoinRow[] {
  return getDb()
    .prepare(
      `SELECT c.*, u.name AS author_name FROM comments c
        JOIN users u ON u.id = c.author_id
       WHERE c.post_id = ?
       ORDER BY c.created_at ASC`
    )
    .all(postId) as unknown as CommentJoinRow[];
}

export function insertComment(
  postId: number,
  authorId: number,
  parentId: number | null,
  body: string,
  now: number
): number {
  const db = getDb();
  const r = db
    .prepare(
      `INSERT INTO comments (post_id, author_id, parent_id, body, created_at) VALUES (?, ?, ?, ?, ?)`
    )
    .run(postId, authorId, parentId, body, now);
  db.prepare(`UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?`).run(postId);
  return Number(r.lastInsertRowid);
}

/** Alterna curtida em comentário; retorna o estado e o contador já atualizados. */
export function toggleCommentLike(
  commentId: number,
  userId: number,
  now: number
): { likedByMe: boolean; likeCount: number } {
  const db = getDb();
  const ins = db
    .prepare(`INSERT OR IGNORE INTO comment_likes (comment_id, user_id, created_at) VALUES (?, ?, ?)`)
    .run(commentId, userId, now);
  let liked: boolean;
  if (Number(ins.changes) > 0) {
    db.prepare(`UPDATE comments SET like_count = like_count + 1 WHERE id = ?`).run(commentId);
    liked = true;
  } else {
    const del = db
      .prepare(`DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?`)
      .run(commentId, userId);
    if (Number(del.changes) > 0) {
      db.prepare(`UPDATE comments SET like_count = like_count - 1 WHERE id = ?`).run(commentId);
    }
    liked = false;
  }
  const row = db
    .prepare(`SELECT like_count FROM comments WHERE id = ?`)
    .get(commentId) as unknown as { like_count: number };
  return { likedByMe: liked, likeCount: row.like_count };
}

function likedCommentIdSet(ids: number[], userId: number): Set<number> {
  if (ids.length === 0) return new Set();
  const placeholders = ids.map(() => "?").join(", ");
  const rows = getDb()
    .prepare(
      `SELECT comment_id FROM comment_likes WHERE user_id = ? AND comment_id IN (${placeholders})`
    )
    .all(userId, ...ids) as unknown as Array<{ comment_id: number }>;
  return new Set(rows.map((r) => r.comment_id));
}

/** Árvore completa de comentários de um post, pronta para a resposta da API. */
export function commentTreeForPost(postId: number, viewerId: number | null): Comment[] {
  const rows = commentJoinRowsForPost(postId);
  const ids = rows.map((r) => r.id);
  const likedSet = viewerId != null ? likedCommentIdSet(ids, viewerId) : new Set<number>();
  const flat: CommentRow[] = rows.map((r) => ({
    id: r.id,
    postId: r.post_id,
    parentId: r.parent_id,
    authorId: r.author_id,
    authorName: r.author_name,
    body: r.body,
    createdAt: r.created_at,
    likeCount: r.like_count,
  }));
  return buildCommentTree(flat, likedSet, viewerId);
}

/** Serializa um único comentário recém-criado (sem replies ainda). */
export function commentView(row: CommentJoinRow, likedByMe: boolean): Comment {
  return {
    id: row.id,
    postId: row.post_id,
    parentId: row.parent_id,
    author: { id: row.author_id, name: row.author_name },
    body: row.body,
    createdAt: row.created_at,
    likeCount: row.like_count,
    likedByMe,
    replies: [],
  };
}
