/**
 * Operações centrais que recebem o `db` explicitamente — usadas tanto pelo
 * seed (antes do singleton existir) quanto pelas rotas.
 * Porte fiel de `createSquadForProject` e `recordProjectEntry` do legado.
 */
import type { DatabaseSync } from "node:sqlite";

/** Cria squad com um slot por função do projeto. Retorna id do squad. */
export function createSquadForProject(
  db: DatabaseSync,
  projectId: number,
  name: string,
  now: number
): number {
  const squad = db
    .prepare(
      `INSERT INTO squads (project_id, name, status, created_at) VALUES (?, ?, 'forming', ?)`
    )
    .run(projectId, name, now);
  const squadId = Number(squad.lastInsertRowid);
  const roles = db
    .prepare(`SELECT id FROM project_roles WHERE project_id = ? ORDER BY id`)
    .all(projectId) as unknown as Array<{ id: number }>;
  const insSlot = db.prepare(
    `INSERT INTO squad_slots (squad_id, role_id) VALUES (?, ?)`
  );
  for (const r of roles) insSlot.run(squadId, r.id);
  return squadId;
}

/**
 * Registra (uma vez, vitaliciamente) que o usuário entrou nesse projeto —
 * usado na regra do projeto grátis.
 */
export function recordProjectEntry(
  db: DatabaseSync,
  userId: number,
  projectId: number,
  when: number
): void {
  db.prepare(
    `INSERT OR IGNORE INTO project_entries (user_id, project_id, first_joined_at) VALUES (?, ?, ?)`
  ).run(userId, projectId, when);
}
