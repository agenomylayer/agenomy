import matter from "gray-matter";
import type { SkillDef } from "./types";

/** Parse one skill.md string into a validated SkillDef. `knownTools` = registry names. */
export function parseSkill(md: string, knownTools: string[]): SkillDef {
  const { data, content } = matter(md);
  const need = ["slug", "name", "category", "inputs"] as const;
  for (const k of need) {
    if (typeof data[k] !== "string" || data[k].length === 0) {
      throw new Error(`skill frontmatter missing required field: ${k}`);
    }
  }
  const tools = Array.isArray(data.tools) ? data.tools.map(String) : [];
  for (const t of tools) {
    if (!knownTools.includes(t)) throw new Error(`skill "${data.slug}" declares unknown tool: ${t}`);
  }
  const schedule =
    data.schedule === null || data.schedule === undefined || data.schedule === "null"
      ? null
      : String(data.schedule);
  const prompt = content.trim();
  if (!prompt) throw new Error(`skill "${data.slug}" has an empty prompt body`);
  const description =
    typeof data.description === "string" ? data.description.trim() : "";
  return {
    slug: String(data.slug),
    name: String(data.name),
    description,
    category: String(data.category),
    tools,
    schedule,
    inputs: String(data.inputs),
    prompt,
  };
}
