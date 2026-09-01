import type { CurrencyCode, HappeningCategory } from "../../src/domain/types";
import type { EventCandidate, ParseContext } from "./types";

const text = (value: unknown): string | undefined => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "object" && value !== null && "@value" in value) return text((value as { "@value": unknown })["@value"]);
  return undefined;
};

const id = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "@id" in value) return text((value as { "@id": unknown })["@id"]);
  return undefined;
};

const numberValue = (value: unknown): number | undefined => {
  const parsed = typeof value === "number" ? value : Number(text(value));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const array = <T>(value: T | T[] | undefined): T[] => value === undefined ? [] : Array.isArray(value) ? value : [value];

const object = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;

const decodeXml = (value: string) => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'")
  .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const xmlTag = (source: string, names: string[]) => {
  for (const name of names) {
    const match = source.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
    if (match) return decodeXml(match[1]);
  }
  return undefined;
};

const categoryFromText = (value?: string): HappeningCategory => {
  const normalized = value?.toLowerCase() ?? "";
  if (/music|concert|jazz|rock|pop/.test(normalized)) return "live_music";
  if (/club|dance|dj|nightlife/.test(normalized)) return "club";
  if (/comedy/.test(normalized)) return "comedy";
  if (/film|cinema/.test(normalized)) return "film";
  if (/food|drink|wine|beer/.test(normalized)) return "food_drink";
  if (/talk|lecture|seminar/.test(normalized)) return "talk";
  if (/market/.test(normalized)) return "market";
  if (/museum|theatre|theater|art|culture|exhibition/.test(normalized)) return "culture";
  return "other";
};

const schemaNodeToCandidate = (node: Record<string, unknown>, context: ParseContext): EventCandidate | undefined => {
  const types = array(node["@type"]).map(text).filter(Boolean);
  if (!types.some((type) => type?.endsWith("Event"))) return undefined;
  const location = array(node.location).map(object).find((item) => item && !String(item["@type"] ?? "").includes("Virtual"));
  const address = object(location?.address);
  const geo = object(location?.geo);
  const offers = array(node.offers).map(object).find(Boolean);
  const performer = array(node.performer).map(object).find(Boolean);
  const organizer = object(node.organizer);
  const canonicalUrl = id(node.url) ?? id(node["@id"]) ?? context.source.canonicalUrl;
  const title = text(node.name);
  const start = text(node.startDate);
  if (!title || !start || !canonicalUrl) return undefined;
  const availabilityValue = id(offers?.availability)?.toLowerCase();
  const eventStatus = id(node.eventStatus)?.toLowerCase();
  return {
    cityId: context.source.cityId,
    title,
    description: text(node.description),
    category: categoryFromText(types.join(" ")),
    venue: {
      name: text(location?.name) ?? context.source.defaultVenue?.name ?? context.source.venue ?? "",
      address: [text(address?.streetAddress), text(address?.addressLocality)].filter(Boolean).join(", ") || context.source.defaultVenue?.address,
      neighborhood: context.source.defaultVenue?.neighborhood,
      lat: numberValue(geo?.latitude) ?? context.source.defaultVenue?.lat,
      lng: numberValue(geo?.longitude) ?? context.source.defaultVenue?.lng,
    },
    start,
    end: text(node.endDate),
    performer: text(performer?.name),
    organizer: text(organizer?.name),
    canonicalUrl,
    ticketUrl: id(offers?.url),
    priceMin: numberValue(offers?.lowPrice ?? offers?.price),
    priceMax: numberValue(offers?.highPrice ?? offers?.price),
    currency: text(offers?.priceCurrency) as CurrencyCode | undefined,
    availability: eventStatus?.includes("cancelled") ? "cancelled" : availabilityValue?.includes("soldout") ? "sold_out" : availabilityValue?.includes("instock") ? "available" : "unknown",
  };
};

export function parseSchemaOrgEventJsonLd(input: string | unknown, context: ParseContext): EventCandidate[] {
  const documents: unknown[] = [];
  if (typeof input === "string") {
    const scripts = [...input.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const script of scripts) {
      try { documents.push(JSON.parse(script[1])); } catch { /* malformed blocks are rejected without aborting the source */ }
    }
    if (!scripts.length) {
      try { documents.push(JSON.parse(input)); } catch { return []; }
    }
  } else documents.push(input);
  const nodes = documents.flatMap((document) => {
    const root = object(document);
    if (!root) return array(document).map(object).filter(Boolean) as Record<string, unknown>[];
    return [...(array(root["@graph"]).map(object).filter(Boolean) as Record<string, unknown>[]), root];
  });
  return nodes.map((node) => schemaNodeToCandidate(node, context)).filter((candidate): candidate is EventCandidate => Boolean(candidate));
}

const parseIcsDate = (value: string) => {
  const clean = value.trim();
  if (/^\d{8}T\d{6}Z$/.test(clean)) return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T${clean.slice(9, 11)}:${clean.slice(11, 13)}:${clean.slice(13, 15)}Z`;
  if (/^\d{8}T\d{6}$/.test(clean)) return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T${clean.slice(9, 11)}:${clean.slice(11, 13)}:${clean.slice(13, 15)}`;
  if (/^\d{8}$/.test(clean)) return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
  return clean;
};

export function parseIcsEvents(input: string, context: ParseContext): EventCandidate[] {
  const unfolded = input.replace(/\r?\n[ \t]/g, "");
  return [...unfolded.matchAll(/BEGIN:VEVENT\r?\n([\s\S]*?)\r?\nEND:VEVENT/g)].flatMap((match) => {
    const properties = new Map<string, string>();
    for (const line of match[1].split(/\r?\n/)) {
      const separator = line.indexOf(":");
      if (separator < 0) continue;
      properties.set(line.slice(0, separator).split(";")[0].toUpperCase(), line.slice(separator + 1).replace(/\\n/gi, " ").replace(/\\,/g, ","));
    }
    const title = properties.get("SUMMARY")?.trim();
    const start = properties.get("DTSTART");
    if (!title || !start) return [];
    return [{
      providerId: properties.get("UID"), cityId: context.source.cityId, title,
      description: properties.get("DESCRIPTION"), category: categoryFromText(properties.get("CATEGORIES")),
      venue: { name: context.source.defaultVenue?.name ?? properties.get("LOCATION")?.split(",")[0] ?? context.source.venue ?? "", address: properties.get("LOCATION"), ...context.source.defaultVenue },
      start: parseIcsDate(start), end: properties.get("DTEND") ? parseIcsDate(properties.get("DTEND")!) : undefined,
      canonicalUrl: properties.get("URL") ?? context.source.canonicalUrl, availability: properties.get("STATUS")?.toUpperCase() === "CANCELLED" ? "cancelled" : "unknown",
    } satisfies EventCandidate];
  });
}

export function parseRssAtomEvents(input: string, context: ParseContext): EventCandidate[] {
  const entries = [...input.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)].map((match) => match[2]);
  return entries.flatMap((entry) => {
    const title = xmlTag(entry, ["title"]);
    const start = xmlTag(entry, ["event:start", "start", "dtstart", "ev:startdate"]);
    const linkAttribute = entry.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1];
    const canonicalUrl = linkAttribute ?? xmlTag(entry, ["link", "guid"]);
    if (!title || !start || !canonicalUrl) return [];
    return [{ cityId: context.source.cityId, title, description: xmlTag(entry, ["description", "summary", "content"]), category: categoryFromText(xmlTag(entry, ["category"])), venue: { name: context.source.defaultVenue?.name ?? context.source.venue ?? "", ...context.source.defaultVenue }, start, end: xmlTag(entry, ["event:end", "end", "dtend", "ev:enddate"]), canonicalUrl, availability: "unknown" } satisfies EventCandidate];
  });
}

