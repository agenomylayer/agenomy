// packages/invoker/src/cron.ts
import parser from "cron-parser";

export const PRESETS: Record<string, string> = {
  hourly: "0 * * * *",
  every_6h: "0 */6 * * *",
  daily: "0 9 * * *",
  weekly: "0 9 * * 1",
};

const PRESET_LABELS: Record<string, string> = {
  "0 * * * *": "Hourly",
  "0 */6 * * *": "Every 6 hours",
  "0 9 * * *": "Daily 09:00 UTC",
  "0 9 * * 1": "Weekly (Mon 09:00 UTC)",
};

const MIN_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export function presetToCron(preset: string): string | null {
  return PRESETS[preset] ?? null;
}

/** Next fire time strictly after `from`, evaluated in UTC. */
export function nextRun(cron: string, from: Date): Date {
  const it = parser.parseExpression(cron, { currentDate: from, tz: "UTC" });
  return it.next().toDate();
}

/** Valid cron AND fires no more often than once per hour. */
export function validateCron(cron: string): { ok: boolean; error?: string } {
  let it;
  try {
    it = parser.parseExpression(cron, { tz: "UTC" });
  } catch {
    return { ok: false, error: "invalid cron expression" };
  }
  const a = it.next().toDate().getTime();
  const b = it.next().toDate().getTime();
  if (b - a < MIN_INTERVAL_MS) {
    return { ok: false, error: "schedule must run at most once per hour" };
  }
  return { ok: true };
}

export function cadenceLabel(cron: string): string {
  return PRESET_LABELS[cron] ?? cron;
}
