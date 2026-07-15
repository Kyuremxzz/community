/**
 * TaskForge — tipos de domínio compartilhados.
 *
 * Os shapes espelham EXATAMENTE as respostas JSON do servidor legado
 * (`legacy/server/server.js`): `{ user }`, `{ projects }`, `{ project }`,
 * `{ squad, project }`, `{ squads }` e `{ error: { code, message } }`.
 */

/** Dificuldade do projeto — define o prazo padrão (1 / 2 / 3–4 semanas). */
export type Difficulty = "iniciante" | "intermediario" | "avancado";

/**
 * Ciclo de vida de um squad:
 * forming → active (quando o último slot é ocupado e o prazo dispara)
 * active  → delivered (entrega com URL de repositório).
 */
export type SquadStatus = "forming" | "active" | "delivered";

/** Usuário público — NUNCA inclui hash de senha nem token de sessão. */
export interface User {
  id: number;
  name: string;
  email: string;
  subscribed: boolean;
  /** Quantos projetos distintos o usuário já entrou (histórico vitalício). */
  projectsJoined: number;
  /** Regra do 1º projeto grátis: true se o crédito grátis já foi consumido. */
  freeProjectUsed: boolean;
}

/** Uma vaga (slot) de um squad — 1 por função do projeto. */
export interface Slot {
  id: number;
  role: string;
  userId: number | null;
  userName: string | null;
  filledAt: number | null;
  /** true se a vaga pertence ao usuário autenticado da requisição. */
  mine: boolean;
}

export interface Squad {
  id: number;
  projectId: number;
  name: string;
  status: SquadStatus;
  deadlineStartedAt: number | null;
  deadlineEndsAt: number | null;
  repoUrl: string | null;
  deliveredAt: number | null;
  /** true se a entrega aconteceu depois do fim do prazo. */
  deliveredLate: boolean;
  slotsTotal: number;
  slotsFilled: number;
  isMember: boolean;
  slots: Slot[];
}

export interface Project {
  id: number;
  title: string;
  description: string;
  difficulty: Difficulty;
  difficultyLabel: string;
  deadlineWeeks: number;
  createdAt: number;
  roles: string[];
  squadCount: number;
  openSlots: number;
  isMember: boolean;
  /** Presente apenas quando a rota devolve o projeto "com squads". */
  squads?: Squad[];
}

/* ------------------------------------------------------------------ */
/* Shapes de resposta da API (idênticos ao legado)                     */
/* ------------------------------------------------------------------ */

/** Corpo de erro padrão: `{ error: { code, message } }`. */
export interface ApiErrorPayload {
  error: { code: string; message: string };
}

export interface UserResponse {
  user: User;
}

/** POST /api/me/subscribe. */
export interface SubscribeResponse {
  user: User;
  message: string;
}

/** POST /api/auth/logout. */
export interface OkResponse {
  ok: true;
}

/** GET /api/projects. */
export interface ProjectsResponse {
  projects: Project[];
}

/** GET/POST /api/projects[/:id]. */
export interface ProjectResponse {
  project: Project;
}

/** POST /api/projects/:id/squads e POST /api/slots/:id/leave. */
export interface SquadResponse {
  squad: Squad;
}

/** GET /api/squads/:id. */
export interface SquadWithProjectResponse {
  squad: Squad;
  project: Project;
}

/** GET /api/me/squads. */
export interface MySquadsResponse {
  squads: SquadWithProjectResponse[];
}

/** POST /api/slots/:id/join. */
export interface JoinSlotResponse {
  squad: Squad;
  deadlineStarted: boolean;
  message: string;
}

/** POST /api/squads/:id/deliver. */
export interface DeliverResponse {
  squad: Squad;
  showGithubTutorial: boolean;
  message: string;
}
