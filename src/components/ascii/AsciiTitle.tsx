/* ==========================================================================
   AsciiTitle — banner figlet estático (server component, sem "use client").
   O <pre> é decorativo (aria-hidden); passe `label` para emitir um heading
   visually-hidden acessível. Uso pontual — a rota /demo usa.
   ========================================================================== */

import { title } from '@/lib/ascii-engine';
import { VISUALLY_HIDDEN } from './visually-hidden';

export interface AsciiTitleProps {
  /** Texto do banner (A-Z, 0-9 e pontuação suportada pela fonte). */
  text: string;
  /** Se presente, renderiza um <h2> visually-hidden com este texto. */
  label?: string;
  className?: string;
}

export function AsciiTitle({ text, label, className }: AsciiTitleProps) {
  return (
    <>
      {label ? <h2 style={VISUALLY_HIDDEN}>{label}</h2> : null}
      <pre aria-hidden="true" className={className}>
        {title(text)}
      </pre>
    </>
  );
}
