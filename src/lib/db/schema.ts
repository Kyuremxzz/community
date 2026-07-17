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

    -- Comunidade (posts/comentários/curtidas/reposts) — feature nova, sem
    -- equivalente no legado.
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('projeto','duvida','discussao','ajuda')),
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      image_path TEXT,
      link_url TEXT,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      repost_of_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
      repost_comment TEXT,
      like_count INTEGER NOT NULL DEFAULT 0,
      comment_count INTEGER NOT NULL DEFAULT 0,
      repost_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_repost_unique
      ON posts(repost_of_id, author_id) WHERE repost_of_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
    CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(type);
    CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at);
    CREATE INDEX IF NOT EXISTS idx_posts_repost_of ON posts(repost_of_id);

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      like_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
    CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);

    CREATE TABLE IF NOT EXISTS post_likes (
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (post_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS comment_likes (
      comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (comment_id, user_id)
    );
  `);
}
