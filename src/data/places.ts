import type { OpeningInterval, Place, PlaceKind, PlacePurpose, Weekday } from "../domain/types";
import { sanFranciscoPlaceExpansion, stockholmPlaceExpansion } from "./placeExpansion";

const verifiedAt = "2026-09-01T10:00:00Z";
const weekdays: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const hours = (opensAt: string, closesAt: string, closesNextDay = false) =>
  Object.fromEntries(weekdays.map((day) => [day, [{ opensAt, closesAt, closesNextDay }]])) as Record<Weekday, OpeningInterval[]>;

type SeedPrice = Omit<Place["priceRange"], "band" | "evidence" | "evidenceUrl"> & Partial<Pick<Place["priceRange"], "band" | "evidence" | "evidenceUrl">>;
type PlaceSeed = Omit<Place, "officialWebsite" | "openingHoursEvidence" | "priceRange"> & {
  officialWebsite?: string;
  openingHoursEvidence?: Place["openingHoursEvidence"];
  priceRange: SeedPrice;
};
const priceBand = (price: SeedPrice) => {
  if (price.max === undefined) return "unknown" as const;
  if (price.currency === "SEK") return price.max <= 250 ? "budget" as const : price.max <= 500 ? "moderate" as const : "premium" as const;
  return price.max <= 25 ? "budget" as const : price.max <= 65 ? "moderate" as const : "premium" as const;
};
const place = (seed: PlaceSeed): Place => {
  const officialWebsite = seed.officialWebsite ?? seed.provenance[0]?.url;
  const menuSource = seed.provenance.find((entry) => entry.fields.includes("menu prices"));
  return {
    ...seed,
    officialWebsite,
    priceRange: {
      ...seed.priceRange,
      band: seed.priceRange.band ?? priceBand(seed.priceRange),
      evidence: seed.priceRange.evidence ?? (menuSource ? "official_menu" : "unknown"),
      evidenceUrl: seed.priceRange.evidenceUrl ?? menuSource?.url,
    },
    openingHoursEvidence: seed.openingHoursEvidence ?? {
      status: Object.keys(seed.weeklyHours).length ? "verified" : "unknown",
      sourceUrl: Object.keys(seed.weeklyHours).length ? officialWebsite : undefined,
      checkedAt: verifiedAt,
    },
  };
};
const source = (name: string, url: string, fields: string[]) => ({ name, url, fields, fetchedAt: verifiedAt });
const evidence = (claim: string, sourceUrl: string) => ({ claim, sourceUrl });

const stockholmReview = (
  id: string,
  name: string,
  kind: PlaceKind,
  lat: number,
  lng: number,
  address: string,
  neighborhood: string,
  sourceUrl: string,
  bestFor: PlacePurpose[],
  claim: string,
): Place => place({
  id, cityId: "stockholm", name, kind,
  location: { lat, lng, address, neighborhood },
  cuisine: [], drinkFocus: [], moodTags: ["evening", "local"],
  whyInteresting: [evidence(claim, sourceUrl)], bestFor,
  typicalVisitDurationMinutes: 90,
  priceRange: { currency: "SEK", basis: "per_person" },
  weeklyHours: {}, exceptionalHours: { status: "unknown" }, reservationMode: "unknown",
  provenance: [source(`${name} official site`, sourceUrl, ["name", "address", "place kind", "why interesting"])],
  verification: { status: "needs_review", verifiedAt, note: "Weekly hours and per-person price range were not available in a stable structured form from the official page." },
});

