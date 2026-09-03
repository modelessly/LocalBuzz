import { describe, expect, it } from "vitest";
import {
  getSearchWindow,
  happeningsLaterToday,
  happeningSectionTitle,
  initialPopulatedTimeSelection,
  localDate,
  shouldShowLaterTodayFallback,
  timeSelectionLabel,
} from "./timeSearch";

const NOW = new Date("2026-08-31T12:45:00.000Z");
const TIME_ZONE = "Europe/Stockholm";

describe("time selector search windows", () => {
  it("uses an explicit active-at instant for events happening right now", () => {
    expect(getSearchWindow("now", "2026-08-31", TIME_ZONE, NOW)).toEqual({
      activeAt: "2026-08-31T12:45:00.000Z",
    });
  });

  it("moves Later to the current city's evening", () => {
    expect(getSearchWindow("later", "2026-08-31", TIME_ZONE, NOW)).toEqual({
      startAfter: "2026-08-31T18:00:00.000Z",
      endBefore: "2026-08-31T22:00:00.000Z",
    });
  });

  it("creates a full local-day window for Tomorrow", () => {
    expect(getSearchWindow("tomorrow", "2026-08-31", TIME_ZONE, NOW)).toEqual({
      startAfter: "2026-08-31T22:00:00.000Z",
      endBefore: "2026-09-01T22:00:00.000Z",
    });
  });

  it("creates a full local-day window for a picked date", () => {
    expect(getSearchWindow("date", "2026-09-03", TIME_ZONE, NOW)).toEqual({
      startAfter: "2026-09-02T22:00:00.000Z",
      endBefore: "2026-09-03T22:00:00.000Z",
    });
  });

  it("derives the calendar date in the active city rather than the browser timezone", () => {
    expect(localDate(new Date("2026-09-01T01:00:00.000Z"), "America/Los_Angeles")).toBe("2026-08-31");
  });

  it("keeps dropdown labels and happening section titles aligned", () => {
    expect(timeSelectionLabel("now", "2026-08-31", "en-SE")).toBe("Right Now");
    expect(happeningSectionTitle("now", "2026-08-31", "en-SE")).toBe("Happening Now");
    expect(happeningSectionTitle("later", "2026-08-31", "en-SE")).toBe("Happening Later");
    expect(happeningSectionTitle("tomorrow", "2026-08-31", "en-SE")).toBe("Happening Tomorrow");
    expect(happeningSectionTitle("date", "2026-09-03", "en-SE")).toBe("Happening 3 Sept");
  });

  it("suggests tomorrow when no events remain in the city-local current day", () => {
    const happenings = [{
      timing: {
        start: "2026-09-01T09:30:00-07:00",
        end: "2026-09-01T12:00:00-07:00",
      },
    }];

    expect(initialPopulatedTimeSelection(
      happenings,
      "America/Los_Angeles",
      new Date("2026-09-01T05:34:00.000Z"),
    )).toBe("tomorrow");
  });

  it("keeps Right Now when a later event remains today", () => {
    const happenings = [{
      timing: {
        start: "2026-08-31T23:00:00-07:00",
        end: "2026-08-31T23:45:00-07:00",
      },
    }];

    expect(initialPopulatedTimeSelection(
      happenings,
      "America/Los_Angeles",
      new Date("2026-09-01T05:34:00.000Z"),
    )).toBe("now");
  });

  it("returns only available nightly events that start later on the same city-local day", () => {
    const happenings = [
      { id: "active-now", timing: { start: "2026-08-31T12:00:00Z", end: "2026-08-31T13:00:00Z" }, status: { availability: "available" } },
      { id: "later-first", timing: { start: "2026-08-31T17:00:00Z", end: "2026-08-31T18:00:00Z" }, status: { availability: "available" } },
      { id: "later-second", timing: { start: "2026-08-31T19:00:00Z", estimatedDurationMinutes: 90 }, status: { availability: "unknown" } },
      { id: "sold-out", timing: { start: "2026-08-31T20:00:00Z", end: "2026-08-31T21:00:00Z" }, status: { availability: "sold_out" } },
      { id: "tomorrow", timing: { start: "2026-08-31T22:30:00Z", end: "2026-08-31T23:30:00Z" }, status: { availability: "available" } },
      { id: "multi-day", timing: { start: "2026-08-31T16:00:00Z", end: "2026-09-01T17:00:00Z" }, status: { availability: "available" } },
    ] as const;

    expect(happeningsLaterToday(happenings, TIME_ZONE, NOW).map((item) => item.id)).toEqual([
      "later-first",
      "later-second",
    ]);
  });

  it("uses the selected city's midnight rather than the browser's calendar day", () => {
    const happenings = [
      { id: "sf-tonight", timing: { start: "2026-09-01T06:30:00Z", end: "2026-09-01T06:50:00Z" }, status: { availability: "available" } },
      { id: "sf-tomorrow", timing: { start: "2026-09-01T07:30:00Z", end: "2026-09-01T08:30:00Z" }, status: { availability: "available" } },
    ] as const;

    expect(happeningsLaterToday(
      happenings,
      "America/Los_Angeles",
      new Date("2026-09-01T05:30:00Z"),
    ).map((item) => item.id)).toEqual(["sf-tonight"]);
  });

  it("shows the later-today fallback only for an unsearched empty Right Now window", () => {
    expect(shouldShowLaterTodayFallback("now", "", 0, 3)).toBe(true);
    expect(shouldShowLaterTodayFallback("now", "jazz", 0, 3)).toBe(false);
    expect(shouldShowLaterTodayFallback("now", "", 1, 3)).toBe(false);
    expect(shouldShowLaterTodayFallback("later", "", 0, 3)).toBe(false);
    expect(shouldShowLaterTodayFallback("now", "", 0, 0)).toBe(false);
  });
});
