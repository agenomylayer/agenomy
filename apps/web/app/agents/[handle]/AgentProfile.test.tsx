import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AgentProfile } from "./AgentProfile";
import { AGENT_DETAIL_FIXTURE } from "../../../src/test/fixtures";

describe("AgentProfile", () => {
  it("renders identity, basescan link, persona, skills, and placeholders", () => {
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

    expect(screen.getByText(/memory/i)).toBeInTheDocument();
    expect(screen.getByText(/earnings/i)).toBeInTheDocument();
    expect(screen.getByText(/coming in a later slice/i)).toBeInTheDocument();
  });
});
