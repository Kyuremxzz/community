/* ==========================================================================
   shapes.ts — nuvens de pontos com normais para o motor 3D.
   Matemática idêntica ao legado (mesmos passos, raios e recortes).
   ========================================================================== */

export type ShapeName = 'donut' | 'cube' | 'diamond' | 'star' | 'mug';

export interface Shape {
  /** Pontos empacotados: [x, y, z, nx, ny, nz, ...] */
  pts: Float64Array;
  /** Raio máximo da forma (para enquadrar a projeção). */
  maxR: number;
}

const TWO_PI = Math.PI * 2;

function pushPt(
  arr: number[],
  x: number, y: number, z: number,
  nx: number, ny: number, nz: number,
): void {
  arr.push(x, y, z, nx, ny, nz);
}

export function buildDonut(): Shape {
  const pts: number[] = [];
  const R1 = 1, R2 = 2;
  for (let t = 0; t < TWO_PI; t += 0.12) {
    const ct = Math.cos(t), st = Math.sin(t);
    const cr = R2 + R1 * ct;
    for (let p = 0; p < TWO_PI; p += 0.045) {
      const cp = Math.cos(p), sp = Math.sin(p);
      pushPt(pts, cr * cp, R1 * st, cr * sp, ct * cp, st, ct * sp);
    }
  }
  return { pts: new Float64Array(pts), maxR: R1 + R2 };
}

export function buildCube(): Shape {
  const pts: number[] = [];
  const hs = 1.7, steps = 40;
  for (let f = 0; f < 6; f++) {
    const axis = f >> 1;
    const sign = (f & 1) ? 1 : -1;
    const o1 = (axis + 1) % 3, o2 = (axis + 2) % 3;
    for (let i = 0; i < steps; i++) {
      for (let j = 0; j < steps; j++) {
        const u = -hs + (2 * hs * i) / (steps - 1);
        const v = -hs + (2 * hs * j) / (steps - 1);
        const p: [number, number, number] = [0, 0, 0];
        const n: [number, number, number] = [0, 0, 0];
        p[axis] = sign * hs; p[o1] = u; p[o2] = v;
        n[axis] = sign;
        pushPt(pts, p[0], p[1], p[2], n[0], n[1], n[2]);
      }
    }
  }
  return { pts: new Float64Array(pts), maxR: hs * Math.sqrt(3) };
}

export function buildDiamond(): Shape {
  /* Gema lapidada: mesa plana, coroa e pavilhão com normais facetadas. */
  const pts: number[] = [];
  const SEC = 8, secA = TWO_PI / SEC;
  const tableR = 1.0, tableY = 1.0;
  const girdleR = 2.0, girdleY = 0.35;
  const apexY = -2.1;
  let a: number, fa: number, nx: number, ny: number, nz: number, len: number;
  // mesa (topo plano)
  for (let r = 0.12; r <= tableR; r += 0.16) {
    const stepsA = Math.max(8, Math.round(TWO_PI * r / 0.14));
    for (let k = 0; k < stepsA; k++) {
      a = (k / stepsA) * TWO_PI;
      pushPt(pts, r * Math.cos(a), tableY, r * Math.sin(a), 0, 1, 0);
    }
  }
  // coroa (mesa -> cintura), normal por setor (facetas)
  for (let t = 0; t <= 1.001; t += 0.09) {
    const cr = tableR + (girdleR - tableR) * t;
    const cy = tableY + (girdleY - tableY) * t;
    for (a = 0; a < TWO_PI; a += 0.07) {
      fa = (Math.floor(a / secA) + 0.5) * secA;
      nx = 0.65 * Math.cos(fa); ny = 1; nz = 0.65 * Math.sin(fa);
      len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      pushPt(pts, cr * Math.cos(a), cy, cr * Math.sin(a), nx / len, ny / len, nz / len);
    }
  }
  // pavilhão (cintura -> ponta), normal por setor
  for (let t = 0; t <= 1.001; t += 0.055) {
    const pr = girdleR * (1 - t);
    const py = girdleY + (apexY - girdleY) * t;
    for (a = 0; a < TWO_PI; a += 0.08) {
      fa = (Math.floor(a / secA) + 0.5) * secA;
      nx = 2.45 * Math.cos(fa); ny = -2; nz = 2.45 * Math.sin(fa);
      len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      pushPt(pts, pr * Math.cos(a), py, pr * Math.sin(a), nx / len, ny / len, nz / len);
    }
  }
  return { pts: new Float64Array(pts), maxR: 2.2 };
}

