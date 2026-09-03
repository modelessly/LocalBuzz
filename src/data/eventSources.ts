import type { CityId } from "../domain/types";

export type EventSourceDescriptor = {
  sourceId: string;
  publisher: string;
  cityId: CityId;
  enabled: boolean;
  disabledReason?: string;
};

export const eventSourceDescriptors: readonly EventSourceDescriptor[] = [
  { sourceId: "visit-sweden-stockholm", publisher: "Visit Sweden", cityId: "stockholm", enabled: true },
  { sourceId: "ticketmaster-stockholm", publisher: "Ticketmaster Discovery API", cityId: "stockholm", enabled: true },
  { sourceId: "venue-stockholm-debaser", publisher: "Debaser", cityId: "stockholm", enabled: true },
  ...["Nalen", "Södra Teatern", "Fasching", "Konserthuset Stockholm", "Kulturhuset Stadsteatern"].map((publisher, index) => ({
    sourceId: `venue-stockholm-${["nalen", "sodra-teatern", "fasching", "konserthuset", "kulturhuset"][index]}`,
    publisher,
    cityId: "stockholm" as const,
    enabled: false,
    disabledReason: "Permission or terms review is required before collection.",
  })),
  { sourceId: "xai-san-francisco-events", publisher: "xAI Web Search event collector", cityId: "san-francisco", enabled: true },
  { sourceId: "ticketmaster-san-francisco", publisher: "Ticketmaster Discovery API", cityId: "san-francisco", enabled: true },
  ...["SFJAZZ", "The Chapel", "Rickshaw Stop", "Bottom of the Hill", "San Francisco Public Library", "The Independent"].map((publisher, index) => ({
    sourceId: `venue-san-francisco-${["sfjazz", "the-chapel", "rickshaw-stop", "bottom-of-the-hill", "sfpl", "the-independent"][index]}`,
    publisher,
    cityId: "san-francisco" as const,
    enabled: false,
    disabledReason: "Permission or terms review is required before collection.",
  })),
] as const;

export const eventSourceDescriptorsForCity = (cityId: CityId) =>
  eventSourceDescriptors.filter((source) => source.cityId === cityId);
