/**
 * TaskForge — cliente HTTP tipado da API (consumido pelos client components).
 *
 * A autenticação vive num cookie httpOnly (`taskforge_token`) gerenciado pelo
 * servidor: fetch same-origin já envia o cookie sozinho, então aqui não há
 * token, header Authorization nem localStorage. Toda resposta usa
 * `cache: "no-store"` — dados de squad/prazo nunca podem ficar velhos.
 */
import type {
  CommentLikeResponse,
  CommentResponse,
  CommentsResponse,
  DeliverResponse,
  Difficulty,
  JoinSlotResponse,
  MySquadsResponse,
  OkResponse,
  PostLikeResponse,
  PostResponse,
  PostType,
  PostsResponse,
  ProfileResponse,
  ProjectResponse,
  ProjectsResponse,
  RepostResponse,
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

/** Extrai o corpo JSON e converte respostas de erro em `ApiClientError`. */
async function parseResponse<T>(res: Response): Promise<T> {
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
  return parseResponse<T>(res);
}

/**
 * Como `request`, mas manda `FormData` direto — sem `JSON.stringify` e sem
 * setar `Content-Type` manualmente (o browser define o boundary do
 * multipart sozinho). Usado só por `createPost` (upload de imagem).
 */
async function requestForm<T>(path: string, form: FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      body: form,
      cache: "no-store",
    });
  } catch {
    throw new ApiClientError(0, "network", "Sem conexão com o servidor — tente de novo.");
  }
  return parseResponse<T>(res);
}

export interface CreateProjectInput {
  title: string;
  description: string;
  difficulty: Difficulty;
  deadlineWeeks: number;
  roles: string[];
}

export interface ListPostsParams {
  type?: PostType;
  q?: string;
  sort?: "recent" | "popular";
  authorId?: number;
  limit?: number;
  offset?: number;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") sp.set(key, String(value));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
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

  /* ---- comunidade ---- */
  posts: (params?: ListPostsParams) =>
    request<PostsResponse>(
      `/api/posts${buildQuery((params ?? {}) as Record<string, string | number | undefined>)}`
    ),
  /** `formData` já vem pronto de `<PostComposer onSubmit>` (campos type/title/body/linkUrl/projectId/image). */
  createPost: (formData: FormData) => requestForm<PostResponse>("/api/posts", formData),
  post: (id: number) => request<PostResponse>(`/api/posts/${id}`),
  likePost: (id: number) =>
    request<PostLikeResponse>(`/api/posts/${id}/like`, { method: "POST" }),
  repostPost: (id: number, comment?: string) =>
    request<RepostResponse>(`/api/posts/${id}/repost`, {
      method: "POST",
      body: comment ? { comment } : {},
    }),
  comments: (postId: number) =>
    request<CommentsResponse>(`/api/posts/${postId}/comments`),
  createComment: (postId: number, body: string, parentId?: number) =>
    request<CommentResponse>(`/api/posts/${postId}/comments`, {
      method: "POST",
      body: parentId != null ? { body, parentId } : { body },
    }),
  likeComment: (id: number) =>
    request<CommentLikeResponse>(`/api/comments/${id}/like`, { method: "POST" }),
  userProfile: (id: number) => request<ProfileResponse>(`/api/users/${id}`),
};
