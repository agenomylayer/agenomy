-- migrations/003_schedules.sql
ALTER TABLE runs ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';  -- manual | scheduled

CREATE TABLE IF NOT EXISTS schedules (
  id            BIGSERIAL PRIMARY KEY,
  agent_handle  TEXT NOT NULL,
  skill_slug    TEXT NOT NULL,
  input         TEXT NOT NULL DEFAULT '',
  cron          TEXT NOT NULL,
  enabled       BOOLEAN NOT NULL DEFAULT true,
  last_run_at   TIMESTAMPTZ,
  next_run_at   TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS schedules_due_idx ON schedules (enabled, next_run_at);
