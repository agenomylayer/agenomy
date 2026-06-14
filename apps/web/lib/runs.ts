import { getPool } from "./db";

export interface NewRun {
  agentHandle: string;
  skillSlug: string;
  input: string;
}
export interface RunFinish {
  status: "ok" | "error";
  output?: string;
  trace?: unknown[];
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  error?: string;
}

export async function createRun(r: NewRun): Promise<string> {
  const res = await getPool().query(
    `INSERT INTO runs (agent_handle, skill_slug, input) VALUES ($1,$2,$3) RETURNING id`,
    [r.agentHandle, r.skillSlug, r.input],
  );
  return String(res.rows[0].id);
}

export async function finishRun(id: string, f: RunFinish): Promise<void> {
  await getPool().query(
    `UPDATE runs SET status=$2, output=$3, trace=$4, model=$5, tokens_in=$6, tokens_out=$7, error=$8, finished_at=now() WHERE id=$1`,
    [
      id,
      f.status,
      f.output ?? null,
      JSON.stringify(f.trace ?? []),
      f.model ?? null,
      f.tokensIn ?? null,
      f.tokensOut ?? null,
      f.error ?? null,
    ],
  );
}

export async function listRuns(
  agentHandle: string,
  limit = 20,
): Promise<Array<Record<string, unknown>>> {
  const res = await getPool().query(
    `SELECT id, agent_handle, skill_slug, input, status, output, model, started_at, finished_at
     FROM runs WHERE agent_handle = $1 ORDER BY started_at DESC LIMIT $2`,
    [agentHandle, limit],
  );
  return res.rows;
}
