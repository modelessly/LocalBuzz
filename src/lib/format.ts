import type { CurrencyCode } from "../domain/types";

const isSanFrancisco = (timeZone: string) => timeZone === "America/Los_Angeles";

const clockParts = (value: string, timeZone: string) => {
  const parts = new Intl.DateTimeFormat(isSanFrancisco(timeZone) ? "en-US" : "en-GB", {
    hour: isSanFrancisco(timeZone) ? "numeric" : "2-digit",
    minute: "2-digit",
    hour12: isSanFrancisco(timeZone),
    hourCycle: isSanFrancisco(timeZone) ? undefined : "h23",
    timeZone,
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return { clock: `${part("hour")}:${part("minute")}`, period: part("dayPeriod").toUpperCase() };
};

const localDateKey = (value: string, timeZone: string) => new Intl.DateTimeFormat("en-CA", {
  year: "numeric", month: "2-digit", day: "2-digit", timeZone,
}).format(new Date(value));

const dateLabel = (value: string, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", timeZone }).formatToParts(new Date(value));
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = (parts.find((part) => part.type === "month")?.value ?? "").replaceAll(".", "").toUpperCase();
  return isSanFrancisco(timeZone) ? `${month} ${day}` : `${day} ${month}`;
};

export const formatTime = (value: string, timeZone = "Europe/Stockholm") => {
  const { clock, period } = clockParts(value, timeZone);
  return period ? `${clock} ${period}` : clock;
};

export function formatTimeRange(start: string, end: string, timeZone: string) {
  const from = clockParts(start, timeZone);
  const to = clockParts(end, timeZone);
  if (!from.period) return `${from.clock}–${to.clock}`;
  return from.period === to.period
    ? `${from.clock}–${to.clock} ${to.period}`
    : `${from.clock} ${from.period}–${to.clock} ${to.period}`;
}

export function formatDateTimeRange(start: string, end: string | undefined, timeZone: string, estimatedEnd = false) {
  const startDate = dateLabel(start, timeZone);
  const startClock = clockParts(start, timeZone);
  if (!end) return `${startDate} · ${formatTime(start, timeZone)}`;
  const endDate = dateLabel(end, timeZone);
  const endClock = clockParts(end, timeZone);
  const estimate = estimatedEnd ? (isSanFrancisco(timeZone) ? "ABOUT " : "CA ") : "";
  const crossesDate = localDateKey(start, timeZone) !== localDateKey(end, timeZone);

  if (crossesDate) {
    return `${startDate} · ${formatTime(start, timeZone)}–${endDate} · ${estimate}${formatTime(end, timeZone)}`;
  }
  if (!startClock.period) return `${startDate} · ${startClock.clock}–${estimate}${endClock.clock}`;
  const from = startClock.period === endClock.period ? startClock.clock : `${startClock.clock} ${startClock.period}`;
  return `${startDate} · ${from}–${estimate}${endClock.clock} ${endClock.period}`;
}

export const formatDay = (value: string, timeZone = "Europe/Stockholm") =>
  new Intl.DateTimeFormat("en", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  }).format(new Date(value));

export const categoryLabel = (value: string) => value.replaceAll("_", " ");

export const priceLabel = (price: number | undefined, currency: CurrencyCode) => {
  if (price === undefined) return "Price at source";
  if (price === 0) return "Free";
  return currency === "SEK" ? `${price} SEK` : `$${price}`;
};
