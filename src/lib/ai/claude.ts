import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function claude(): Anthropic {
  if (_client) return _client;
  _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

export const MODEL_PRIMARY = "claude-sonnet-4-6";
export const MODEL_FAST = "claude-haiku-4-5-20251001";

// Extract a JSON object from a Claude response that uses tool-use (preferred)
// or a fenced ```json block as a fallback.
export function extractJson<T>(res: Anthropic.Messages.Message): T {
  for (const block of res.content) {
    if (block.type === "tool_use") return block.input as T;
    if (block.type === "text") {
      const m = block.text.match(/```json\s*([\s\S]*?)```/);
      if (m) return JSON.parse(m[1]) as T;
      const trimmed = block.text.trim();
      if (trimmed.startsWith("{")) return JSON.parse(trimmed) as T;
    }
  }
  throw new Error("No JSON content in Claude response");
}
