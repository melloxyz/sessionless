CREATE TABLE IF NOT EXISTS migrations (
  name TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  cli TEXT NOT NULL CHECK(cli IN ('claude', 'opencode', 'codex')),
  session_id TEXT NOT NULL,
  project_path TEXT,
  model TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_ms INTEGER,
  total_cost_usd REAL,
  source_confidence TEXT NOT NULL DEFAULT 'LOW' CHECK(source_confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  message_count INTEGER DEFAULT 0,
  tool_call_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(session_id, cli, provider)
);

CREATE TABLE IF NOT EXISTS usage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_fk INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  timestamp TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  reasoning_tokens INTEGER NOT NULL DEFAULT 0,
  tool_calls_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS session_model_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_fk INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  reasoning_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  tool_calls_count INTEGER NOT NULL DEFAULT 0,
  total_cost_usd REAL NOT NULL DEFAULT 0,
  UNIQUE(session_fk, provider, model)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_fk INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,
  git_remote TEXT,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  total_cost REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  input_cost_per_million REAL NOT NULL DEFAULT 0,
  output_cost_per_million REAL NOT NULL DEFAULT 0,
  cached_input_cost REAL,
  UNIQUE(provider, model_name)
);

CREATE INDEX IF NOT EXISTS idx_sessions_cli ON sessions(cli);
CREATE INDEX IF NOT EXISTS idx_sessions_project_path ON sessions(project_path);
CREATE INDEX IF NOT EXISTS idx_sessions_model ON sessions(model);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_usage_events_session ON usage_events(session_fk);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_fk);
CREATE INDEX IF NOT EXISTS idx_session_model_usage_session ON session_model_usage(session_fk);
CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(path);

CREATE TABLE IF NOT EXISTS __checkpoints (
  cli TEXT NOT NULL,
  session_path TEXT NOT NULL,
  last_file_mtime INTEGER NOT NULL,
  last_file_size INTEGER NOT NULL,
  last_session_id TEXT,
  PRIMARY KEY (cli, session_path)
);
