import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { ADDRESSES } from "@agenomy/shared";

const ERC20_BALANCEOF = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

interface ReaderClient {
  readContract(args: { address: `0x${string}`; abi: unknown; functionName: string; args: unknown[] }): Promise<unknown>;
}

export async function readUsdcBalanceAtomic(
  wallet: string,
  rpcUrl: string,
  client?: ReaderClient,
): Promise<bigint> {
  const c = client ?? (createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) }) as unknown as ReaderClient);
  const raw = await c.readContract({
    address: ADDRESSES.usdc,
    abi: ERC20_BALANCEOF,
    functionName: "balanceOf",
    args: [wallet],
  });
  return BigInt(raw as bigint);
}
