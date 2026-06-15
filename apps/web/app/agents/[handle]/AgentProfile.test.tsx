import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// The profile mounts client panels that use wagmi + the x402 client. Stub them for this unit test.
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: undefined }),
  useSignMessage: () => ({ signMessageAsync: async () => "0x" }),
  useWalletClient: () => ({ data: undefined }),
}));
vi.mock("../../../lib/x402-client", () => ({ paidFetch: () => fetch }));

import { AgentProfile } from "./AgentProfile";
import { AGENT_DETAIL_FIXTURE } from "../../../src/test/fixtures";

describe("AgentProfile", () => {
  it("renders identity, basescan link, manifest, persona, and the earnings/memory sections", () => {
    render(
      <AgentProfile agent={AGENT_DETAIL_FIXTURE} ipfsGateway="gateway.pinata.cloud" />,
    );

    // handle + display name appear (rail, breadcrumb, hero)
    expect(screen.getAllByText("scout-01").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Scout").length).toBeGreaterThan(0);

    // persona bio
    expect(screen.getByText(/finds things on the web/i)).toBeInTheDocument();

    // wallet links out to basescan
    const basescan = screen.getByRole("link", { name: /basescan/i });
    expect(basescan).toHaveAttribute(
      "href",
      "https://sepolia.basescan.org/address/0x00000000000000000000000000000000000000bb",
    );

    // manifest links to the IPFS gateway
    const cidLink = screen.getByRole("link", { name: /ipfs/i });
    expect(cidLink).toHaveAttribute(
      "href",
      "https://gateway.pinata.cloud/ipfs/QmFakeCidForTestsXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    );

    // earnings + memory sections present; memory still a placeholder
    expect(screen.getAllByText(/earnings/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/memory/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/coming in a later slice/i)).toHaveLength(1);
  });
});
