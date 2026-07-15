'use client';

/* ==========================================================================
   useReducedMotion — lê `prefers-reduced-motion: reduce` de forma reativa.
   Implementado com useSyncExternalStore: SSR-safe (servidor => false),
   StrictMode-safe e atualiza ao vivo se o usuário mudar a preferência.
   ========================================================================== */

import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * `true` quando o usuário prefere movimento reduzido.
 * No servidor (SSR) retorna sempre `false`.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
