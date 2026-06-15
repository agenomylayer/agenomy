export interface SkillDef {
  slug: string;
  name: string;
  description: string; // one-line human summary of what the skill does
  category: string;
  tools: string[]; // declared tool names this skill may call
  schedule: string | null; // cron string (Plan 4) or null = on-demand
  inputs: string; // human description of expected input
  prompt: string; // the markdown body = the agent instructions
}
