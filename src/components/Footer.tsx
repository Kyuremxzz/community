/**
 * Rodapé discreto — mono pequeno, borda superior 1px.
 * Server component: só apresentação.
 */
import { cx } from "@/components/ui";
import styles from "./footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={cx("container", styles.inner)}>
        <span>TASKFORGE ~ estágio simulado para devs em formação ~ protótipo</span>
        <span aria-hidden="true">▓▒░ desenhado a caractere ░▒▓</span>
      </div>
    </footer>
  );
}
