import type { ReactNode } from "react";
import { cx } from "./cx";

export type StampTone = "coral" | "teal" | "gold" | "neutral";

export interface StampProps {
  /** Cor do carimbo (borda + fundo translúcido). */
  tone?: StampTone;
  /** Direção da rotação: left = -2deg (padrão, dificuldade), right = +1.5deg (status). */
  tilt?: "left" | "right";
  className?: string;
  children: ReactNode;
}

/** Carimbo de status/dificuldade — o traço cartoon que sobrevive: rotação leve + borda 1.5px. */
export default function Stamp({ tone = "neutral", tilt = "left", className, children }: StampProps) {
  return (
    <span className={cx("stamp", `stamp--${tone}`, tilt === "right" && "stamp--right", className)}>
      {children}
    </span>
  );
}
