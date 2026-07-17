/**
 * Avatar — círculo com as iniciais do nome, cor de fundo determinística
 * (hash simples do nome cai numa paleta fixa de 6 tons). Server-friendly:
 * sem estado, sem "use client".
 */
import { cx } from "@/components/ui";
import { hashString, initialsOf } from "./format";
import styles from "./Avatar.module.css";

const TONE_COUNT = 6;

export interface AvatarProps {
  /** Nome completo (ou parcial) do usuário — vira iniciais + semente da cor. */
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function Avatar({ name, size = "md", className }: AvatarProps) {
  const tone = hashString(name || "?") % TONE_COUNT;
  return (
    <span
      className={cx(styles.avatar, styles[size], styles[`tone-${tone}`], className)}
      role="img"
      aria-label={name}
      title={name}
    >
      <span aria-hidden="true">{initialsOf(name)}</span>
    </span>
  );
}
