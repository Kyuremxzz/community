/**
 * TaskForge — camada de banco (node:sqlite, zero dependências).
 *
 * Singleton do banco cacheado em `globalThis` para sobreviver ao HMR do
 * `next dev` (cada recompilação recria os módulos, mas o global persiste
 * no mesmo processo — sem isso abriríamos N conexões e re-rodaríamos o seed).
 */
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { migrate } from "./schema";
import { seedIfEmpty } from "./seed";

/** Caminho do banco: env TASKFORGE_DB ou `data/taskforge.db` na raiz do projeto. */
export const DB_PATH =
  process.env.TASKFORGE_DB || path.join(process.cwd(), "data", "taskforge.db");

const globalForDb = globalThis as unknown as {
  __taskforgeDb: DatabaseSync | undefined;
};

/** Abre (uma única vez por processo) o banco, aplicando schema e seed. */
export function getDb(): DatabaseSync {
  if (!globalForDb.__taskforgeDb) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const db = new DatabaseSync(DB_PATH);
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");
    migrate(db);
    seedIfEmpty(db);
    globalForDb.__taskforgeDb = db;
  }
  return globalForDb.__taskforgeDb;
}

export { hashPassword, verifyPassword } from "./password";
export { createSquadForProject, recordProjectEntry } from "./core";
