import { SF_PULSE_RESPONSE_SCHEMA } from "./schema";
import type { CollectionMode } from "./types";

export const DEFAULT_XAI_MODEL = "grok-4.6";
const XAI_RESPONSES_URL = "https://api.x.ai/v1/responses";

interface XaiSearchOptions {
  apiKey: string;
  model?: string;
  prompt: string;
  mode: CollectionMode;
  handles: string[];
  now: Date;
  enableImageUnderstanding?: boolean;
  fetchImpl?: typeof fetch;
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function extractOutputText(response: unknown): string {
  if (typeof response !== "object" || response === null || !("output" in response) || !Array.isArray(response.output)) {
    throw new Error("xAI returned an unexpected response shape.");
  }
  for (const item of response.output) {
    if (typeof item !== "object" || item === null || !("type" in item) || item.type !== "message" || !("content" in item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (typeof content === "object" && content !== null && "type" in content && content.type === "output_text" && "text" in content && typeof content.text === "string") {
        return content.text;
      }
    }
  }
  throw new Error("xAI response did not contain structured output text.");
}

export async function searchXForPulse(options: XaiSearchOptions): Promise<{ raw: unknown; latencyMs: number; model: string }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const model = options.model ?? DEFAULT_XAI_MODEL;
  const yesterday = new Date(options.now.getTime() - 24 * 60 * 60 * 1000);
  const tool: Record<string, unknown> = {
    type: "x_search",
    from_date: dateOnly(yesterday),
    to_date: dateOnly(options.now),
    enable_image_understanding: options.enableImageUnderstanding ?? false,
  };
  if (options.mode === "curated") tool.allowed_x_handles = options.handles;

  const startedAt = Date.now();
  const response = await fetchImpl(XAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: "Collect only well-supported, current public activity. Follow the output schema exactly." },
        { role: "user", content: options.prompt },
      ],
      tools: [tool],
      text: {
        format: {
          type: "json_schema",
          name: "local_buzz_sf_pulse",
          schema: SF_PULSE_RESPONSE_SCHEMA,
          strict: true,
        },
      },
      prompt_cache_key: `local-buzz-sf-pulse-${options.mode}`,
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const latencyMs = Date.now() - startedAt;
  if (!response.ok) {
    throw new Error(`xAI request failed with HTTP ${response.status}.`);
  }

  const data: unknown = await response.json();
  return { raw: JSON.parse(extractOutputText(data)) as unknown, latencyMs, model };
}
