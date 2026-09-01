import type { Happening } from "../domain/types";

export type TimeSelection = "now" | "later" | "tomorrow" | "date";

export type SearchWindow = {
  startAfter: string;
  endBefore: string;
};

const selectionLabels: Record<Exclude<TimeSelection, "date">, string> = {
  now: "Right Now",
  later: "Later",
  tomorrow: "Tomorrow",
};

type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const zonedDateParts = (date: Date, timeZone: string): ZonedDateParts => {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return values as ZonedDateParts;
};

const padded = (value: number) => String(value).padStart(2, "0");

export function localDate(date: Date, timeZone: string) {
  const parts = zonedDateParts(date, timeZone);
  return `${parts.year}-${padded(parts.month)}-${padded(parts.day)}`;
}

export function localDateTimeToIso(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute, second = 0] = time.split(":").map(Number);
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let instant = targetAsUtc;

  // Iterating accounts for the city's UTC offset, including daylight-saving changes.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = zonedDateParts(new Date(instant), timeZone);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    const adjustment = targetAsUtc - actualAsUtc;
    instant += adjustment;
    if (adjustment === 0) break;
  }

  return new Date(instant).toISOString();
}

export function shiftIsoDate(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function timeSelectionLabel(
  selection: TimeSelection,
  selectedDate: string,
  locale: string,
) {
  if (selection !== "date") return selectionLabels[selection];
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(
    new Date(`${selectedDate}T12:00:00Z`),
  );
}

export function happeningSectionTitle(
  selection: TimeSelection,
  selectedDate: string,
  locale: string,
) {
  return `Happening ${selection === "now" ? "Now" : timeSelectionLabel(selection, selectedDate, locale)}`;
}

export function getSearchWindow(
  selection: TimeSelection,
  selectedDate: string,
  timeZone: string,
  now = new Date(),
): SearchWindow {
  const baseDate = localDate(now, timeZone);
  const nextDate = shiftIsoDate(baseDate, 1);
  const endOfToday = localDateTimeToIso(nextDate, "00:00:00", timeZone);

  if (selection === "later") {
    const eveningStart = localDateTimeToIso(baseDate, "20:00:00", timeZone);
    return {
      startAfter: new Date(Math.max(now.getTime(), Date.parse(eveningStart))).toISOString(),
      endBefore: endOfToday,
    };
  }

  if (selection === "tomorrow") {
    return {
      startAfter: endOfToday,
      endBefore: localDateTimeToIso(shiftIsoDate(baseDate, 2), "00:00:00", timeZone),
    };
  }

  if (selection === "date") {
    return {
      startAfter: localDateTimeToIso(selectedDate, "00:00:00", timeZone),
      endBefore: localDateTimeToIso(shiftIsoDate(selectedDate, 1), "00:00:00", timeZone),
    };
  }

  return { startAfter: now.toISOString(), endBefore: endOfToday };
}

export function initialPopulatedTimeSelection(
  happenings: Array<Pick<Happening, "timing">>,
  timeZone: string,
  now = new Date(),
): Extract<TimeSelection, "now" | "tomorrow"> {
  const selectedDate = localDate(now, timeZone);
  const overlaps = (selection: "now" | "tomorrow") => {
    const window = getSearchWindow(selection, selectedDate, timeZone, now);
    const startAfter = Date.parse(window.startAfter);
    const endBefore = Date.parse(window.endBefore);
    return happenings.some((item) => {
      const start = Date.parse(item.timing.start);
      const end = item.timing.end
        ? Date.parse(item.timing.end)
        : start + (item.timing.estimatedDurationMinutes ?? 90) * 60_000;
      return end > startAfter && start < endBefore;
    });
  };

  if (overlaps("now")) return "now";
  return overlaps("tomorrow") ? "tomorrow" : "now";
}
