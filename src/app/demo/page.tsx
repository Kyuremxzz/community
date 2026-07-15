"use client";

/**
 * /demo — playground da engine ASCII (sem auth). Porta o espírito do
 * legacy/public/demo-engine.html: todas as peças visuais lado a lado.
 */
import { useMemo } from "react";
import { TerminalWindow } from "@/components/ui";
import {
  AsciiSpin,
  AsciiTitle,
  Countdown,
  Mascot,
  SlotMeter,
  Typewriter,
} from "@/components/ascii";
import type { MascotMood, ShapeName } from "@/lib/ascii-engine";
import type { TerminalTone } from "@/components/ui";
import styles from "./page.module.css";

const SHAPES: readonly ShapeName[] = ["donut", "cube", "diamond", "star", "mug"];

const MOODS: ReadonlyArray<{ mood: MascotMood; tone: TerminalTone }> = [
  { mood: "idle", tone: "amber" },
  { mood: "cheer", tone: "teal" },
  { mood: "sad", tone: "coral" },
];

export default function DemoPage() {
  // prazo fake: 3 dias, 4 horas e 5 minutos a partir de agora
  const endsAt = useMemo(
    () => Date.now() + (3 * 24 * 3600 + 4 * 3600 + 5 * 60) * 1000,
    []
  );

  return (
    <div className="page-enter stack-lg">
      <header className="stack-sm">
        <h1 className="prompt">Demo da engine ASCII</h1>
        <p className={styles.tagline}>
          Playground das peças visuais do TaskForge — formas 3D, mascote,
          figlet, medidores e contagem regressiva. Tudo respeita
          prefers-reduced-motion.
        </p>
      </header>

      <section className="stack" aria-label="Formas 3D">
        <h2 className="prompt">Formas 3D</h2>
        <div className={styles.grid}>
          {SHAPES.map((shape) => (
            <TerminalWindow key={shape} title={`spin — ${shape}`}>
              <AsciiSpin shape={shape} width={44} height={16} />
            </TerminalWindow>
          ))}
        </div>
      </section>

      <section className="stack" aria-label="Mascote Chico Caneca">
        <h2 className="prompt">Chico Caneca</h2>
        <div className={styles.grid}>
          {MOODS.map(({ mood, tone }) => (
            <TerminalWindow key={mood} tone={tone} title={`chico — ${mood}`}>
              <Mascot mood={mood} />
            </TerminalWindow>
          ))}
        </div>
      </section>

      <section className="stack" aria-label="Banner figlet">
        <h2 className="prompt">Figlet</h2>
        <TerminalWindow title="figlet — taskforge">
          <AsciiTitle text="TASKFORGE" label="Banner figlet TaskForge" />
        </TerminalWindow>
      </section>

      <section className="stack" aria-label="Medidor de vagas">
        <h2 className="prompt">Slot meter</h2>
        <TerminalWindow tone="amber" title="elenco — 2/4">
          <SlotMeter
            filled={2}
            total={4}
            roles={["Frontend", "Backend", "Mobile", "QA"]}
          />
        </TerminalWindow>
      </section>

      <section className="stack" aria-label="Contagem regressiva">
        <h2 className="prompt">Countdown</h2>
        <TerminalWindow tone="coral" title="prazo — exemplo">
          <Countdown endsAt={endsAt} />
        </TerminalWindow>
      </section>

      <section className="stack" aria-label="Efeito typewriter">
        <h2 className="prompt">Typewriter</h2>
        <TerminalWindow title="echo — taskforge">
          <p className={styles.type}>
            <Typewriter
              text="Entre num squad. Encare um prazo de verdade. Entregue como num estágio — sem precisar de um."
              cps={40}
            />
          </p>
        </TerminalWindow>
      </section>
    </div>
  );
}
