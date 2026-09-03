import { getCityPulseConfig, resolveTrustedHandles, type PulseHandleGroup } from "./config/cities";
import { buildPulsePrompt } from "./prompt";
import { scorePulseSignal } from "./score";
import type { CollectionMode, CollectionResult, PulseCityId, PulsePayload, PulseSignal } from "./types";
import { validatePulseResponse } from "./validate";
import { searchXForPulse } from "./xai";

type CollectorOptions = {
  cityId: PulseCityId;
  apiKey: string;
  model?: string;
  groups?: PulseHandleGroup[];
  now?: Date;
  enableImageUnderstanding?: boolean;
  fetchImpl?: typeof fetch;
};

const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9åäöé]+/gi, " ").trim();
const dedupeKey = (signal: PulseSignal) => `${normalized(signal.location.name)}|${normalized(signal.title)}`;

export function mergePulseSignals(signals: PulseSignal[], now = new Date()): PulseSignal[] {
  const merged = new Map<string, PulseSignal>();
  for (const signal of signals) {
    const key = dedupeKey(signal);
    const previous = merged.get(key);
    if (!previous) { merged.set(key, signal); continue; }
    const sourceUrls = [...new Set([...previous.social.sourceUrls, ...signal.social.sourceUrls])];
    const sourceAccounts = [...new Set([...previous.social.sourceAccounts, ...signal.social.sourceAccounts])];
    const latest = Date.parse(previous.timing.latestSeen) >= Date.parse(signal.timing.latestSeen) ? previous : signal;
    const combined = {
      ...latest,
      timing: {
        firstSeen: [previous.timing.firstSeen, signal.timing.firstSeen].filter((value): value is string => Boolean(value)).sort()[0] ?? null,
        latestSeen: latest.timing.latestSeen,
        likelyActiveUntil: [previous.timing.likelyActiveUntil, signal.timing.likelyActiveUntil].filter((value): value is string => Boolean(value)).sort().at(-1) ?? null,
      },
      social: {
        ...latest.social,
        evidenceCount: sourceUrls.length,
        independentSourceCount: Math.min(sourceAccounts.length, sourceUrls.length),
        sourceAccounts,
        sourceUrls,
        confidence: Math.max(previous.social.confidence, signal.social.confidence),
      },
      tags: [...new Set([...previous.tags, ...signal.tags])],
    };
    merged.set(key, { ...combined, ...scorePulseSignal(combined, now) });
  }
  return [...merged.values()].sort((a, b) => b.buzzScore - a.buzzScore || Date.parse(b.timing.latestSeen) - Date.parse(a.timing.latestSeen)).slice(0, 15);
}

async function collectPass(options: CollectorOptions, mode: CollectionMode) {
  const city = getCityPulseConfig(options.cityId);
  const handles = mode === "curated" ? resolveTrustedHandles(options.cityId, options.groups) : [];
  const now = options.now ?? new Date();
  const response = await searchXForPulse({
    apiKey: options.apiKey, model: options.model, city,
    prompt: buildPulsePrompt({ city, now, mode, handles }), mode, handles, now,
    enableImageUnderstanding: options.enableImageUnderstanding, fetchImpl: options.fetchImpl,
  });
  const validated = validatePulseResponse(response.raw, options.cityId, now);
  return { ...validated, latencyMs: response.latencyMs, model: response.model, mode };
}

export async function collectCityPulse(options: CollectorOptions): Promise<CollectionResult> {
  if (!options.apiKey.trim()) throw new Error("XAI_API_KEY is required.");
  const now = options.now ?? new Date();
  const [broadResult, curatedResult] = await Promise.allSettled([collectPass(options, "broad"), collectPass(options, "curated")]);
  const successful = [broadResult, curatedResult].flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  if (!successful.length) throw new Error("Both city pulse passes failed.");
  const city = getCityPulseConfig(options.cityId);
  const signals = mergePulseSignals(successful.flatMap((pass) => pass.payload.signals), now);
  return {
    payload: { generatedAt: now.toISOString(), cityId: options.cityId, city: city.name, signals, status: "fresh" },
    rejected: successful.flatMap((pass) => pass.rejected.map((reason) => `${pass.mode}: ${reason}`)),
    latencyMs: Math.max(...successful.map((pass) => pass.latencyMs)), model: successful[0].model,
    passes: ([{ mode: "broad" as const, result: broadResult }, { mode: "curated" as const, result: curatedResult }]).map(({ mode, result }) => result.status === "fulfilled"
      ? { mode, latencyMs: result.value.latencyMs, rejectedCount: result.value.rejected.length, signalCount: result.value.payload.signals.length }
      : { mode, latencyMs: 0, rejectedCount: 1, signalCount: 0 }),
  };
}

export function collectSanFranciscoPulse(options: Omit<CollectorOptions, "cityId"> & { mode?: CollectionMode }): Promise<CollectionResult> {
  if (options.mode) {
    return collectPass({ ...options, cityId: "san-francisco" }, options.mode).then((pass) => ({ ...pass, passes: [{ mode: pass.mode, latencyMs: pass.latencyMs, rejectedCount: pass.rejected.length, signalCount: pass.payload.signals.length }] }));
  }
  return collectCityPulse({ ...options, cityId: "san-francisco" });
}

export function unavailablePulse(cityId: PulseCityId = "san-francisco", now = new Date()): PulsePayload {
  const city = getCityPulseConfig(cityId);
  return { generatedAt: now.toISOString(), cityId, city: city.name, signals: [], status: "unavailable" };
}
