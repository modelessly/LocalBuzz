import type { CurrencyCode } from "../domain/types";

export const formatTime = (value: string, timeZone = "Europe/Stockholm") =>
  new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(new Date(value));

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
