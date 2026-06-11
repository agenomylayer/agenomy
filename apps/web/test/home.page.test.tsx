import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "../app/page";

describe("HomePage (landing)", () => {
  it("renders the hero headline", () => {
    render(<HomePage />);
    // The hero <h1> reads "Agents that live, earn & remember." across markup,
    // with "live" in an <em> and a <br/>. Match by role + accessible name.
    const heading = screen.getByRole("heading", {
      level: 1,
      name: /agents that\s+live\s*,\s*earn & remember\./i,
    });
    expect(heading).toBeInTheDocument();
  });

  it("renders the primary spawn CTA", () => {
    render(<HomePage />);
    expect(
      screen.getAllByText(/spawn an agent/i).length,
    ).toBeGreaterThan(0);
  });
});
