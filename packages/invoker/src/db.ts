export interface QueryResultLike {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

/** Anything with a node-postgres style query(). Lets the package stay app-agnostic. */
export interface Queryable {
  query(text: string, values?: unknown[]): Promise<QueryResultLike>;
}
