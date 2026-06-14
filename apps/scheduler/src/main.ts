import { join } from "node:path";
import { Pool } from "pg";
import {
  dueSchedules,
  claimNextRun,
  markRan,
  countScheduledRunsSince,
  invokeSkillRun,
  type InvokeEnv,
} from "@agenomy/invoker";
import { runLoop } from "./scheduler";

function reqEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

async function main(): Promise<void> {
  const databaseUrl = reqEnv("DATABASE_URL");
  const env: InvokeEnv = {
    llmBaseUrl: reqEnv("LLM_BASE_URL"),
    llmApiKey: reqEnv("LLM_API_KEY"),
    llmModel: reqEnv("LLM_MODEL"),
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org",
    skillsDir: process.env.SKILLS_DIR || join(process.cwd(), "skills"),
  };
  const delayMs = Number(process.env.SCHEDULER_POLL_MS ?? "60000");
  const dailyCap = Number(process.env.SCHEDULER_DAILY_CAP ?? "500");
  const pool = new Pool({ connectionString: databaseUrl });

  console.log(`scheduler starting: poll=${delayMs}ms dailyCap=${dailyCap} skillsDir=${env.skillsDir}`);
  await runLoop(
    {
      now: () => new Date(),
      dueSchedules: (now) => dueSchedules(pool, now),
      claimNextRun: (id, next) => claimNextRun(pool, id, next),
      markRan: (id, at) => markRan(pool, id, at),
      scheduledRunsSince: (since) => countScheduledRunsSince(pool, since),
      invoke: async (s) => {
        await invokeSkillRun({
          pool,
          handle: s.agent_handle,
          skillSlug: s.skill_slug,
          input: s.input,
          source: "scheduled",
          env,
        });
      },
      dailyCap,
    },
    { delayMs },
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
