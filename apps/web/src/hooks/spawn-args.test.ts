import { describe, it, expect } from "vitest";
import { buildSpawnArgs } from "./spawn-args";

describe("buildSpawnArgs", () => {
  it("returns exactly [handle, manifestHash, configHash] in order", () => {
    const args = buildSpawnArgs({
      handle: "scout-01",
      manifestHash:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
      configHash:
        "0x2222222222222222222222222222222222222222222222222222222222222222",
    });
    expect(args).toEqual([
      "scout-01",
      "0x1111111111111111111111111111111111111111111111111111111111111111",
      "0x2222222222222222222222222222222222222222222222222222222222222222",
    ]);
    expect(args).toHaveLength(3);
  });
});
