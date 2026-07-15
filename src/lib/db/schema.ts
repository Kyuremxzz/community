/**
 * Schema do banco — cópia fiel do `migrate()` do legado (`legacy/server/db.js`).
 */
import type { DatabaseSync } from "node:sqlite";

export function migrate(db: DatabaseSync): void {
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
