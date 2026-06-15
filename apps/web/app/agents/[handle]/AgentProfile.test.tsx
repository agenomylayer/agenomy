import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// The profile now mounts client panels that use wagmi + the x402 client. Stub them for this unit test.
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: undefined }),
  useSignMessage: () => ({ signMessageAsync: async () => "0x" }),
  useWalletClient: () => ({ data: undefined }),
}));
vi.mock("../../../lib/x402-client", () => ({ paidFetch: () => fetch }));

import { AgentProfile } from "./AgentProfile";
import { AGENT_DETAIL_FIXTURE } from "../../../src/test/fixtures";

describe("AgentProfile", () => {
  it("renders identity, basescan link, persona, skills, and the earnings/memory sections", () => {
    render(
      <AgentProfile agent={AGENT_DETAIL_FIXTURE} ipfsGateway="gateway.pinata.cloud" />,
    );

    expect(screen.getByText("scout-01")).toBeInTheDocument();
    expect(screen.getByText("Scout")).toBeInTheDocument();
    expect(
      screen.getByText(/finds things on the web/i),
    ).toBeInTheDocument();

    const basescan = screen.getByRole("link", { name: /view on basescan/i });
    expect(basescan).toHaveAttribute(
      "href",
      "https://sepolia.basescan.org/address/0x00000000000000000000000000000000000000bb",
    );

    const cidLink = screen.getByRole("link", { name: /manifest/i });
    expect(cidLink).toHaveAttribute(
      "href",
      "https://gateway.pinata.cloud/ipfs/QmFakeCidForTestsXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    );

    // Earnings is now a real panel (no longer a placeholder); Memory is still "coming in a later slice".
    expect(screen.getByText(/earnings/i)).toBeInTheDocument();
    expect(screen.getByText(/memory/i)).toBeInTheDocument();
    expect(screen.getAllByText(/coming in a later slice/i)).toHaveLength(1);
  });
});
