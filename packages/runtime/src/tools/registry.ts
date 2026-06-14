import type { Tool } from "./types";

export interface ToolRegistry {
  get(name: string): Tool | undefined;
  has(name: string): boolean;
  names(): string[];
  all(): Tool[];
}

export function makeRegistry(tools: Tool[]): ToolRegistry {
  const map = new Map<string, Tool>();
  for (const t of tools) {
    if (map.has(t.name)) throw new Error(`duplicate tool: ${t.name}`);
    map.set(t.name, t);
  }
  return {
    get: (n) => map.get(n),
    has: (n) => map.has(n),
    names: () => [...map.keys()],
    all: () => [...map.values()],
  };
}
