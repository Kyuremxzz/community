/**
 * Helpers de formatação e mapeamentos de domínio → visual, copiados do
 * legado (`legacy/public/js/app.js`) para preservar microcopy e regras.
 * Sem JSX — só constantes e funções puras compartilhadas pelas telas.
 */
import type { Difficulty, Squad } from "@/lib/types";
import type { ShapeName } from "@/lib/ascii-engine";
import type { StampTone, TerminalTone } from "@/components/ui";

/** Forma 3D de cada dificuldade (vitrine, cartaz do projeto). */
export const DIFF_SHAPE: Record<Difficulty, ShapeName> = {
  iniciante: "donut",
  intermediario: "cube",
  avancado: "diamond",
};

/** Tom do carimbo de dificuldade. */
export const DIFF_STAMP_TONE: Record<Difficulty, StampTone> = {
  iniciante: "teal",
  intermediario: "gold",
  avancado: "coral",
};

/** Tom do terminal por dificuldade (equivalente aos CRTs do legado). */
export const DIFF_TERMINAL_TONE: Record<Difficulty, TerminalTone> = {
  iniciante: "teal",
  intermediario: "amber",
  avancado: "coral",
};

/** "1 semana" / "3 semanas". */
export function fmtWeeks(n: number): string {
  return n === 1 ? "1 semana" : `${n} semanas`;
}

/** "3d 04h 12m restantes" ou "prazo estourado". */
export function fmtRemaining(endsAt: number): string {
  const ms = endsAt - Date.now();
  if (ms <= 0) return "prazo estourado";
  const d = Math.floor(ms / 86400000);
  const hh = Math.floor((ms % 86400000) / 3600000);
  const mm = Math.floor((ms % 3600000) / 60000);
  return `${d}d ${String(hh).padStart(2, "0")}h ${String(mm).padStart(2, "0")}m restantes`;
}

/** Data curta pt-BR: "14 de jul. de 2026" → "14 jul. 2026". */
export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Rótulo + tom do carimbo de status de um squad. */
export function statusStampProps(
  squad: Pick<Squad, "status" | "deliveredLate">
): { label: string; tone: StampTone } {
  switch (squad.status) {
    case "forming":
      return { label: "FORMANDO", tone: "neutral" };
    case "active":
      return { label: "PRAZO CORRENDO", tone: "coral" };
    case "delivered":
      return {
        label: squad.deliveredLate ? "ENTREGUE (ATRASADO)" : "ENTREGUE",
        tone: "teal",
      };
  }
}

/** Tutorial de colaboradores no GitHub (app.js, linhas 422–429). */
export const GITHUB_TUTORIAL: ReadonlyArray<readonly [string, string]> = [
  [
    "Abra o repositório entregue no GitHub",
    "Vá até a página do repositório que o squad enviou.",
  ],
  [
    "Settings → Collaborators",
    "No menu do repositório, clique em Settings e depois em Collaborators (peça ao dono do repo se você não tiver acesso).",
  ],
  [
    "Add people",
    "Clique no botão Add people e digite o usuário do GitHub de cada colega de squad.",
  ],
  [
    "Escolha a permissão Write",
    "Assim todo mundo pode dar push direto, abrir branches e revisar PRs.",
  ],
  [
    "Cada colega aceita o convite",
    "O GitHub envia um e-mail/notificação; o convite expira em 7 dias.",
  ],
  [
    "Bônus: proteja a branch main",
    "Em Settings → Branches, exija pull request para main — como num time de verdade.",
  ],
];
