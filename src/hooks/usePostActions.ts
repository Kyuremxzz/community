"use client";

/* ==========================================================================
   usePostActions — curtir/repostar um Post com update otimista.

   Não guarda nenhuma lista/post: quem chama passa o `Post` atual (de onde
   ele estiver — feed, post único, perfil) pra `like`/`repost`, e uma função
   `applyPatch(id, patch)` que sabe escrever de volta no estado de onde esse
   post veio. `useCommunityFeed` e `usePost` já expõem exatamente essa função
   (`applyPostPatch`), então o uso típico é:

     const feed = useCommunityFeed({ sort: "recent" });
     const { like, repost } = usePostActions(feed.applyPostPatch);
     ...
     <button onClick={() => like(post)}>curtir</button>

   Isso mantém a regra de "curtir otimista" num único lugar (ver
   `src/lib/community/optimistic.ts`) reaproveitável por qualquer tela.
   ========================================================================== */
import { useCallback, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import type { Post } from "@/lib/types";
import { likeTogglePatch, repostTogglePatch, type PostPatch } from "@/lib/community/optimistic";

export type ApplyPostPatch = (id: number, patch: PostPatch) => void;

export interface UsePostActionsResult {
  /** Curte/descurte `post`: aplica o patch otimista, chama a API, reconcilia com a resposta e reverte em caso de erro. */
  like: (post: Post) => Promise<void>;
  /** Reposta/desfaz repost de `post` (citação opcional), mesma estratégia otimista de `like`. */
  repost: (post: Post, comment?: string) => Promise<void>;
  /** ids de post com curtida em voo — use pra desabilitar o botão de curtir daquele post. */
  pendingLikeIds: ReadonlySet<number>;
  /** ids de post com repost em voo. */
  pendingRepostIds: ReadonlySet<number>;
  /** Mensagem da última falha (curtir ou repostar), ou null. Some sozinha na próxima ação bem-sucedida. */
  error: string | null;
}

export function usePostActions(applyPatch: ApplyPostPatch): UsePostActionsResult {
  const [pendingLikeIds, setPendingLikeIds] = useState<Set<number>>(new Set());
  const [pendingRepostIds, setPendingRepostIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Espelham os sets acima, mas em ref: evitam clique duplo no MESMO post
  // antes do próximo render aplicar o novo estado de `pending*Ids`.
  const likeInFlight = useRef<Set<number>>(new Set());
  const repostInFlight = useRef<Set<number>>(new Set());

  const like = useCallback(
    async (post: Post) => {
      if (likeInFlight.current.has(post.id)) return;
      likeInFlight.current.add(post.id);
      setPendingLikeIds((prev) => new Set(prev).add(post.id));

      const before: PostPatch = { likeCount: post.likeCount, likedByMe: post.likedByMe };
      applyPatch(post.id, likeTogglePatch(post));

      try {
        const res = await api.likePost(post.id);
        // Reconcilia com o valor real do servidor (não apenas o toggle local).
        applyPatch(post.id, { likeCount: res.likeCount, likedByMe: res.likedByMe });
        setError(null);
      } catch (err) {
        applyPatch(post.id, before); // reverte pro valor de antes do clique
        setError(errorMessage(err));
      } finally {
        likeInFlight.current.delete(post.id);
        setPendingLikeIds((prev) => {
          const next = new Set(prev);
          next.delete(post.id);
          return next;
        });
      }
    },
    [applyPatch]
  );

  const repost = useCallback(
    async (post: Post, comment?: string) => {
      if (repostInFlight.current.has(post.id)) return;
      repostInFlight.current.add(post.id);
      setPendingRepostIds((prev) => new Set(prev).add(post.id));

      const before: PostPatch = {
        repostCount: post.repostCount,
        repostedByMe: post.repostedByMe,
      };
      applyPatch(post.id, repostTogglePatch(post));

      try {
        const res = await api.repostPost(post.id, comment);
        // A API sempre devolve o post ORIGINAL com contadores atualizados.
        applyPatch(post.id, {
          repostCount: res.post.repostCount,
          repostedByMe: res.post.repostedByMe,
        });
        setError(null);
      } catch (err) {
        applyPatch(post.id, before);
        setError(errorMessage(err));
      } finally {
        repostInFlight.current.delete(post.id);
        setPendingRepostIds((prev) => {
          const next = new Set(prev);
          next.delete(post.id);
          return next;
        });
      }
    },
    [applyPatch]
  );

  return { like, repost, pendingLikeIds, pendingRepostIds, error };
}
