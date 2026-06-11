import type { Hex } from "viem";

export interface SpawnArgsInput {
  handle: string;
  manifestHash: Hex;
  configHash: Hex;
}

/** Tuple matching AgentRegistry.spawnAgent(string,bytes32,bytes32). */
export function buildSpawnArgs(
  input: SpawnArgsInput,
): readonly [string, Hex, Hex] {
  return [input.handle, input.manifestHash, input.configHash] as const;
}