const stockholmSeedPlaces: Place[] = [
  place({
    id: "sthlm-tjoget", cityId: "stockholm", name: "Tjoget", kind: "cocktail_lounge",
    location: { lat: 59.3156, lng: 18.0343, address: "Hornsbruksgatan 24", neighborhood: "Hornstull" },
    cuisine: ["Mediterranean"], drinkFocus: ["cocktails", "wine"], moodTags: ["lively", "designed", "social"],
    whyInteresting: [evidence("The official site combines Mediterranean food, cocktails and wine under one roof.", "https://tjoget.com/")],
    bestFor: ["dinner", "drinks", "late_drinks"], typicalVisitDurationMinutes: 105,
    priceRange: { min: 165, max: 490, currency: "SEK", basis: "per_person" },
    weeklyHours: {
      monday: [{ opensAt: "17:00", closesAt: "01:00", closesNextDay: true }],
      tuesday: [{ opensAt: "17:00", closesAt: "01:00", closesNextDay: true }],
      wednesday: [{ opensAt: "17:00", closesAt: "01:00", closesNextDay: true }],
      thursday: [{ opensAt: "17:00", closesAt: "01:00", closesNextDay: true }],
      friday: [{ opensAt: "16:00", closesAt: "03:00", closesNextDay: true }],
      saturday: [{ opensAt: "13:00", closesAt: "03:00", closesNextDay: true }],
      sunday: [{ opensAt: "17:00", closesAt: "01:00", closesNextDay: true }],
    },
    exceptionalHours: { status: "unknown", note: "Check the official site for holiday exceptions." },
    reservationMode: "available",
    provenance: [source("Tjoget official site", "https://tjoget.com/", ["address", "concept", "hours", "menu prices", "reservations"])],
    verification: { status: "verified", verifiedAt },
  }),
  place({
    id: "sthlm-pelikan", cityId: "stockholm", name: "Pelikan", kind: "restaurant",
    location: { lat: 59.3128, lng: 18.0795, address: "Blekingegatan 40", neighborhood: "Södermalm" },
    cuisine: ["Swedish"], drinkFocus: ["beer", "aquavit"], moodTags: ["historic", "classic", "convivial"],
    whyInteresting: [evidence("Pelikan describes itself as a classic Swedish restaurant in a historic dining hall.", "https://pelikan.se/en")],
    bestFor: ["dinner"], typicalVisitDurationMinutes: 120,
    priceRange: { min: 195, max: 425, currency: "SEK", basis: "per_person" },
    weeklyHours: hours("11:30", "01:00", true), exceptionalHours: { status: "unknown" },
    reservationMode: "recommended",
    provenance: [source("Pelikan official site", "https://pelikan.se/en", ["address", "cuisine", "hours", "reservation duration"]), source("Pelikan official menu", "https://pelikan.se/en/menu/", ["menu prices"])],
    verification: { status: "needs_review", verifiedAt, note: "The price range is menu-item based; exceptional hours remain unknown." },
  }),
  place({
    id: "sthlm-akkurat", cityId: "stockholm", name: "Akkurat", kind: "pub",
    location: { lat: 59.3182, lng: 18.0629, address: "Hornsgatan 18", neighborhood: "Södermalm" },
    cuisine: ["pub food"], drinkFocus: ["beer", "whisky"], moodTags: ["specialist", "relaxed", "late"],
    whyInteresting: [evidence("The official site centres beer and whisky alongside its restaurant menu.", "https://akkurat.se/")],
    bestFor: ["quick_bite", "drinks", "late_drinks"], typicalVisitDurationMinutes: 90,
    priceRange: { min: 165, max: 675, currency: "SEK", basis: "per_person" }, weeklyHours: {},
    exceptionalHours: { status: "unknown" }, reservationMode: "available",
    provenance: [source("Akkurat official site", "https://akkurat.se/", ["address", "drink focus"]), source("Akkurat official menu PDF", "https://akkurat.se/wp-content/uploads/2026/04/MENY-kvall-hemsida.pdf", ["menu prices", "late kitchen service"])],
    verification: { status: "needs_review", verifiedAt, note: "Weekly opening hours require confirmation before this record can be staged." },
  }),
  place({
    id: "sthlm-pharmarium", cityId: "stockholm", name: "Pharmarium", kind: "cocktail_lounge",
    location: { lat: 59.3252, lng: 18.0708, address: "Stortorget 7", neighborhood: "Gamla stan" },
    cuisine: [], drinkFocus: ["cocktails"], moodTags: ["intimate", "historic", "theatrical"],
    whyInteresting: [evidence("The official site connects its cocktail concept to the building's history as an early pharmacy.", "https://pharmarium.se/english/")],
    bestFor: ["drinks", "late_drinks"], typicalVisitDurationMinutes: 90,
    priceRange: { currency: "SEK", basis: "per_person" }, weeklyHours: {}, exceptionalHours: { status: "unknown" }, reservationMode: "available",
    provenance: [source("Pharmarium official site", "https://pharmarium.se/english/", ["address", "cocktail focus", "reservations", "why interesting"])],
    verification: { status: "needs_review", verifiedAt, note: "The page exposes today's hours rather than a stable weekly schedule and did not expose a current price range." },
  }),
  stockholmReview("sthlm-fasching", "Fasching", "music_bar", 59.3320, 18.0579, "Kungsgatan 63", "Norrmalm", "https://www.fasching.se/", ["drinks", "late_drinks"], "Fasching's official program presents a dedicated live-jazz venue and bar."),
  stockholmReview("sthlm-debaser", "Debaser Strand", "music_bar", 59.3141, 18.0340, "Hornsbruksgatan 4", "Hornstull", "https://debaser.se/", ["drinks", "late_drinks"], "Debaser's official site presents concerts, club nights and its bar at the waterfront venue."),
  stockholmReview("sthlm-sodra-teatern", "Södra Teatern", "bar", 59.3185, 18.0740, "Mosebacke Torg 1–3", "Södermalm", "https://sodrateatern.com/", ["drinks", "late_drinks"], "The official site combines stages, bars and views over Stockholm."),
  stockholmReview("sthlm-tradgarden", "Trädgården / Under Bron", "club", 59.3027, 18.0805, "Hammarby Slussväg 2", "Skanstull", "https://tradgarden.com/", ["drinks", "late_drinks"], "The official site presents a seasonal outdoor club and its year-round Under Bron space."),
];

