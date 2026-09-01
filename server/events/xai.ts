const XAI_RESPONSES_URL = "https://api.x.ai/v1/responses";
export const DEFAULT_EVENTS_MODEL = "grok-4.6";

interface SearchOptions {
  apiKey: string;
  model?: string;
  prompt: string;
  fetchImpl?: typeof fetch;
}

function extractOutputText(response: unknown): string {
  if (!isRecord(response) || !Array.isArray(response.output)) throw new Error("xAI returned an unexpected response shape.");
  for (const item of response.output) {
    if (!isRecord(item) || item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (typeof content === "object" && content !== null && "type" in content && content.type === "output_text" && "text" in content && typeof content.text === "string") return content.text;
    }
  }
  throw new Error("xAI response did not contain structured output text.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseJsonOutput(value: string): unknown {
  const trimmed = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(trimmed) as unknown;
}

export async function searchWebForFreshEvents(options: SearchOptions): Promise<{ raw: unknown; latencyMs: number; model: string }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const model = options.model ?? DEFAULT_EVENTS_MODEL;
  const startedAt = Date.now();
  const response = await fetchImpl(XAI_RESPONSES_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: "Collect only verifiable, current San Francisco events. Follow the output schema exactly." },
        { role: "user", content: options.prompt },
      ],
      tools: [{
        type: "web_search",
        filters: {
          allowed_domains: ["sfpl.org", "sfmoma.org", "sf.gov", "goldengatepark.com", "sftravel.com"],
        },
      }],
      prompt_cache_key: "local-buzz-sf-events",
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const latencyMs = Date.now() - startedAt;
  if (!response.ok) throw new Error(`xAI request failed with HTTP ${response.status}.`);
  const data: unknown = await response.json();
  return { raw: parseJsonOutput(extractOutputText(data)), latencyMs, model };
}
