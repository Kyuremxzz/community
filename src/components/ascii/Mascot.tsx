'use client';

/* ==========================================================================
   Mascot — Chico Caneca, o mascote rubber-hose do TaskForge.
   Troca de frames pelo ms do ciclo (verificação a 12fps, como o legado —
   o hook só escreve no DOM quando o frame de fato muda).
   Decorativo: <pre aria-hidden>. Com reduced-motion fica no primeiro frame.
   ========================================================================== */

import { useCallback } from 'react';
import { MASCOT, type MascotMood } from '@/lib/ascii-engine';
import { useAsciiAnimation } from '@/hooks/useAsciiAnimation';

const MASCOT_FPS = 12;

export interface MascotProps {
  /** Humor do mascote: 'idle' | 'cheer' | 'sad'. */
  mood: MascotMood;
  className?: string;
}

export function Mascot({ mood, className }: MascotProps) {
  const renderAt = useCallback(
    (elapsedMs: number): string => {
      const cycle = MASCOT[mood];
      const f = Math.floor(elapsedMs / cycle.ms) % cycle.frames.length;
      return cycle.frames[f] ?? '';
    },
    [mood],
  );

  const ref = useAsciiAnimation(MASCOT_FPS, renderAt);

  return <pre ref={ref} aria-hidden="true" className={className} />;
}
