"use client";

/**
 * /squads/[id] — a tela do squad, com os três estados do ciclo de vida:
 * forming (mascote aguardando), active (countdown coral + entrega para
 * membros) e delivered (celebração + tutorial de colaboradores no GitHub).
 */
import { use, useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { Button, Card, Field, Skeleton, TerminalWindow, cx, useToast } from "@/components/ui";
import { Countdown, Mascot, SlotMeter } from "@/components/ascii";
import { api, errorMessage } from "@/lib/api-client";
import type { Project, Squad } from "@/lib/types";
import { useUser } from "@/components/UserContext";
import { useJoinSlot } from "@/components/Paywall";
import { DiffStamp, StatusStamp } from "@/components/Stamps";
import { fmtDate, fmtWeeks, GITHUB_TUTORIAL } from "@/components/format";
import styles from "./page.module.css";

export default function SquadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { toast } = useToast();
  const { refresh } = useUser();

  const [data, setData] = useState<{ squad: Squad; project: Project } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const [leavingSlot, setLeavingSlot] = useState<number | null>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [deliverError, setDeliverError] = useState<string | null>(null);
  const [delivering, setDelivering] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api.squad(Number(id));
      setData({ squad: r.squad, project: r.project });
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // ao ocupar vaga estando já na tela do squad, só recarrega os dados
  const { joinSlot, joiningSlot, paywall } = useJoinSlot(() => {
    void load();
  });

  async function leave(slotId: number) {
    setLeavingSlot(slotId);
    try {
      await api.leaveSlot(slotId);
      void refresh(); // badge do topbar
      toast("Você saiu da vaga.");
      await load();
    } catch (err) {
      toast("Erro: " + errorMessage(err));
    } finally {
      setLeavingSlot(null);
    }
  }

  async function onDeliver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    setDeliverError(null);
    setDelivering(true);
    try {
      const r = await api.deliver(data.squad.id, repoUrl.trim());
      toast(r.message, "teal");
      await load();
    } catch (err) {
      setDeliverError(errorMessage(err));
    } finally {
      setDelivering(false);
    }
  }

  if (error) {
    return (
      <div className="page-enter stack">
        <Card className="stack-sm">
          <p role="alert">{error}</p>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => void load()}>
              Tentar de novo
            </Button>
            <Link href="/" className="btn btn--ghost btn--sm">
              ← Catálogo
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-enter stack-lg" aria-busy="true">
        <Skeleton variant="text" lines={2} />
        <Skeleton variant="card" />
        <Skeleton variant="text" lines={4} />
      </div>
    );
  }

  const { squad: s, project: p } = data;

  return (
    <div className="page-enter stack-lg">
      <header className="stack-sm">
        <p className={styles.breadcrumb}>
          <Link href={`/projetos/${p.id}`}>← {p.title}</Link>{" "}
          <DiffStamp project={p} />
        </p>
        <h1 className={styles.title}>
          {s.name} <StatusStamp squad={s} />
        </h1>
      </header>

      <TerminalWindow tone="amber" title="elenco do squad">
        <SlotMeter
          filled={s.slotsFilled}
          total={s.slotsTotal}
          roles={s.slots.map((x) => x.role)}
        />
      </TerminalWindow>

      <section className="stack-sm" aria-label="Vagas do squad">
        {s.slots.map((slot) => (
          <p key={slot.id} className={styles.slotLine}>
            <b>{slot.role}: </b>
            {slot.userName
              ? `${slot.userName}${slot.mine ? " (você)" : ""}`
              : "— vaga aberta —"}
            {slot.userId == null && s.status === "forming" && !s.isMember && (
              <Button
                size="sm"
                className={styles.slotBtn}
                loading={joiningSlot === slot.id}
                onClick={() => void joinSlot(slot.id)}
              >
                Ocupar
              </Button>
            )}
            {slot.mine && s.status === "forming" && (
              <Button
                variant="ghost"
                size="sm"
                className={styles.slotBtn}
                loading={leavingSlot === slot.id}
                onClick={() => void leave(slot.id)}
              >
                Sair da vaga
              </Button>
            )}
          </p>
        ))}
      </section>

      {s.status === "forming" && (
        <div className={styles.split}>
          <TerminalWindow tone="amber">
            <Mascot mood="idle" />
          </TerminalWindow>
          <div className="stack-sm">
            <h2>Aguardando o squad fechar</h2>
            <p className={styles.body}>
              Faltam {s.slotsTotal - s.slotsFilled} pessoa(s). Quando a última
              vaga for ocupada, o cronômetro de {fmtWeeks(p.deadlineWeeks)}{" "}
              dispara automaticamente — como o primeiro dia de um estágio.
            </p>
          </div>
        </div>
      )}

      {s.status === "active" && (
        <>
          <section className="stack-sm" aria-label="Prazo do squad">
            <TerminalWindow tone="coral" title="prazo — taskforge">
              <Countdown endsAt={s.deadlineEndsAt ?? 0} />
            </TerminalWindow>
            <p className={styles.meta}>
              Começou em {fmtDate(s.deadlineStartedAt ?? 0)} · entrega até{" "}
              {fmtDate(s.deadlineEndsAt ?? 0)}
            </p>
          </section>

          {s.isMember && (
            <Card className="stack">
              <h2 className={cx("prompt", styles.cardTitle)}>Entrega</h2>
              <form className="stack" onSubmit={onDeliver}>
                <Field
                  label="Link do repositório (GitHub)"
                  type="url"
                  placeholder="https://github.com/seu-squad/projeto"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  error={deliverError ?? undefined}
                  required
                />
                <div>
                  <Button type="submit" loading={delivering}>
                    Entregar projeto
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </>
      )}

      {s.status === "delivered" && (
        <>
          <div className={styles.split}>
            <TerminalWindow tone="teal">
              <Mascot mood="cheer" />
            </TerminalWindow>
            <div className="stack-sm">
              <h2>
                {s.deliveredLate
                  ? "Entregue (fora do prazo, mas entregue!)"
                  : "Entregue dentro do prazo!"}
              </h2>
              <p className={styles.body}>
                Repositório:{" "}
                <a href={s.repoUrl ?? "#"} target="_blank" rel="noopener noreferrer">
                  {s.repoUrl}
                </a>
              </p>
              <p className={styles.meta}>
                Entrega registrada em {fmtDate(s.deliveredAt ?? 0)}.
              </p>
            </div>
          </div>

          <Card className="stack">
            <h2 className={styles.cardTitle}>☞ Tutorial: colaboradores no GitHub</h2>
            <p className={styles.body}>
              Agora transforme a entrega em portfólio de todo mundo — adicione o
              squad como colaborador do repositório:
            </p>
            <ol className={styles.tutorial}>
              {GITHUB_TUTORIAL.map(([step, detail]) => (
                <li key={step}>
                  <b>{step} — </b>
                  {detail}
                </li>
              ))}
            </ol>
            <p className={styles.meta}>
              Dica: cada commit dos colegas passa a contar no gráfico de
              contribuições deles no GitHub.
            </p>
          </Card>
        </>
      )}

      {paywall}
    </div>
  );
}
