"use client";

/* ==========================================================================
   useComments — árvore de comentários de um post (GET /api/posts/:id/comments).

   - `addComment(body, parentId?)` insere o comentário criado direto na
     árvore local (posição certa: dentro de `replies` do pai, ou no topo das
     raízes) — não recarrega a árvore inteira. Propaga erros da API pra quem
     chamou (mesmo padrão de formulário usado no resto do projeto: o
     componente decide como mostrar o erro, ex. inline no textarea).
   - `likeComment(comment)` é update otimista, igual a `usePostActions.like`,
     só que percorrendo a árvore recursivamente até achar o comentário (ver
     `patchCommentInTree` em `src/lib/community/optimistic.ts`).
   - Corrida de requisições na carga inicial: mesmo padrão de ref-contador de
     `useCommunityFeed` (api-client não expõe AbortSignal).
   ========================================================================== */
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import type { Comment } from "@/lib/types";
import {
  insertCommentInTree,
  likeCommentTogglePatch,
  patchCommentInTree,
  type CommentPatch,
} from "@/lib/community/optimistic";

export interface UseCommentsResult {
  comments: Comment[] | null;
  loading: boolean;
  error: string | null;
  /** ids de comentário com curtida em voo. */
  pendingLikeIds: ReadonlySet<number>;
  /**
   * Cria um comentário (resposta a `parentId`, se informado) e insere na
   * árvore local. Rejeita se a API falhar — chamador decide como exibir.
   */
  addComment: (body: string, parentId?: number) => Promise<void>;
  /** Curte/descurte `comment` com update otimista; reverte e seta `error` se falhar. */
  likeComment: (comment: Comment) => Promise<void>;
  /** Recarrega a árvore inteira do zero. */
  refresh: () => void;
}

export function useComments(postId: number): UseCommentsResult {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingLikeIds, setPendingLikeIds] = useState<Set<number>>(new Set());

  const likeInFlight = useRef<Set<number>>(new Set());
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.comments(postId);
      if (seq !== requestSeq.current) return; // resposta obsoleta
      setComments(res.comments);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(errorMessage(err));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addComment = useCallback(
    async (body: string, parentId?: number) => {
      const res = await api.createComment(postId, body, parentId);
      setComments((prev) =>
        prev ? insertCommentInTree(prev, res.comment, parentId ?? null) : [res.comment]
      );
    },
    [postId]
  );

  const likeComment = useCallback(async (comment: Comment) => {
    if (likeInFlight.current.has(comment.id)) return;
    likeInFlight.current.add(comment.id);
    setPendingLikeIds((prev) => new Set(prev).add(comment.id));

    const before: CommentPatch = { likeCount: comment.likeCount, likedByMe: comment.likedByMe };
    setComments((prev) =>
      prev ? patchCommentInTree(prev, comment.id, likeCommentTogglePatch(comment)) : prev
    );

    try {
      const res = await api.likeComment(comment.id);
      setComments((prev) =>
        prev
          ? patchCommentInTree(prev, comment.id, {
              likeCount: res.likeCount,
              likedByMe: res.likedByMe,
            })
          : prev
      );
      setError(null);
    } catch (err) {
      setComments((prev) => (prev ? patchCommentInTree(prev, comment.id, before) : prev));
      setError(errorMessage(err));
    } finally {
      likeInFlight.current.delete(comment.id);
      setPendingLikeIds((prev) => {
        const next = new Set(prev);
        next.delete(comment.id);
        return next;
      });
    }
  }, []);

  return { comments, loading, error, pendingLikeIds, addComment, likeComment, refresh: load };
}