export function buildStar(): Shape {
  /* Estrela de 5 pontas extrudada: 10 arestas x 2 ápices = 20 triângulos. */
  const pts: number[] = [];
  const outer = 2.2, inner = 0.92, zh = 0.5;
  const verts: Array<[number, number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const ang = Math.PI / 2 + (i * Math.PI) / 5;
    const rad = (i % 2 === 0) ? outer : inner;
    verts.push([rad * Math.cos(ang), rad * Math.sin(ang), 0]);
  }
  function addTri(
    a: readonly [number, number, number],
    b: readonly [number, number, number],
    c: readonly [number, number, number],
  ): void {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]] as const;
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]] as const;
    let nx = u[1] * v[2] - u[2] * v[1];
    let ny = u[2] * v[0] - u[0] * v[2];
    let nz = u[0] * v[1] - u[1] * v[0];
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= len; ny /= len; nz /= len;
    const gx = (a[0] + b[0] + c[0]) / 3;
    const gy = (a[1] + b[1] + c[1]) / 3;
    const gz = (a[2] + b[2] + c[2]) / 3;
    if (nx * gx + ny * gy + nz * gz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const steps = 22;
    for (let p = 0; p <= steps; p++) {
      for (let q = 0; q <= steps - p; q++) {
        const s = p / steps, t = q / steps;
        pushPt(pts,
          a[0] + s * u[0] + t * v[0],
          a[1] + s * u[1] + t * v[1],
          a[2] + s * u[2] + t * v[2],
          nx, ny, nz);
      }
    }
  }
  const front: [number, number, number] = [0, 0, zh];
  const back: [number, number, number] = [0, 0, -zh];
  for (let i = 0; i < 10; i++) {
    const v1 = verts[i]!, v2 = verts[(i + 1) % 10]!;
    addTri(front, v1, v2);
    addTri(back, v1, v2);
  }
  return { pts: new Float64Array(pts), maxR: Math.sqrt(outer * outer + zh * zh) };
}

export function buildMug(): Shape {
  /* Caneca mascote: cilindro oco (parede externa/interna, borda, fundo)
     + alça em meio-toro recortado. Referência Cuphead. */
  const pts: number[] = [];
  const BR = 1.6, BH = 1.8, IR = 1.3;
  let a: number, y: number, r: number, ca: number, sa: number;
  // parede externa
  for (a = 0; a < TWO_PI; a += 0.055) {
    ca = Math.cos(a); sa = Math.sin(a);
    for (y = -BH; y <= BH; y += 0.11) {
      pushPt(pts, BR * ca, y, BR * sa, ca, 0, sa);
    }
  }
  // parede interna (caneca aberta)
  for (a = 0; a < TWO_PI; a += 0.075) {
    ca = Math.cos(a); sa = Math.sin(a);
    for (y = -BH + 0.35; y <= BH; y += 0.13) {
      pushPt(pts, IR * ca, y, IR * sa, -ca, 0, -sa);
    }
  }
  // borda superior (anel plano)
  for (a = 0; a < TWO_PI; a += 0.055) {
    ca = Math.cos(a); sa = Math.sin(a);
    for (r = IR; r <= BR; r += 0.075) {
      pushPt(pts, r * ca, BH, r * sa, 0, 1, 0);
    }
  }
  // fundo externo
  for (a = 0; a < TWO_PI; a += 0.07) {
    ca = Math.cos(a); sa = Math.sin(a);
    for (r = 0.1; r <= BR; r += 0.12) {
      pushPt(pts, r * ca, -BH, r * sa, 0, -1, 0);
    }
  }
  // fundo interno ("café")
  for (a = 0; a < TWO_PI; a += 0.09) {
    ca = Math.cos(a); sa = Math.sin(a);
    for (r = 0.1; r <= IR; r += 0.15) {
      pushPt(pts, r * ca, -BH + 0.35, r * sa, 0, 1, 0);
    }
  }
  // alça (toro no plano x-y, recortando o que entra no corpo)
  const HC = 2.0, HR = 0.75, HT = 0.19;
  for (let p = 0; p < TWO_PI; p += 0.06) {
    const cp = Math.cos(p), sp = Math.sin(p);
    const rx = HC + HR * cp, ry = HR * sp;
    for (let t = 0; t < TWO_PI; t += 0.34) {
      const nx = Math.cos(t) * cp;
      const ny = Math.cos(t) * sp;
      const nz = Math.sin(t);
      const px = rx + HT * nx, py = ry + HT * ny, pz = HT * nz;
      if (Math.sqrt(px * px + pz * pz) < BR + 0.02 && Math.abs(py) < BH) continue;
      pushPt(pts, px, py, pz, nx, ny, nz);
    }
  }
  return { pts: new Float64Array(pts), maxR: HC + HR + HT };
}

const shapeCache = new Map<ShapeName, Shape>();

/** Retorna a forma pelo nome, construindo e cacheando na primeira chamada. */
export function getShape(name: ShapeName): Shape {
  const cached = shapeCache.get(name);
  if (cached) return cached;
  let s: Shape;
  switch (name) {
    case 'cube': s = buildCube(); break;
    case 'star': s = buildStar(); break;
    case 'mug': s = buildMug(); break;
    case 'diamond': s = buildDiamond(); break;
    case 'donut': s = buildDonut(); break;
  }
  shapeCache.set(name, s);
  return s;
}
