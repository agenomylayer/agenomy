import type { Tool, ToolContext, ToolResult } from "./types";

export const marketData: Tool = {
  name: "market_data",
  description:
    "Token prices and DeFi protocol TVL via DeFiLlama (free). action=price needs a DeFiLlama coin id like 'coingecko:ethereum'; action=tvl needs a protocol slug like 'aave'.",
  parameters: {
    type: "object",
    required: ["action"],
    properties: {
      action: { type: "string", enum: ["price", "tvl"] },
      id: { type: "string", description: "coin id (price) e.g. coingecko:ethereum" },
      protocol: { type: "string", description: "protocol slug (tvl) e.g. aave" },
    },
  },
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const action = String(args.action);
      if (action === "price") {
        const id = String(args.id ?? "");
        const res = await ctx.fetch(`https://coins.llama.fi/prices/current/${encodeURIComponent(id)}`);
        if (!res.ok) return { ok: false, error: `DeFiLlama prices ${res.status}` };
        const body = (await res.json()) as { coins: Record<string, { price: number; symbol?: string }> };
        const coin = body.coins?.[id];
        if (!coin) return { ok: false, error: `no price for ${id}` };
        return { ok: true, data: { id, price: coin.price, symbol: coin.symbol } };
      }
      if (action === "tvl") {
        const slug = String(args.protocol ?? "");
        const res = await ctx.fetch(`https://api.llama.fi/tvl/${encodeURIComponent(slug)}`);
        if (!res.ok) return { ok: false, error: `DeFiLlama tvl ${res.status}` };
        const tvl = (await res.json()) as number;
        return { ok: true, data: { protocol: slug, tvlUsd: tvl } };
      }
      return { ok: false, error: `unknown action: ${action}` };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "market_data failed" };
    }
  },
};
