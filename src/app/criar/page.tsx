"use client";

/**
 * /criar — prancheta de novo projeto (exige login).
 * Mesmo formulário do legado: título, descrição, dificuldade (avançado
 * libera o select de 3/4 semanas) e funções dinâmicas (2 a 6, máx. 14 chars).
 */
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Skeleton, TerminalWindow, cx, useToast } from "@/components/ui";
import { AsciiSpin } from "@/components/ascii";
import { api, errorMessage } from "@/lib/api-client";
import type { Difficulty } from "@/lib/types";
import { useUser } from "@/components/UserContext";
import styles from "./page.module.css";

const WEEKS_BY_DIFF: Record<Exclude<Difficulty, "avancado">, number> = {
  iniciante: 1,
  intermediario: 2,
};

export default function CriarPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: userLoading } = useUser();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("iniciante");
  const [weeks, setWeeks] = useState("3");
  const [roles, setRoles] = useState<string[]>(["Frontend", "Backend"]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // guard de sessão
  useEffect(() => {
    if (!userLoading && !user) router.replace("/entrar");
  }, [userLoading, user, router]);

  function setRole(index: number, value: string) {
    setRoles((rs) => rs.map((r, i) => (i === index ? value : r)));
  }

  function removeRole(index: number) {
    setRoles((rs) => rs.filter((_, i) => i !== index));
  }

  function addRole() {
    setRoles((rs) => [...rs, ""]);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const deadlineWeeks =
      difficulty === "avancado" ? Number(weeks) : WEEKS_BY_DIFF[difficulty];
    try {
      const r = await api.createProject({
        title: title.trim(),
        description: description.trim(),
        difficulty,
        deadlineWeeks,
        roles: roles.map((x) => x.trim()).filter(Boolean),
      });
      toast("Projeto no ar! Squad Alpha aberto para inscrições.");
      router.push(`/projetos/${r.project.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  if (userLoading || !user) {
    return (
      <div className="page-enter stack-lg" aria-busy="true">
        <Skeleton variant="text" lines={2} />
        <Skeleton variant="card" />
      </div>
    );
  }

  return (
    <div className="page-enter stack-lg">
      <header className="stack-sm">
        <h1 className="prompt">Novo projeto</h1>
        <p className={styles.tagline}>
          Defina o cartaz: quem topar entra num squad e o prazo vira realidade.
        </p>
      </header>

      <div className={styles.split}>
        <Card className="stack">
          <form className="stack" onSubmit={onSubmit}>
            <Field
              label="Título"
              type="text"
              placeholder="Ex: Clone do Trello para estudos"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <Field
              as="textarea"
              label="Descrição (o que o squad vai construir)"
              rows={3}
              placeholder="Escopo, tecnologias sugeridas, o que é uma entrega boa…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
            <Field
              as="select"
              label="Dificuldade"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            >
              <option value="iniciante">Iniciante — 1 semana de prazo</option>
              <option value="intermediario">Intermediário — 2 semanas</option>
              <option value="avancado">Avançado — 3 a 4 semanas</option>
            </Field>
            {difficulty === "avancado" && (
              <Field
                as="select"
                label="Prazo (avançado: 3 ou 4 semanas)"
                value={weeks}
                onChange={(e) => setWeeks(e.target.value)}
              >
                <option value="3">3 semanas</option>
                <option value="4">4 semanas</option>
              </Field>
            )}

            <fieldset className={styles.rolesFieldset}>
              <legend className={styles.rolesLegend}>
                Funções do squad (você define — 2 a 6)
              </legend>
              <div className="stack-sm">
                {roles.map((role, i) => (
                  <div key={i} className={styles.roleRow}>
                    <input
                      type="text"
                      className={cx("field-control", styles.roleInput)}
                      value={role}
                      maxLength={14}
                      aria-label={`Função ${i + 1}`}
                      onChange={(e) => setRole(i, e.target.value)}
                    />
                    {roles.length > 2 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Remover função ${i + 1}`}
                        onClick={() => removeRole(i)}
                      >
                        ✕
                      </Button>
                    )}
                  </div>
                ))}
                {roles.length < 6 && (
                  <div>
                    <Button variant="secondary" size="sm" onClick={addRole}>
                      + função
                    </Button>
                  </div>
                )}
              </div>
            </fieldset>

            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <div>
              <Button type="submit" loading={submitting}>
                Publicar projeto
              </Button>
            </div>
          </form>
        </Card>

        <div className={styles.showcase} aria-hidden="true">
          <TerminalWindow>
            <AsciiSpin shape="star" width={54} height={22} />
          </TerminalWindow>
        </div>
      </div>
    </div>
  );
}
