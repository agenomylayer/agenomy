import matter from "gray-matter";

export interface AeonConvertOptions {
  /** Skill slug, normally the Aeon skill directory name (e.g. "onchain-monitor"). */
  slug: string;
  /**
   * Schedule from the skill's entry in `aeon.yml` (Aeon keeps schedules there,
   * not in SKILL.md). A cron string is carried through; Aeon's special values
   * `reactive` / `workflow_dispatch` map to on-demand (null).
   */
  schedule?: string | null;
}

/** Convert a single Aeon SKILL.md (markdown string) into an Agenomy skill.md string. */
export function aeonToAgenomySkill(aeonMd: string, opts: AeonConvertOptions): string {
  const { data, content } = matter(aeonMd);
  const slug = opts.slug;
  const name =
    typeof data.name === "string" && data.name.trim() ? data.name.trim() : slug;
  const category =
    typeof data.category === "string" && data.category.trim()
      ? data.category.trim()
      : "general";
  const description =
    typeof data.description === "string" ? data.description.trim() : "";
  const inputs = deriveInputs(content, data);
  const body = buildBody(name, content);
  const schedule = mapSchedule(opts.schedule ?? data.schedule);
  return matter.stringify("\n" + body + "\n", {
    slug,
    name,
    description,
    category,
    tools: [],
    schedule,
    inputs,
  });
}

/** Carry a cron string through; Aeon's `reactive`/`workflow_dispatch` are on-demand. */
function mapSchedule(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || s === "reactive" || s === "workflow_dispatch") return null;
  return s;
}

/**
 * Wrap the original Aeon body with an honest attribution + translation note.
 * The note credits the source and tells the agent to ignore Aeon-runtime-only
 * plumbing (file writes, ./notify) that does not exist on Agenomy.
 */
function buildBody(name: string, content: string): string {
  const note =
    `Note: this skill was adapted from the Aeon skill "${name}" ` +
    `(github.com/aaronjmars/aeon) by Agenomy's Aeon adapter. It was written for ` +
    `Aeon's GitHub Actions runtime, so ignore Aeon-only plumbing: do not write to ` +
    "`memory/` or `articles/` files and do not call `./notify`. Use your Agenomy " +
    "tools and persona, and report the result directly. Treat `${var}` as the user's " +
    "input for this run and `${today}` as the current date.";
  return `${note}\n\n---\n\n${content.trim()}`;
}

/**
 * Aeon skills take a single optional input named `var`, documented in the body
 * as a blockquote line like `> **${var}** — <description>`. Lift that line into
 * Agenomy's required `inputs` field. Falls back to a generic, non-empty note.
 */
function deriveInputs(content: string, data: Record<string, unknown>): string {
  const m = content.match(/\*\*\$\{var\}\*\*\s*[—–-]+\s*(.+)/);
  if (m) return m[1].trim();
  if ("var" in data) {
    return "Optional single input passed as `var` (see skill body for how it is used).";
  }
  return "None.";
}
