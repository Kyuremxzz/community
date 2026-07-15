"use client";

/**
 * /projetos/[id] — cartaz do projeto + squads com vagas.
 * Comportamento do screenProject legado: ocupar vaga (com paywall no 402),
 * abrir novo squad e voltar ao catálogo.
 */
import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Skeleton, TerminalWindow, useToast } from "@/components/ui";
import { AsciiSpin, SlotMeter } from "@/components/ascii";
import { api, errorMessage } from "@/lib/api-client";
import type { Project, Squad } from "@/lib/types";
import { useUser } from "@/components/UserContext";
import { useJoinSlot } from "@/components/Paywall";
import { DiffStamp, StatusStamp } from "@/components/Stamps";
import {
  DIFF_SHAPE,
  DIFF_TERMINAL_TONE,
  fmtDate,
  fmtRemaining,
  fmtWeeks,
} from "@/components/format";
import styles from "./page.module.css";

function squadInfo(s: Squad): string {
  if (s.status === "forming") {
    return `${s.slotsFilled}/${s.slotsTotal} vagas ocupadas — o prazo só começa quando fechar.`;
  }
  if (s.status === "active") {
    return `Prazo: ${fmtRemaining(s.deadlineEndsAt ?? 0)} (até ${fmtDate(s.deadlineEndsAt ?? 0)})`;
  }
  return `Entregue em ${fmtDate(s.deliveredAt ?? 0)} → ${s.repoUrl ?? ""}`;
}

export default function ProjetoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();

  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addingSquad, setAddingSquad] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api.project(Number(id));
      setProject(r.project);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const { joinSlot, joiningSlot, paywall } = useJoinSlot();

  async function addSquad() {
    if (!project) return;
    if (!user) {
      toast("Entre para abrir um squad.");
      router.push("/entrar");
      return;
    }
    setAddingSquad(true);
    try {
      const r = await api.addSquad(project.id);
      toast(`Novo squad aberto: ${r.squad.name}`);
      await load();
    } catch (err) {
      toast("Erro: " + errorMessage(err));
    } finally {
      setAddingSquad(false);
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

  if (!project) {
    return (
      <div className="page-enter stack-lg" aria-busy="true">
        <Skeleton variant="text" lines={4} />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
    );
  }

  const p = project;

  return (
    <div className="page-enter stack-lg">
      <header className={styles.split}>
        <div className="stack-sm">
          <h1>{p.title}</h1>
          <div>
            <DiffStamp project={p} />
          </div>
          <p>{p.description}</p>
          <p className={styles.meta}>
            Funções deste projeto (definidas por quem o criou):{" "}
            {p.roles.join(" · ")}
          </p>
          <p className={styles.meta}>
            Prazo após fechar o squad: {fmtWeeks(p.deadlineWeeks)}
          </p>
        </div>
        <TerminalWindow tone={DIFF_TERMINAL_TONE[p.difficulty]}>
          <AsciiSpin shape={DIFF_SHAPE[p.difficulty]} width={50} height={18} />
        </TerminalWindow>
      </header>

      <section className="stack" aria-label="Squads do projeto">
        <h2 className="prompt">Squads</h2>
        {(p.squads ?? []).map((s) => (
          <Card key={s.id} className="stack-sm">
            <h3 className={styles.squadTitle}>
              {s.name} <StatusStamp squad={s} />
            </h3>
            <SlotMeter
              filled={s.slotsFilled}
              total={s.slotsTotal}
              roles={s.slots.map((x) => x.role)}
              className={styles.meter}
            />
            <p className={styles.meta}>{squadInfo(s)}</p>
            <div className={styles.actions}>
              <Link href={`/squads/${s.id}`} className="btn btn--secondary btn--sm">
                Ver squad
              </Link>
              {s.status === "forming" &&
                !s.isMember &&
                s.slots
                  .filter((slot) => slot.userId == null)
                  .map((slot) => (
                    <Button
                      key={slot.id}
                      size="sm"
                      loading={joiningSlot === slot.id}
                      onClick={() => void joinSlot(slot.id)}
                    >
                      Ocupar vaga · {slot.role}
                    </Button>
                  ))}
            </div>
          </Card>
        ))}
      </section>

      <div className={styles.actions}>
        <Button
          variant="secondary"
          size="sm"
          loading={addingSquad}
          onClick={() => void addSquad()}
        >
          + Abrir novo squad neste projeto
        </Button>
        <Link href="/" className="btn btn--ghost btn--sm">
          ← Catálogo
        </Link>
      </div>

      {paywall}
    </div>
  );
}
