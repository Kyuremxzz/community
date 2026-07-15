/**
 * Seed de demonstração — cópia fiel do `seedIfEmpty()` do legado
 * (`legacy/server/db.js`): conta demo `demo@taskforge.dev`/`demo123`
 * e seis projetos cobrindo todos os estados de squad.
 */
import type { DatabaseSync } from "node:sqlite";
import type { Difficulty } from "@/lib/types";
import { hashPassword } from "./password";
import { createSquadForProject } from "./core";

export function seedIfEmpty(db: DatabaseSync): void {
  const row = db.prepare("SELECT COUNT(*) AS n FROM users").get() as unknown as {
    n: number;
  };
  if (row.n > 0) return;

  const now = Date.now();
  const day = 86400000;

  const insUser = db.prepare(
    `INSERT INTO users (name, email, password_hash, subscribed, created_at) VALUES (?, ?, ?, ?, ?)`
  );
  const mk = (name: string, email: string, pass: string, sub: number): number =>
    Number(insUser.run(name, email, hashPassword(pass), sub, now).lastInsertRowid);

  const demo = mk("Demo", "demo@taskforge.dev", "demo123", 0);
  const ana = mk("Ana Lima", "ana@taskforge.dev", "senha123", 1);
  const bruno = mk("Bruno Reis", "bruno@taskforge.dev", "senha123", 1);
  const carla = mk("Carla Nunes", "carla@taskforge.dev", "senha123", 1);
  const diego = mk("Diego Alves", "diego@taskforge.dev", "senha123", 1);
  const elisa = mk("Elisa Prado", "elisa@taskforge.dev", "senha123", 1);
  void demo;

  const insProject = db.prepare(
    `INSERT INTO projects (title, description, difficulty, deadline_weeks, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insRole = db.prepare(
    `INSERT INTO project_roles (project_id, name) VALUES (?, ?)`
  );

  function mkProject(
    title: string,
    description: string,
    difficulty: Difficulty,
    weeks: number,
    roles: string[],
    creator: number
  ): number {
    const p = Number(
      insProject.run(title, description, difficulty, weeks, creator, now)
        .lastInsertRowid
    );
    for (const r of roles) insRole.run(p, r);
    return p;
  }

  function fillSlot(slotId: number, userId: number, when: number): void {
    db.prepare(
      `UPDATE squad_slots SET user_id = ?, filled_at = ? WHERE id = ?`
    ).run(userId, when, slotId);
    const slotRow = db
      .prepare(
        `SELECT sq.project_id AS pid FROM squad_slots sl JOIN squads sq ON sq.id = sl.squad_id WHERE sl.id = ?`
      )
      .get(slotId) as unknown as { pid: number };
    db.prepare(
      `INSERT OR IGNORE INTO project_entries (user_id, project_id, first_joined_at) VALUES (?, ?, ?)`
    ).run(userId, slotRow.pid, when);
  }

  function slotsOf(squadId: number): Array<{ id: number }> {
    return db
      .prepare(`SELECT id FROM squad_slots WHERE squad_id = ? ORDER BY id`)
      .all(squadId) as unknown as Array<{ id: number }>;
  }

  // 1) Iniciante, 1 vaga já ocupada — pronto para o usuário novo entrar e ativar o prazo.
  const p1 = mkProject(
    "Pixel Pomodoro",
    "Um timer pomodoro com placar de foco compartilhado. HTML/CSS/JS puro no front, API simples de sessões no back.",
    "iniciante",
    1,
    ["Frontend", "Backend"],
    ana
  );
  const s1 = createSquadForProject(db, p1, "Squad Alpha", now);
  fillSlot(slotsOf(s1)[1].id, ana, now - 2 * day);

  // 2) Iniciante, squad vazio.
  const p2 = mkProject(
    "API de Receitas",
    "CRUD de receitas culinárias com busca por ingrediente e documentação viva. Ideal para treinar REST do zero.",
    "iniciante",
    1,
    ["Backend", "Frontend", "Docs"],
    bruno
  );
  createSquadForProject(db, p2, "Squad Alpha", now);

  // 3) Intermediário, squad ATIVO com prazo correndo (cheio há 3 dias, prazo de 2 semanas).
  const p3 = mkProject(
    "Placar de Torneios",
    "Sistema de chaveamento e placar ao vivo para torneios amadores. WebSocket opcional, foco em modelagem.",
    "intermediario",
    2,
    ["Frontend", "Backend", "Design"],
    carla
  );
  const s3 = createSquadForProject(db, p3, "Squad Alpha", now - 10 * day);
  const s3slots = slotsOf(s3);
  fillSlot(s3slots[0].id, carla, now - 5 * day);
  fillSlot(s3slots[1].id, diego, now - 4 * day);
  fillSlot(s3slots[2].id, elisa, now - 3 * day);
  db.prepare(
    `UPDATE squads SET status = 'active', deadline_started_at = ?, deadline_ends_at = ? WHERE id = ?`
  ).run(now - 3 * day, now - 3 * day + 14 * day, s3);

  // 4) Intermediário, formação em andamento.
  const p4 = mkProject(
    "Chat em Tempo Real",
    "Salas de chat com presença online e histórico. Um clássico de estágio: sockets, estado e UX de mensagens.",
    "intermediario",
    2,
    ["Frontend", "Backend"],
    diego
  );
  const s4 = createSquadForProject(db, p4, "Squad Alpha", now);
  fillSlot(slotsOf(s4)[0].id, bruno, now - day);

  // 5) Avançado (4 semanas), metade preenchido.
  const p5 = mkProject(
    "Marketplace Solidário",
    "Plataforma de doações entre ONGs e doadores: catálogo, matching e logística. Escopo grande, papéis bem separados.",
    "avancado",
    4,
    ["Frontend", "Backend", "Design", "PM"],
    elisa
  );
  const s5 = createSquadForProject(db, p5, "Squad Alpha", now);
  const s5slots = slotsOf(s5);
  fillSlot(s5slots[1].id, ana, now - 2 * day);
  fillSlot(s5slots[3].id, carla, now - day);

  // 6) Avançado (3 semanas), squad ENTREGUE — mostra o estado final + tutorial GitHub.
  const p6 = mkProject(
    "Motor de Busca Musical",
    "Indexador e busca de letras/metadados de músicas com ranking. Pipeline de dados + API + UI de busca.",
    "avancado",
    3,
    ["Backend", "Data", "Frontend"],
    bruno
  );
  const s6 = createSquadForProject(db, p6, "Squad Alpha", now - 30 * day);
  const s6slots = slotsOf(s6);
  fillSlot(s6slots[0].id, bruno, now - 28 * day);
  fillSlot(s6slots[1].id, diego, now - 27 * day);
  fillSlot(s6slots[2].id, elisa, now - 26 * day);
  db.prepare(
    `UPDATE squads SET status = 'delivered', deadline_started_at = ?, deadline_ends_at = ?, repo_url = ?, delivered_at = ? WHERE id = ?`
  ).run(
    now - 26 * day,
    now - 5 * day,
    "https://github.com/taskforge-demo/motor-busca-musical",
    now - 6 * day,
    s6
  );
}
