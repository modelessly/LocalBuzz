import { DEFAULT_SF_HANDLE_GROUPS, resolveSfHandles, type SfHandleGroup } from "./config/handles";
import { buildPulsePrompt } from "./prompt";
import type { CollectionMode, CollectionResult } from "./types";
import { validatePulseResponse } from "./validate";
import { searchXForPulse } from "./xai";

interface CollectorOptions {
  apiKey: string;
  model?: string;
  mode?: CollectionMode;
  groups?: SfHandleGroup[];
  now?: Date;
  enableImageUnderstanding?: boolean;
  fetchImpl?: typeof fetch;
}

export async function collectSanFranciscoPulse(options: CollectorOptions): Promise<CollectionResult> {
  if (!options.apiKey.trim()) throw new Error("XAI_API_KEY is required.");
  const now = options.now ?? new Date();
  const mode = options.mode ?? "broad";
  const handles = mode === "curated" ? resolveSfHandles(options.groups ?? DEFAULT_SF_HANDLE_GROUPS) : [];
  const prompt = buildPulsePrompt({ now, mode, handles });
  const response = await searchXForPulse({
    apiKey: options.apiKey,
    model: options.model,
    prompt,
    mode,
    handles,
    now,
    enableImageUnderstanding: options.enableImageUnderstanding,
    fetchImpl: options.fetchImpl,
  });
  return { ...validatePulseResponse(response.raw, now), latencyMs: response.latencyMs, model: response.model };
}

export function unavailablePulse(now = new Date()) {
  return { generatedAt: now.toISOString(), city: "San Francisco" as const, signals: [], status: "unavailable" as const };
}
