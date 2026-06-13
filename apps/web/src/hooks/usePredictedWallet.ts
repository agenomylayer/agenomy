"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import type { Address } from "viem";
import { predictWallet } from "@agenomy/shared";

export function usePredictedWallet(
  owner: Address | undefined,
  handle: string,
) {
  const publicClient = usePublicClient();
  const enabled = Boolean(owner && publicClient && handle.length >= 3);

  return useQuery({
    queryKey: ["predicted-wallet", owner, handle],
    enabled,
    queryFn: async (): Promise<Address> => {
      if (!owner || !publicClient) throw new Error("not ready");
      return predictWallet(publicClient, owner, handle);
    },
    staleTime: 60_000,
  });
}
