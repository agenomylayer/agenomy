-- 005_memory.sql — Slice 5: agent memory
CREATE TABLE IF NOT EXISTS memories (
  id            BIGSERIAL PRIMARY KEY,
  agent_handle  TEXT NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'auto',   -- 'auto' | 'pinned'
  content       TEXT NOT NULL,
  content_hash  TEXT NOT NULL,
  run_id        BIGINT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS memories_agent_idx ON memories (agent_handle, created_at DESC);

CREATE TABLE IF NOT EXISTS memory_snapshots (
  agent_handle  TEXT PRIMARY KEY,
  cid           TEXT NOT NULL,
  hash          TEXT NOT NULL,
  entry_count   INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
