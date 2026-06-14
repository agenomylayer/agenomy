CREATE TABLE IF NOT EXISTS runs (
  id           BIGSERIAL PRIMARY KEY,
  agent_handle TEXT NOT NULL,
  skill_slug   TEXT NOT NULL,
  input        TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'running',  -- running | ok | error
  output       TEXT,
  trace        JSONB NOT NULL DEFAULT '[]',
  model        TEXT,
  tokens_in    INTEGER,
  tokens_out   INTEGER,
  error        TEXT,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS runs_agent_idx ON runs (agent_handle, started_at DESC);
