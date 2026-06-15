-- migrations/004_earn.sql
CREATE TABLE IF NOT EXISTS pricing (
  agent_handle TEXT PRIMARY KEY,
  price_atomic BIGINT NOT NULL DEFAULT 0,  -- USDC atomic units (6 decimals); 0 = free
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE runs ADD COLUMN IF NOT EXISTS payment_amount BIGINT;  -- atomic USDC; null = free/unpaid
ALTER TABLE runs ADD COLUMN IF NOT EXISTS payer          TEXT;    -- caller address; null if free
ALTER TABLE runs ADD COLUMN IF NOT EXISTS payment_tx     TEXT;    -- settlement tx hash; null if free
