"use client";

/**
 * SearchBar — campo de busca com debounce de 300ms antes de chamar
 * `onSearch`. Não busca nada sozinho: quem monta a tela decide o que fazer
 * com a query (ex.: `api.listPosts({ q })`).
 */
import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui";
import styles from "./SearchBar.module.css";

const DEBOUNCE_MS = 300;

export interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  initialValue?: string;
  className?: string;
}

export default function SearchBar({
  onSearch,
  placeholder = "Buscar na comunidade…",
  initialValue = "",
  className,
}: SearchBarProps) {
  const [value, setValue] = useState(initialValue);
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onSearchRef.current(value.trim());
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [value]);

  return (
    <div className={cx(styles.wrap, className)}>
      <span className={styles.prompt} aria-hidden="true">
        ❯
      </span>
      <input
        type="search"
        className={cx("field-control", styles.input)}
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-label="Buscar na comunidade"
      />
    </div>
  );
}
