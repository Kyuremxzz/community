/**
 * GET  /api/projects — catálogo (auth opcional; muda `isMember`/`mine`).
 * POST /api/projects — cria projeto + Squad Alpha inicial (auth obrigatória).
 */
import type { NextRequest } from "next/server";
import { createSquadForProject, getDb } from "@/lib/db";
import {
  DIFFICULTIES,
  insertProject,
  insertProjectRole,
  isDifficulty,
  listProjectRows,
  projectView,
} from "@/lib/db/queries";
import { getSessionUser } from "@/lib/auth";
import type { ProjectResponse, ProjectsResponse } from "@/lib/types";
import {
  ApiError,
  getProjectOr404,
  handle,
  json,
  readBody,
  requireUser,
} from "../_lib/http";

export async function GET() {
  return handle(async () => {
    const u = await getSessionUser();
    const rows = listProjectRows();
    const payload: ProjectsResponse = {
      projects: rows.map((p) => projectView(p, u?.id ?? null, false)),
    };
    return json(payload, 200);
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const u = await requireUser();
    const body = await readBody(req);
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const difficulty = String(body.difficulty || "");
    const rolesRaw: unknown[] = Array.isArray(body.roles) ? body.roles : [];

    if (title.length < 3) {
      throw new ApiError(400, "invalid_title", "Título precisa de pelo menos 3 caracteres.");
    }
    if (description.length < 10) {
      throw new ApiError(400, "invalid_description", "Descrição precisa de pelo menos 10 caracteres.");
    }
    if (!isDifficulty(difficulty)) {
      throw new ApiError(400, "invalid_difficulty", "Dificuldade deve ser iniciante, intermediario ou avancado.");
    }
    const diff = DIFFICULTIES[difficulty];

    // deadlineWeeks é opcional (usa o padrão da dificuldade); se enviado, tem que
    // ser um inteiro válido para essa dificuldade — nunca cai num default silencioso.
    let deadlineWeeks: number;
    const dw = body.deadlineWeeks;
    if (dw === undefined || dw === null || dw === "") {
      deadlineWeeks = diff.weeks[0];
    } else if (typeof dw === "number" && Number.isInteger(dw)) {
      deadlineWeeks = dw;
    } else {
      throw new ApiError(400, "invalid_deadline", "Prazo precisa ser um número inteiro de semanas.");
    }
    if (!diff.weeks.includes(deadlineWeeks)) {
      throw new ApiError(400, "invalid_deadline", `Prazo para ${difficulty}: ${diff.weeks.join(" ou ")} semana(s).`);
    }

    const rolesTrimmed = rolesRaw.map((r) => String(r).trim()).filter(Boolean);
    const roles = [...new Set(rolesTrimmed)];
    if (roles.length !== rolesTrimmed.length) {
      throw new ApiError(400, "invalid_roles", "Funções não podem se repetir.");
    }
    if (roles.length < 2 || roles.length > 6) {
      throw new ApiError(400, "invalid_roles", "Defina entre 2 e 6 funções para o projeto.");
    }
    if (roles.some((r) => r.length > 14)) {
      throw new ApiError(400, "invalid_roles", "Nome de função pode ter no máximo 14 caracteres.");
    }

    const now = Date.now();
    const projectId = insertProject(title, description, difficulty, deadlineWeeks, u.id, now);
    for (const role of roles) insertProjectRole(projectId, role);
    // Todo projeto nasce com um squad em formação.
    createSquadForProject(getDb(), projectId, "Squad Alpha", now);

    const p = getProjectOr404(projectId);
    const payload: ProjectResponse = { project: projectView(p, u.id, true) };
    return json(payload, 201);
  });
}
