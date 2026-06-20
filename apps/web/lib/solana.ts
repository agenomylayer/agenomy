import { createHash, createPrivateKey, createPublicKey } from "node:crypto";

// Base58 (Bitcoin/Solana alphabet) encoder. Small and dependency-free so we
// don't pull @solana/web3.js into the web app just to print an address.
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58(buf: Buffer): string {
  let zeros = 0;
  while (zeros < buf.length && buf[zeros] === 0) zeros++;
  const digits: number[] = [];
  for (let i = zeros; i < buf.length; i++) {
    let carry = buf[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = "1".repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i--) out += B58[digits[i]];
  return out;
}

// PKCS8 DER prefix for an Ed25519 private key followed by its 32-byte seed.
const PKCS8_ED25519_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

/**
 * Deterministically derive an agent's Solana (Ed25519) wallet address from a
 * server-held master seed and the agent's unique on-chain identity (its Base
 * wallet address). The result is a real Solana account, verifiable on the
 * explorer; the operator can reconstruct the keypair from the same seed when
 * Solana payments ship in a later slice. Identity only for now — settlement
 * stays on Base over x402/USDC.
 *
 * The master seed MUST stay stable for the life of the deployment: changing it
 * changes every derived address. Set AGENOMY_SOLANA_SEED once and keep it.
 */
export function deriveSolanaAddress(agentKey: string): string {
  const masterSeed = process.env.AGENOMY_SOLANA_SEED ?? "";
  const seed32 = createHash("sha256")
    .update(`agenomy:solana:v1:${masterSeed}:${agentKey}`)
    .digest();
  const der = Buffer.concat([PKCS8_ED25519_PREFIX, seed32]);
  const priv = createPrivateKey({ key: der, format: "der", type: "pkcs8" });
  const spki = createPublicKey(priv).export({ format: "der", type: "spki" }) as Buffer;
  const rawPub = spki.subarray(spki.length - 32);
  return base58(rawPub);
}
