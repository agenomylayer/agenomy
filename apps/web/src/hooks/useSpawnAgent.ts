"use client";

import { useCallback } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { decodeEventLog, type Hex, type Address } from "viem";
import { agentRegistryAbi } from "@aeonomy/shared";
import { clientEnv } from "../env";
import { buildSpawnArgs } from "./spawn-args";

export interface SpawnInput {
  handle: string;
  manifestHash: Hex;
  configHash: Hex;
}

export interface SpawnedResult {
  agentId: bigint;
  wallet: Address;
}

export function useSpawnAgent() {
  const {
    writeContractAsync,
    data: txHash,
    isPending: isWriting,
    error: writeError,
    reset,
  } = useWriteContract();

  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash: txHash });

  const spawn = useCallback(
    async (input: SpawnInput): Promise<Hex> => {
      return writeContractAsync({
        address: clientEnv.registryAddress,
        abi: agentRegistryAbi,
        functionName: "spawnAgent",
        args: buildSpawnArgs(input),
      });
    },
    [writeContractAsync],
  );

  let spawned: SpawnedResult | undefined;
  if (receipt) {
    for (const log of receipt.logs) {
      try {
        const parsed = decodeEventLog({
          abi: agentRegistryAbi,
          data: log.data,
          topics: log.topics,
        });
        if (parsed.eventName === "AgentSpawned") {
          const a = parsed.args as unknown as {
            agentId: bigint;
            wallet: Address;
          };
          spawned = { agentId: a.agentId, wallet: a.wallet };
          break;
        }
      } catch {
        // not our event; skip
      }
    }
  }

  return {
    spawn,
    reset,
    txHash,
    isWriting,
    isConfirming,
    isConfirmed,
    spawned,
    error: writeError ?? receiptError ?? null,
  };
}
