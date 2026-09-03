import { describe, expect, it, vi } from "vitest";
import { buildBillettoRequest, collectBilletto, parseBillettoResponse } from "./billetto";
import { eventSourcesForCity } from "./registry";

const source = eventSourcesForCity("stockholm").find((item) => item.parser === "billetto-public-events")!;
const event = (overrides: Record<string, unknown> = {}) => ({
  id: "b1",
  state: "published",
  title: "Stockholm Session",
  description: "A source-backed event",
  url: "https://billetto.se/e/stockholm-session-biljetter-1?utm_source=api",
  availability: true,
  minimum_price: { amount_in_cents: 125, currency: "SEK" },
  categorization: { category: "music", type: "concert" },
  location: { location_name: "The Hall", address_line: "1 Testgatan", postal_code: "111 11", city: "Stockholm", coordinates: { latitude: 59.33, longitude: 18.06 } },
  startdate: "2026-09-04T17:00:00Z",
  enddate: "2026-09-04T19:00:00Z",
  organiser: { name: "Local Organizer" },
  ...overrides,
});

describe("Billetto public event adapter", () => {
  it("constructs a Swedish-domain authenticated request without putting credentials in its URL", () => {
    const request = buildBillettoRequest(source, "key-sentinel", "secret-sentinel");
    expect(request.url).toBe("https://billetto.se/api/v3/public/events?limit=100");
    expect(request.headers.has("Api-Keypair")).toBe(true);
    expect(request.url).not.toContain("sentinel");
  });

  it("normalizes public Stockholm events, preserves UTM URLs, and excludes unsupported records", () => {
    const parsed = parseBillettoResponse({ data: [event(), event({ id: "draft", state: "draft" }), event({ id: "cancelled", state: "canceled" }), event({ id: "completed", state: "completed" }), event({ id: "online", location: null }), event({ id: "outside", location: { location_name: "Elsewhere", address_line: "1 Road", city: "Malmö", coordinates: { latitude: 55.6, longitude: 13 } } }), event({ id: "unsafe", url: "http://example.test/event" })], has_more: false, total: 7 }, source);
    expect(parsed.candidates).toHaveLength(1);
    expect(parsed.candidates[0]).toMatchObject({ title: "Stockholm Session", category: "live_music", priceMin: 125, currency: "SEK" });
    expect(parsed.candidates[0]?.canonicalUrl).toContain("utm_source=api");
    expect(parsed.rejected).toEqual(expect.arrayContaining(["status:draft", "status:canceled", "status:completed", "online or missing location", "outside Stockholm or missing coordinates", "invalid canonical URL"]));
  });

  it("uses bounded pagination and reports safe rejection reasons", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      expect(request.headers.has("Api-Keypair")).toBe(true);
      const second = request.url.includes("page=2");
      return new Response(JSON.stringify(second
        ? { data: [event({ id: "b2", title: "Second Event", url: "https://billetto.se/e/second?utm_source=api" })], has_more: false, total: 2 }
        : { data: [event()], has_more: true, next_url: "https://billetto.se/api/v3/public/events?page=2", total: 2 }), { status: 200 });
    });
    const result = await collectBilletto({ source, apiKey: "key-sentinel", apiSecret: "secret-sentinel", fetchImpl, now: new Date("2026-09-02T12:00:00Z"), maxPages: 3 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ status: "fresh", candidateCount: 2 });
    expect(result.happenings).toHaveLength(2);
    expect(JSON.stringify(result)).not.toContain("sentinel");
  });

  it("rejects broad Billetto date ranges with the shared nightly reason", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      data: [
        event({ id: "night", title: "One Night", startdate: "2026-09-04T17:00:00Z", enddate: "2026-09-04T21:00:00Z" }),
        event({ id: "week", title: "Weekly Pass", startdate: "2026-09-04T17:00:00Z", enddate: "2026-09-11T17:00:00Z" }),
        event({ id: "month", title: "Monthly Pass", startdate: "2026-09-04T17:00:00Z", enddate: "2026-10-04T17:00:00Z" }),
      ],
      has_more: false,
      total: 3,
    }), { status: 200 }));
    const result = await collectBilletto({ source, apiKey: "key-sentinel", apiSecret: "secret-sentinel", fetchImpl, now: new Date("2026-09-02T12:00:00Z") });
    expect(result.happenings.map((item) => item.title)).toEqual(["One Night"]);
    expect(result.rejectionReasons).toMatchObject({ "event duration exceeds nightly limit": 2 });
  });

  it("degrades honestly when either credential is missing", async () => {
    await expect(collectBilletto({ source, apiKey: "only-key" })).resolves.toMatchObject({ status: "unavailable", happenings: [] });
  });

  it("distinguishes an empty success from a safe provider failure", async () => {
    const empty = await collectBilletto({ source, apiKey: "key-sentinel", apiSecret: "secret-sentinel", fetchImpl: async () => new Response(JSON.stringify({ data: [], has_more: false, total: 0 }), { status: 200 }) });
    expect(empty).toMatchObject({ status: "fresh", happenings: [], candidateCount: 0 });
    await expect(collectBilletto({ source, apiKey: "key-sentinel", apiSecret: "secret-sentinel", fetchImpl: async () => new Response("denied", { status: 401 }) })).rejects.toThrow("Billetto returned HTTP 401");
    try {
      await collectBilletto({ source, apiKey: "key-sentinel", apiSecret: "secret-sentinel", fetchImpl: async () => new Response("denied", { status: 401 }) });
    } catch (error) {
      expect(String(error)).not.toContain("sentinel");
    }
  });
});
