"use client";

/**
 * /meus-squads — squads em que o usuário ocupa alguma vaga (exige login).
 * Vazio: mascote + convite para o catálogo. Senão, lista com status e ações.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Skeleton, TerminalWindow } from "@/components/ui";
import { Mascot, SlotMeter } from "@/components/ascii";
import { api, errorMessage } from "@/lib/api-client";
import type { Project, Squad } from "@/lib/types";
import { useUser } from "@/components/UserContext";
import { StatusStamp } from "@/components/Stamps";
import { fmtDate, fmtRemaining } from "@/components/format";
import styles from "./page.module.css";

function squadInfo(s: Squad): string {
  if (s.status === "active") return `⏱ ${fmtRemaining(s.deadlineEndsAt ?? 0)}`;
  if (s.status === "delivered") return `✔ entregue em ${fmtDate(s.deliveredAt ?? 0)}`;
  return `${s.slotsFilled}/${s.slotsTotal} vagas — formando`;
}

export default function MeusSquadsPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();

  const [items, setItems] = useState<
    Array<{ squad: Squad; project: Project }> | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api.mySquads();
      setItems(r.squads);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    if (!userLoading && !user) router.replace("/entrar");
  }, [userLoading, user, router]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  if (userLoading || !user || (!items && !error)) {
    return (
      <div className="page-enter stack-lg" aria-busy="true">
        <Skeleton variant="text" lines={2} />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
    );
  }

  return (
    <div className="page-enter stack-lg">
      <h1 className="prompt">Meus squads</h1>

      {error ? (
        <Card className="stack-sm">
          <p role="alert">{error}</p>
          <div>
            <Button variant="secondary" onClick={() => void load()}>
              Tentar de novo
            </Button>
          </div>
        </Card>
      ) : items && items.length === 0 ? (
        <div className={styles.split}>
          <TerminalWindow tone="amber">
            <Mascot mood="idle" />
          </TerminalWindow>
          <div className="stack-sm">
            <h2>Nenhum squad ainda</h2>
            <p>Seu primeiro projeto é grátis — vá ao catálogo e ocupe uma vaga!</p>
            <div>
              <Link href="/" className="btn btn--primary btn--md">
                Ver projetos
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <section className="stack" aria-label="Meus squads">
          {items?.map(({ squad: s, project: p }) => (
            <Card key={s.id} className="stack-sm">
              <h3 className={styles.rowTitle}>
                {p.title} · {s.name} <StatusStamp squad={s} />
              </h3>
              <SlotMeter
                filled={s.slotsFilled}
                total={s.slotsTotal}
                roles={s.slots.map((x) => x.role)}
                className={styles.meter}
              />
              <p className={styles.info}>{squadInfo(s)}</p>
              <div>
                <Link href={`/squads/${s.id}`} className="btn btn--secondary btn--sm">
                  Abrir squad
                </Link>
              </div>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
