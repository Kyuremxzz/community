/**
 * Patch otimista de `Post`/`Comment` — módulo puro (zero DOM, zero fetch).
 *
 * Curtir e repostar existem em três telas (feed, post único, perfil público)
 * e todas precisam do mesmo comportamento: atualizar `likeCount`/`likedByMe`
 * (ou `repostCount`/`repostedByMe`) na hora do clique e reverter se a API
 * falhar. Em vez de duplicar essa lógica em cada hook de tela, os hooks só
 * sabem "onde" o post mora (lista ou valor único) e chamam estas funções
 * puras para calcular/aplicar o patch — `usePostActions` (curtir/repostar)
 * e `useComments` (curtir comentário) reaproveitam tudo daqui.
 */
import type { Comment, Post } from "@/lib/types";

/**
 * Campos de `Post` que uma ação otimista tem permissão de mexer. De propósito
 * um subconjunto pequeno (contadores/flags de curtida e repost) — evita que
 * um patch acidentalmente sobrescreva título/corpo/autor etc. vindos de um
 * estado desatualizado.
 */
export type PostPatch = Partial<
  Pick<Post, "likeCount" | "likedByMe" | "repostCount" | "repostedByMe">
>;

/** Mesma ideia de `PostPatch`, mas para `Comment`. */
export type CommentPatch = Partial<Pick<Comment, "likeCount" | "likedByMe">>;

/**
 * Aplica `patch` no post de id `id` dentro de `posts`. Se nenhum post bater,
 * devolve a MESMA referência de array (não uma cópia) — permite que quem
 * chamar `setPosts(prev => patchPostInList(prev, id, patch))` deixe o React
 * pular o re-render quando o id não está naquela lista (ex.: like num post
 * que só existe no perfil, não no feed montado ao mesmo tempo).
 */
export function patchPostInList(posts: Post[], id: number, patch: PostPatch): Post[] {
  let changed = false;
  const next = posts.map((p) => {
    if (p.id !== id) return p;
    changed = true;
    return { ...p, ...patch };
  });
  return changed ? next : posts;
}

/** Como `patchPostInList`, mas para um único post (tela de detalhe). */
export function patchPost(post: Post, id: number, patch: PostPatch): Post {
  return post.id === id ? { ...post, ...patch } : post;
}

/** Patch otimista para alternar curtida — deriva o próximo estado do atual. */
export function likeTogglePatch(post: Post): PostPatch {
  const likedByMe = !post.likedByMe;
  return { likedByMe, likeCount: post.likeCount + (likedByMe ? 1 : -1) };
}

/**
 * Patch otimista para alternar repost. Espelha a regra do backend
 * (`togglePostRepost`): repostar de novo desfaz o repost anterior.
 */
export function repostTogglePatch(post: Post): PostPatch {
  const repostedByMe = !post.repostedByMe;
  return { repostedByMe, repostCount: post.repostCount + (repostedByMe ? 1 : -1) };
}

/** Patch otimista para alternar curtida de comentário — mesma ideia de `likeTogglePatch`. */
export function likeCommentTogglePatch(comment: Comment): CommentPatch {
  const likedByMe = !comment.likedByMe;
  return { likedByMe, likeCount: comment.likeCount + (likedByMe ? 1 : -1) };
}

/**
 * Aplica `patch` no comentário de id `id`, em qualquer profundidade da
 * árvore (percorre `replies` recursivamente). Mesma regra de referência de
 * `patchPostInList`: se `id` não existir na árvore, devolve o mesmo array.
 */
export function patchCommentInTree(
  comments: Comment[],
  id: number,
  patch: CommentPatch
): Comment[] {
  let changed = false;
  const next = comments.map((c) => {
    if (c.id === id) {
      changed = true;
      return { ...c, ...patch };
    }
    if (c.replies.length === 0) return c;
    const replies = patchCommentInTree(c.replies, id, patch);
    if (replies === c.replies) return c;
    changed = true;
    return { ...c, replies };
  });
  return changed ? next : comments;
}

/**
 * Insere `comment` na árvore: se `parentId` for informado, dentro do array
 * `replies` do comentário pai (em qualquer profundidade); senão, no topo da
 * lista de raízes. Se `parentId` for informado mas o pai não estiver (ainda)
 * na árvore local — não deveria acontecer, já que o pai precisa existir pra
 * um reply ser criado, mas cobrimos o caso — cai de volta pro topo em vez de
 * silenciosamente descartar o comentário novo.
 */
export function insertCommentInTree(
  comments: Comment[],
  comment: Comment,
  parentId: number | null
): Comment[] {
  if (parentId == null) return [comment, ...comments];

  let inserted = false;
  const next = comments.map((c) => {
    if (inserted) return c;
    if (c.id === parentId) {
      inserted = true;
      return { ...c, replies: [...c.replies, comment] };
    }
    if (c.replies.length === 0) return c;
    const replies = insertCommentInTree(c.replies, comment, parentId);
    if (replies === c.replies) return c;
    inserted = true;
    return { ...c, replies };
  });

  return inserted ? next : [comment, ...comments];
}
