-- Aeonomy slice 1 schema. Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS skills (
  slug        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  category    TEXT,
  tags        JSONB NOT NULL DEFAULT '[]',
  source      TEXT NOT NULL DEFAULT 'aeon'
);

CREATE TABLE IF NOT EXISTS agents (
  agent_id      BIGINT PRIMARY KEY,
  owner         TEXT NOT NULL,
  wallet        TEXT NOT NULL,
  handle        TEXT UNIQUE NOT NULL,
  manifest_hash TEXT NOT NULL,
  manifest_cid  TEXT,
  config_hash   TEXT NOT NULL,
  persona       JSONB,
  skills        JSONB NOT NULL DEFAULT '[]',
  created_at    BIGINT NOT NULL,
  block_number  BIGINT NOT NULL,
  tx_hash       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS indexer_state (
  id         INT PRIMARY KEY DEFAULT 1,
  last_block BIGINT NOT NULL
);

-- Helpful read-path indexes (filters/sorts in the read API).
CREATE INDEX IF NOT EXISTS agents_created_at_idx ON agents (created_at DESC);
CREATE INDEX IF NOT EXISTS agents_owner_idx ON agents (owner);
