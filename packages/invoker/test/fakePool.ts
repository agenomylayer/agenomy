import type { Queryable, QueryResultLike } from "../src/db";

export interface FakeCall {
  text: string;
  values?: unknown[];
}
export type Responder = (text: string, values?: unknown[]) => QueryResultLike | undefined;

/** A pool whose query() routes to `respond` and records every call. */
export function fakePool(respond: Responder): Queryable & { calls: FakeCall[] } {
  const calls: FakeCall[] = [];
  return {
    calls,
    async query(text: string, values?: unknown[]): Promise<QueryResultLike> {
      calls.push({ text, values });
      return respond(text, values) ?? { rowCount: 0, rows: [] };
    },
  };
}
