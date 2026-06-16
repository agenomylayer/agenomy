import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: undefined }),
  useSignMessage: () => ({ signMessageAsync: async () => "0x" }),
}));

import { MemoryPanel } from "./MemoryPanel";

beforeEach(() => {
  global.fetch = vi.fn(async () =>
    new Response(
      JSON.stringify({
        entries: [{ id: "1", kind: "pinned", content: "watch ETH", content_hash: "h", created_at: "2026-06-16T00:00:00Z" }],
        snapshot: { cid: "bafy0000000000", hash: "h", entry_count: 1, updated_at: "t" },
      }),
      { status: 200 },
    ),
  ) as unknown as typeof fetch;
});

describe("MemoryPanel", () => {
  it("renders entries and the IPFS snapshot", async () => {
    render(<MemoryPanel handle="wizard" owner="0xowner" ipfsGateway="gateway.pinata.cloud" />);
    await waitFor(() => expect(screen.getByText("watch ETH")).toBeInTheDocument());
    expect(screen.getByText(/anchored to IPFS/i)).toBeInTheDocument();
    expect(screen.getByText(/pinned/i)).toBeInTheDocument();
  });
});
