import { describe, it, expect } from "vitest";

describe("scaffold", () => {
  it("runs the vitest+jsdom toolchain", () => {
    const el = document.createElement("div");
    el.textContent = "aeonomy";
    expect(el.textContent).toBe("aeonomy");
  });
});
