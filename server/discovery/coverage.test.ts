import { describe, expect, it } from "vitest";
import type { Happening } from "../../src/domain/types";
import { buildCoverageReport, formatCoverageReport } from "./coverage";
import { targetedQueriesFromCoverage } from "./queries";

const event = (overrides: Partial<Happening> = {}): Happening => ({
  id: "gap-event", cityId: "san-francisco", title: "Mission Midnight Music", category: "live_music",
  venue: { name: "Gap Hall", address: "1 Mission St", neighborhood: "Mission", lat: 37.76, lng: -122.42 },
  timing: { start: "2026-09-02T23:00:00-07:00", end: "2026-09-03T00:30:00-07:00" },
  commerce: { priceMin: 0, currency: "USD" }, status: { availability: "unknown" },
  source: { name: "Official", url: "https://example.com/event", lastVerifiedAt: "2026-08-01T00:00:00Z" },
  ...overrides,
});

describe("coverage cube", () => {
  it("identifies covered observations, empty cells, stale inventory and corridor gaps deterministically", () => {
    const report = buildCoverageReport({ happenings: [event()], places: [], now: new Date("2026-09-02T12:00:00-07:00") });
    const occupied = report.cells.find((cell) => cell.cityId === "san-francisco" && cell.neighborhood === "Mission" && cell.category === "live_music" && cell.timeWindow === "late_night" && cell.priceBand === "free" && cell.leadTime === "same_day");
    const empty = report.cells.find((cell) => cell.cityId === "san-francisco" && cell.neighborhood === "Mission" && cell.category === "comedy" && cell.timeWindow === "late_night" && cell.priceBand === "free" && cell.leadTime === "same_day");
    expect(occupied).toMatchObject({ eventCount: 1, strength: "weak", eventIds: ["gap-event"] });
    expect(empty).toMatchObject({ eventCount: 0, strength: "empty" });
    expect(report.summary.staleInventory).toEqual([{ id: "gap-event", title: "Mission Midnight Music", lastVerifiedAt: "2026-08-01T00:00:00Z" }]);
    expect(report.summary.corridorGaps).toContainEqual(expect.objectContaining({ cityId: "san-francisco", neighborhood: "Mission", eventCount: 1, operationalPlaceCount: 0 }));
    expect(formatCoverageReport(report)).toContain("Priority gaps:");
  });

  it("generates a narrow city, neighborhood, category, time and price query for a specific weak cell", () => {
    const report = buildCoverageReport({ happenings: [event()], places: [], now: new Date("2026-09-02T12:00:00-07:00") });
    const target = targetedQueriesFromCoverage(report, report.cells.length).find((item) => item.cell.cityId === "san-francisco" && item.cell.neighborhood === "Mission" && item.cell.category === "comedy" && item.cell.timeWindow === "late_night" && item.cell.priceBand === "free" && item.cell.leadTime === "same_day");
    expect(target?.query).toMatch(/comedy.*Mission, San Francisco.*after 10pm.*today.*free/i);
    expect(target?.maxResults).toBe(10);
  });
});
