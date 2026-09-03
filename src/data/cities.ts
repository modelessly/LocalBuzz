import { demoHappeningIds, demoInitialPlanIds, happenings } from "./happenings";
import {
  sanFranciscoDemoHappeningIds,
  sanFranciscoDemoInitialPlanIds,
  sanFranciscoHappenings,
} from "./sanFranciscoHappenings";
import { sanFranciscoPlaces, stockholmPlaces } from "./places";
import type { CityId, CurrencyCode, Happening, Place, PlacePurpose, PlanConstraints } from "../domain/types";

export type CityDefinition = {
  id: CityId;
  name: string;
  timeZone: string;
  locale: string;
  currency: CurrencyCode;
  mapCenter: [number, number];
  mapZoom: number;
  constraints: Omit<PlanConstraints, "latestEndTime">;
  agentPrompt: string;
  searchDefaults: {
    query: string;
    maxPrice?: number;
    maxDistanceKm: number;
  };
  happenings: Happening[];
  places: Place[];
  demoHappeningIds: string[];
  demoInitialPlanIds: string[];
  demoStarts: Record<string, string>;
  repairHappeningIds: string[];
  placeFallbackPlan: Array<{ placeId: string; purpose: PlacePurpose; localTime: string }>;
  snapshotLabel: string;
};

const definitions: Record<CityId, CityDefinition> = {
  stockholm: {
    id: "stockholm",
    name: "Stockholm",
    timeZone: "Europe/Stockholm",
    locale: "en-SE",
    currency: "SEK",
    mapCenter: [18.071, 59.325],
    mapZoom: 12.35,
    constraints: {
      currency: "SEK",
      partySize: 2,
      startLocation: { lat: 59.319, lng: 18.072, label: "Slussen" },
    },
    agentPrompt: "Build a surprising night near Slussen for two, done by midnight.",
    searchDefaults: {
      query: "unexpected music",
      maxDistanceKm: 8,
    },
    happenings,
    places: stockholmPlaces,
    demoHappeningIds,
    demoInitialPlanIds,
    demoStarts: {
      "ukraine-festival": "2026-08-30T18:00:00+02:00",
      "weeping-willows": "2026-08-30T19:30:00+02:00",
      "montelius-night-walk": "2026-08-30T22:00:00+02:00",
    },
    repairHappeningIds: ["forro-dance", "fringe-closing", "ruby-wax", "fotografiska-late"],
    placeFallbackPlan: [
      { placeId: "sthlm-bar-central", purpose: "dinner", localTime: "18:00:00" },
      { placeId: "sthlm-stigbergets-fot", purpose: "drinks", localTime: "20:00:00" },
    ],
    snapshotLabel: "48 source-backed Stockholm happenings",
  },
  "san-francisco": {
    id: "san-francisco",
    name: "San Francisco",
    timeZone: "America/Los_Angeles",
    locale: "en-US",
    currency: "USD",
    mapCenter: [-122.438, 37.774],
    mapZoom: 12,
    constraints: {
      currency: "USD",
      partySize: 2,
      startLocation: { lat: 37.7599, lng: -122.4148, label: "Mission" },
    },
    agentPrompt: "Build an unexpected San Francisco night near Mission for two, done by midnight.",
    searchDefaults: {
      query: "local music",
      maxDistanceKm: 12,
    },
    happenings: sanFranciscoHappenings,
    places: sanFranciscoPlaces,
    demoHappeningIds: sanFranciscoDemoHappeningIds,
    demoInitialPlanIds: sanFranciscoDemoInitialPlanIds,
    demoStarts: {
      "sf-crucial-reggae": "2026-08-30T16:30:00-07:00",
      "sf-haight-laughsbury": "2026-08-30T19:15:00-07:00",
      "sf-sindustry": "2026-08-30T21:15:00-07:00",
    },
    repairHappeningIds: ["sf-bird-beckett-jam", "sf-dear-san-francisco", "sf-hamburger-eyes"],
    placeFallbackPlan: [
      { placeId: "sf-horsefeather", purpose: "dinner", localTime: "18:00:00" },
      { placeId: "sf-the-page", purpose: "drinks", localTime: "20:00:00" },
    ],
    snapshotLabel: "12 source-backed San Francisco happenings",
  },
};

export const cityIds = Object.keys(definitions) as CityId[];

export const getCityDefinition = (cityId: CityId) => definitions[cityId];
