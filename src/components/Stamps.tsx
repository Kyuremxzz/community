/**
 * Carimbos compostos usados em várias telas:
 * - DiffStamp: dificuldade + prazo ("INICIANTE · 1 SEMANA"), inclinado à esquerda.
 * - StatusStamp: status do squad (FORMANDO / PRAZO CORRENDO / ENTREGUE),
 *   inclinado à direita, como os carimbos de status do legado.
 * Server-friendly: sem estado, sem "use client".
 */
import { Stamp } from "@/components/ui";
import type { Project, Squad } from "@/lib/types";
import { DIFF_STAMP_TONE, fmtWeeks, statusStampProps } from "./format";

export function DiffStamp({
  project,
}: {
  project: Pick<Project, "difficulty" | "difficultyLabel" | "deadlineWeeks">;
}) {
  return (
    <Stamp tone={DIFF_STAMP_TONE[project.difficulty]}>
      {project.difficultyLabel} · {fmtWeeks(project.deadlineWeeks)}
    </Stamp>
  );
}

export function StatusStamp({
  squad,
}: {
  squad: Pick<Squad, "status" | "deliveredLate">;
}) {
  const { label, tone } = statusStampProps(squad);
  return (
    <Stamp tone={tone} tilt="right">
      {label}
    </Stamp>
  );
}
