"use client";

/**
 * TagFilter — chips "Todos / #projeto / #dúvida / #discussão / #ajuda",
 * um selecionado por vez. Controlado: quem chama guarda `value` e reage a
 * `onChange` (ex.: refaz `api.listPosts({ type })`).
 */
import { cx } from "@/components/ui";
import type { PostType } from "@/lib/types";
import { POST_TYPE_META, POST_TYPES_ORDER } from "./format";
import styles from "./TagFilter.module.css";

export interface TagFilterProps {
  /** Tipo selecionado, ou null para "Todos". */
  value: PostType | null;
  onChange: (type: PostType | null) => void;
  className?: string;
}

export default function TagFilter({ value, onChange, className }: TagFilterProps) {
  return (
    <div className={cx(styles.list, className)} role="group" aria-label="Filtrar por tipo">
      <button
        type="button"
        className={cx(styles.chip, value === null && styles.chipActive)}
        aria-pressed={value === null}
        onClick={() => onChange(null)}
      >
        Todos
      </button>
      {POST_TYPES_ORDER.map((type) => {
        const meta = POST_TYPE_META[type];
        const active = value === type;
        return (
          <button
            key={type}
            type="button"
            className={cx(styles.chip, active && styles.chipActive, active && styles[`tone-${meta.tone}`])}
            aria-pressed={active}
            onClick={() => onChange(type)}
          >
            #{type === "duvida" ? "dúvida" : type === "discussao" ? "discussão" : type}
          </button>
        );
      })}
    </div>
  );
}
