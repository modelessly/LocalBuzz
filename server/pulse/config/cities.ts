import type { PulseCityId } from "../types";

export const PULSE_HANDLE_GROUPS = ["venues", "culture", "nightlife", "food", "neighborhoods", "city"] as const;
export type PulseHandleGroup = (typeof PULSE_HANDLE_GROUPS)[number];

export type CityPulseConfig = {
  id: PulseCityId;
  name: "Stockholm" | "San Francisco";
  timeZone: string;
  center: { lat: number; lng: number };
  searchArea: string;
  socialTerms: string[];
  neighborhoods: string[];
  trustedXHandles: Record<PulseHandleGroup, string[]>;
  geocodingHints: Array<{ names: string[]; neighborhood: string; lat: number; lng: number }>;
};

const cities: Record<PulseCityId, CityPulseConfig> = {
  stockholm: {
    id: "stockholm",
    name: "Stockholm",
    timeZone: "Europe/Stockholm",
    center: { lat: 59.325, lng: 18.071 },
    searchArea: "Stockholm municipality and the central evening corridors inside the city boundary",
    socialTerms: ["händer nu", "ikväll", "live nu", "kö", "fullt hus", "pop-up", "sista minuten"],
    neighborhoods: ["Södermalm", "Norrmalm", "Gamla Stan", "Östermalm", "Kungsholmen", "Vasastan", "Djurgården"],
    trustedXHandles: {
      venues: ["debasersthlm", "FaschingSthlm"],
      culture: ["VisitStockholm", "ModernaMuseet"],
      nightlife: ["debasersthlm"],
      food: ["VisitStockholm"],
      neighborhoods: [],
      city: ["stockholmstad"],
    },
    geocodingHints: [
      { names: ["Debaser", "Debaser Strand"], neighborhood: "Södermalm", lat: 59.315, lng: 18.031 },
      { names: ["Fasching"], neighborhood: "Norrmalm", lat: 59.3352, lng: 18.0559 },
      { names: ["Moderna Museet"], neighborhood: "Skeppsholmen", lat: 59.3262, lng: 18.0847 },
    ],
  },
  "san-francisco": {
    id: "san-francisco",
    name: "San Francisco",
    timeZone: "America/Los_Angeles",
    center: { lat: 37.774, lng: -122.438 },
    searchArea: "San Francisco city and county only; exclude Oakland, Berkeley, Marin, San Mateo and San Jose",
    socialTerms: ["happening now", "starting now", "line outside", "walk-ins", "tonight", "pop-up", "last minute"],
    neighborhoods: ["Mission", "SoMa", "Hayes Valley", "North Beach", "Chinatown", "Castro", "Haight", "Richmond", "Sunset"],
    trustedXHandles: {
      venues: ["SFJAZZ", "TheFillmoreSF", "publicworkssf", "indysf", "TheMidwaySF"],
      culture: ["SFMOMA", "exploratorium", "deyoungmuseum", "asianartmuseum"],
      nightlife: ["noisepop", "apeconcerts"],
      food: ["OfftheGridSF", "FerryBldg"],
      neighborhoods: ["SFist"],
      city: ["sfgov", "RecParkSF", "SFPort", "SFMTA_Muni"],
    },
    geocodingHints: [
      { names: ["SFJAZZ", "SFJAZZ Center"], neighborhood: "Hayes Valley", lat: 37.7763, lng: -122.4214 },
      { names: ["The Fillmore"], neighborhood: "Fillmore", lat: 37.7841, lng: -122.4331 },
      { names: ["Public Works"], neighborhood: "Mission", lat: 37.7689, lng: -122.4193 },
      { names: ["The Midway"], neighborhood: "Dogpatch", lat: 37.7504, lng: -122.3863 },
    ],
  },
};

export const cityPulseIds = Object.keys(cities) as PulseCityId[];

export function getCityPulseConfig(cityId: PulseCityId): CityPulseConfig {
  return cities[cityId];
}

export function isPulseHandleGroup(value: string): value is PulseHandleGroup {
  return PULSE_HANDLE_GROUPS.includes(value as PulseHandleGroup);
}

export function resolveTrustedHandles(cityId: PulseCityId, groups: readonly PulseHandleGroup[] = PULSE_HANDLE_GROUPS): string[] {
  const handles = [...new Set(groups.flatMap((group) => cities[cityId].trustedXHandles[group]))];
  if (handles.length > 20) throw new Error(`Curated X Search accepts at most 20 handles; ${cityId} resolved to ${handles.length}.`);
  return handles;
}
