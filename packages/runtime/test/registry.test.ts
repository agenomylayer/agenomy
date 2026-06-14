import { describe, it, expect } from "vitest";
import { makeRegistry } from "../src/tools/registry";
import type { Tool } from "../src/tools/types";

const fake: Tool = {
  name: "fake",
  description: "x",
  parameters: { type: "object", properties: {} },
  run: async () => ({ ok: true, data: 1 }),
};

describe("registry", () => {
  it("looks up tools by name and reports missing ones", () => {
    const reg = makeRegistry([fake]);
    expect(reg.get("fake")).toBe(fake);
    expect(reg.has("nope")).toBe(false);
    expect(reg.names()).toEqual(["fake"]);
  });
  it("rejects duplicate names", () => {
    expect(() => makeRegistry([fake, fake])).toThrow(/duplicate/i);
  });
});
