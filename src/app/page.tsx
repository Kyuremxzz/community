"use client";

/**
 * / — Catálogo de projetos (exige login; deslogado vai para /entrar).
 * Vitrine de dificuldades com formas 3D + grid de cartazes.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Skeleton, TerminalWindow, cx } from "@/components/ui";
import { AsciiSpin, Typewriter } from "@/components/ascii";
import { api, errorMessage } from "@/lib/api-client";
import type { Difficulty, Project } from "@/lib/types";
import { useUser } from "@/components/UserContext";
import { DiffStamp } from "@/components/Stamps";
import { DIFF_SHAPE, DIFF_TERMINAL_TONE } from "@/components/format";
import styles from "./page.module.css";

const VITRINE: ReadonlyArray<{
  diff: Difficulty;
  label: string;
  speed: number;
}> = [
  { diff: "iniciante", label: "INICIANTE · 1 SEMANA", speed: 1 },
  { diff: "intermediario", label: "INTERMEDIÁRIO · 2 SEMANAS", speed: 1 },
  { diff: "avancado", label: "AVANÇADO · 3–4 SEMANAS", speed: 1.6 },
];

export default function CatalogoPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();

  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api.projects();
      setProjects(r.projects);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  // guard de sessão: deslogado → /entrar
  useEffect(() => {
    if (!userLoading && !user) router.replace("/entrar");
  }, [userLoading, user, router]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  // enquanto decide a sessão (ou redireciona), mostra skeleton
  if (userLoading || !user) {
    return (
      <div className="page-enter stack-lg" aria-busy="true">
        <Skeleton variant="text" lines={2} />
        <div className="grid-cards">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} variant="card" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter stack-lg">
      <header className="stack-sm">
        <h1 className="prompt">Projetos</h1>
        <p className={styles.tagline}>
          <Typewriter
            text="Escolha um cartaz, ocupe uma vaga e o espetáculo começa quando o squad fechar."
            cps={50}
          />
        </p>
      </header>

      <div className={styles.vitrine} aria-hidden="true">
        {VITRINE.map((v) => (
          <TerminalWindow key={v.diff} tone={DIFF_TERMINAL_TONE[v.diff]}>
            <div className={styles.vitrineLabel}>{v.label}</div>
            <AsciiSpin
              shape={DIFF_SHAPE[v.diff]}
              width={44}
              height={15}
              speed={v.speed}
            />
          </TerminalWindow>
        ))}
      </div>

      <section className="stack" aria-label="Catálogo de projetos">
        {error ? (
          <Card className="stack-sm">
            <p role="alert">Erro carregando projetos: {error}</p>
            <div>
              <Button variant="secondary" onClick={() => void load()}>
                Tentar de novo
              </Button>
            </div>
          </Card>
        ) : !projects ? (
          <div className="grid-cards" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} variant="card" />
            ))}
          </div>
        ) : (
          <div className="grid-cards">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/projetos/${p.id}`}
                className={styles.cardLink}
              >
                <Card interactive className={cx("stack-sm", styles.projectCard)}>
                  <h3>{p.title}</h3>
                  <div>
                    <DiffStamp project={p} />
                  </div>
                  <p className={styles.cardDesc}>{p.description}</p>
                  <p className={styles.cardRoles}>
                    Funções: {p.roles.join(" · ")}
                  </p>
                  <p className={styles.cardSlots}>
                    {p.openSlots > 0
                      ? `▸ ${p.openSlots} vaga(s) aberta(s) em ${p.squadCount} squad(s)`
                      : "▸ nenhuma vaga aberta agora"}
                    {p.isMember && (
                      <span className={styles.member}>
                        {" "}
                        ☺ você está nesse projeto
                      </span>
                    )}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
