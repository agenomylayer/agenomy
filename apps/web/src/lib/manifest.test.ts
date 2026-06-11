import { describe, it, expect } from "vitest";
import { buildManifest, buildConfig } from "./manifest";
import { computeConfigHash } from "@aeonomy/shared";

const OWNER = "0x00000000000000000000000000000000000000aa" as const;

describe("buildManifest", () => {
  it("produces a version-1 manifest with sorted skills and persona", () => {
    const m = buildManifest({
      handle: "scout-01",
      owner: OWNER,
      skills: ["web-search", "arxiv"],
      persona: { displayName: "Scout", bio: "finds things", avatarSeed: "scout-01" },
      createdAt: 1718000000,
    });
    expect(m.version).toBe(1);
    expect(m.handle).toBe("scout-01");
    expect(m.owner).toBe(OWNER);
    expect(m.skills).toEqual(["arxiv", "web-search"]); // deterministic order
    expect(m.persona.displayName).toBe("Scout");
    expect(m.createdAt).toBe(1718000000);
  });
});

describe("buildConfig", () => {
  it("hashes persona+skills deterministically and excludes volatile fields", () => {
    const cfgA = buildConfig({
      handle: "scout-01",
      skills: ["web-search", "arxiv"],
      persona: { displayName: "Scout", bio: "finds things", avatarSeed: "scout-01" },
    });
    const cfgB = buildConfig({
      handle: "scout-01",
      skills: ["arxiv", "web-search"], // different input order
      persona: { displayName: "Scout", bio: "finds things", avatarSeed: "scout-01" },
    });
    expect(computeConfigHash(cfgA)).toBe(computeConfigHash(cfgB));
  });
});
