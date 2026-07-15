/* ==========================================================================
   render3d.ts — projeção perspectiva + z-buffer + rampa de luminância.
   Função pura extraída do spin() do legado: mesma matemática, mesma luz
   (lx=0, ly=0.55, lz=-0.83), mesmos K1/K2. Retorna a string do frame.
   ========================================================================== */

import type { Shape } from './shapes';

export const DEFAULT_RAMP = '.,-~:;=!*#$@';

// luz de cima, atrás do espectador (idêntica ao legado)
const LX = 0, LY = 0.55, LZ = -0.83;

/**
 * Renderiza um frame da forma girada (B em Y, depois A em X) numa grade
 * width x height. Puro: sem estado, sem DOM.
 */
export function renderFrame(
  shape: Shape,
  A: number,
  B: number,
  width: number,
  height: number,
  ramp: string = DEFAULT_RAMP,
): string {
  const pts = shape.pts;
  const maxR = shape.maxR;
  const K2 = maxR * 1.8;
  const K1 = Math.min(width, height * 2) * K2 * 3 / (8 * maxR);
  const size = width * height;
  const zb = new Float64Array(size);
  const buf: string[] = new Array<string>(size).fill(' ');
  const rampMax = ramp.length - 1;
  const halfW = width / 2, halfH = height / 2;

  const cA = Math.cos(A), sA = Math.sin(A);
  const cB = Math.cos(B), sB = Math.sin(B);

  for (let i = 0; i < pts.length; i += 6) {
    const x = pts[i]!, y = pts[i + 1]!, z = pts[i + 2]!;
    // gira em torno de Y (B), depois inclina em X (A)
    const x1 = x * cB + z * sB;
    const z1 = z * cB - x * sB;
    const y2 = y * cA - z1 * sA;
    const z2 = y * sA + z1 * cA;
    const ooz = 1 / (z2 + K2);
    const sx = (halfW + K1 * ooz * x1) | 0;
    const sy = (halfH - K1 * ooz * y2 * 0.5) | 0;
    if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;
    const idx = sy * width + sx;
    if (ooz > zb[idx]!) {
      zb[idx] = ooz;
      const nx = pts[i + 3]!, ny = pts[i + 4]!, nz = pts[i + 5]!;
      const nx1 = nx * cB + nz * sB;
      const nz1 = nz * cB - nx * sB;
      const ny2 = ny * cA - nz1 * sA;
      const nz2 = ny * sA + nz1 * cA;
      const L = nx1 * LX + ny2 * LY + nz2 * LZ;
      let ci = L <= 0 ? 0 : ((L * rampMax + 0.5) | 0);
      if (ci > rampMax) ci = rampMax;
      buf[idx] = ramp.charAt(ci);
    }
  }

  let out = '';
  for (let yy = 0; yy < height; yy++) {
    out += buf.slice(yy * width, (yy + 1) * width).join('');
    if (yy < height - 1) out += '\n';
  }
  return out;
}

/**
 * Ângulos do loop do spin legado para `tSeconds` (segundos desde o início)
 * e `speed`. A caneca fica reconhecível: gira em Y e balança a inclinação
 * em X; as demais formas giram nos dois eixos.
 */
export function spinAngles(
  tSeconds: number,
  speed: number,
  isMug: boolean,
): { A: number; B: number } {
  const ts = tSeconds * speed;
  const A = isMug ? 0.45 + 0.5 * Math.sin(ts * 1.1) : ts * 1.0;
  const B = ts * 0.62;
  return { A, B };
}
