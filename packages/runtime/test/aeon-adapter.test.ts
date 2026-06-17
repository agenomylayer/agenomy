import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { parseSkill } from "../src/skills/loader";
import { aeonToAgenomySkill } from "../src/skills/aeon-adapter";

// A REAL Aeon SKILL.md, verbatim frontmatter from github.com/aaronjmars/aeon
// (skills/onchain-monitor/SKILL.md), body excerpted. Used to prove the adapter
// converts a genuine Aeon skill into a loadable Agenomy skill. No fabricated input.
const AEON_ONCHAIN_MONITOR = `---
name: Onchain Monitor
category: crypto
description: Monitor blockchain addresses and contracts for notable activity
var: ""
tags: [crypto]
requires: [ALCHEMY_API_KEY?, COINGECKO_API_KEY?, ETHERSCAN_API_KEY?]
capabilities: [external_api, sends_notifications]
---
> **\${var}** — Watch label or chain to check. Empty = all watches.

If \${var} is set, only monitor the watch with that label or watches on that chain.

## Config

Reads \`memory/on-chain-watches.yml\`. If missing, log ON_CHAIN_NO_CONFIG and exit.`;

describe("aeonToAgenomySkill", () => {
  it("produces an Agenomy skill the loader accepts, mapping slug/name/category", () => {
    const md = aeonToAgenomySkill(AEON_ONCHAIN_MONITOR, { slug: "onchain-monitor" });
    const def = parseSkill(md, []);
    expect(def.slug).toBe("onchain-monitor");
    expect(def.name).toBe("Onchain Monitor");
    expect(def.category).toBe("crypto");
  });

  it("derives inputs from the Aeon ${var} doc line", () => {
    const md = aeonToAgenomySkill(AEON_ONCHAIN_MONITOR, { slug: "onchain-monitor" });
    const def = parseSkill(md, []);
    expect(def.inputs).toContain("Watch label or chain to check");
  });

  it("preserves the Aeon instructions and credits the source", () => {
    const md = aeonToAgenomySkill(AEON_ONCHAIN_MONITOR, { slug: "onchain-monitor" });
    const def = parseSkill(md, []);
    // original Aeon instructions carried over verbatim
    expect(def.prompt).toContain("on-chain-watches.yml");
    // source attributed (this is a converted Aeon skill, not ours)
    expect(def.prompt).toContain("aaronjmars/aeon");
  });

  it("does not leak Aeon `requires` / `capabilities` as Agenomy tools", () => {
    // loader throws on unknown tools; an empty knownTools registry must still parse
    const md = aeonToAgenomySkill(AEON_ONCHAIN_MONITOR, { slug: "onchain-monitor" });
    const def = parseSkill(md, []);
    expect(def.tools).toEqual([]);
  });

  it("maps a cron schedule (from aeon.yml) into the Agenomy schedule field", () => {
    const md = aeonToAgenomySkill(AEON_ONCHAIN_MONITOR, {
      slug: "onchain-monitor",
      schedule: "0 8 * * *",
    });
    const def = parseSkill(md, []);
    expect(def.schedule).toBe("0 8 * * *");
  });

  it("treats Aeon reactive/workflow_dispatch schedules as on-demand (null)", () => {
    const md = aeonToAgenomySkill(AEON_ONCHAIN_MONITOR, {
      slug: "onchain-monitor",
      schedule: "reactive",
    });
    const def = parseSkill(md, []);
    expect(def.schedule).toBeNull();
  });

  // Integration: the full, unmodified real Aeon skill file (210 lines) must
  // convert into a skill the Agenomy loader accepts, body intact.
  it("converts the full real onchain-monitor SKILL.md into a loadable skill", () => {
    const real = readFileSync(
      new URL("./fixtures/aeon-onchain-monitor.SKILL.md", import.meta.url),
      "utf8",
    );
    const md = aeonToAgenomySkill(real, { slug: "aeon-onchain-monitor" });
    const def = parseSkill(md, []);
    expect(def.slug).toBe("aeon-onchain-monitor");
    expect(def.name).toBe("Onchain Monitor");
    expect(def.category).toBe("crypto");
    expect(def.inputs).toContain("Watch label or chain to check");
    expect(def.prompt).toContain("aaronjmars/aeon");
    expect(def.prompt.length).toBeGreaterThan(500); // full body carried through
  });
});
