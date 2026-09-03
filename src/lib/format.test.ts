import { describe, expect, it } from "vitest";
import { formatDateTimeRange, formatTimeRange } from "./format";

describe("city-local date and time formatting", () => {
  it("formats Stockholm with day first and a 24-hour clock", () => {
    expect(formatDateTimeRange("2026-09-03T20:00:00+02:00", "2026-09-03T21:30:00+02:00", "Europe/Stockholm")).toBe("3 SEP · 20:00–21:30");
    expect(formatTimeRange("2026-09-03T18:00:00+02:00", "2026-09-03T21:30:00+02:00", "Europe/Stockholm")).toBe("18:00–21:30");
  });

  it("formats San Francisco with month first and AM/PM", () => {
    expect(formatDateTimeRange("2026-09-03T20:00:00-07:00", "2026-09-03T21:30:00-07:00", "America/Los_Angeles")).toBe("SEP 3 · 8:00–9:30 PM");
    expect(formatTimeRange("2026-09-03T18:00:00-07:00", "2026-09-03T21:30:00-07:00", "America/Los_Angeles")).toBe("6:00–9:30 PM");
  });

  it("marks estimated endings and includes the next local date after midnight", () => {
    expect(formatDateTimeRange("2026-09-03T23:30:00+02:00", "2026-09-04T01:00:00+02:00", "Europe/Stockholm", true)).toBe("3 SEP · 23:30–4 SEP · CA 01:00");
    expect(formatDateTimeRange("2026-09-03T23:30:00-07:00", "2026-09-04T01:00:00-07:00", "America/Los_Angeles", true)).toBe("SEP 3 · 11:30 PM–SEP 4 · ABOUT 1:00 AM");
  });

  it("uses the requested city timezone instead of the machine timezone", () => {
    const instant = "2026-09-04T05:30:00.000Z";
    expect(formatDateTimeRange(instant, undefined, "Europe/Stockholm")).toBe("4 SEP · 07:30");
    expect(formatDateTimeRange(instant, undefined, "America/Los_Angeles")).toBe("SEP 3 · 10:30 PM");
  });
});
