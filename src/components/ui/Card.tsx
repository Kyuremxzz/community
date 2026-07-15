import type { HTMLAttributes } from "react";
import { cx } from "./cx";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Hover com borda coral + leve elevação (cards clicáveis do catálogo). */
  interactive?: boolean;
}

/** Card de conteúdo: fundo elevated, borda 1px, radius 10px, padding 24px. */
export default function Card({ interactive = false, className, children, ...rest }: CardProps) {
  return (
    <div className={cx("card", interactive && "card--interactive", className)} {...rest}>
      {children}
    </div>
  );
}
