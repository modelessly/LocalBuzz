import { collectCityPulse, unavailablePulse } from "../server/pulse/collector";
import { collectSanFranciscoEvents } from "../server/events/collector";
import { verifiedSanFranciscoFallback, withVerifiedFallback } from "../server/events/fallback";
import { isPulseHandleGroup, type PulseHandleGroup } from "../server/pulse/config/cities";
import { refreshCityEvents } from "../server/ingestion/refresh";
import type { CityEventSnapshot } from "../server/ingestion/types";
import { getCityDefinition } from "../src/data/cities";
import type { CityId } from "../src/domain/types";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  XAI_API_KEY?: string;
  XAI_MODEL?: string;
  TICKETMASTER_API_KEY?: string;
  BILLETTO_API_KEY?: string;
  BILLETTO_API_SECRET?: string;
}

function fixtureSnapshot(cityId: CityId, now = new Date()): CityEventSnapshot {
  return {
    cityId,
    generatedAt: now.toISOString(),
    retained: false,
    happenings: getCityDefinition(cityId).happenings.filter((item) => Date.parse(item.timing.end ?? item.timing.start) > now.getTime()),
    sources: [],
  };
}

async function ingestionResponse(request: Request, env: Env, context: WorkerContext, cityId: CityId): Promise<Response> {
  const url = new URL(request.url);
  const edgeCache = (caches as CacheStorage & { default: Cache }).default;
  const responseKey = new Request(`${url.origin}${url.pathname}`, { method: "GET" });
  const cached = await edgeCache.match(responseKey);
  if (cached) return new Response(cached.body, cached);
  const lastGoodKey = new Request(`${url.origin}/api/internal/last-good/${cityId}`, { method: "GET" });
  const lastGoodResponse = await edgeCache.match(lastGoodKey);
  let previous = fixtureSnapshot(cityId);
  if (lastGoodResponse) {
    try { previous = await lastGoodResponse.json() as CityEventSnapshot; } catch { /* use validated checked-in fixture */ }
  }
  const snapshot = await refreshCityEvents({ cityId, ticketmasterApiKey: env.TICKETMASTER_API_KEY, billettoApiKey: env.BILLETTO_API_KEY, billettoApiSecret: env.BILLETTO_API_SECRET, xaiApiKey: env.XAI_API_KEY, xaiModel: env.XAI_MODEL, previous });
  const response = json(snapshot, { headers: { "Cache-Control": "public, max-age=900", "X-Ingestion-Snapshot": snapshot.retained ? "RETAINED" : "FRESH" } });
  context.waitUntil(edgeCache.put(responseKey, response.clone()));
  if (!snapshot.retained && snapshot.happenings.length) {
    const durable = json(snapshot, { headers: { "Cache-Control": "public, max-age=2592000" } });
    context.waitUntil(edgeCache.put(lastGoodKey, durable));
  }
  return response;
}

interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}

const CACHE_SECONDS = 12 * 60;

function json(payload: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(payload), { ...init, headers });
}

function parsePulseGroups(url: URL): PulseHandleGroup[] | undefined {
  const rawGroups = url.searchParams.get("groups");
  if (!rawGroups) return undefined;
  const groups = [...new Set(rawGroups.split(",").map((group) => group.trim()).filter(Boolean))];
  if (groups.length === 0 || !groups.every(isPulseHandleGroup)) throw new Error("groups contains an unknown trusted handle group");
  return groups;
}

