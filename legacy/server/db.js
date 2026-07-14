'use strict';
/**
 * TaskForge — camada de banco (node:sqlite, zero dependências).
 * Schema + seed de demonstração.
 */
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const crypto = require('node:crypto');

const DB_PATH = process.env.TASKFORGE_DB || path.join(__dirname, '..', 'data', 'taskforge.db');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

function openDb() {
  const fs = require('node:fs');
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  migrate(db);
  seedIfEmpty(db);
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      subscribed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL
    );

    -- Histórico vitalício de "entrei nesse projeto alguma vez", usado para a
    -- regra do projeto grátis. Não é apagado quando o usuário sai de uma vaga
    -- em formação — diferente de squad_slots, que reflete ocupação ATUAL.
    CREATE TABLE IF NOT EXISTS project_entries (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      first_joined_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, project_id)
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      difficulty TEXT NOT NULL CHECK (difficulty IN ('iniciante','intermediario','avancado')),
      deadline_weeks INTEGER NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      UNIQUE (project_id, name)
    );

    CREATE TABLE IF NOT EXISTS squads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'forming' CHECK (status IN ('forming','active','delivered')),
      deadline_started_at INTEGER,
      deadline_ends_at INTEGER,
      repo_url TEXT,
      delivered_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS squad_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      squad_id INTEGER NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
      role_id INTEGER NOT NULL REFERENCES project_roles(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      filled_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_slots_squad ON squad_slots(squad_id);
    CREATE INDEX IF NOT EXISTS idx_slots_user ON squad_slots(user_id);
    CREATE INDEX IF NOT EXISTS idx_squads_project ON squads(project_id);
    CREATE INDEX IF NOT EXISTS idx_roles_project ON project_roles(project_id);
  `);
}

/** Cria squad com um slot por função do projeto. Retorna id do squad. */
function createSquadForProject(db, projectId, name, now) {
  const squad = db
    .prepare(`INSERT INTO squads (project_id, name, status, created_at) VALUES (?, ?, 'forming', ?)`)
    .run(projectId, name, now);
  const squadId = Number(squad.lastInsertRowid);
  const roles = db.prepare(`SELECT id FROM project_roles WHERE project_id = ? ORDER BY id`).all(projectId);
  const insSlot = db.prepare(`INSERT INTO squad_slots (squad_id, role_id) VALUES (?, ?)`);
  for (const r of roles) insSlot.run(squadId, r.id);
  return squadId;
}

function seedIfEmpty(db) {
  const row = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  if (row.n > 0) return;

  const now = Date.now();
  const day = 86400000;

  const insUser = db.prepare(
    `INSERT INTO users (name, email, password_hash, subscribed, created_at) VALUES (?, ?, ?, ?, ?)`
  );
  const mk = (name, email, pass, sub) => Number(insUser.run(name, email, hashPassword(pass), sub, now).lastInsertRowid);

  const demo = mk('Demo', 'demo@taskforge.dev', 'demo123', 0);
  const ana = mk('Ana Lima', 'ana@taskforge.dev', 'senha123', 1);
  const bruno = mk('Bruno Reis', 'bruno@taskforge.dev', 'senha123', 1);
  const carla = mk('Carla Nunes', 'carla@taskforge.dev', 'senha123', 1);
  const diego = mk('Diego Alves', 'diego@taskforge.dev', 'senha123', 1);
  const elisa = mk('Elisa Prado', 'elisa@taskforge.dev', 'senha123', 1);
  void demo;

  const insProject = db.prepare(
    `INSERT INTO projects (title, description, difficulty, deadline_weeks, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insRole = db.prepare(`INSERT INTO project_roles (project_id, name) VALUES (?, ?)`);

  function mkProject(title, description, difficulty, weeks, roles, creator) {
    const p = Number(insProject.run(title, description, difficulty, weeks, creator, now).lastInsertRowid);
    for (const r of roles) insRole.run(p, r);
    return p;
  }

  function fillSlot(slotId, userId, when) {
    db.prepare(`UPDATE squad_slots SET user_id = ?, filled_at = ? WHERE id = ?`).run(userId, when, slotId);
    const row = db
      .prepare(
        `SELECT sq.project_id AS pid FROM squad_slots sl JOIN squads sq ON sq.id = sl.squad_id WHERE sl.id = ?`
      )
      .get(slotId);
    db.prepare(
      `INSERT OR IGNORE INTO project_entries (user_id, project_id, first_joined_at) VALUES (?, ?, ?)`
    ).run(userId, row.pid, when);
  }

  function slotsOf(squadId) {
    return db.prepare(`SELECT id FROM squad_slots WHERE squad_id = ? ORDER BY id`).all(squadId);
  }

  // 1) Iniciante, 1 vaga já ocupada — pronto para o usuário novo entrar e ativar o prazo.
  const p1 = mkProject(
    'Pixel Pomodoro',
    'Um timer pomodoro com placar de foco compartilhado. HTML/CSS/JS puro no front, API simples de sessões no back.',
    'iniciante', 1, ['Frontend', 'Backend'], ana
  );
  const s1 = createSquadForProject(db, p1, 'Squad Alpha', now);
  fillSlot(slotsOf(s1)[1].id, ana, now - 2 * day);

  // 2) Iniciante, squad vazio.
  const p2 = mkProject(
    'API de Receitas',
    'CRUD de receitas culinárias com busca por ingrediente e documentação viva. Ideal para treinar REST do zero.',
    'iniciante', 1, ['Backend', 'Frontend', 'Docs'], bruno
  );
  createSquadForProject(db, p2, 'Squad Alpha', now);

  // 3) Intermediário, squad ATIVO com prazo correndo (cheio há 3 dias, prazo de 2 semanas).
  const p3 = mkProject(
    'Placar de Torneios',
    'Sistema de chaveamento e placar ao vivo para torneios amadores. WebSocket opcional, foco em modelagem.',
    'intermediario', 2, ['Frontend', 'Backend', 'Design'], carla
  );
  const s3 = createSquadForProject(db, p3, 'Squad Alpha', now - 10 * day);
  const s3slots = slotsOf(s3);
  fillSlot(s3slots[0].id, carla, now - 5 * day);
  fillSlot(s3slots[1].id, diego, now - 4 * day);
  fillSlot(s3slots[2].id, elisa, now - 3 * day);
  db.prepare(
    `UPDATE squads SET status = 'active', deadline_started_at = ?, deadline_ends_at = ? WHERE id = ?`
  ).run(now - 3 * day, now - 3 * day + 14 * day, s3);

  // 4) Intermediário, formação em andamento.
  const p4 = mkProject(
    'Chat em Tempo Real',
    'Salas de chat com presença online e histórico. Um clássico de estágio: sockets, estado e UX de mensagens.',
    'intermediario', 2, ['Frontend', 'Backend'], diego
  );
  const s4 = createSquadForProject(db, p4, 'Squad Alpha', now);
  fillSlot(slotsOf(s4)[0].id, bruno, now - day);

  // 5) Avançado (4 semanas), metade preenchido.
  const p5 = mkProject(
    'Marketplace Solidário',
    'Plataforma de doações entre ONGs e doadores: catálogo, matching e logística. Escopo grande, papéis bem separados.',
    'avancado', 4, ['Frontend', 'Backend', 'Design', 'PM'], elisa
  );
  const s5 = createSquadForProject(db, p5, 'Squad Alpha', now);
  const s5slots = slotsOf(s5);
  fillSlot(s5slots[1].id, ana, now - 2 * day);
  fillSlot(s5slots[3].id, carla, now - day);

  // 6) Avançado (3 semanas), squad ENTREGUE — mostra o estado final + tutorial GitHub.
  const p6 = mkProject(
    'Motor de Busca Musical',
    'Indexador e busca de letras/metadados de músicas com ranking. Pipeline de dados + API + UI de busca.',
    'avancado', 3, ['Backend', 'Data', 'Frontend'], bruno
  );
  const s6 = createSquadForProject(db, p6, 'Squad Alpha', now - 30 * day);
  const s6slots = slotsOf(s6);
  fillSlot(s6slots[0].id, bruno, now - 28 * day);
  fillSlot(s6slots[1].id, diego, now - 27 * day);
  fillSlot(s6slots[2].id, elisa, now - 26 * day);
  db.prepare(
    `UPDATE squads SET status = 'delivered', deadline_started_at = ?, deadline_ends_at = ?, repo_url = ?, delivered_at = ? WHERE id = ?`
  ).run(now - 26 * day, now - 5 * day, 'https://github.com/taskforge-demo/motor-busca-musical', now - 6 * day, s6);
}

/** Registra (uma vez, vitaliciamente) que o usuário entrou nesse projeto — usado na regra do projeto grátis. */
function recordProjectEntry(db, userId, projectId, when) {
  db.prepare(
    `INSERT OR IGNORE INTO project_entries (user_id, project_id, first_joined_at) VALUES (?, ?, ?)`
  ).run(userId, projectId, when);
}

module.exports = { openDb, hashPassword, verifyPassword, createSquadForProject, recordProjectEntry, DB_PATH };
