import type { HappeningCategory } from "../../src/domain/types";
import { normalizeEventCandidate } from "./pipeline";
import type { EventCandidate, EventSourceDefinition } from "./types";

type BillettoOptions = {
  source: EventSourceDefinition;
  apiKey?: string;
  apiSecret?: string;
  fetchImpl?: typeof fetch;
  now?: Date;
  maxPages?: number;
};

type ParsedPage = {
  candidates: EventCandidate[];
  rejected: string[];
  hasMore: boolean;
  nextUrl?: string;
  total?: number;
};

const STOCKHOLM_BOUNDS = { minLat: 59.15, maxLat: 59.5, minLng: 17.7, maxLng: 18.35 };
const record = (value: unknown): Record<string, unknown> | undefined => typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const list = (value: unknown) => Array.isArray(value) ? value : [];
const string = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;
const number = (value: unknown) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : undefined; };
const httpsUrl = (value: unknown) => {
  const raw = string(value);
  if (!raw) return undefined;
  try { return new URL(raw).protocol === "https:" ? raw : undefined; } catch { return undefined; }
};
const countReasons = (reasons: string[]) => reasons.reduce<Record<string, number>>((counts, reason) => ({ ...counts, [reason]: (counts[reason] ?? 0) + 1 }), {});

const category = (value?: string): HappeningCategory => {
  const normalized = value?.toLowerCase() ?? "";
  if (/music|concert|festival/.test(normalized)) return "live_music";
  if (/film|cinema/.test(normalized)) return "film";
  if (/food|drink/.test(normalized)) return "food_drink";
  if (/art|culture|theatre|comedy/.test(normalized)) return "culture";
  if (/club|party|nightlife/.test(normalized)) return "club";
  return "activity";
};

export function buildBillettoRequest(source: EventSourceDefinition, apiKey?: string, apiSecret?: string, url = source.fetchUrl) {
  if (!apiKey?.trim() || !apiSecret?.trim()) throw new Error("Billetto credentials are not configured");
  const requestUrl = new URL(url);
  if (requestUrl.protocol !== "https:" || requestUrl.hostname !== "billetto.se") throw new Error("Billetto pagination URL is invalid");
  requestUrl.searchParams.set("limit", "100");
  return new Request(requestUrl, { headers: { "Api-Keypair": `${apiKey}:${apiSecret}`, "Billetto-Version": "v2021-01-01" } });
}

export function parseBillettoResponse(value: unknown, source: EventSourceDefinition): ParsedPage {
  const root = record(value);
  const candidates: EventCandidate[] = [];
  const rejected: string[] = [];
  for (const raw of list(root?.data)) {
    const event = record(raw);
    const location = record(event?.location);
    const coordinates = record(location?.coordinates);
    const price = record(event?.minimum_price);
    const categorization = record(event?.categorization ?? event?.categorisation);
    const state = string(event?.state)?.toLowerCase();
    const start = string(event?.startdate);
    const canonicalUrl = httpsUrl(event?.url);
    const lat = number(coordinates?.latitude);
    const lng = number(coordinates?.longitude);
    if (state !== "published") { rejected.push(`status:${state ?? "unknown"}`); continue; }
    if (event?.availability === false) { rejected.push("unavailable"); continue; }
    if (!location) { rejected.push("online or missing location"); continue; }
    if (!start) { rejected.push("missing start time"); continue; }
    if (!canonicalUrl) { rejected.push("invalid canonical URL"); continue; }
    if (lat === undefined || lng === undefined || lat < STOCKHOLM_BOUNDS.minLat || lat > STOCKHOLM_BOUNDS.maxLat || lng < STOCKHOLM_BOUNDS.minLng || lng > STOCKHOLM_BOUNDS.maxLng) { rejected.push("outside Stockholm or missing coordinates"); continue; }
    const currency = string(price?.currency);
    if (currency && currency !== "SEK") { rejected.push("currency does not match city"); continue; }
    // The current Swedish public API returns this legacy-named field in the
    // displayed currency unit (for example 195 for SEK 195).
    const amount = number(price?.amount_in_cents);
    const organizer = record(event?.organiser ?? event?.organizer);
    const headliners = record(event?.headliners);
    candidates.push({
      providerId: string(event?.id),
      cityId: source.cityId,
      title: string(event?.title) ?? "",
      description: string(event?.description),
      category: category([string(categorization?.category), string(categorization?.type)].filter(Boolean).join(" ")),
      venue: {
        name: string(location?.location_name) ?? "",
        address: [string(location?.address_line), string(location?.address_line_2), string(location?.postal_code), string(location?.city)].filter(Boolean).join(", "),
        neighborhood: string(location?.city),
        lat,
        lng,
      },
      start,
      end: string(event?.enddate),
      performer: string(record(list(headliners?.data)[0])?.name),
      organizer: string(organizer?.name),
      canonicalUrl,
      ticketUrl: canonicalUrl,
      priceMin: amount,
      currency: currency as "SEK" | undefined,
      availability: "available",
    });
  }
  const nextUrl = httpsUrl(root?.next_url);
  return { candidates, rejected, hasMore: root?.has_more === true, nextUrl, total: number(root?.total) };
}

export async function collectBilletto(options: BillettoOptions) {
  const attemptedAt = (options.now ?? new Date()).toISOString();
  if (!options.apiKey?.trim() || !options.apiSecret?.trim()) return { happenings: [], rejected: [], candidateCount: 0, rejectionReasons: {}, status: "unavailable" as const, attemptedAt, message: "Billetto credentials are not configured." };
  const candidates: EventCandidate[] = [];
  const rejected: string[] = [];
  let nextUrl: string | undefined = options.source.fetchUrl;
  const maxPages = Math.max(1, Math.min(10, options.maxPages ?? 7));
  for (let page = 0; page < maxPages && nextUrl; page += 1) {
    const response = await (options.fetchImpl ?? fetch)(buildBillettoRequest(options.source, options.apiKey, options.apiSecret, nextUrl));
    if (!response.ok) throw new Error(`Billetto returned HTTP ${response.status}`);
    const parsed = parseBillettoResponse(await response.json(), options.source);
    candidates.push(...parsed.candidates);
    rejected.push(...parsed.rejected);
    nextUrl = parsed.hasMore ? parsed.nextUrl : undefined;
  }
  const normalized = candidates.map((candidate) => normalizeEventCandidate(candidate, options.source, attemptedAt, options.now));
  const normalizationRejected = normalized.flatMap((item) => item.reason ? [item.reason] : []);
  const allRejected = [...rejected, ...normalizationRejected];
  return {
    happenings: normalized.flatMap((item) => item.happening ? [item.happening] : []),
    rejected: allRejected,
    candidateCount: candidates.length + rejected.length,
    rejectionReasons: countReasons(allRejected),
    status: "fresh" as const,
    attemptedAt,
  };
}
