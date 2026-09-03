import { getCityPulseConfig, type CityPulseConfig } from "./config/cities";
import { scorePulseSignal } from "./score";
import { PULSE_CATEGORIES, PULSE_KINDS, type PulseCategory, type PulseCityId, type PulseKind, type PulseSignal, type ValidationResult } from "./types";

const MAX_AGE_MS = 3 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const CITY_EXCLUSIONS: Record<PulseCityId, RegExp> = {
  stockholm: /\b(gothenburg|göteborg|malmö|uppsala|västerås)\b/i,
  "san-francisco": /\b(oakland|berkeley|san jose|palo alto|san mateo|marin|sacramento)\b/i,
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const isoOrNull = (value: unknown): value is string | null => value === null || (nonEmpty(value) && Number.isFinite(Date.parse(value)));

function safeXUrl(value: unknown): value is string {
  if (!nonEmpty(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      && ["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(url.hostname)
      && /\/status\/\d+/.test(url.pathname);
  } catch { return false; }
}

function accountFromUrl(value: string): string | undefined {
  try {
    const account = new URL(value).pathname.split("/").filter(Boolean)[0];
    return account && account.toLowerCase() !== "i" ? account.toLowerCase() : undefined;
  } catch { return undefined; }
}

function stableId(cityId: PulseCityId, signal: Omit<PulseSignal, "id">): string {
  const source = `${cityId}|${signal.title}|${signal.location.name}`.toLowerCase();
  let hash = 2166136261;
  for (const character of source) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return `${cityId}-pulse-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function normalizeSignal(value: unknown, city: CityPulseConfig, now: Date): { signal?: PulseSignal; reason?: string } {
  if (!isRecord(value)) return { reason: "signal is not an object" };
  const location = value.location; const timing = value.timing; const social = value.social;
  if (!isRecord(location) || !isRecord(timing) || !isRecord(social)) return { reason: "nested fields are invalid" };
  if (!nonEmpty(value.title) || !nonEmpty(value.summary) || !nonEmpty(value.reasonActionable)) return { reason: "required text is missing" };
  if (!PULSE_KINDS.includes(value.kind as PulseKind)) return { reason: "kind is invalid" };
  if (!PULSE_CATEGORIES.includes(value.category as PulseCategory)) return { reason: "category is invalid" };
  if (!nonEmpty(location.name) || !nonEmpty(location.neighborhood) || location.address !== null) return { reason: "location is invalid" };
  if (!isoOrNull(timing.firstSeen) || !nonEmpty(timing.latestSeen) || !Number.isFinite(Date.parse(timing.latestSeen)) || !isoOrNull(timing.likelyActiveUntil)) return { reason: "timing is invalid" };

  const latestSeenMs = Date.parse(timing.latestSeen);
  const likelyActiveUntilMs = timing.likelyActiveUntil ? Date.parse(timing.likelyActiveUntil) : Number.NaN;
  const evidenceAge = now.getTime() - latestSeenMs;
  if (latestSeenMs - now.getTime() > MAX_FUTURE_SKEW_MS) return { reason: "latest evidence is in the future" };
  const evidenceCount = social.evidenceCount; const independentSourceCount = social.independentSourceCount; const confidence = social.confidence;
  if (![evidenceCount, independentSourceCount].every((item) => typeof item === "number" && Number.isInteger(item)) || typeof confidence !== "number") return { reason: "social counts are invalid" };
  if ((evidenceCount as number) < 1 || (independentSourceCount as number) < 1 || (independentSourceCount as number) > (evidenceCount as number)) return { reason: "social counts are inconsistent" };
  if (confidence < 0.55 || confidence > 1) return { reason: "confidence is outside the accepted range" };
  if (social.source !== "x" || !Array.isArray(social.sourceUrls) || social.sourceUrls.length < 1 || !social.sourceUrls.every(safeXUrl)) return { reason: "source URLs are missing or suspicious" };
  if (!Array.isArray(social.sourceAccounts) || !social.sourceAccounts.every(nonEmpty)) return { reason: "source accounts are invalid" };
  if (!Array.isArray(value.tags) || !value.tags.every(nonEmpty)) return { reason: "tags are invalid" };
  const tags = value.tags.map((tag) => tag.trim().toLowerCase());
  if ((independentSourceCount as number) < 2 && !tags.includes("official-source")) return { reason: "spontaneous activity lacks independent confirmation" };
  const clearlyCorroboratedActive = Number.isFinite(likelyActiveUntilMs) && likelyActiveUntilMs > now.getTime() && (independentSourceCount as number) >= 2 && confidence >= 0.75;
  if (evidenceAge > MAX_AGE_MS && !clearlyCorroboratedActive) return { reason: "latest evidence is stale" };
  const cityText = `${value.title} ${value.summary} ${location.name} ${location.neighborhood}`;
  if (CITY_EXCLUSIONS[city.id].test(cityText) && !cityText.toLowerCase().includes(city.name.toLowerCase())) return { reason: `signal appears to be outside ${city.name}` };

  const urls = [...new Set((social.sourceUrls as string[]).map((url) => url.trim()))];
  const accounts = [...new Set([...(social.sourceAccounts as string[]).map((account) => account.replace(/^@/, "").trim().toLowerCase()), ...urls.map(accountFromUrl).filter((account): account is string => Boolean(account))])];
  const base = {
    kind: value.kind as PulseKind, title: value.title.trim(), summary: value.summary.trim(), category: value.category as PulseCategory,
    location: { name: location.name.trim(), neighborhood: location.neighborhood.trim(), address: null },
    timing: { firstSeen: timing.firstSeen ? new Date(Date.parse(timing.firstSeen)).toISOString() : null, latestSeen: new Date(latestSeenMs).toISOString(), likelyActiveUntil: timing.likelyActiveUntil ? new Date(likelyActiveUntilMs).toISOString() : null },
    social: { evidenceCount: urls.length, independentSourceCount: Math.min(accounts.length, urls.length), sourceAccounts: accounts, confidence, source: "x" as const, sourceUrls: urls },
    tags: [...new Set(tags)], reasonActionable: value.reasonActionable.trim(),
  };
  if (base.social.independentSourceCount < 1) return { reason: "source accounts cannot be resolved" };
  const withoutId: Omit<PulseSignal, "id"> = { ...base, ...scorePulseSignal(base, now) };
  return { signal: { id: stableId(city.id, withoutId), ...withoutId } };
}

export function validatePulseResponse(value: unknown, cityIdOrNow: PulseCityId | Date = "san-francisco", requestedNow = new Date()): ValidationResult {
  const cityId = cityIdOrNow instanceof Date ? "san-francisco" : cityIdOrNow;
  const now = cityIdOrNow instanceof Date ? cityIdOrNow : requestedNow;
  const city = getCityPulseConfig(cityId); const rejected: string[] = [];
  if (!isRecord(value) || !Array.isArray(value.signals) || (value.city !== undefined && value.city !== city.name)) return { payload: { generatedAt: now.toISOString(), cityId, city: city.name, signals: [] }, rejected: ["response shape or city is invalid"] };
  const signals: PulseSignal[] = [];
  for (const [index, candidate] of value.signals.slice(0, 10).entries()) { const result = normalizeSignal(candidate, city, now); if (result.signal) signals.push(result.signal); else rejected.push(`signal ${index}: ${result.reason ?? "invalid"}`); }
  if (value.signals.length > 10) rejected.push(`${value.signals.length - 10} signals exceeded the maximum`);
  return { payload: { generatedAt: now.toISOString(), cityId, city: city.name, signals, status: "fresh" }, rejected };
}
