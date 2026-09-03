import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { collectSanFranciscoEvents } from "./server/events/collector";
import { verifiedSanFranciscoFallback, withVerifiedFallback } from "./server/events/fallback";
import { collectSanFranciscoPulse, unavailablePulse } from "./server/pulse/collector";
import { refreshCityEvents } from "./server/ingestion/refresh";
import type { CityEventSnapshot } from "./server/ingestion/types";
import { getCityDefinition } from "./src/data/cities";

const CACHE_MS = 12 * 60 * 1000;

function localFreshDataApi(apiKey: string | undefined, model: string | undefined, ticketmasterApiKey: string | undefined, billettoApiKey: string | undefined, billettoApiSecret: string | undefined): Plugin {
  let eventsCache: { expiresAt: number; payload: unknown } | undefined;
  let pulseCache: { expiresAt: number; payload: unknown } | undefined;
  let eventsPending: Promise<unknown> | undefined;
  let pulsePending: Promise<unknown> | undefined;
  const ingestionSnapshots = new Map<string, CityEventSnapshot>();
  return {
    name: "local-buzz-fresh-data-api",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = request.url ? new URL(request.url, "http://127.0.0.1").pathname : "";
        const ingestionCity = pathname.match(/^\/api\/ingestion\/(stockholm|san-francisco)$/)?.[1] as "stockholm" | "san-francisco" | undefined;
        if (pathname !== "/api/events/san-francisco" && pathname !== "/api/pulse/san-francisco" && !ingestionCity) {
          next();
          return;
        }
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        if (request.method !== "GET") {
          response.statusCode = 405;
          response.setHeader("Allow", "GET");
          response.end(JSON.stringify({ error: "method not allowed" }));
          return;
        }
        if (ingestionCity) {
          const previous = ingestionSnapshots.get(ingestionCity) ?? {
            cityId: ingestionCity,
            generatedAt: new Date().toISOString(),
            retained: false,
            happenings: getCityDefinition(ingestionCity).happenings.filter((item) => Date.parse(item.timing.end ?? item.timing.start) > Date.now()),
            sources: [],
          };
          const snapshot = await refreshCityEvents({ cityId: ingestionCity, ticketmasterApiKey, billettoApiKey, billettoApiSecret, xaiApiKey: apiKey, xaiModel: model, previous });
          ingestionSnapshots.set(ingestionCity, snapshot);
          response.statusCode = 200;
          response.end(JSON.stringify(snapshot));
          return;
        }
        if (!apiKey) {
          response.statusCode = pathname.includes("/events/") ? 200 : 503;
          response.end(JSON.stringify(pathname.includes("/events/")
            ? { ...verifiedSanFranciscoFallback(), status: "unavailable", error: "XAI_API_KEY is not configured." }
            : unavailablePulse()));
          return;
        }
        try {
          const now = Date.now();
          if (pathname.includes("/events/")) {
            if (!eventsCache || eventsCache.expiresAt <= now) {
              eventsPending ??= collectSanFranciscoEvents({ apiKey, model })
                .then((result) => {
                  eventsCache = { expiresAt: Date.now() + CACHE_MS, payload: withVerifiedFallback(result.payload) };
                  return eventsCache.payload;
                })
                .catch(() => {
                  const payload = { ...verifiedSanFranciscoFallback(), status: "unavailable", error: "Scheduled-event collection failed; no result was published as fresh." };
                  eventsCache = { expiresAt: Date.now() + CACHE_MS, payload };
                  return payload;
                })
                .finally(() => { eventsPending = undefined; });
            }
            response.end(JSON.stringify(eventsPending ? await eventsPending : eventsCache?.payload));
          } else {
            if (!pulseCache || pulseCache.expiresAt <= now) {
              pulseCache = { expiresAt: now + CACHE_MS, payload: unavailablePulse() };
              pulsePending ??= collectSanFranciscoPulse({ apiKey, model })
                .then((result) => {
                  pulseCache = { expiresAt: Date.now() + CACHE_MS, payload: result.payload };
                  return pulseCache.payload;
                })
                .catch(() => pulseCache?.payload)
                .finally(() => { pulsePending = undefined; });
            }
            response.end(JSON.stringify(pulseCache.payload));
          }
        } catch (error) {
          if (pathname.includes("/events/")) {
            response.statusCode = 200;
            response.end(JSON.stringify(verifiedSanFranciscoFallback()));
          } else {
            response.statusCode = 503;
            response.end(JSON.stringify({
              ...unavailablePulse(),
              error: error instanceof Error ? error.message : "fresh data unavailable",
            }));
          }
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), localFreshDataApi(env.XAI_API_KEY, env.XAI_MODEL, env.TICKETMASTER_API_KEY, env.BILLETTO_API_KEY, env.BILLETTO_API_SECRET)],
    server: { host: "127.0.0.1", port: 5173 },
    preview: { host: "127.0.0.1", port: 4173 },
  };
});
