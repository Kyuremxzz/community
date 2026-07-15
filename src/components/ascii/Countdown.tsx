'use client';

/* ==========================================================================
   Countdown — relógio figlet '00d 00:00:00' a 4fps. Quando o prazo estoura,
   alterna os blocos "00d 00:00:00" / "PRAZO ESTOURADO" a cada 650ms (mesma
   cadência do legado).

   Acessibilidade: o <pre> animado é aria-hidden; um <span> visually-hidden
   com aria-live="polite" anuncia o tempo restante em texto legível
   ("3 dias, 4 horas e 12 minutos restantes"), atualizado no máximo 1x/min.
   ========================================================================== */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { countdownText, expiredBlocks } from '@/lib/ascii-engine';
import { useAsciiAnimation } from '@/hooks/useAsciiAnimation';
import { VISUALLY_HIDDEN } from './visually-hidden';

const COUNTDOWN_FPS = 4;
const EXPIRED_BLINK_MS = 650;
const READABLE_REFRESH_MS = 60_000;

export interface CountdownProps {
  /** Fim do prazo em epoch ms (ex.: Date.parse(...) ou getTime()). */
  endsAt: number;
  className?: string;
}

/** "3 dias, 4 horas e 12 minutos restantes" (ou "Prazo estourado"). */
function readableRemaining(remainingMs: number): string {
  if (remainingMs <= 0) return 'Prazo estourado';
  const totalMin = Math.floor(remainingMs / 60_000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d} ${d === 1 ? 'dia' : 'dias'}`);
  if (h > 0) parts.push(`${h} ${h === 1 ? 'hora' : 'horas'}`);
  parts.push(`${m} ${m === 1 ? 'minuto' : 'minutos'}`);
  const text =
    parts.length > 1
      ? `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`
      : parts[0]!;
  return `${text} restantes`;
}

export function Countdown({ endsAt, className }: CountdownProps) {
  const blocks = useMemo(() => expiredBlocks(), []);

  const renderAt = useCallback(
    (elapsedMs: number): string => {
      const remaining = endsAt - Date.now();
      if (remaining > 0) return countdownText(remaining);
      const showClock = Math.floor(elapsedMs / EXPIRED_BLINK_MS) % 2 === 0;
      return showClock ? blocks.a : blocks.b;
    },
    [endsAt, blocks],
  );

  const ref = useAsciiAnimation(COUNTDOWN_FPS, renderAt);

  // Texto legível para leitores de tela, atualizado no máximo 1x/minuto.
  const [readable, setReadable] = useState('');
  useEffect(() => {
    const update = (): void => setReadable(readableRemaining(endsAt - Date.now()));
    update();
    const id = setInterval(update, READABLE_REFRESH_MS);
    return () => clearInterval(id);
  }, [endsAt]);

  return (
    <>
      <pre ref={ref} aria-hidden="true" className={className} />
      <span style={VISUALLY_HIDDEN} aria-live="polite">
        {readable}
      </span>
    </>
  );
}
