"use client";

/* ==========================================================================
   useCommunityFeed — feed paginado de posts da Comunidade (GET /api/posts).

   - Params reativos (`type`/`q`/`sort`/`authorId`): mudar qualquer um deles
     reseta a paginação (offset volta a 0) e recarrega do zero. O hook só lê
     os valores — quem decide QUANDO `q` muda (debounce da busca) é o
     componente `SearchBar`; aqui não tem debounce nenhum.
   - `loadMore()` busca a próxima página (offset = quantidade já carregada) e
     concatena no fim da lista atual.
   - Corrida de requisições: `api-client` não aceita `AbortSignal` (o
     `fetch()` interno de `request()` não expõe `signal`), então não dá pra
     cancelar de verdade. Em vez disso, cada chamada de `fetchPage` carimba um
     número de sequência (`requestSeq`); se a resposta chegar depois de uma
     chamada mais nova já ter sido disparada (params mudaram de novo, ou
     StrictMode rodou o efeito 2x), ela é descartada e não escreve no state.
   ========================================================================== */
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ListPostsParams } from "@/lib/api-client";
import { errorMessage } from "@/lib/api-client";
import type { Post, PostType } from "@/lib/types";
import { patchPostInList, type PostPatch } from "@/lib/community/optimistic";

const PAGE_SIZE = 20;

export interface UseCommunityFeedParams {
  type?: PostType;
  q?: string;
  sort?: "recent" | "popular";
  authorId?: number;
}

export interface UseCommunityFeedResult {
  /** `null` enquanto a primeira página nunca terminou de carregar. */
  posts: Post[] | null;
  /** true durante o carregamento inicial ou um `refresh()`/troca de params. */
  loading: boolean;
  /** true só durante um `loadMore()` (a lista já tem conteúdo). */
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  /** Busca a próxima página e concatena. No-op se já não houver mais páginas ou já tiver uma busca em voo. */
  loadMore: () => void;
  /** Reseta a paginação e recarrega a primeira página com os params atuais. */
  refresh: () => void;
  /**
   * Aplica um patch otimista (curtir/repostar) no post `id`, se ele estiver
   * carregado nesta lista. Pensada pra passar direto pra `usePostActions`:
   * `usePostActions(feed.applyPostPatch)`.
   */
  applyPostPatch: (id: number, patch: PostPatch) => void;
}

export function useCommunityFeed(params: UseCommunityFeedParams): UseCommunityFeedResult {
  const { type, q, sort, authorId } = params;

  const [posts, setPosts] = useState<Post[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const requestSeq = useRef(0);
  // Quantos posts já foram carregados — usado como `offset` do próximo loadMore.
  const offsetRef = useRef(0);

  const fetchPage = useCallback(
    async (offset: number, mode: "reset" | "append") => {
      const seq = ++requestSeq.current;
      if (mode === "reset") setLoading(true);
      else setLoadingMore(true);
      setError(null);

      try {
        const listParams: ListPostsParams = {
          type,
          q: q || undefined,
          sort,
          authorId,
          limit: PAGE_SIZE,
          offset,
        };
        const res = await api.posts(listParams);
        if (seq !== requestSeq.current) return; // resposta obsoleta (params mudaram / StrictMode)

        offsetRef.current = offset + res.posts.length;
        setHasMore(res.hasMore);
        setPosts((prev) => (mode === "append" && prev ? [...prev, ...res.posts] : res.posts));
      } catch (err) {
        if (seq !== requestSeq.current) return;
        setError(errorMessage(err));
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [type, q, sort, authorId]
  );

  // Só depende de `fetchPage`, que por sua vez só muda quando type/q/sort/authorId
  // mudam — então isso cobre tanto o mount quanto qualquer troca de filtro/busca.
  useEffect(() => {
    offsetRef.current = 0;
    void fetchPage(0, "reset");
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    void fetchPage(offsetRef.current, "append");
  }, [fetchPage, loading, loadingMore, hasMore]);

  const refresh = useCallback(() => {
    offsetRef.current = 0;
    void fetchPage(0, "reset");
  }, [fetchPage]);

  const applyPostPatch = useCallback((id: number, patch: PostPatch) => {
    setPosts((prev) => (prev ? patchPostInList(prev, id, patch) : prev));
  }, []);

  return { posts, loading, loadingMore, error, hasMore, loadMore, refresh, applyPostPatch };
}
