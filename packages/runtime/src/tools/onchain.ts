import { createPublicClient, http, formatEther, isAddress } from "viem";
import { baseSepolia } from "viem/chains";
import type { Tool, ToolContext, ToolResult } from "./types";

const ERC20 = [
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

function client(ctx: ToolContext): any {
  return ctx.makeClient
    ? ctx.makeClient()
    : createPublicClient({ chain: baseSepolia, transport: http(ctx.rpcUrl) });
}

export const onchainRead: Tool = {
  name: "onchain_read",
  description:
    "Read Base (Sepolia) on-chain data: native ETH balance, ERC-20 token metadata/balance, current gas price.",
  parameters: {
    type: "object",
    required: ["action"],
    properties: {
      action: { type: "string", enum: ["balance", "erc20", "gasPrice"] },
      address: { type: "string", description: "0x address for balance/erc20" },
      token: { type: "string", description: "ERC-20 contract for action=erc20" },
    },
  },
  async run(args, ctx): Promise<ToolResult> {
    try {
      const c = client(ctx);
      const action = String(args.action);
      if (action === "gasPrice") {
        const wei = await c.getGasPrice();
        return { ok: true, data: { gwei: Number(wei) / 1e9 } };
      }
      const address = String(args.address ?? "");
      if (!isAddress(address)) return { ok: false, error: `invalid address: ${address}` };
      if (action === "balance") {
        const wei = await c.getBalance({ address });
        return { ok: true, data: { eth: formatEther(wei) } };
      }
      if (action === "erc20") {
        const token = String(args.token ?? "");
        if (!isAddress(token)) return { ok: false, error: `invalid token address: ${token}` };
        const [symbol, decimals, raw] = await Promise.all([
          c.readContract({ address: token, abi: ERC20, functionName: "symbol" }),
          c.readContract({ address: token, abi: ERC20, functionName: "decimals" }),
          c.readContract({ address: token, abi: ERC20, functionName: "balanceOf", args: [address] }),
        ]);
        const bal = Number(raw) / 10 ** Number(decimals);
        return { ok: true, data: { token, symbol, balance: bal } };
      }
      return { ok: false, error: `unknown action: ${action}` };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "onchain_read failed" };
    }
  },
};
