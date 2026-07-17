/**
 * Queries e "views" de serialização usadas pelas rotas da API.
 * Porte fiel de `userPublic`, `squadView` e `projectView` do legado
 * (`legacy/server/server.js`) — os shapes JSON são idênticos.
 */
import type {
  Difficulty,
  Project,
  Squad,
  SquadStatus,
  SquadWithProjectResponse,
  User,
} from "@/lib/types";
import { getDb } from "./index";

export const WEEK_MS = 7 * 86400000;

export interface DifficultyConfig {
  weeks: number[];
  label: string;
}

/** Prazos válidos por dificuldade — mesmo mapa do legado. */
export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  iniciante: { weeks: [1], label: "Iniciante" },
  intermediario: { weeks: [2], label: "Intermediário" },
  avancado: { weeks: [3, 4], label: "Avançado" },
};

/** Nomes de squad em ordem de criação: Alpha, Bravo, Charlie, ... */
export const SQUAD_NAMES = [
  "Alpha",
  "Bravo",
  "Charlie",
  "Delta",
  "Echo",
  "Foxtrot",
  "Golf",
  "Hotel",
];

export function isDifficulty(value: string): value is Difficulty {
  return value === "iniciante" || value === "intermediario" || value === "avancado";
}

/* ------------------------------------------------------------------ */
/* Tipos de linha (schema do SQLite)                                   */
/* ------------------------------------------------------------------ */

export interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  subscribed: number;
  created_at: number;
}

/** Colunas públicas do usuário (sem hash) — o que as rotas carregam da sessão. */
export interface SessionUser {
  id: number;
  name: string;
  email: string;
  subscribed: number;
}

export interface ProjectRow {
  id: number;
  title: string;
  description: string;
  difficulty: Difficulty;
  deadline_weeks: number;
  created_by: number | null;
  created_at: number;
}

export interface SquadRow {
  id: number;
  project_id: number;
  name: string;
  status: SquadStatus;
  deadline_started_at: number | null;
  deadline_ends_at: number | null;
  repo_url: string | null;
  delivered_at: number | null;
  created_at: number;
}

export interface SlotRow {
  id: number;
  squad_id: number;
  role_id: number;
  user_id: number | null;
  filled_at: number | null;
}

/* ------------------------------------------------------------------ */
/* Usuários                                                            */
/* ------------------------------------------------------------------ */

export function findUserByEmail(email: string): UserRow | undefined {
  return getDb()
    .prepare(`SELECT * FROM users WHERE email = ?`)
    .get(email) as unknown as UserRow | undefined;
}

export function getUserPublicRow(id: number): SessionUser | undefined {
  return getDb()
    .prepare(`SELECT id, name, email, subscribed FROM users WHERE id = ?`)
    .get(id) as unknown as SessionUser | undefined;
}

export function insertUser(
  name: string,
  email: string,
  passwordHash: string,
  now: number
): number {
  const r = getDb()
    .prepare(
      `INSERT INTO users (name, email, password_hash, subscribed, created_at) VALUES (?, ?, ?, 0, ?)`
    )
    .run(name, email, passwordHash, now);
  return Number(r.lastInsertRowid);
}

/** Assinatura simulada — só liga o flag. */
export function subscribeUser(userId: number): void {
  getDb().prepare(`UPDATE users SET subscribed = 1 WHERE id = ?`).run(userId);
}

/**
 * Ids de projetos distintos que o usuário JÁ ENTROU alguma vez (histórico
 * vitalício). Usado para a regra do "1 projeto grátis": sair de uma vaga em
 * formação não deve "devolver" o crédito grátis, então isso é lido de
 * project_entries (nunca apagado), não de squad_slots (ocupação atual).
 */
export function projectsJoinedBy(userId: number): number[] {
  return (
    getDb()
      .prepare(`SELECT project_id AS pid FROM project_entries WHERE user_id = ?`)
      .all(userId) as unknown as Array<{ pid: number }>
  ).map((r) => r.pid);
}

