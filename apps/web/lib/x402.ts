// Server-side x402 wrapper (Node only — never import from a client component).
// Confirmed against @x402/core + @x402/evm v2.15.0 (2026-06-16 spike).
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { decodePaymentSignatureHeader } from "@x402/core/http";
import { ADDRESSES, CHAIN_ID } from "@agenomy/shared";

const FACILITATOR_URL = process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator";
export const X402_NETWORK = `eip155:${CHAIN_ID}`; // "eip155:84532"

/* eslint-disable @typescript-eslint/no-explicit-any */
let _server: any = null;
let _initPromise: Promise<unknown> | null = null;

/** Lazily construct + initialize the resource server (initialize() fetches the facilitator's supported kinds). */
async function server(): Promise<any> {
  if (!_server) {
    _server = new x402ResourceServer(new HTTPFacilitatorClient({ url: FACILITATOR_URL }));
    registerExactEvmScheme(_server);
  }
  if (!_initPromise) _initPromise = _server.initialize();
  await _initPromise;
  return _server;
}

/**
 * Build x402 payment requirements for an exact USDC payment to `payTo`.
 * Price is expressed in USD; the SDK resolves the network's default stablecoin (Base Sepolia USDC,
 * which carries the correct EIP-3009 domain). priceAtomic is USDC 6-decimal atomic units.
 * Requires network access to the facilitator (for initialize()).
 */
export async function buildRequirements(payTo: `0x${string}`, priceAtomic: bigint): Promise<any[]> {
  const usd = (Number(priceAtomic) / 1_000_000).toString();
  const s = await server();
  return await s.buildPaymentRequirements({
    scheme: "exact",
    payTo,
    price: `$${usd}`,
    network: X402_NETWORK,
  });
}

/** The HTTP 402 response body (PaymentRequired) the x402 client reads `accepts` from. Pure. */
export function paymentRequiredBody(requirements: any[]): unknown {
  return { x402Version: 2, accepts: requirements, error: "payment required" };
}

/** Verify the caller's X-PAYMENT header against requirements (calls the facilitator). Never throws. */
export async function verifyPayment(
  header: string,
  requirements: any[],
): Promise<{ valid: boolean; payer?: string; reason?: string }> {
  try {
    if (!header || requirements.length === 0) return { valid: false, reason: "missing payment" };
    const payload = decodePaymentSignatureHeader(header);
    const s = await server();
    const v = await s.verifyPayment(payload, requirements[0]);
    return { valid: Boolean(v.isValid), payer: v.payer, reason: v.invalidReason };
  } catch (e) {
    return { valid: false, reason: e instanceof Error ? e.message : "verify failed" };
  }
}

/** Settle the verified payment on-chain via the facilitator after the work succeeded. */
export async function settlePayment(
  header: string,
  requirements: any[],
): Promise<{ txHash: string; payer?: string; success: boolean }> {
  const payload = decodePaymentSignatureHeader(header);
  const s = await server();
  const r = await s.settlePayment(payload, requirements[0]);
  return { txHash: String(r.transaction ?? ""), payer: r.payer, success: Boolean(r.success) };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
