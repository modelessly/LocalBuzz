import { describe, expect, it } from "vitest";
import {
  getSearchWindow,
  happeningSectionTitle,
  initialPopulatedTimeSelection,
  localDate,
  timeSelectionLabel,
} from "./timeSearch";

const NOW = new Date("2026-08-31T12:45:00.000Z");
const TIME_ZONE = "Europe/Stockholm";

describe("time selector search windows", () => {
  it("starts Right Now at the actual current instant and ends at city-local midnight", () => {
    expect(getSearchWindow("now", "2026-08-31", TIME_ZONE, NOW)).toEqual({
      startAfter: "2026-08-31T12:45:00.000Z",
      endBefore: "2026-08-31T22:00:00.000Z",
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
});