/** Serializa o usuário para a API — nunca expõe hash nem token. */
export function userPublic(u: SessionUser): User {
  const joined = projectsJoinedBy(u.id);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    subscribed: !!u.subscribed,
    projectsJoined: joined.length,
    freeProjectUsed: joined.length >= 1,
  };
}

/* ------------------------------------------------------------------ */
/* Projetos                                                            */
/* ------------------------------------------------------------------ */

export function getProjectRow(id: number): ProjectRow | undefined {
  return getDb()
    .prepare(`SELECT * FROM projects WHERE id = ?`)
    .get(id) as unknown as ProjectRow | undefined;
}

export function listProjectRows(): ProjectRow[] {
  return getDb()
    .prepare(`SELECT * FROM projects ORDER BY id`)
    .all() as unknown as ProjectRow[];
}

export function insertProject(
  title: string,
  description: string,
  difficulty: Difficulty,
  deadlineWeeks: number,
  createdBy: number,
  now: number
): number {
  const r = getDb()
    .prepare(
      `INSERT INTO projects (title, description, difficulty, deadline_weeks, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(title, description, difficulty, deadlineWeeks, createdBy, now);
  return Number(r.lastInsertRowid);
}

export function insertProjectRole(projectId: number, name: string): void {
  getDb()
    .prepare(`INSERT INTO project_roles (project_id, name) VALUES (?, ?)`)
    .run(projectId, name);
}

/* ------------------------------------------------------------------ */
/* Squads e slots                                                      */
/* ------------------------------------------------------------------ */

export function getSquadRow(id: number): SquadRow | undefined {
  return getDb()
    .prepare(`SELECT * FROM squads WHERE id = ?`)
    .get(id) as unknown as SquadRow | undefined;
}

export function getSlotRow(id: number): SlotRow | undefined {
  return getDb()
    .prepare(`SELECT * FROM squad_slots WHERE id = ?`)
    .get(id) as unknown as SlotRow | undefined;
}

export function countSquadsOfProject(projectId: number): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS n FROM squads WHERE project_id = ?`)
    .get(projectId) as unknown as { n: number };
  return row.n;
}

/** Squads (distintos) em que o usuário ocupa alguma vaga, mais recentes primeiro. */
export function squadRowsOfUser(userId: number): SquadRow[] {
  return getDb()
    .prepare(
      `SELECT DISTINCT sq.* FROM squads sq JOIN squad_slots sl ON sl.squad_id = sq.id WHERE sl.user_id = ? ORDER BY sq.id DESC`
    )
    .all(userId) as unknown as SquadRow[];
}

export function findUserSlotInSquad(
  squadId: number,
  userId: number
): { id: number } | undefined {
  return getDb()
    .prepare(`SELECT id FROM squad_slots WHERE squad_id = ? AND user_id = ?`)
    .get(squadId, userId) as unknown as { id: number } | undefined;
}

/**
 * Ocupa a vaga de forma atômica (`AND user_id IS NULL` evita corrida entre
 * duas requisições). Retorna o nº de linhas alteradas (0 = alguém chegou antes).
 */
export function occupySlot(slotId: number, userId: number, now: number): number {
  const r = getDb()
    .prepare(
      `UPDATE squad_slots SET user_id = ?, filled_at = ? WHERE id = ? AND user_id IS NULL`
    )
    .run(userId, now, slotId);
  return Number(r.changes);
}

export function vacateSlot(slotId: number): void {
  getDb()
    .prepare(`UPDATE squad_slots SET user_id = NULL, filled_at = NULL WHERE id = ?`)
    .run(slotId);
}