async function pulseResponse(request: Request, env: Env, context: WorkerContext, cityId: CityId): Promise<Response> {
  const url = new URL(request.url);
  let groups: PulseHandleGroup[] | undefined;
  try {
    groups = parsePulseGroups(url);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "invalid request" }, { status: 400 });
  }

  const cacheUrl = new URL(url.origin + url.pathname);
  if (groups) cacheUrl.searchParams.set("groups", [...groups].sort().join(","));
  const cacheKey = new Request(cacheUrl, { method: "GET" });
  const edgeCache = (caches as CacheStorage & { default: Cache }).default;
  const cached = await edgeCache.match(cacheKey);
  if (cached) {
    const response = new Response(cached.body, cached);
    response.headers.set("X-Pulse-Cache", "HIT");
    return response;
  }

  if (!env.XAI_API_KEY) {
    console.error(JSON.stringify({ event: "city_pulse_failure", cityId, reason: "missing_api_key" }));
    return json(unavailablePulse(cityId), { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const lastGoodKey = new Request(`${url.origin}/api/internal/last-good-pulse/${cityId}`, { method: "GET" });
  try {
    const result = await collectCityPulse({ cityId, apiKey: env.XAI_API_KEY, model: env.XAI_MODEL, groups });
    console.log(JSON.stringify({
      event: "city_pulse_collection", cityId,
      model: result.model,
      latencyMs: result.latencyMs,
      signalCount: result.payload.signals.length,
      validationFailureCount: result.rejected.length,
    }));
    const response = json(result.payload, {
      headers: {
        "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
        "X-Pulse-Cache": "MISS",
      },
    });
    context.waitUntil(edgeCache.put(cacheKey, response.clone()));
    context.waitUntil(edgeCache.put(lastGoodKey, json(result.payload, { headers: { "Cache-Control": "public, max-age=2592000" } })));
    return response;
  } catch (error) {
    console.error(JSON.stringify({
      event: "city_pulse_failure", cityId,
      message: error instanceof Error ? error.message : "unknown failure",
    }));
    const retained = await edgeCache.match(lastGoodKey);
    if (retained) {
      const payload = await retained.json() as Record<string, unknown>;
      return json({ ...payload, status: "retained", retainedAt: payload.generatedAt }, { headers: { "Cache-Control": `public, max-age=${CACHE_SECONDS}` } });
    }
    return json(unavailablePulse(cityId), { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

async function eventsResponse(request: Request, env: Env, context: WorkerContext): Promise<Response> {
  const url = new URL(request.url);
  const cacheKey = new Request(url.origin + url.pathname, { method: "GET" });
  const edgeCache = (caches as CacheStorage & { default: Cache }).default;
  const cached = await edgeCache.match(cacheKey);
  if (cached) {
    const response = new Response(cached.body, cached);
    response.headers.set("X-Events-Cache", "HIT");
    return response;
  }
  if (!env.XAI_API_KEY) return json({ ...verifiedSanFranciscoFallback(), status: "unavailable", error: "XAI_API_KEY is not configured." }, { headers: { "Cache-Control": `public, max-age=${CACHE_SECONDS}` } });
  try {
    const result = await collectSanFranciscoEvents({ apiKey: env.XAI_API_KEY, model: env.XAI_MODEL });
    const payload = withVerifiedFallback(result.payload);
    console.log(JSON.stringify({
      event: "sf_events_collection",
      model: result.model,
      latencyMs: result.latencyMs,
      eventCount: payload.events.length,
      validationFailureCount: result.rejected.length,
    }));
    const response = json(payload, {
      headers: { "Cache-Control": `public, max-age=${CACHE_SECONDS}`, "X-Events-Cache": "MISS" },
    });
    context.waitUntil(edgeCache.put(cacheKey, response.clone()));
    return response;
  } catch (error) {
    console.error(JSON.stringify({ event: "sf_events_failure", message: error instanceof Error ? error.message : "unknown failure" }));
    return json({ ...verifiedSanFranciscoFallback(), status: "unavailable", error: "Scheduled-event collection failed; no result was published as fresh." }, { headers: { "Cache-Control": `public, max-age=${CACHE_SECONDS}` } });
  }
}

export default {
  async fetch(request: Request, env: Env, context: WorkerContext): Promise<Response> {
    const url = new URL(request.url);
    const pulseCity = url.pathname.match(/^\/api\/pulse\/(stockholm|san-francisco)$/)?.[1] as CityId | undefined;
    if (pulseCity) {
      if (request.method !== "GET") return json({ error: "method not allowed" }, { status: 405, headers: { Allow: "GET" } });
      return pulseResponse(request, env, context, pulseCity);
    }
    if (url.pathname === "/api/events/san-francisco") {
      if (request.method !== "GET") return json({ error: "method not allowed" }, { status: 405, headers: { Allow: "GET" } });
      return eventsResponse(request, env, context);
    }
    const ingestionCity = url.pathname.match(/^\/api\/ingestion\/(stockholm|san-francisco)$/)?.[1] as CityId | undefined;
    if (ingestionCity) {
      if (request.method !== "GET") return json({ error: "method not allowed" }, { status: 405, headers: { Allow: "GET" } });
      return ingestionResponse(request, env, context, ingestionCity);
    }
    if (url.pathname.startsWith("/api/")) return json({ error: "not found" }, { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
