import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AgentCard } from "./AgentCard";
import { AGENT_SUMMARY_FIXTURE } from "../test/fixtures";

describe("AgentCard", () => {
  it("renders handle, short wallet, created date, and skill chips", () => {
    render(<AgentCard agent={AGENT_SUMMARY_FIXTURE} />);

    expect(screen.getByText("scout-01")).toBeInTheDocument();
    expect(screen.getByText("0x0000…00bb")).toBeInTheDocument();
    expect(screen.getByText("2024-06-10")).toBeInTheDocument();

    const chips = screen.getAllByTestId("skill-chip");
    expect(chips.map((c) => c.textContent)).toEqual(["web-search", "arxiv"]);

    const link = screen.getByRole("link", { name: /scout-01/i });
    expect(link).toHaveAttribute("href", "/agents/scout-01");
  });
});
