/* ==========================================================================
   ascii-engine — porte TS puro de legacy/public/js/ascii-engine.js.
   Módulos sem DOM/React: recebem/retornam strings e números.

   NÃO portados de propósito:
   - boil() e irisWipe(): dependem de DOM e medidas de layout; a camada
     React (components/ascii) fará versões próprias na Fase 2A.
   - typewriter(): a camada React implementa; daqui sai só o cursor.
   ========================================================================== */

export { makeLoop } from './loop';
export type { FrameFn, LoopHandle } from './loop';

export { RAW_FONT, bigLines, title } from './font';

export {
  buildDonut,
  buildCube,
  buildDiamond,
  buildStar,
  buildMug,
  getShape,
} from './shapes';
export type { Shape, ShapeName } from './shapes';

export { DEFAULT_RAMP, renderFrame, spinAngles } from './render3d';

export { MASCOT, normalizeFrames } from './mascot';
export type { MascotCycle, MascotMood } from './mascot';

export { slotMeter, countdownText, expiredBlocks } from './meters';

/** Cursor do efeito typewriter (a animação em si vive na camada React). */
export const TYPEWRITER_CURSOR = '█';
