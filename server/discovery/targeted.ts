import { buildEventLead } from "../../src/domain/discovery";
import type { CityId, DiscoveryLead, EventDiscoveryFields, Happening } from "../../src/domain/types";
import { getCityDefinition } from "../../src/data/cities";
import type { CoverageSearchTarget, TargetedDiscoverySnapshot } from "./types";

const XAI_RESPONSES_URL = "https://api.x.ai/v1/responses";
const CACHE_MS = 6 * 60 * 60 * 1000;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;

function extractOutputText(response: unknown): string {
  if (!isRecord(response) || !Array.isArray(response.output)) throw new Error("xAI returned an unexpected response shape.");
  for (const item of response.output) {
    if (!isRecord(item) || item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const content of item.content) if (isRecord(content) && content.type === "output_text" && typeof content.text === "string") return content.text;
  }
  throw new Error("xAI response did not contain structured output text.");
}

function responseSchema(cityId: CityId) {
  const currency = getCityDefinition(cityId).currency;
  return {
    type: "object", additionalProperties: false, required: ["results"], properties: { results: { type: "array", maxItems: 10, items: {
      type: "object", additionalProperties: false, required: ["title", "category", "venue", "timing", "commerce", "sourceUrl", "sourceType", "availability", "evidence"], properties: {
        title: { type: "string" }, description: { type: ["string", "null"] }, category: { type: "string", enum: ["live_music", "club", "comedy", "food_drink", "culture", "film", "talk", "market", "activity", "other"] },
        venue: { type: "object", additionalProperties: false, required: ["name", "address", "neighborhood", "lat", "lng"], properties: { name: { type: "string" }, address: { type: "string" }, neighborhood: { type: "string" }, lat: { type: "number" }, lng: { type: "number" } } },
        timing: { type: "object", additionalProperties: false, required: ["start", "end"], properties: { start: { type: "string" }, end: { type: ["string", "null"] } } },
        commerce: { type: "object", additionalProperties: false, required: ["priceMin", "priceMax", "currency", "bookingUrl"], properties: { priceMin: { type: ["number", "null"] }, priceMax: { type: ["number", "null"] }, currency: { type: "string", const: currency }, bookingUrl: { type: ["string", "null"] } } },
        sourceUrl: { type: "string" }, sourceType: { type: "string", enum: ["official_page", "venue_calendar", "ticket_page"] }, availability: { type: "string", enum: ["unknown", "available", "limited", "sold_out", "cancelled", "walk_in"] },
        evidence: { type: "array", minItems: 1, maxItems: 12, items: { type: "object", additionalProperties: false, required: ["field", "sourceUrl", "note"], properties: { field: { type: "string" }, sourceUrl: { type: "string" }, note: { type: "string" } } } },
      },
    } } },
  };
}

function promptFor(target: CoverageSearchTarget, now: Date): string {
  const definition = getCityDefinition(target.cell.cityId);
  return `Run one narrow event discovery search for a measured Local Buzz coverage gap.\n\nCurrent instant: ${now.toISOString()}\nCity: ${definition.name}\nTime zone: ${definition.timeZone}\nCoverage cell: ${target.id}\nSearch instruction: ${target.query}\n\nReturn at most ${target.maxResults} physical public events. Every result needs a future zoned start time, exact physical address and coordinates, a direct public official/venue/ticket URL, and field-level evidence. Do not return recommendations, permits, street closures, social posts, online-only events, undated listings, or inferred availability. Unknown price and end time must be null. Search the web before answering.`;
}

async function searchTarget(options: { apiKey: string; model?: string; target: CoverageSearchTarget; now: Date; fetchImpl?: typeof fetch }): Promise<unknown> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(XAI_RESPONSES_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: options.model ?? "grok-4.6",
      input: [{ role: "system", content: "Find only independently verifiable public events for a precise coverage gap. Follow the schema exactly." }, { role: "user", content: promptFor(options.target, options.now) }],
      tools: [{ type: "web_search" }],
      text: { format: { type: "json_schema", name: "local_buzz_coverage_discovery", strict: true, schema: responseSchema(options.target.cell.cityId) } },
      prompt_cache_key: `local-buzz-gap-${options.target.id}`.slice(0, 128),
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`xAI request failed with HTTP ${response.status}.`);
  return JSON.parse(extractOutputText(await response.json() as unknown)) as unknown;
}

