/* ==========================================================================
   mascot.ts — Chico Caneca, personagem rubber-hose do TaskForge.
   Frames desenhados à mão, copiados EXATAMENTE do legado; cada ciclo é
   normalizado para as mesmas dimensões (nada pula entre frames).
   ========================================================================== */

export type MascotMood = 'idle' | 'cheer' | 'sad';

export interface MascotCycle {
  /** Duração de cada frame em ms. */
  ms: number;
  /** Frames já normalizados (string multilinha por frame). */
  frames: string[];
}

/* Normaliza um conjunto de frames (arrays de linhas) para dimensões
   idênticas — crítico para os ciclos não "pularem". */
export function normalizeFrames(frames: ReadonlyArray<readonly string[]>): string[] {
  let maxW = 0, maxH = 0;
  for (let i = 0; i < frames.length; i++) {
    maxH = Math.max(maxH, frames[i]!.length);
    for (let j = 0; j < frames[i]!.length; j++) {
      maxW = Math.max(maxW, frames[i]![j]!.length);
    }
  }
  const out: string[] = [];
  for (let i = 0; i < frames.length; i++) {
    const lines: string[] = [];
    for (let j = 0; j < maxH; j++) {
      let ln = frames[i]![j] ?? '';
      while (ln.length < maxW) ln += ' ';
      lines.push(ln);
    }
    out.push(lines.join('\n'));
  }
  return out;
}

export const MASCOT: Record<MascotMood, MascotCycle> = {
  idle: {
    ms: 450,
    frames: normalizeFrames([
      [
        "       ( (",
        "        ) )",
        "    .=========.",
        "    |  0   0  |=,",
        "    |    ,    | |",
        "  ,=|  \\___/  |='",
        " (o)|         |",
        "    |         |",
        "    '========='",
        "      |     |",
        "     _|     |_",
        "    (__)   (__)"
      ],
      [
        "        ) )",
        "       ( (",
        "    .=========.",
        "  ,=|  0   0  |=,",
        " (o)|    ,    | |",
        "    |  \\___/  |='",
        "    |         |",
        "    |         |",
        "    '========='",
        "      |     |",
        "     _|     |_",
        "    (__)   (__)"
      ]
    ])
  },
  cheer: {
    ms: 280,
    frames: normalizeFrames([
      [
        " (o)         (o)",
        "   \\         /",
        "    .=========.",
        "    |  ^   ^  |=,",
        "    |    o    | |",
        "    |  \\___/  |='",
        "    |         |",
        "    |         |",
        "    '========='",
        "      |     |",
        "     _|     |_",
        "    (__)   (__)"
      ],
      [
        "(o)             (o)",
        "  \\_           _/",
        "    .=========.",
        "    |  ^   ^  |=,",
        "    |    O    | |",
        "    |  \\___/  |='",
        "    |         |",
        "    |         |",
        "    '========='",
        "      |     |",
        "     _|     |_",
        "    (__)   (__)"
      ]
    ])
  },
  sad: {
    ms: 500,
    frames: normalizeFrames([
      [
        "",
        "",
        "    .=========.",
        "    |  T   T  |=,",
        "  ,-|      .  | |",
        "  | |   ___   |='",
        "  | |  /   \\  |-,",
        " (o)|         | |",
        "    '========='(o)",
        "      |     |",
        "     _|     |_",
        "    (__)   (__)"
      ],
      [
        "",
        "",
        "    .=========.",
        "    |  T   T  |=,",
        "  ,-|         | |",
        "  | |   ___   |='",
        "  | |  /   \\  |-,",
        " (o)|      o  | |",
        "    '========='(o)",
        "      |     |",
        "     _|     |_",
        "    (__)   (__)"
      ],
      [
        "",
        "",
        "    .=========.",
        "    |  T   T  |=,",
        "  ,-|         | |",
        "  | |   ___   |='",
        "  | |  /   \\  |-,",
        " (o)|         | |",
        "    '========='(o)",
        "      |     |",
        "     _|    o|_",
        "    (__)   (__)"
      ]
    ])
  }
};
