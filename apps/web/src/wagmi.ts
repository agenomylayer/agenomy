import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { baseSepolia } from "viem/chains";
import { http } from "wagmi";
import { clientEnv } from "./env";

export const wagmiConfig = getDefaultConfig({
  appName: "Aeonomy",
  projectId: clientEnv.walletConnectId,
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(),
  },
  ssr: true,
});