export function countEmptySlots(squadId: number): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM squad_slots WHERE squad_id = ? AND user_id IS NULL`
    )
    .get(squadId) as unknown as { n: number };
  return row.n;
}

/** Último slot ocupado → squad ativa e o prazo começa a contar. */
export function activateSquad(squadId: number, now: number, endsAt: number): void {
  getDb()
    .prepare(
      `UPDATE squads SET status = 'active', deadline_started_at = ?, deadline_ends_at = ? WHERE id = ?`
    )
    .run(now, endsAt, squadId);
}

export function deliverSquad(squadId: number, repoUrl: string, now: number): void {
  getDb()
    .prepare(
      `UPDATE squads SET status = 'delivered', repo_url = ?, delivered_at = ? WHERE id = ?`
    )
    .run(repoUrl, now, squadId);
}

/* ------------------------------------------------------------------ */
/* Views de serialização (shapes idênticos ao legado)                  */
/* ------------------------------------------------------------------ */

interface SlotJoinRow {
  id: number;
  user_id: number | null;
  filled_at: number | null;
  role: string;
  userName: string | null;
}

export function squadView(squadRow: SquadRow, userId: number | null): Squad {
  const slots = getDb()
    .prepare(
      `SELECT sl.id, sl.user_id, sl.filled_at, r.name AS role, u.name AS userName
         FROM squad_slots sl
         JOIN project_roles r ON r.id = sl.role_id
         LEFT JOIN users u ON u.id = sl.user_id
        WHERE sl.squad_id = ?
        ORDER BY sl.id`
    )
    .all(squadRow.id) as unknown as SlotJoinRow[];
  const filled = slots.filter((s) => s.user_id != null).length;
  return {
    id: squadRow.id,
    projectId: squadRow.project_id,
    name: squadRow.name,
    status: squadRow.status,
    deadlineStartedAt: squadRow.deadline_started_at,
    deadlineEndsAt: squadRow.deadline_ends_at,
    repoUrl: squadRow.repo_url,
    deliveredAt: squadRow.delivered_at,
    // Entregue depois do fim do prazo → flag de atraso.
    deliveredLate:
      squadRow.delivered_at != null && squadRow.deadline_ends_at != null
        ? squadRow.delivered_at > squadRow.deadline_ends_at
        : false,
    slotsTotal: slots.length,
    slotsFilled: filled,
    isMember: userId != null && slots.some((s) => s.user_id === userId),
    slots: slots.map((s) => ({
      id: s.id,
      role: s.role,
      userId: s.user_id,
      userName: s.userName,
      filledAt: s.filled_at,
      mine: userId != null && s.user_id === userId,
    })),
  };
}

export function projectView(
  p: ProjectRow,
  userId: number | null,
  withSquads: boolean
): Project {
  const roles = (
    getDb()
      .prepare(`SELECT name FROM project_roles WHERE project_id = ? ORDER BY id`)
      .all(p.id) as unknown as Array<{ name: string }>
  ).map((r) => r.name);
  const squadRows = getDb()
    .prepare(`SELECT * FROM squads WHERE project_id = ? ORDER BY id`)
    .all(p.id) as unknown as SquadRow[];
  const squads = squadRows.map((s) => squadView(s, userId));
  // Vagas abertas contam só squads em formação (as demais estão travadas).
  const openSlots = squads.reduce(
    (acc, s) => acc + (s.status === "forming" ? s.slotsTotal - s.slotsFilled : 0),
    0
  );
  const base: Project = {
    id: p.id,
    title: p.title,
    description: p.description,
    difficulty: p.difficulty,
    difficultyLabel: DIFFICULTIES[p.difficulty]?.label || p.difficulty,
    deadlineWeeks: p.deadline_weeks,
    createdAt: p.created_at,
    roles,
    squadCount: squads.length,
    openSlots,
    isMember: userId != null && squads.some((s) => s.isMember),
  };
  if (withSquads) base.squads = squads;
  return base;
}

/**
 * Squads (com projeto) de `targetUserId`, sob o olhar de `viewerId` (decide
 * `isMember`/`mine` nas views). Reaproveitado por `GET /api/me/squads`
 * (target = viewer) e `GET /api/users/:id` (perfil público de outro usuário).
 */
export function squadsWithProjectForUser(
  targetUserId: number,
  viewerId: number | null
): SquadWithProjectResponse[] {
  return squadRowsOfUser(targetUserId).map((sq) => {
    // squads.project_id tem FK ON DELETE CASCADE — se o squad existe, o projeto existe.
    const p = getProjectRow(sq.project_id) as ProjectRow;
    return {
      squad: squadView(sq, viewerId),
      project: projectView(p, viewerId, false),
    };
  });
}
