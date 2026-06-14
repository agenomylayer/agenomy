import { describe, it, expect } from "vitest";
import { parseSkill } from "../src/skills/loader";

const md = `---
slug: token-info
name: Token Info
category: onchain
tools: [onchain_read]
schedule: null
inputs: A token address.
---
Do the thing with onchain_read.`;

describe("parseSkill", () => {
  it("parses frontmatter + body into a SkillDef", () => {
    const s = parseSkill(md, ["onchain_read", "market_data"]);
    expect(s.slug).toBe("token-info");
    expect(s.tools).toEqual(["onchain_read"]);
    expect(s.schedule).toBeNull();
    expect(s.prompt.trim()).toBe("Do the thing with onchain_read.");
  });
  it("throws if a declared tool does not exist", () => {
    const bad = md.replace("[onchain_read]", "[ghost_tool]");
    expect(() => parseSkill(bad, ["onchain_read"])).toThrow(/ghost_tool/);
  });
  it("throws on a missing required field", () => {
    const bad = md.replace("slug: token-info\n", "");
    expect(() => parseSkill(bad, ["onchain_read"])).toThrow(/slug/);
  });
});