const sfReview = (
  id: string, name: string, kind: PlaceKind, lat: number, lng: number, address: string,
  neighborhood: string, sourceUrl: string, bestFor: PlacePurpose[], claim: string,
): Place => place({
  id, cityId: "san-francisco", name, kind, location: { lat, lng, address, neighborhood },
  cuisine: [], drinkFocus: [], moodTags: ["evening", "local"], whyInteresting: [evidence(claim, sourceUrl)], bestFor,
  typicalVisitDurationMinutes: 90, priceRange: { currency: "USD", basis: "per_person" }, weeklyHours: {},
  exceptionalHours: { status: "unknown" }, reservationMode: "unknown",
  provenance: [source(`${name} official site`, sourceUrl, ["name", "address", "place kind", "why interesting"])],
  verification: { status: "needs_review", verifiedAt, note: "Weekly hours and per-person price range need confirmation from the official source." },
});

const sanFranciscoSeedPlaces: Place[] = [
  place({
    id: "sf-true-laurel", cityId: "san-francisco", name: "True Laurel", kind: "cocktail_lounge",
    location: { lat: 37.7576, lng: -122.4117, address: "753 Alabama Street", neighborhood: "Mission" },
    cuisine: ["California"], drinkFocus: ["cocktails"], moodTags: ["inventive", "warm", "neighborhood"],
    whyInteresting: [evidence("The official site pairs a cocktail program with a concise food menu in the Mission.", "https://www.truelaurelsf.com/")],
    bestFor: ["dinner", "quick_bite", "drinks", "late_drinks"], typicalVisitDurationMinutes: 90,
    priceRange: { min: 18, max: 38, currency: "USD", basis: "per_person" },
    weeklyHours: {
      tuesday: [{ opensAt: "16:00", closesAt: "22:00" }], wednesday: [{ opensAt: "16:00", closesAt: "22:00" }],
      thursday: [{ opensAt: "16:00", closesAt: "23:00" }], friday: [{ opensAt: "16:00", closesAt: "00:00", closesNextDay: true }],
      saturday: [{ opensAt: "11:00", closesAt: "00:00", closesNextDay: true }], sunday: [{ opensAt: "11:00", closesAt: "22:00" }],
    }, exceptionalHours: { status: "unknown" }, reservationMode: "available",
    provenance: [source("True Laurel official site", "https://www.truelaurelsf.com/", ["address", "hours", "concept"]), source("True Laurel official food menu", "https://truelaurelsf.com/menus/food.pdf", ["menu prices"]), source("True Laurel official cocktail menu", "https://truelaurelsf.com/menus/cocktails.pdf", ["drink focus", "cocktail prices"])],
    verification: { status: "verified", verifiedAt },
  }),
  place({
    id: "sf-trick-dog", cityId: "san-francisco", name: "Trick Dog", kind: "cocktail_lounge",
    location: { lat: 37.7608, lng: -122.4115, address: "3010 20th Street", neighborhood: "Mission" },
    cuisine: ["bar food"], drinkFocus: ["cocktails"], moodTags: ["playful", "lively", "late"],
    whyInteresting: [evidence("The official site foregrounds its changing cocktail menu and distinguishes food service from bar closing.", "https://www.trickdogbar.com/")],
    bestFor: ["quick_bite", "drinks", "late_drinks"], typicalVisitDurationMinutes: 90,
    priceRange: { min: 10, max: 25, currency: "USD", basis: "per_person" },
    weeklyHours: {
      monday: [{ opensAt: "16:00", closesAt: "00:00", closesNextDay: true }], tuesday: [{ opensAt: "16:00", closesAt: "00:00", closesNextDay: true }],
      wednesday: [{ opensAt: "16:00", closesAt: "00:00", closesNextDay: true }], thursday: [{ opensAt: "16:00", closesAt: "00:00", closesNextDay: true }],
      friday: [{ opensAt: "16:00", closesAt: "02:00", closesNextDay: true }], saturday: [{ opensAt: "16:00", closesAt: "02:00", closesNextDay: true }],
      sunday: [{ opensAt: "16:00", closesAt: "00:00", closesNextDay: true }],
    }, exceptionalHours: { status: "unknown" }, serviceTimes: {
      kitchenLastOrder: {
        monday: { type: "at", localTime: "22:00" }, tuesday: { type: "at", localTime: "22:00" },
        wednesday: { type: "at", localTime: "22:00" }, thursday: { type: "at", localTime: "22:00" },
        friday: { type: "at", localTime: "00:00" }, saturday: { type: "at", localTime: "00:00" }, sunday: { type: "at", localTime: "22:00" },
      }, barClosesWithVenue: true,
    }, reservationMode: "walk_in",
    provenance: [source("Trick Dog official site", "https://www.trickdogbar.com/", ["address", "hours", "food cutoff", "reservation mode", "concept"]), source("Trick Dog official menu PDF", "https://www.trickdogbar.com/gypsytan/wp-content/uploads/2023/10/TanTrickDog-0623-F-1.pdf", ["historic menu prices"])],
    verification: { status: "needs_review", verifiedAt, note: "Hours and service cutoffs are current; price range comes from an older official menu and should be refreshed." },
  }),
  place({
    id: "sf-foreign-cinema", cityId: "san-francisco", name: "Foreign Cinema", kind: "restaurant",
    location: { lat: 37.7569, lng: -122.4191, address: "2534 Mission Street", neighborhood: "Mission" },
    cuisine: ["California", "Mediterranean"], drinkFocus: ["wine", "cocktails"], moodTags: ["cinematic", "romantic", "courtyard"],
    whyInteresting: [evidence("The official site describes dining, film and hospitality as one experience.", "https://foreigncinema.com/")],
    bestFor: ["dinner"], typicalVisitDurationMinutes: 120, priceRange: { min: 60, max: 74, currency: "USD", basis: "per_person" },
    weeklyHours: {
      monday: [{ opensAt: "17:00", closesAt: "21:30" }], tuesday: [{ opensAt: "17:00", closesAt: "21:30" }],
      wednesday: [{ opensAt: "17:00", closesAt: "21:30" }], thursday: [{ opensAt: "17:00", closesAt: "21:30" }],
      friday: [{ opensAt: "17:00", closesAt: "22:00" }], saturday: [{ opensAt: "17:00", closesAt: "22:00" }], sunday: [{ opensAt: "17:00", closesAt: "21:00" }],
    }, exceptionalHours: { status: "unknown" }, reservationMode: "recommended",
    provenance: [source("Foreign Cinema official site", "https://foreigncinema.com/location-hours/", ["address", "dinner hours", "reservations", "concept"]), source("Foreign Cinema official dinner menu", "https://foreigncinema.com/wp-content/uploads/Copy-of-Dinner-02.21.25-.pdf", ["menu prices"])],
    verification: { status: "needs_review", verifiedAt, note: "The official menu price evidence is a dated snapshot; current prices should be refreshed." },
  }),
  place({
    id: "sf-zeitgeist", cityId: "san-francisco", name: "Zeitgeist", kind: "bar",
    location: { lat: 37.7700, lng: -122.4222, address: "199 Valencia Street", neighborhood: "Mission" },
    cuisine: ["bar food"], drinkFocus: ["beer"], moodTags: ["outdoor", "casual", "social"],
    whyInteresting: [evidence("The official site presents its beer garden and first-come-first-served service.", "https://www.zeitgeistsf.com/")],
    bestFor: ["quick_bite", "drinks", "late_drinks"], typicalVisitDurationMinutes: 75,
    priceRange: { currency: "USD", basis: "per_person" },
    weeklyHours: {
      monday: [{ opensAt: "14:00", closesAt: "23:00" }], tuesday: [{ opensAt: "14:00", closesAt: "23:00" }], wednesday: [{ opensAt: "14:00", closesAt: "23:00" }],
      thursday: [{ opensAt: "14:00", closesAt: "00:00", closesNextDay: true }], friday: [{ opensAt: "14:00", closesAt: "01:00", closesNextDay: true }],
      saturday: [{ opensAt: "12:00", closesAt: "01:00", closesNextDay: true }], sunday: [{ opensAt: "11:00", closesAt: "21:30" }],
    }, exceptionalHours: { status: "unknown" }, serviceTimes: {
      kitchenLastOrder: Object.fromEntries(weekdays.map((day) => [day, { type: "before_close", minutes: 60 }])) as Record<Weekday, { type: "before_close"; minutes: number }>,
      barClosesWithVenue: true,
    }, reservationMode: "walk_in",
    provenance: [source("Zeitgeist official site", "https://www.zeitgeistsf.com/", ["address", "hours", "kitchen cutoff", "reservation mode", "concept"])],
    verification: { status: "needs_review", verifiedAt, note: "A current per-person price range was not exposed by the official page." },
  }),
  place({
    id: "sf-vesuvio", cityId: "san-francisco", name: "Vesuvio Cafe", kind: "bar",
    location: { lat: 37.7980, lng: -122.4062, address: "255 Columbus Avenue", neighborhood: "North Beach" },
    cuisine: [], drinkFocus: ["cocktails", "wine", "beer"], moodTags: ["historic", "literary", "casual"],
    whyInteresting: [evidence("The official site connects the bar to North Beach's literary history.", "https://vesuvio.com/")],
    bestFor: ["drinks", "late_drinks"], typicalVisitDurationMinutes: 75,
    priceRange: { min: 5, max: 13, currency: "USD", basis: "per_person" },
    weeklyHours: {
      monday: [{ opensAt: "11:00", closesAt: "01:00", closesNextDay: true }],
      tuesday: [{ opensAt: "11:00", closesAt: "01:00", closesNextDay: true }],
      wednesday: [{ opensAt: "11:00", closesAt: "01:00", closesNextDay: true }],
      thursday: [{ opensAt: "11:00", closesAt: "01:00", closesNextDay: true }],
      friday: [{ opensAt: "11:00", closesAt: "02:00", closesNextDay: true }],
      saturday: [{ opensAt: "11:00", closesAt: "02:00", closesNextDay: true }],
      sunday: [{ opensAt: "11:00", closesAt: "01:00", closesNextDay: true }],
    },
    exceptionalHours: { status: "unknown" }, reservationMode: "walk_in",
    provenance: [
      source("Vesuvio official site", "https://vesuvio.com/", ["address", "hours", "history"]),
      source("Vesuvio official drinks menu", "https://vesuvio.com/drinks/", ["menu prices", "drink focus"]),
    ],
    verification: { status: "needs_review", verifiedAt, note: "Official weekly hours and menu prices were captured; date-specific exceptions remain unknown." },
  }),
  sfReview("sf-madrone", "Madrone Art Bar", "music_bar", 37.7742, -122.4379, "500 Divisadero Street", "NoPa", "https://madroneartbar.com/", ["drinks", "late_drinks"], "The official site presents a neighborhood bar built around music, art and dancing."),
  sfReview("sf-the-saloon", "The Saloon", "music_bar", 37.7986, -122.4072, "1232 Grant Avenue", "North Beach", "https://thesaloonsf.com/", ["drinks", "late_drinks"], "The official site presents daily live music in a historic North Beach saloon."),
  sfReview("sf-el-rio", "El Rio", "club", 37.7468, -122.4195, "3158 Mission Street", "Bernal Heights", "https://www.elriosf.com/", ["drinks", "late_drinks"], "The official site presents a community-oriented bar, patio and performance space."),
];

export const stockholmPlaces: Place[] = [...stockholmSeedPlaces, ...stockholmPlaceExpansion];
export const sanFranciscoPlaces: Place[] = [...sanFranciscoSeedPlaces, ...sanFranciscoPlaceExpansion];
