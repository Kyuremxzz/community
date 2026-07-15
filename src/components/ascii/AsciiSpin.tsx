'use client';

/* ==========================================================================
   AsciiSpin — forma 3D girando em ASCII (donut, cubo, diamante, estrela,
   caneca) a 30fps via engine pura. Decorativo: <pre aria-hidden>.
   Com prefers-reduced-motion renderiza um único frame fixo (A=0.6, B=0.8).
   ========================================================================== */

import { useCallback } from 'react';
import {
  DEFAULT_RAMP,
  getShape,
  renderFrame,
  spinAngles,
  type ShapeName,
} from '@/lib/ascii-engine';
import { useAsciiAnimation } from '@/hooks/useAsciiAnimation';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const SPIN_FPS = 30;

// Frame estático "bonito" para prefers-reduced-motion.
const STATIC_A = 0.6;
const STATIC_B = 0.8;

export interface AsciiSpinProps {
  /** Forma 3D a girar. */
  shape: ShapeName;
  /** Largura da grade em colunas. @default 60 */
  width?: number;
  /** Altura da grade em linhas. @default 24 */
  height?: number;
  /** Multiplicador de velocidade do giro. @default 1 */
  speed?: number;
  /** Rampa de luminância (escuro -> claro). @default DEFAULT_RAMP */
  ramp?: string;
  className?: string;
}

export function AsciiSpin({
  shape,
  width = 60,
  height = 24,
  speed = 1,
  ramp = DEFAULT_RAMP,
  className,
}: AsciiSpinProps) {
  const reducedMotion = useReducedMotion();

  const renderAt = useCallback(
    (elapsedMs: number): string => {
      const s = getShape(shape);
      if (reducedMotion) {
        return renderFrame(s, STATIC_A, STATIC_B, width, height, ramp);
      }
      const { A, B } = spinAngles(elapsedMs / 1000, speed, shape === 'mug');
      return renderFrame(s, A, B, width, height, ramp);
    },
    [shape, width, height, speed, ramp, reducedMotion],
  );

  const ref = useAsciiAnimation(SPIN_FPS, renderAt);

  return <pre ref={ref} aria-hidden="true" className={className} />;
}
