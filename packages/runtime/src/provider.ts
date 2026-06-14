import type { Tool } from "./tools/types";

export interface ProviderConfig {
  baseUrl: string; // OpenAI-compatible base, e.g. https://.../v1
  apiKey: string;
  model: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: unknown[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ChatResult {
  content: string | null;
  toolCalls: ToolCall[];
  tokensIn: number;
  tokensOut: number;
}

function safeParse(s: unknown): Record<string, unknown> {
  try {
    return typeof s === "string" ? JSON.parse(s) : ((s as Record<string, unknown>) ?? {});
  } catch {
    return {};
  }
}

/** One chat-completions call against any OpenAI-compatible endpoint (MiMo, OpenAI, etc.). */
export async function chat(
  messages: ChatMessage[],
  tools: Tool[],
  cfg: ProviderConfig,
  fetchFn: typeof fetch = fetch,
): Promise<ChatResult> {
  const body: Record<string, unknown> = { model: cfg.model, messages };
  if (tools.length) {
    body.tools = tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
    body.tool_choice = "auto";
  }
  const res = await fetchFn(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM ${res.status}: ${text.slice(0, 300)}`);
  }
  const data: any = await res.json();
  const msg = data.choices?.[0]?.message ?? {};
  const toolCalls: ToolCall[] = (msg.tool_calls ?? []).map((tc: any) => ({
    id: tc.id,
    name: tc.function?.name,
    args: safeParse(tc.function?.arguments),
  }));
  return {
    content: msg.content ?? null,
    toolCalls,
    tokensIn: data.usage?.prompt_tokens ?? 0,
    tokensOut: data.usage?.completion_tokens ?? 0,
  };
}
