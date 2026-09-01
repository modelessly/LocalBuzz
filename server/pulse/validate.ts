import { PULSE_CATEGORIES, type PulseCategory, type PulseSignal, type ValidationResult } from "./types";

const MAX_AGE_MS = 3 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const OUTSIDE_CITY_PATTERN = /\b(oakland|berkeley|san jose|palo alto|san mateo|marin|sacramento)\b/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isoOrNull(value: unknown): value is string | null {
  return value === null || (nonEmpty(value) && Number.isFinite(Date.parse(value)));
}

function safeXUrl(value: unknown): value is string {
  if (!nonEmpty(value)) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (url.hostname === "x.com" || url.hostname === "www.x.com" || url.hostname === "twitter.com" || url.hostname === "www.twitter.com") &&
      /\/status\/\d+/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function stableId(signal: Omit<PulseSignal, "id">): string {
  const source = `${signal.title}|${signal.location.name}|${signal.timing.latestSeen}`.toLowerCase();
  let hash = 2166136261;
  for (const character of source) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `sf-pulse-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function normalizeSignal(value: unknown, now: Date): { signal?: PulseSignal; reason?: string } {
  if (!isRecord(value)) return { reason: "signal is not an object" };
  const location = value.location;
  const timing = value.timing;
  const social = value.social;
  if (!isRecord(location) || !isRecord(timing) || !isRecord(social)) return { reason: "nested fields are invalid" };
  if (!nonEmpty(value.title) || !nonEmpty(value.summary) || !nonEmpty(value.reasonActionable)) return { reason: "required text is missing" };
  if (value.kind !== "live_signal") return { reason: "kind is invalid" };
  if (!PULSE_CATEGORIES.includes(value.category as PulseCategory)) return { reason: "category is invalid" };
  if (!nonEmpty(location.name) || !nonEmpty(location.neighborhood) || location.address !== null) return { reason: "location is invalid" };
  if (!isoOrNull(timing.firstSeen) || !nonEmpty(timing.latestSeen) || !Number.isFinite(Date.parse(timing.latestSeen)) || !isoOrNull(timing.likelyActiveUntil)) {
    return { reason: "timing is invalid" };
  }

  const latestSeenMs = Date.parse(timing.latestSeen);
  if (now.getTime() - latestSeenMs > MAX_AGE_MS) return { reason: "latest evidence is stale" };
  if (latestSeenMs - now.getTime() > MAX_FUTURE_SKEW_MS) return { reason: "latest evidence is in the future" };

  const cityText = `${value.title} ${value.summary} ${location.name} ${location.neighborhood}`;
  if (OUTSIDE_CITY_PATTERN.test(cityText) && !/\bsan francisco\b/i.test(cityText)) return { reason: "signal appears to be outside San Francisco" };

  const evidenceCount = social.evidenceCount;
  const independentSourceCount = social.independentSourceCount;
  const confidence = social.confidence;
  if (typeof evidenceCount !== "number" || typeof independentSourceCount !== "number" || !Number.isInteger(evidenceCount) || !Number.isInteger(independentSourceCount) || typeof confidence !== "number") return { reason: "social counts are invalid" };
  if (evidenceCount < 1 || independentSourceCount < 1 || independentSourceCount > evidenceCount) return { reason: "social counts are inconsistent" };
  if (confidence < 0.55 || confidence > 1) return { reason: "confidence is outside the accepted range" };
  if (social.source !== "x" || !Array.isArray(social.sourceUrls) || social.sourceUrls.length < 1 || !social.sourceUrls.every(safeXUrl)) {
    return { reason: "source URLs are missing or suspicious" };
  }
  if (!Array.isArray(value.tags) || !value.tags.every(nonEmpty)) return { reason: "tags are invalid" };
  const tags = value.tags.map((tag) => tag.trim().toLowerCase());
  if (independentSourceCount < 2 && !tags.includes("official-source")) return { reason: "spontaneous activity lacks independent confirmation" };

  const withoutId: Omit<PulseSignal, "id"> = {
    kind: "live_signal",
    title: value.title.trim(),
    summary: value.summary.trim(),
    category: value.category as PulseCategory,
    location: { name: location.name.trim(), neighborhood: location.neighborhood.trim(), address: null },
    timing: {
      firstSeen: timing.firstSeen,
      latestSeen: new Date(latestSeenMs).toISOString(),
      likelyActiveUntil: timing.likelyActiveUntil,
    },
    social: {
      evidenceCount,
      independentSourceCount,
      confidence,
      source: "x",
      sourceUrls: [...new Set(social.sourceUrls)],
    },
    tags: [...new Set(tags)],
    reasonActionable: value.reasonActionable.trim(),
  };
  return { signal: { id: stableId(withoutId), ...withoutId } };
}

export function validatePulseResponse(value: unknown, now = new Date()): ValidationResult {
  const rejected: string[] = [];
  if (!isRecord(value) || !Array.isArray(value.signals)) {
    return { payload: { generatedAt: now.toISOString(), city: "San Francisco", signals: [] }, rejected: ["response shape is invalid"] };
  }

  const signals: PulseSignal[] = [];
  for (const [index, candidate] of value.signals.slice(0, 15).entries()) {
    const result = normalizeSignal(candidate, now);
    if (result.signal) signals.push(result.signal);
    else rejected.push(`signal ${index}: ${result.reason ?? "invalid"}`);
  }
  if (value.signals.length > 15) rejected.push(`${value.signals.length - 15} signals exceeded the maximum`);

  return { payload: { generatedAt: now.toISOString(), city: "San Francisco", signals }, rejected };
}
