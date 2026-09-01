import { buildFreshEventsPrompt } from "./prompt";
import type { FreshEventsCollectionResult } from "./types";
import { validateFreshEventsResponse } from "./validate";
import { searchWebForFreshEvents } from "./xai";

interface CollectorOptions {
  apiKey: string;
  model?: string;
  now?: Date;
  fetchImpl?: typeof fetch;
}

export async function collectSanFranciscoEvents(options: CollectorOptions): Promise<FreshEventsCollectionResult> {
  if (!options.apiKey.trim()) throw new Error("XAI_API_KEY is required.");
  const now = options.now ?? new Date();
  const response = await searchWebForFreshEvents({
    apiKey: options.apiKey,
    model: options.model,
    prompt: buildFreshEventsPrompt(now),
    fetchImpl: options.fetchImpl,
  });
  return { ...validateFreshEventsResponse(response.raw, now), latencyMs: response.latencyMs, model: response.model };
}

export function unavailableFreshEvents(now = new Date()) {
  return { generatedAt: now.toISOString(), city: "San Francisco" as const, events: [], status: "unavailable" as const };
}
