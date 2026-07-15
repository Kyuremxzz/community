/* ==========================================================================
   visually-hidden.ts — estilo inline equivalente à classe .sr-only
   (não editamos globals.css a partir desta camada). Esconde visualmente
   mantendo o conteúdo acessível a leitores de tela.
   ========================================================================== */

import type { CSSProperties } from 'react';

export const VISUALLY_HIDDEN: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
};
