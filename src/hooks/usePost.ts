"use client";

/* ==========================================================================
   usePost — um único Post (tela de detalhe: /comunidade/[id] ou similar).

   Reaproveita a mesma lógica de patch otimista de curtir/repostar que
   `useCommunityFeed` usa (não duplica): expõe `applyPostPatch(id, patch)`
   com a mesma assinatura, só que aplicando em um valor único em vez de uma
   lista. Uso típico:

     const { post, loading, error, applyPostPatch } = usePost(id);
     const { like, repost } = usePostActions(applyPostPatch);

   Corrida de requisições: mesmo padrão de ref-contador dos outros hooks
   desta feature (api-client não expõe AbortSignal pra cancelar de verdade).
   ========================================================================== */
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import type { Post } from "@/lib/types";
import { patchPost, type PostPatch } from "@/lib/community/optimistic";

export interface UsePostResult {
  post: Post | null;
  loading: boolean;
  error: string | null;
  /** Rebusca o post do zero. */
  refresh: () => void;
  /** Aplica um patch otimista (curtir/repostar) no post carregado, se o id bater. */
  applyPostPatch: (id: number, patch: PostPatch) => void;
}

export function usePost(postId: number): UsePostResult {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(postId);
      if (seq !== requestSeq.current) return; // resposta obsoleta
      setPost(res.post);
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

  const applyPostPatch = useCallback((id: number, patch: PostPatch) => {
    setPost((prev) => (prev ? patchPost(prev, id, patch) : prev));
  }, []);

  return { post, loading, error, refresh: load, applyPostPatch };
}
