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

CREATE INDEX IF NOT EXISTS idx_session_model_usage_session ON session_model_usage(session_fk);