export function validateTargetedResults(value: unknown, target: CoverageSearchTarget, happenings: Happening[], now = new Date()): { leads: DiscoveryLead[]; rejected: string[] } {
  if (!isRecord(value) || !Array.isArray(value.results)) return { leads: [], rejected: ["response shape is invalid"] };
  const leads: DiscoveryLead[] = [];
  const rejected: string[] = [];
  for (const [index, raw] of value.results.slice(0, target.maxResults).entries()) {
    if (!isRecord(raw) || !isRecord(raw.venue) || !isRecord(raw.timing) || !isRecord(raw.commerce) || !Array.isArray(raw.evidence)) { rejected.push(`result ${index}: shape is invalid`); continue; }
    const fields: EventDiscoveryFields = {
      title: text(raw.title), description: text(raw.description), category: text(raw.category) as EventDiscoveryFields["category"],
      venue: { name: text(raw.venue.name), address: text(raw.venue.address), neighborhood: text(raw.venue.neighborhood), lat: typeof raw.venue.lat === "number" ? raw.venue.lat : undefined, lng: typeof raw.venue.lng === "number" ? raw.venue.lng : undefined },
      timing: { start: text(raw.timing.start), end: text(raw.timing.end) },
      commerce: { priceMin: typeof raw.commerce.priceMin === "number" ? raw.commerce.priceMin : undefined, priceMax: typeof raw.commerce.priceMax === "number" ? raw.commerce.priceMax : undefined, currency: raw.commerce.currency === "SEK" || raw.commerce.currency === "USD" ? raw.commerce.currency : undefined, bookingUrl: text(raw.commerce.bookingUrl) },
      availability: text(raw.availability) as EventDiscoveryFields["availability"],
    };
    const sourceUrl = text(raw.sourceUrl);
    const sourceType = text(raw.sourceType);
    if (!sourceUrl || !sourceType || !["official_page", "venue_calendar", "ticket_page"].includes(sourceType)) { rejected.push(`result ${index}: source is invalid`); continue; }
    const evidence = raw.evidence.flatMap((item) => isRecord(item) && text(item.field) && text(item.sourceUrl) ? [{ field: text(item.field)!, sourceUrl: text(item.sourceUrl)!, note: text(item.note) }] : []);
    const result = buildEventLead({ cityId: target.cell.cityId, sourceUrl, sourceType: sourceType as "official_page" | "venue_calendar" | "ticket_page", fields, evidence, submittedBy: { kind: "targeted_collector", sourceId: "xai_web_coverage", coverageCellId: target.id } }, target.cell.cityId, happenings, now);
    if (!result.ok) rejected.push(`result ${index}: ${result.message}`);
    else if (result.lead.issues.includes("EXPIRED_EVENT") || result.lead.issues.includes("MISSING_LOCATION") || result.lead.issues.includes("INSUFFICIENT_PROVENANCE") || result.lead.issues.includes("DUPLICATE")) rejected.push(`result ${index}: ${result.lead.issues.join(",")}`);
    else leads.push(result.lead);
  }
  return { leads, rejected };
}

export async function runTargetedDiscovery(input: { apiKey?: string; model?: string; target: CoverageSearchTarget; happenings: Happening[]; previous?: TargetedDiscoverySnapshot; now?: Date; fetchImpl?: typeof fetch }): Promise<TargetedDiscoverySnapshot> {
  const now = input.now ?? new Date();
  const reusable = input.previous?.target.id === input.target.id ? input.previous : undefined;
  if (reusable && now.getTime() - Date.parse(reusable.generatedAt) < CACHE_MS) return { ...reusable, status: "cached", retained: false };
  const retained = (status: TargetedDiscoverySnapshot["status"], message: string): TargetedDiscoverySnapshot => reusable?.leads.length ? { ...reusable, retained: true, status: "retained", message } : { cityId: input.target.cell.cityId, generatedAt: now.toISOString(), retained: false, target: input.target, leads: [], status, message };
  if (!input.apiKey?.trim()) return retained("unavailable", "XAI_API_KEY is unavailable; targeted discovery did not run.");
  try {
    const raw = await searchTarget({ apiKey: input.apiKey, model: input.model, target: input.target, now, fetchImpl: input.fetchImpl });
    const validated = validateTargetedResults(raw, input.target, input.happenings, now);
    if (!validated.leads.length) return retained(validated.rejected.length ? "invalid" : "empty", validated.rejected.length ? `No publishable discovery leads; ${validated.rejected.length} result(s) rejected.` : "Search completed with no candidate results.");
    return { cityId: input.target.cell.cityId, generatedAt: now.toISOString(), retained: false, target: input.target, leads: validated.leads, status: "fresh", message: validated.rejected.length ? `${validated.rejected.length} result(s) rejected.` : undefined };
  } catch (error) {
    return retained("unavailable", error instanceof Error ? error.message : "Targeted discovery failed.");
  }
}
