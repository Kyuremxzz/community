"use client";

/**
 * /entrar — Bilheteria: login e registro (mesmo toggle do legado).
 * Hero split: terminal com a caneca girando + tagline em typewriter à
 * esquerda; card do formulário à direita.
 */
import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, TerminalWindow, cx, useToast } from "@/components/ui";
import { AsciiSpin, Typewriter } from "@/components/ascii";
import { api, errorMessage } from "@/lib/api-client";
import { useUser } from "@/components/UserContext";
import styles from "./page.module.css";

const TAGLINE =
  "Entre num squad. Encare um prazo de verdade. Entregue como num estágio — sem precisar de um.";

export default function EntrarPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { setUser } = useUser();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleMode() {
    setMode((m) => (m === "login" ? "register" : "login"));
    setError(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const r =
        mode === "login"
          ? await api.login(email.trim(), password)
          : await api.register(name.trim(), email.trim(), password);
      setUser(r.user);
      toast(`Salve, ${r.user.name}! ☺`);
      router.push("/");
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className={cx("page-enter", styles.hero)}>
      <div className={styles.showcase}>
        <TerminalWindow>
          <AsciiSpin shape="mug" width={56} height={20} />
          <p className={styles.tagline}>
            <Typewriter text={TAGLINE} cps={45} />
          </p>
        </TerminalWindow>
      </div>

      <Card className={styles.box}>
        <h1 className={cx("prompt", styles.boxTitle)}>Bilheteria</h1>
        <form className="stack" onSubmit={onSubmit}>
          {mode === "register" && (
            <Field
              label="Nome"
              type="text"
              autoComplete="name"
              placeholder="Como te chamam"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
          <Field
            label="E-mail"
            type="email"
            autoComplete="email"
            placeholder="voce@exemplo.dev"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Field
            label="Senha"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder="••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <div>
            <Button type="submit" loading={submitting}>
              {mode === "login" ? "Entrar" : "Criar conta"}
            </Button>
          </div>
          <p className={styles.demoHint}>Conta demo: demo@taskforge.dev / demo123</p>
        </form>

        <p className={styles.toggle}>
          {mode === "login" ? "Primeira vez por aqui? " : "Já tem conta? "}
          <button type="button" className={styles.toggleLink} onClick={toggleMode}>
            {mode === "login" ? "Crie sua conta" : "Faça login"}
          </button>
        </p>
      </Card>
    </div>
  );
}
