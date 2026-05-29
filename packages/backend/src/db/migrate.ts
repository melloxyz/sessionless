import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDatabase, saveDatabase } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MIGRATIONS_DIR = resolveMigrationsDir();

function resolveMigrationsDir(): string {
  const compiledDir = join(__dirname, 'migrations');
  if (existsSync(compiledDir)) return compiledDir;

  const sourceDir = join(__dirname, '..', '..', 'src', 'db', 'migrations');
  if (existsSync(sourceDir)) return sourceDir;

  return compiledDir;
}

export function runMigrations(): void {
  const db = getDatabase();

  db.run(`
    CREATE TABLE IF NOT EXISTS __migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const migrations = [
    '0000_init',
    '0001_session_model_usage',
    '0002_expand_cli_check',
    '0003_cost_source_hidden_projects',
    '0004_pricing_aliases',
    '0005_app_settings',
    '0006_budget_alerts',
  ];

  for (const name of migrations) {
    const result = db.exec(`SELECT name FROM __migrations WHERE name = ?`, [name]);
    const alreadyApplied = result.length > 0 && result[0].values.length > 0;
    if (alreadyApplied) continue;

    if (ensureMigrationSatisfied(name)) {
      db.run(`INSERT INTO __migrations (name) VALUES (?)`, [name]);
      continue;
    }

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

function ensureMigrationSatisfied(name: string): boolean {
  const db = getDatabase();

  if (name === '0003_cost_source_hidden_projects') {
    const hasCostSource = columnExists('sessions', 'cost_source');
    if (!hasCostSource) {
      db.run(
        `ALTER TABLE sessions ADD COLUMN cost_source TEXT NOT NULL DEFAULT 'unknown' CHECK(cost_source IN ('actual', 'estimated', 'unknown'))`,
      );
    }
    db.run(`
      CREATE TABLE IF NOT EXISTS hidden_projects (
        path TEXT PRIMARY KEY,
        hidden_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    db.run(`CREATE INDEX IF NOT EXISTS idx_hidden_projects_path ON hidden_projects(path)`);
    return true;
  }

  return false;
}

function columnExists(table: string, column: string): boolean {
  const db = getDatabase();
  const result = db.exec(`PRAGMA table_info(${table})`);
  return (result[0]?.values ?? []).some((row) => row[1] === column);
}
