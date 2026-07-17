/**
 * Helpers de formatação e mapeamentos de domínio → visual da Comunidade.
 * Sem JSX — só constantes e funções puras, no mesmo espírito de
 * `src/components/format.tsx` (que cobre projetos/squads).
 */
import type { PostType } from "@/lib/types";
import type { StampTone } from "@/components/ui";

/** Rótulo + tom do carimbo de cada tipo de post (usado por TagStamp e TagFilter). */
export const POST_TYPE_META: Record<PostType, { label: string; tone: StampTone }> = {
  projeto: { label: "PROJETO", tone: "teal" },
  discussao: { label: "DISCUSSÃO", tone: "neutral" },
  ajuda: { label: "AJUDA", tone: "gold" },
  // pedido no brief: a tag de dúvida precisa se destacar visualmente das outras
  // três — tom coral (mesma família do accent) + prefixo "?" no rótulo.
  duvida: { label: "? DÚVIDA", tone: "coral" },
};

export const POST_TYPES_ORDER: readonly PostType[] = ["projeto", "duvida", "discussao", "ajuda"];

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const WEEK = DAY * 7;

/**
 * Data relativa curta: "agora", "5min", "3h", "2d", "3sem" — e a partir de
 * ~4 semanas cai para a data absoluta curta ("14 jul. 2026"), igual ao
 * `fmtDate` de `components/format.tsx`.
 */
export function fmtRelativeDate(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 0 || diff < MINUTE) return "agora";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}min`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  if (diff < WEEK) return `${Math.floor(diff / DAY)}d`;
  if (diff < WEEK * 4) return `${Math.floor(diff / WEEK)}sem`;
  return new Date(ts).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Hash simples e determinístico (djb2) — mesma string sempre cai no mesmo índice. */
export function hashString(value: string): number {
  let h = 5381;
  for (let i = 0; i < value.length; i++) {
    h = (h * 33) ^ value.charCodeAt(i);
  }
  return Math.abs(h);
}

/** "Ana Torres" -> "AT"; "chico" -> "CH". Máximo 2 letras, sempre maiúsculas. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** Hostname curto para exibir em chips de link ("https://x.com/y" -> "x.com"). */
export function shortHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
