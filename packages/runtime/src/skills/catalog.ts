import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseSkill } from "./loader";
import type { SkillDef } from "./types";

/** Load every `<dir>/<slug>/skill.md` into a validated SkillDef list (server-side). */
export function loadSkillsFromDir(dir: string, knownTools: string[]): SkillDef[] {
  if (!existsSync(dir)) return [];
  const out: SkillDef[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = join(dir, entry.name, "skill.md");
    if (!existsSync(file)) continue;
    out.push(parseSkill(readFileSync(file, "utf8"), knownTools));
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
