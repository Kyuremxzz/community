'use client';

/* ==========================================================================
   Typewriter — texto letra a letra com cursor █ piscando a cada 380ms
   (30fps, como o legado). Ao terminar, mantém o texto completo e para o
   loop. Com prefers-reduced-motion mostra o texto completo direto.

   Como o texto É conteúdo (não decoração), o elemento externo carrega o
   texto completo em aria-label; só o conteúdo animado interno é aria-hidden.
   ========================================================================== */

import { useEffect, useRef } from 'react';
import { makeLoop, TYPEWRITER_CURSOR } from '@/lib/ascii-engine';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const TYPEWRITER_FPS = 30;
const CURSOR_BLINK_MS = 380;

export interface TypewriterProps {
  /** Texto a datilografar. */
  text: string;
  /** Caracteres por segundo. @default 40 */
  cps?: number;
  className?: string;
}

export function Typewriter({ text, cps = 40, className }: TypewriterProps) {
  const innerRef = useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    if (reducedMotion) {
      el.textContent = text; // sem animação: texto completo direto
      return;
    }

    el.textContent = '';
    const loop = makeLoop(TYPEWRITER_FPS, (elapsedMs) => {
      const shown = Math.min(text.length, Math.floor((elapsedMs / 1000) * cps));
      if (shown >= text.length) {
        el.textContent = text; // terminou: mantém o texto, sem cursor
        loop.stop();
        return;
      }
      const cursor =
        Math.floor(elapsedMs / CURSOR_BLINK_MS) % 2 === 0
          ? TYPEWRITER_CURSOR
          : ' ';
      el.textContent = text.slice(0, shown) + cursor;
    });

    return () => loop.stop();
  }, [text, cps, reducedMotion]);

  return (
    <span className={className} aria-label={text}>
      <span ref={innerRef} aria-hidden="true" />
    </span>
  );
}
