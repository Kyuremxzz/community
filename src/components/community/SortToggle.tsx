"use client";

/** SortToggle — alterna a ordenação do feed entre "Recentes" e "Mais populares". */
import { cx } from "@/components/ui";
import styles from "./SortToggle.module.css";

export type PostSort = "recent" | "popular";

export interface SortToggleProps {
  value: PostSort;
  onChange: (sort: PostSort) => void;
  className?: string;
}

const OPTIONS: ReadonlyArray<{ value: PostSort; label: string }> = [
  { value: "recent", label: "Recentes" },
  { value: "popular", label: "Mais populares" },
];

export default function SortToggle({ value, onChange, className }: SortToggleProps) {
  return (
    <div className={cx(styles.group, className)} role="group" aria-label="Ordenar posts">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={cx(styles.option, value === opt.value && styles.optionActive)}
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
