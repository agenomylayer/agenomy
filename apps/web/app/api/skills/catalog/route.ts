import { NextResponse } from "next/server";
import { join } from "node:path";
import { makeRegistry, onchainRead, marketData, loadSkillsFromDir } from "@agenomy/runtime";

export const dynamic = "force-dynamic";

const SKILLS_DIR = process.env.SKILLS_DIR || join(process.cwd(), "../../skills");
const registry = makeRegistry([onchainRead, marketData]);

export async function GET(): Promise<Response> {
  const skills = loadSkillsFromDir(SKILLS_DIR, registry.names()).map((s) => ({
    slug: s.slug,
    name: s.name,
    category: s.category,
    inputs: s.inputs,
    tools: s.tools,
  }));
  return NextResponse.json({ skills });
}
