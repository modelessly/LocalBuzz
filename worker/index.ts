import { collectSanFranciscoPulse, unavailablePulse } from "../server/pulse/collector";
import { collectSanFranciscoEvents } from "../server/events/collector";
import { verifiedSanFranciscoFallback, withVerifiedFallback } from "../server/events/fallback";
import { isHandleGroup, type SfHandleGroup } from "../server/pulse/config/handles";
import type { CollectionMode } from "../server/pulse/types";
import { refreshCityEvents } from "../server/ingestion/refresh";
import type { CityEventSnapshot } from "../server/ingestion/types";
import { getCityDefinition } from "../src/data/cities";
import type { CityId } from "../src/domain/types";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  XAI_API_KEY?: string;
  XAI_MODEL?: string;
  TICKETMASTER_API_KEY?: string;
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
  const snapshot = await refreshCityEvents({ cityId, ticketmasterApiKey: env.TICKETMASTER_API_KEY, previous });
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

function parseOptions(url: URL): { mode: CollectionMode; groups?: SfHandleGroup[] } {
  const requestedMode = url.searchParams.get("mode") ?? "broad";
  if (requestedMode !== "broad" && requestedMode !== "curated") throw new Error("mode must be broad or curated");
  if (requestedMode === "broad") return { mode: "broad" };

  const rawGroups = url.searchParams.get("groups");
  if (!rawGroups) return { mode: "curated" };
  const groups = [...new Set(rawGroups.split(",").map((group) => group.trim()).filter(Boolean))];
  if (groups.length === 0 || !groups.every(isHandleGroup)) throw new Error("groups contains an unknown curated handle group");
  return { mode: "curated", groups };
}

async function pulseResponse(request: Request, env: Env, context: WorkerContext): Promise<Response> {
  const url = new URL(request.url);
  let options: ReturnType<typeof parseOptions>;
  try {
    options = parseOptions(url);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "invalid request" }, { status: 400 });
  }

  const cacheUrl = new URL(url.origin + url.pathname);
  cacheUrl.searchParams.set("mode", options.mode);
  if (options.groups) cacheUrl.searchParams.set("groups", [...options.groups].sort().join(","));
  const cacheKey = new Request(cacheUrl, { method: "GET" });
  const edgeCache = (caches as CacheStorage & { default: Cache }).default;
  const cached = await edgeCache.match(cacheKey);
  if (cached) {
    const response = new Response(cached.body, cached);
    response.headers.set("X-Pulse-Cache", "HIT");
    return response;
  }

  if (!env.XAI_API_KEY) {
    console.error(JSON.stringify({ event: "sf_pulse_failure", reason: "missing_api_key" }));
    return json(unavailablePulse(), { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const result = await collectSanFranciscoPulse({
      apiKey: env.XAI_API_KEY,
      model: env.XAI_MODEL,
      ...options,
    });
    console.log(JSON.stringify({
      event: "sf_pulse_collection",
      mode: options.mode,
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
    return response;
  } catch (error) {
    console.error(JSON.stringify({
      event: "sf_pulse_failure",
      mode: options.mode,
      message: error instanceof Error ? error.message : "unknown failure",
    }));
    return json(unavailablePulse(), { status: 503, headers: { "Cache-Control": "no-store" } });
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
  if (!env.XAI_API_KEY) return json(verifiedSanFranciscoFallback(), { headers: { "Cache-Control": `public, max-age=${CACHE_SECONDS}` } });
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
    return json(verifiedSanFranciscoFallback(), { headers: { "Cache-Control": `public, max-age=${CACHE_SECONDS}` } });
  }
}

export default {
  async fetch(request: Request, env: Env, context: WorkerContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/pulse/san-francisco") {
      if (request.method !== "GET") return json({ error: "method not allowed" }, { status: 405, headers: { Allow: "GET" } });
      return pulseResponse(request, env, context);
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
