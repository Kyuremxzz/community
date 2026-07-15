/**
 * TaskForge — cliente HTTP tipado da API (consumido pelos client components).
 *
 * A autenticação vive num cookie httpOnly (`taskforge_token`) gerenciado pelo
 * servidor: fetch same-origin já envia o cookie sozinho, então aqui não há
 * token, header Authorization nem localStorage. Toda resposta usa
 * `cache: "no-store"` — dados de squad/prazo nunca podem ficar velhos.
 */
import type {
  DeliverResponse,
  Difficulty,
  JoinSlotResponse,
  MySquadsResponse,
  OkResponse,
  ProjectResponse,
  ProjectsResponse,
  SquadResponse,
  SquadWithProjectResponse,
  SubscribeResponse,
  UserResponse,
} from "@/lib/types";

/** Erro de API no cliente: carrega `status` HTTP e `code` do corpo `{ error }`. */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

/** Mensagem legível de qualquer erro capturado (para toasts/erros inline). */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Erro inesperado.";
}

/** Status HTTP do erro, ou null se não for um erro de API. */
export function errorStatus(err: unknown): number | null {
  return err instanceof ApiClientError ? err.status : null;
}

async function request<T>(
  path: string,
  init?: { method?: "POST"; body?: unknown }
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init?.method ?? "GET",
      headers:
        init?.body !== undefined
          ? { "Content-Type": "application/json" }
          : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiClientError(0, "network", "Sem conexão com o servidor — tente de novo.");
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* corpo vazio/não-JSON: tratado abaixo */
  }

  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)
      ?.error;
    throw new ApiClientError(
      res.status,
      err?.code ?? "unknown",
      err?.message ?? `Erro ${res.status}.`
    );
  }
  return data as T;
}

export interface CreateProjectInput {
  title: string;
  description: string;
  difficulty: Difficulty;
  deadlineWeeks: number;
  roles: string[];
}

/** Métodos 1:1 com as rotas de `src/app/api` (mesmos shapes do legado). */
export const api = {
  /* ---- auth ---- */
  register: (name: string, email: string, password: string) =>
    request<UserResponse>("/api/auth/register", {
      method: "POST",
      body: { name, email, password },
    }),
  login: (email: string, password: string) =>
    request<UserResponse>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    }),
  logout: () => request<OkResponse>("/api/auth/logout", { method: "POST" }),

  /* ---- eu ---- */
  me: () => request<UserResponse>("/api/me"),
  subscribe: () =>
    request<SubscribeResponse>("/api/me/subscribe", { method: "POST" }),
  mySquads: () => request<MySquadsResponse>("/api/me/squads"),

  /* ---- projetos ---- */
  projects: () => request<ProjectsResponse>("/api/projects"),
  createProject: (input: CreateProjectInput) =>
    request<ProjectResponse>("/api/projects", { method: "POST", body: input }),
  project: (id: number) => request<ProjectResponse>(`/api/projects/${id}`),
  addSquad: (projectId: number, name?: string) =>
    request<SquadResponse>(`/api/projects/${projectId}/squads`, {
      method: "POST",
      body: name ? { name } : {},
    }),

  /* ---- squads e vagas ---- */
  squad: (id: number) =>
    request<SquadWithProjectResponse>(`/api/squads/${id}`),
  deliver: (id: number, repoUrl: string) =>
    request<DeliverResponse>(`/api/squads/${id}/deliver`, {
      method: "POST",
      body: { repoUrl },
    }),
  joinSlot: (slotId: number) =>
    request<JoinSlotResponse>(`/api/slots/${slotId}/join`, { method: "POST" }),
  leaveSlot: (slotId: number) =>
    request<SquadResponse>(`/api/slots/${slotId}/leave`, { method: "POST" }),
};
