import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDatabase, saveDatabase } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MIGRATIONS_DIR = join(__dirname, 'migrations');

export function runMigrations(): void {
  const db = getDatabase();

  db.run(`
    CREATE TABLE IF NOT EXISTS __migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const migrations = ['0000_init', '0001_session_model_usage'];

  for (const name of migrations) {
    const result = db.exec(`SELECT name FROM __migrations WHERE name = ?`, [name]);
    const alreadyApplied = result.length > 0 && result[0].values.length > 0;
    if (alreadyApplied) continue;

    const sqlPath = join(MIGRATIONS_DIR, `${name}.sql`);
    if (!existsSync(sqlPath)) {
      throw new Error(`Migration file not found: ${sqlPath}`);
    }

    const sql = readFileSync(sqlPath, 'utf-8');
    db.run(sql);
    db.run(`INSERT INTO __migrations (name) VALUES (?)`, [name]);
  }

  saveDatabase();
}
