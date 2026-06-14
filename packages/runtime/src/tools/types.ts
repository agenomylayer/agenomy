import type { JSONSchema7 } from "json-schema";

export interface ToolContext {
  rpcUrl: string; // Base RPC endpoint
  fetch: typeof fetch; // injected for testability
  /** Test seam: let unit tests inject a fake viem client. */
  makeClient?: () => any;
}

export interface ToolResult {
  ok: boolean;
  data?: unknown; // structured result the model reads
  error?: string; // human-readable failure (model can react)
}

export interface Tool {
  name: string; // e.g. "onchain_read"
  description: string; // shown to the model
  parameters: JSONSchema7; // JSON-schema for the call args
  run(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}
