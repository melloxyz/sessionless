CREATE TABLE IF NOT EXISTS budget_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope_type TEXT NOT NULL CHECK(scope_type IN ('global', 'project', 'cli', 'model', 'provider')),
  scope_value TEXT,
  limit_usd REAL NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly' CHECK(period IN ('daily', 'weekly', 'monthly', 'all_time')),
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS alert_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  budget_id INTEGER REFERENCES budget_limits(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK(type IN ('exceeded', 'approaching', 'warning')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  current_spend REAL NOT NULL,
  limit_usd REAL NOT NULL,
  acknowledged INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
