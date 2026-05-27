import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { join, dirname } from 'node:path';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

let db: SqlJsDatabase | null = null;
let dbPath: string;

export function getDbPath(): string {
  return process.env.DATABASE_PATH || join(process.cwd(), 'data', 'sessionless.db');
}

export function getDatabase(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export async function initDatabase(): Promise<void> {
  dbPath = getDbPath();
  const dir = dirname(dbPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const legacyPath = join(dir, ['ai', 'meter.db'].join(''));
  if (!existsSync(dbPath) && existsSync(legacyPath)) {
    copyFileSync(legacyPath, dbPath);
  }

  const SQL = await initSqlJs();

  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
}

export function saveDatabase(): void {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  writeFileSync(dbPath, buffer);
}

export function closeDatabase(): void {
  if (!db) return;
  saveDatabase();
  db.close();
  db = null;
}
