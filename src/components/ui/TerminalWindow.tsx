import type { ReactNode } from "react";
import { cx } from "./cx";

export type TerminalTone = "neutral" | "coral" | "teal" | "amber";

export interface TerminalWindowProps {
  /** Título mono 11px centralizado na barra. */
  title?: string;
  /** Cor do conteúdo ASCII: coral (prazo), teal (entregue), amber (aguardando). */
  tone?: TerminalTone;
  className?: string;
  children: ReactNode;
}

/**
 * Janela de terminal estilo Terminal.app do macOS — o elemento de identidade
 * do TaskForge. As animações ASCII (formas 3D, mascote, countdown, slot meter)
 * vivem dentro do corpo. Server component: só apresentação.
 */
export default function TerminalWindow({
  title = "chico@taskforge — zsh",
  tone = "neutral",
  className,
  children,
}: TerminalWindowProps) {
  return (
    <div className={cx("terminal", tone !== "neutral" && `terminal--${tone}`, className)}>
      <div className="terminal-bar">
        <div className="terminal-lights" aria-hidden="true">
          <span className="terminal-light terminal-light--red" />
          <span className="terminal-light terminal-light--yellow" />
          <span className="terminal-light terminal-light--green" />
        </div>
        <span className="terminal-title">{title}</span>
      </div>
      <div className="terminal-body">{children}</div>
    </div>
  );
}
