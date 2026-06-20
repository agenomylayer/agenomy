-- 006_solana_wallet: give agents a Solana wallet address alongside their Base
-- wallet (honest multichain identity). The address is a real Solana account;
-- full Solana spawn flow + payments (SPL / Solana Pay) come in a later slice.
ALTER TABLE agents ADD COLUMN IF NOT EXISTS solana_wallet TEXT;
