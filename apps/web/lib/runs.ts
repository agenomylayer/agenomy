import { getPool } from "./db";
import { listRuns as invokerListRuns } from "@agenomy/invoker";

export function listRuns(agentHandle: string, limit = 20): Promise<Array<Record<string, unknown>>> {
  return invokerListRuns(getPool(), agentHandle, limit);
}
