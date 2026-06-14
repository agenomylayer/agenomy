import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadSkillsFromDir } from "../src/skills/catalog";

const here = dirname(fileURLToPath(import.meta.url));
const skillsDir = join(here, "../../../skills");

describe("loadSkillsFromDir", () => {
  it("loads the real skill files and validates their tools", () => {
    const skills = loadSkillsFromDir(skillsDir, ["onchain_read", "market_data"]);
    const slugs = skills.map((s) => s.slug);
    expect(slugs).toContain("base-gas-check");
    expect(skills.length).toBeGreaterThanOrEqual(10);
    expect(skills.every((s) => s.prompt.length > 0)).toBe(true);
  });
});
