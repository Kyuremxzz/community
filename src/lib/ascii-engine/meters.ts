/* ==========================================================================
   meters.ts — SLOT METER (vagas do squad como fichas ASCII) e helpers do
   COUNTDOWN (dígitos figlet + blocos "PRAZO/ESTOURADO").
   Porte puro do legado: retorna strings, sem DOM e sem relógio próprio.
   ========================================================================== */

import { bigLines } from './font';

function pad2(n: number): string {
  return (n < 10 ? '0' : '') + n;
}

function repeatChar(ch: string, n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += ch;
  return s;
}

function centerPad(line: string, width: number): string {
  const extra = width - line.length;
  if (extra <= 0) return line;
  const left = extra >> 1;
  return repeatChar(' ', left) + line + repeatChar(' ', extra - left);
}

/* ----------------------------------------------------------------------
   SLOT METER — mesma arte e mesmo header do legado.
   ---------------------------------------------------------------------- */
const SLOT_W = 11;
const SLOT_FILLED = [
  ' (o)   (o) ',
  '   \\   /   ',
  '   (^o^)   ',
  '    | |    ',
  '   _/ \\_   '
];
const SLOT_EMPTY = [
  ' . - - - . ',
  ' .       . ',
  ' :   ?   : ',
  ' .       . ',
  ' . _ _ _ . '
];

/** Fichas de vagas do squad. Retorna a string multilinha completa. */
export function slotMeter(
  filled: number,
  total: number,
  roleNames: ReadonlyArray<string | null | undefined> = [],
): string {
  total = Math.max(0, total | 0);
  filled = Math.max(0, Math.min(filled | 0, total));
  const GAP = '  ';
  const rows = ['', '', '', '', ''];
  let names = '';
  let tags = '';
  for (let i = 0; i < total; i++) {
    const art = i < filled ? SLOT_FILLED : SLOT_EMPTY;
    for (let r = 0; r < 5; r++) {
      rows[r] += (i > 0 ? GAP : '') + art[r]!;
    }
    let nm = String(roleNames[i] ?? '').toUpperCase();
    if (nm.length > SLOT_W) nm = nm.slice(0, SLOT_W);
    names += (i > 0 ? GAP : '') + centerPad(nm, SLOT_W);
    // precedência igual ao legado: o slice só se aplica ao texto "vaga"
    tags += (i > 0 ? GAP : '') +
      centerPad(i < filled ? '\\o/ A BORDO' : '. . vaga . .'.slice(0, SLOT_W), SLOT_W);
  }
  const bar = '[' + repeatChar('#', filled) + repeatChar('.', total - filled) + ']';
  const header = '== SQUAD ' + bar + ' ' + filled + '/' + total + ' ==';
  const width = Math.max(header.length, rows[0]!.length);
  const out = [centerPad(header, width), ''];
  for (let r = 0; r < 5; r++) out.push(rows[r]!);
  out.push(names);
  out.push(tags);
  return out.join('\n');
}

/* ----------------------------------------------------------------------
   COUNTDOWN — helpers puros. A camada React decide o "agora" e alterna
   os blocos expirados (mesmo ritmo do legado: 650ms por bloco).
   ---------------------------------------------------------------------- */

/** Relógio '00d 00:00:00' em dígitos figlet para o tempo restante em ms. */
export function countdownText(remainingMs: number): string {
  let s = Math.floor(Math.max(0, remainingMs) / 1000);
  let d = Math.floor(s / 86400); s -= d * 86400;
  const hh = Math.floor(s / 3600); s -= hh * 3600;
  const mm = Math.floor(s / 60);
  const ss = s - mm * 60;
  if (d > 99) d = 99;
  return bigLines(pad2(d) + 'd ' + pad2(hh) + ':' + pad2(mm) + ':' + pad2(ss)).join('\n');
}

/**
 * Blocos do estado "estourado", pré-computados com largura comum:
 * `a` = relógio zerado centralizado em 11 linhas; `b` = PRAZO / ESTOURADO
 * em fonte grande. Mesma lógica blockA/blockB do legado.
 */
export function expiredBlocks(): { a: string; b: string } {
  const expClock = bigLines('00d 00:00:00');
  const expTop = bigLines('PRAZO');
  const expBottom = bigLines('ESTOURADO');
  const expW = Math.max(expClock[0]!.length, expTop[0]!.length, expBottom[0]!.length);

  // relógio zerado, centralizado em 11 linhas
  const outA: string[] = ['', '', ''];
  for (let i = 0; i < 5; i++) outA.push(centerPad(expClock[i]!, expW));
  outA.push('', '', '');
  for (let i = 0; i < 3; i++) outA[i] = centerPad('', expW);
  outA[8] = centerPad('', expW); outA[9] = centerPad('', expW); outA[10] = centerPad('', expW);

  // PRAZO / ESTOURADO em fonte grande
  const outB: string[] = [];
  for (let i = 0; i < 5; i++) outB.push(centerPad(expTop[i]!, expW));
  outB.push(centerPad('', expW));
  for (let i = 0; i < 5; i++) outB.push(centerPad(expBottom[i]!, expW));

  return { a: outA.join('\n'), b: outB.join('\n') };
}
