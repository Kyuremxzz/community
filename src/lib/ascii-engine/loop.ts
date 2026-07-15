/* ==========================================================================
   loop.ts — núcleo de animação: rAF com controle de FPS interno.
   Zero DOM (apenas requestAnimationFrame/cancelAnimationFrame).
   Porte fiel do makeLoop do legado: nada vaza após stop().
   ========================================================================== */

/** Callback de frame: recebe o tempo decorrido em ms desde o primeiro tick. */
export type FrameFn = (elapsedMs: number) => void;

export interface LoopHandle {
  stop(): void;
}

/** Loop em requestAnimationFrame limitado a `fps`. Retorna { stop() }. */
export function makeLoop(fps: number, fn: FrameFn): LoopHandle {
  let alive = true;
  let raf = 0;
  const interval = 1000 / fps;
  let last = -1e9;
  let t0 = -1;

  function tick(ts: number): void {
    if (!alive) return;
    raf = requestAnimationFrame(tick);
    if (t0 < 0) t0 = ts;
    if (ts - last < interval - 0.5) return;
    last = ts;
    fn(ts - t0);
  }

  raf = requestAnimationFrame(tick);

  return {
    stop(): void {
      if (!alive) return;
      alive = false;
      cancelAnimationFrame(raf);
    },
  };
}
