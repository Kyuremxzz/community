import { cx } from "./cx";

export interface SkeletonProps {
  /** "text" = linhas de texto; "card" = bloco do tamanho de um card. */
  variant?: "text" | "card";
  /** Quantidade de linhas (só na variante text). A última fica mais curta. */
  lines?: number;
  className?: string;
}

/** Placeholder de carregamento com shimmer sutil. Decorativo (aria-hidden). */
export default function Skeleton({ variant = "text", lines = 1, className }: SkeletonProps) {
  if (variant === "card") {
    return <div className={cx("skeleton", "skeleton--card", className)} aria-hidden="true" />;
  }

  return (
    <div className={cx("skeleton-lines", className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <div
          key={index}
          className="skeleton skeleton--text"
          style={lines > 1 && index === lines - 1 ? { width: "60%" } : undefined}
        />
      ))}
    </div>
  );
}
