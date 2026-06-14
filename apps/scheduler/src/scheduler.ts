import { nextRun, type ScheduleRow } from "@agenomy/invoker";

export interface SchedulerDeps {
  now: () => Date;
  dueSchedules: (now: Date) => Promise<ScheduleRow[]>;
  claimNextRun: (id: string, next: Date) => Promise<void>;
  markRan: (id: string, ranAt: Date) => Promise<void>;
  invoke: (s: ScheduleRow) => Promise<void>;
  scheduledRunsSince: (since: Date) => Promise<number>;
  dailyCap: number;
}

/** One scheduler tick: run every due schedule once. Returns how many actually ran. */
export async function runOnce(deps: SchedulerDeps): Promise<number> {
  const now = deps.now();
  const due = await deps.dueSchedules(now);
  if (due.length === 0) return 0;

  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  let ran = 0;
  for (const s of due) {
    // Claim the next slot BEFORE running so a slow run can't double-fire next tick.
    await deps.claimNextRun(s.id, nextRun(s.cron, now));

    if ((await deps.scheduledRunsSince(since)) >= deps.dailyCap) {
      console.warn(`scheduler daily cap ${deps.dailyCap} reached; skipping ${s.agent_handle}/${s.skill_slug}`);
      continue;
    }

    try {
      await deps.invoke(s);
      await deps.markRan(s.id, deps.now());
      ran += 1;
    } catch (err) {
      console.error(`scheduled run failed for ${s.agent_handle}/${s.skill_slug}:`, err);
    }
  }
  return ran;
}

export interface LoopOptions {
  delayMs: number;
  signal?: { aborted: boolean };
}

export async function runLoop(deps: SchedulerDeps, opts: LoopOptions): Promise<void> {
  for (;;) {
    if (opts.signal?.aborted) return;
    try {
      const n = await runOnce(deps);
      if (n > 0) console.log(`scheduler fired ${n} runs`);
    } catch (err) {
      console.error("scheduler poll failed, will retry:", err);
    }
    await new Promise((r) => setTimeout(r, opts.delayMs));
  }
}