export function parseVenueJsonEvents(input: unknown, context: ParseContext): EventCandidate[] {
  const root = object(input);
  const rows = Array.isArray(input) ? input : array(root?.events ?? root?.data ?? root?.items);
  return rows.flatMap((row) => {
    const event = object(row);
    if (!event) return [];
    const title = text(event.title ?? event.name);
    const sourceDate = text(event.date);
    const sourceTime = text(event.open_time)?.match(/(?:Dörrar\s*)?(\d{1,2})[.:](\d{2})/i);
    const cityOffset = context.source.cityId === "stockholm" ? "+02:00" : "-07:00";
    const start = text(event.start ?? event.startDate ?? event.startsAt) ?? (sourceDate ? `${sourceDate}T${sourceTime?.[1]?.padStart(2, "0") ?? "18"}:${sourceTime?.[2] ?? "00"}:00${cityOffset}` : undefined);
    const canonicalUrl = text(event.url ?? event.canonicalUrl) ?? context.source.canonicalUrl;
    if (!title || !start) return [];
    const venue = object(event.venue);
    return [{ providerId: text(event.id), cityId: context.source.cityId, title, description: text(event.description), category: categoryFromText(text(event.category ?? event.type)), venue: { name: text(venue?.name) ?? context.source.defaultVenue?.name ?? context.source.venue ?? "", address: text(venue?.address) ?? context.source.defaultVenue?.address, neighborhood: text(venue?.neighborhood) ?? context.source.defaultVenue?.neighborhood, lat: numberValue(venue?.lat) ?? context.source.defaultVenue?.lat, lng: numberValue(venue?.lng) ?? context.source.defaultVenue?.lng }, start, end: text(event.end ?? event.endDate ?? event.endsAt), performer: text(event.performer), organizer: text(event.organizer), canonicalUrl, ticketUrl: text(event.ticketUrl ?? event.ticket_url), priceMin: numberValue(event.priceMin), priceMax: numberValue(event.priceMax), currency: text(event.currency) as CurrencyCode | undefined, availability: text(event.status)?.toLowerCase() === "cancelled" ? "cancelled" : "unknown" } satisfies EventCandidate];
  });
}

export function parseEventSitemap(input: string): string[] {
  return [...input.matchAll(/<url(?:\s[^>]*)?>([\s\S]*?)<\/url>/gi)]
    .map((match) => xmlTag(match[1], ["loc"]))
    .filter((url): url is string => Boolean(url && /^https:\/\//.test(url)));
}
