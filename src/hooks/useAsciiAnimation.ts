'use client';

/* ==========================================================================
   useAsciiAnimation — ponte genérica entre a engine pura (makeLoop) e o
   React. Recebe fps + callback (elapsedMs) => string e escreve o resultado
   em `ref.current.textContent` — nada de estado React por frame.

   - Cleanup rigoroso: `stop()` no unmount/troca de deps (zero rAF vazando).
   - StrictMode-safe: o efeito é idempotente (monta/desmonta duas vezes ok).
   - prefers-reduced-motion: chama o callback UMA vez (frame estático) e
     não anima.
   - Passe um callback estável (useCallback) — o efeito re-roda quando ele,
     o fps ou a preferência de movimento mudarem.
   ========================================================================== */

import { useEffect, useRef, type RefObject } from 'react';
import { makeLoop } from '@/lib/ascii-engine';
import { useReducedMotion } from './useReducedMotion';

/** Produz o conteúdo de um frame a partir do tempo decorrido em ms. */
export type AsciiFrameFn = (elapsedMs: number) => string;

/**
 * Anima um `<pre>` escrevendo `frame(elapsedMs)` em `textContent` a `fps`.
 * Retorna o ref para pendurar no elemento.
 */
export function useAsciiAnimation(
  fps: number,
  frame: AsciiFrameFn,
): RefObject<HTMLPreElement | null> {
  const ref = useRef<HTMLPreElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Frame inicial imediato (evita o <pre> vazio até o primeiro rAF).
    let last = frame(0);
    el.textContent = last;

    if (reducedMotion) return; // frame estático: não anima

    const loop = makeLoop(fps, (elapsedMs) => {
      const next = frame(elapsedMs);
      if (next !== last) {
        last = next;
        el.textContent = next;
      }
    });

    return () => loop.stop();
  }, [fps, frame, reducedMotion]);

  return ref;
}
