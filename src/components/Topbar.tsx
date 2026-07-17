"use client";

/**
 * Topbar sticky com blur — wordmark "TaskForge_" à esquerda e as ações da
 * conta à direita (mesma jornada do topbar legado, visual do DESIGN.md).
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, cx } from "@/components/ui";
import { api } from "@/lib/api-client";
import { useUser } from "./UserContext";
import Paywall from "./Paywall";
import styles from "./topbar.module.css";

export default function Topbar() {
  const { user, loading, setUser } = useUser();
  const router = useRouter();
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  async function logout() {
    setLeaving(true);
    try {
      await api.logout();
    } catch {
      /* logout é idempotente no servidor */
    }
    setUser(null);
    setLeaving(false);
    router.push("/entrar");
  }

  return (
    <header className={styles.topbar}>
      <div className={cx("container", styles.inner)}>
        <Link href="/" className={styles.wordmark} aria-label="TaskForge — início">
          TaskForge
          <span className={cx("cursor-blink", styles.cursor)} aria-hidden="true">
            _
          </span>
        </Link>

        <nav className={styles.actions} aria-label="Conta e navegação">
          <Link href="/comunidade" className="btn btn--ghost btn--sm">
            Comunidade
          </Link>
          {loading ? null : user ? (
            <>
              <span className={styles.userchip} title={user.email}>
                ☺ {user.name}
                {user.subscribed ? (
                  <span className={styles.badgeGold}>★ assinante</span>
                ) : (
                  <span className={styles.badge}>
                    {user.freeProjectUsed ? "· grátis usado" : "· 1 projeto grátis"}
                  </span>
                )}
              </span>
              <Link href="/meus-squads" className="btn btn--secondary btn--sm">
                Meus squads
              </Link>
              <Link href="/criar" className="btn btn--primary btn--sm">
                Criar projeto
              </Link>
              {!user.subscribed && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPaywallOpen(true)}
                >
                  Assinar
                </Button>
              )}
              <Button variant="ghost" size="sm" loading={leaving} onClick={logout}>
                Sair
              </Button>
            </>
          ) : (
            <Link href="/entrar" className="btn btn--primary btn--sm">
              Entrar
            </Link>
          )}
        </nav>
      </div>

      <Paywall open={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </header>
  );
}
