import type { CityId, CurrencyCode, OpeningInterval, Place, PlaceKind, PlacePurpose, Weekday } from "../domain/types";

const checkedAt = "2026-09-01T12:00:00Z";
const days: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const everyDay = (opensAt: string, closesAt: string, closesNextDay = false) =>
  Object.fromEntries(days.map((day) => [day, [{ opensAt, closesAt, closesNextDay }]])) as Record<Weekday, OpeningInterval[]>;
const weekly = (...entries: Array<[Weekday[], string, string, boolean?]>): Place["weeklyHours"] =>
  Object.fromEntries(entries.flatMap(([entryDays, opensAt, closesAt, closesNextDay = false]) =>
    entryDays.map((day) => [day, [{ opensAt, closesAt, closesNextDay }]]),
  ));

type QualifiedOperations = {
  price: [number, number];
  weeklyHours: Place["weeklyHours"];
  serviceTimes?: Place["serviceTimes"];
  reservationMode: Place["reservationMode"];
};

// Only records in this table publish numeric operating claims. Each entry was
// checked against the linked official page on the snapshot date. Other seed
// hints remain discovery-only and are emitted with explicit unknown fields.
const qualifiedOperations: Record<string, QualifiedOperations> = {
  "sthlm-surfers": {
    price: [129, 479],
    weeklyHours: weekly(
      [["monday", "tuesday"], "17:00", "23:00"],
      [["wednesday", "thursday"], "17:00", "00:00", true],
      [["friday"], "17:00", "01:00", true],
      [["saturday"], "16:00", "01:00", true],
    ),
    reservationMode: "recommended",
  },
  "sthlm-stigbergets-fot": {
    price: [119, 185],
    weeklyHours: weekly(
      [["monday", "tuesday"], "16:00", "00:00", true],
      [["wednesday", "thursday"], "11:30", "00:00", true],
      [["friday"], "11:30", "01:00", true],
      [["saturday"], "12:00", "01:00", true],
      [["sunday"], "12:00", "00:00", true],
    ),
    reservationMode: "available",
  },
  "sthlm-bar-central": {
    price: [85, 375],
    weeklyHours: weekly(
      [["sunday", "monday", "tuesday"], "16:00", "22:00"],
      [["wednesday", "thursday"], "16:00", "23:00"],
      [["friday", "saturday"], "16:00", "00:30", true],
    ),
    reservationMode: "available",
  },
  "sf-horsefeather": {
    price: [8, 33],
    weeklyHours: weekly(
      [["monday", "tuesday", "wednesday", "thursday"], "14:00", "00:00", true],
      [["friday"], "14:00", "02:00", true],
      [["saturday"], "11:00", "02:00", true],
      [["sunday"], "11:00", "00:00", true],
    ),
    serviceTimes: {
      kitchenLastOrder: {
        monday: { type: "at", localTime: "23:30" }, tuesday: { type: "at", localTime: "23:30" },
        wednesday: { type: "at", localTime: "23:30" }, thursday: { type: "at", localTime: "23:30" },
        friday: { type: "at", localTime: "01:00" }, saturday: { type: "at", localTime: "01:00" },
        sunday: { type: "at", localTime: "23:30" },
      },
      barClosesWithVenue: true,
    },
    reservationMode: "recommended",
  },
  "sf-the-page": {
    price: [5, 23],
    weeklyHours: everyDay("16:00", "02:00", true),
    reservationMode: "walk_in",
  },
  "sf-tosca-cafe": {
    price: [10, 63],
    weeklyHours: weekly(
      [["tuesday", "wednesday"], "17:00", "22:00"],
      [["thursday", "friday", "saturday"], "17:00", "23:00"],
    ),
    reservationMode: "recommended",
  },
  "sf-red-window": {
    price: [6, 29],
    weeklyHours: weekly(
      [["monday", "tuesday", "wednesday", "thursday"], "16:00", "21:00"],
      [["friday"], "16:00", "23:00"],
      [["saturday"], "10:00", "23:00"],
      [["sunday"], "10:00", "21:00"],
    ),
    reservationMode: "available",
  },
};

type ExpansionSeed = {
  id: string;
  cityId: CityId;
  name: string;
  kind: PlaceKind;
  lat: number;
  lng: number;
  address: string;
  neighborhood: string;
  officialWebsite: string;
  editorialUrl: string;
  focus: string;
  cuisine?: string[];
  drinks?: string[];
  moods: string[];
  bestFor: PlacePurpose[];
  duration?: number;
  band: Place["priceRange"]["band"];
  price?: [number, number];
  currency: CurrencyCode;
  hours?: [string, string, boolean?];
  reservation?: Place["reservationMode"];
};

const expandedPlace = (seed: ExpansionSeed): Place => {
  const operations = qualifiedOperations[seed.id];
  const weeklyHours = operations?.weeklyHours ?? {};
  return {
    id: seed.id,
    cityId: seed.cityId,
    name: seed.name,
    officialWebsite: seed.officialWebsite,
    kind: seed.kind,
    location: { lat: seed.lat, lng: seed.lng, address: seed.address, neighborhood: seed.neighborhood },
    cuisine: seed.cuisine ?? [],
    drinkFocus: seed.drinks ?? [],
    moodTags: seed.moods,
    whyInteresting: [{ claim: seed.focus, sourceUrl: seed.officialWebsite }],
    bestFor: seed.bestFor,
    typicalVisitDurationMinutes: seed.duration ?? 90,
    priceRange: {
      min: operations?.price[0], max: operations?.price[1], currency: seed.currency, basis: "per_person",
      band: seed.band, evidence: operations ? "official_menu" : "unknown", evidenceUrl: operations ? seed.officialWebsite : undefined,
    },
    weeklyHours,
    openingHoursEvidence: { status: operations ? "verified" : "unknown", sourceUrl: operations ? seed.officialWebsite : undefined, checkedAt },
    exceptionalHours: { status: "unknown", note: "Check the official site for date-specific exceptions." },
    serviceTimes: operations?.serviceTimes,
    reservationMode: operations?.reservationMode ?? seed.reservation ?? "unknown",
    provenance: [
      { name: seed.cityId === "stockholm" ? "Visit Stockholm editorial qualification" : "SF Travel controlled discovery", url: seed.editorialUrl, fields: ["editorial qualification", "evening use"], fetchedAt: checkedAt },
      { name: `${seed.name} official site`, url: seed.officialWebsite, fields: ["identity", "address", "concept", ...(operations ? ["weekly hours", "menu prices", "reservation mode"] : [])], fetchedAt: checkedAt },
    ],
    verification: {
      status: "needs_review", verifiedAt: checkedAt,
      note: operations
        ? "Official operating and menu evidence captured; exceptional hours still require a date-specific check."
        : "Qualified for evening discovery; missing operational fields remain explicit and block canonical staging.",
    },
  };
};

const stockholmEditorial = "https://www.visitstockholm.com/eat-drink/nightlife/";
const stockholmCocktails = "https://www.visitstockholm.com/eat-drink/nightlife/creative-cocktail-bars/";
const stockholmWine = "https://www.visitstockholm.com/eat-drink/nightlife/wine-bars-in-stockholm/";

export const stockholmPlaceExpansion: Place[] = [
  expandedPlace({ id: "sthlm-roda-huset", cityId: "stockholm", name: "Röda Huset", kind: "cocktail_lounge", lat: 59.3334, lng: 18.0655, address: "Malmskillnadsgatan 9", neighborhood: "Norrmalm", officialWebsite: "https://rodahusetsthlm.se/", editorialUrl: stockholmCocktails, focus: "The official bar presents seasonal Swedish ingredients through a dedicated cocktail program.", drinks: ["cocktails"], moods: ["inventive", "urban", "special-occasion"], bestFor: ["drinks", "late_drinks"], band: "premium", price: [165, 230], currency: "SEK", hours: ["16:00", "01:00", true], reservation: "available" }),
  expandedPlace({ id: "sthlm-gemma", cityId: "stockholm", name: "A Bar Called Gemma", kind: "cocktail_lounge", lat: 59.3386, lng: 18.0809, address: "Grev Turegatan 30", neighborhood: "Östermalm", officialWebsite: "https://abarcalledgemma.se/", editorialUrl: stockholmCocktails, focus: "The official site centers a bartender-led cocktail bar with a compact, conversational room.", drinks: ["cocktails"], moods: ["intimate", "polished", "conversational"], bestFor: ["drinks", "late_drinks"], band: "premium", price: [165, 225], currency: "SEK", hours: ["16:00", "01:00", true], reservation: "available" }),
  expandedPlace({ id: "sthlm-herno-gin-bar", cityId: "stockholm", name: "Hernö Gin Bar", kind: "cocktail_lounge", lat: 59.3203, lng: 18.0701, address: "Hornsgatan 1", neighborhood: "Södermalm", officialWebsite: "https://hernoginbar.com/", editorialUrl: stockholmCocktails, focus: "The distiller's official bar is built around Swedish gin cocktails and a food menu.", cuisine: ["Nordic"], drinks: ["gin", "cocktails"], moods: ["focused", "warm", "crafted"], bestFor: ["quick_bite", "drinks", "late_drinks"], band: "moderate", price: [145, 395], currency: "SEK", hours: ["16:00", "00:00", true], reservation: "available" }),
  expandedPlace({ id: "sthlm-tiki-room", cityId: "stockholm", name: "Tiki Room", kind: "cocktail_lounge", lat: 59.3236, lng: 18.0697, address: "Mälartorget 15", neighborhood: "Gamla stan", officialWebsite: "https://tikiroom.se/", editorialUrl: stockholmCocktails, focus: "The official site presents a basement tiki bar devoted to tropical cocktails.", drinks: ["tropical cocktails", "rum"], moods: ["playful", "transportive", "late"], bestFor: ["drinks", "late_drinks"], band: "moderate", price: [155, 215], currency: "SEK", hours: ["17:00", "01:00", true], reservation: "available" }),
  expandedPlace({ id: "sthlm-surfers", cityId: "stockholm", name: "Surfers Stockholm", kind: "restaurant", lat: 59.3348, lng: 18.0727, address: "Norrlandsgatan 24", neighborhood: "Norrmalm", officialWebsite: "https://surfersstockholm.se/", editorialUrl: stockholmCocktails, focus: "The official restaurant pairs Sichuan small plates with a lively cocktail-led dining room.", cuisine: ["Sichuan"], drinks: ["cocktails"], moods: ["lively", "sharing", "colorful"], bestFor: ["dinner", "drinks"], band: "moderate", price: [295, 525], currency: "SEK", hours: ["17:00", "00:00", true], reservation: "recommended" }),
  expandedPlace({ id: "sthlm-bar-ninja", cityId: "stockholm", name: "Bar Ninja", kind: "wine_bar", lat: 59.3128, lng: 18.0738, address: "Björngårdsgatan 1", neighborhood: "Södermalm", officialWebsite: "https://barninja.se/", editorialUrl: stockholmWine, focus: "The official site presents natural wine, small plates and guest-led selections.", cuisine: ["small plates"], drinks: ["natural wine"], moods: ["casual", "curious", "social"], bestFor: ["quick_bite", "drinks"], band: "moderate", price: [145, 395], currency: "SEK", hours: ["16:00", "00:00", true], reservation: "walk_in" }),
  expandedPlace({ id: "sthlm-tyge-sessil", cityId: "stockholm", name: "Tyge & Sessil", kind: "wine_bar", lat: 59.3376, lng: 18.0780, address: "Brahegatan 4", neighborhood: "Östermalm", officialWebsite: "https://tygesessil.se/", editorialUrl: stockholmWine, focus: "The official site focuses on grower-led wine and a concise seasonal food menu.", cuisine: ["small plates"], drinks: ["wine"], moods: ["intimate", "knowledgeable", "calm"], bestFor: ["quick_bite", "drinks"], band: "moderate", price: [150, 420], currency: "SEK", hours: ["16:00", "00:00", true], reservation: "available" }),
  expandedPlace({ id: "sthlm-omnipollos-hatt", cityId: "stockholm", name: "Omnipollos Hatt", kind: "pub", lat: 59.3187, lng: 18.0745, address: "Hökens gata 1A", neighborhood: "Södermalm", officialWebsite: "https://www.omnipolloshatt.com/", editorialUrl: stockholmEditorial, focus: "The brewery's official venue pairs experimental beer with its own pizza kitchen.", cuisine: ["pizza"], drinks: ["craft beer"], moods: ["casual", "quirky", "compact"], bestFor: ["quick_bite", "dinner", "drinks"], band: "budget", price: [125, 245], currency: "SEK", hours: ["16:00", "00:00", true], reservation: "walk_in" }),
  expandedPlace({ id: "sthlm-stigbergets-fot", cityId: "stockholm", name: "Stigbergets Fot", kind: "pub", lat: 59.3195, lng: 18.0741, address: "Götgatan 5", neighborhood: "Södermalm", officialWebsite: "https://stigbergetsfot.se/", editorialUrl: stockholmEditorial, focus: "The brewery bar's official site combines rotating taps with a full evening kitchen.", cuisine: ["Nordic pub food"], drinks: ["craft beer"], moods: ["relaxed", "beer-focused", "social"], bestFor: ["dinner", "quick_bite", "drinks"], band: "moderate", price: [155, 345], currency: "SEK", hours: ["16:00", "01:00", true], reservation: "available" }),
  expandedPlace({ id: "sthlm-soldaten-svejk", cityId: "stockholm", name: "Soldaten Švejk", kind: "pub", lat: 59.3115, lng: 18.0810, address: "Östgötagatan 35", neighborhood: "Södermalm", officialWebsite: "https://soldatensvejk.se/", editorialUrl: stockholmEditorial, focus: "The official site presents Czech beer and Czech cooking in a long-running neighborhood pub.", cuisine: ["Czech"], drinks: ["Czech beer"], moods: ["unfussy", "convivial", "classic"], bestFor: ["dinner", "quick_bite", "drinks"], band: "budget", price: [155, 295], currency: "SEK", hours: ["15:00", "00:00", true], reservation: "available" }),
  expandedPlace({ id: "sthlm-lilla-ego", cityId: "stockholm", name: "Lilla Ego", kind: "restaurant", lat: 59.3408, lng: 18.0388, address: "Västmannagatan 69", neighborhood: "Vasastan", officialWebsite: "https://lillaego.com/", editorialUrl: "https://www.visitstockholm.com/eat-drink/restaurants/", focus: "The official restaurant presents a compact Swedish dining room with an open kitchen and changing menu.", cuisine: ["modern Swedish"], drinks: ["wine"], moods: ["lively", "chef-led", "special-occasion"], bestFor: ["dinner"], band: "premium", price: [395, 795], currency: "SEK", hours: ["17:00", "00:00", true], reservation: "required" }),
  expandedPlace({ id: "sthlm-babette", cityId: "stockholm", name: "Babette", kind: "wine_bar", lat: 59.3431, lng: 18.0604, address: "Roslagsgatan 6", neighborhood: "Vasastan", officialWebsite: "https://babette.se/", editorialUrl: stockholmWine, focus: "The official site combines pizza, seasonal plates and wine in a neighborhood room.", cuisine: ["pizza", "European"], drinks: ["wine"], moods: ["neighborhood", "buzzy", "relaxed"], bestFor: ["dinner", "quick_bite", "drinks"], band: "moderate", price: [175, 395], currency: "SEK", hours: ["16:00", "00:00", true], reservation: "recommended" }),
  expandedPlace({ id: "sthlm-cafe-nizza", cityId: "stockholm", name: "Café Nizza", kind: "restaurant", lat: 59.3136, lng: 18.0861, address: "Åsögatan 171", neighborhood: "Södermalm", officialWebsite: "https://cafenizza.se/", editorialUrl: "https://www.visitstockholm.com/eat-drink/restaurants/", focus: "The official site presents a European neighborhood restaurant with an evening wine focus.", cuisine: ["European"], drinks: ["wine"], moods: ["neighborhood", "warm", "date-night"], bestFor: ["dinner", "drinks"], band: "moderate", price: [225, 525], currency: "SEK", hours: ["17:00", "00:00", true], reservation: "recommended" }),
  expandedPlace({ id: "sthlm-woodstockholm", cityId: "stockholm", name: "Woodstockholm", kind: "restaurant", lat: 59.3130, lng: 18.0819, address: "Mosebacke Torg 9", neighborhood: "Södermalm", officialWebsite: "https://woodstockholm.com/", editorialUrl: "https://www.visitstockholm.com/eat-drink/restaurants/", focus: "The official restaurant revolves around changing themes, shared plates and a wine-led bar.", cuisine: ["seasonal"], drinks: ["wine"], moods: ["creative", "intimate", "surprising"], bestFor: ["dinner", "drinks"], band: "premium", price: [395, 795], currency: "SEK", hours: ["17:00", "00:00", true], reservation: "recommended" }),
  expandedPlace({ id: "sthlm-bar-central", cityId: "stockholm", name: "Bar Central", kind: "wine_bar", lat: 59.3182, lng: 18.0450, address: "Hornsgatan 72", neighborhood: "Södermalm", officialWebsite: "https://barcentral.se/", editorialUrl: stockholmWine, focus: "The official site draws on Central European food, beer and wine for a flexible pre-show stop.", cuisine: ["Central European"], drinks: ["wine", "beer"], moods: ["bustling", "classic", "flexible"], bestFor: ["dinner", "quick_bite", "drinks"], band: "moderate", price: [85, 375], currency: "SEK", reservation: "available" }),
  expandedPlace({ id: "sthlm-berns", cityId: "stockholm", name: "Berns", kind: "club", lat: 59.3324, lng: 18.0746, address: "Berzelii Park", neighborhood: "Norrmalm", officialWebsite: "https://berns.se/", editorialUrl: "https://www.visitstockholm.com/eat-drink/nightlife/clubbing-in-stockholm-a-primer/", focus: "The official site combines historic rooms, bars, dining and late club programming.", cuisine: ["Asian"], drinks: ["cocktails"], moods: ["grand", "late", "dress-up"], bestFor: ["dinner", "drinks", "late_drinks"], band: "premium", currency: "SEK" }),
  expandedPlace({ id: "sthlm-banankompaniet", cityId: "stockholm", name: "Banankompaniet", kind: "club", lat: 59.3509, lng: 18.1122, address: "Frihamnsgatan 24", neighborhood: "Frihamnen", officialWebsite: "https://banankompaniet.com/", editorialUrl: "https://www.visitstockholm.com/eat-drink/nightlife/clubbing-in-stockholm-a-primer/", focus: "The official venue presents large club rooms, multiple bars and seasonal outdoor space in a former warehouse.", drinks: ["beer", "cocktails"], moods: ["large-scale", "dance", "industrial"], bestFor: ["drinks", "late_drinks"], band: "moderate", currency: "SEK" }),
  expandedPlace({ id: "sthlm-ambar", cityId: "stockholm", name: "Ambar", kind: "wine_bar", lat: 59.3399, lng: 18.0335, address: "Tomtebogatan 22", neighborhood: "Vasastan", officialWebsite: "https://ambarstockholm.se/", editorialUrl: stockholmWine, focus: "The official bar specializes in amber-colored drinks alongside Japanese-influenced small plates.", cuisine: ["Japanese small plates"], drinks: ["orange wine", "rum", "brandy"], moods: ["niche", "cozy", "curious"], bestFor: ["quick_bite", "drinks"], band: "moderate", currency: "SEK" }),
  expandedPlace({ id: "sthlm-folii", cityId: "stockholm", name: "Folii", kind: "wine_bar", lat: 59.3139, lng: 18.0911, address: "Erstagatan 21", neighborhood: "Södermalm", officialWebsite: "https://folii.se/", editorialUrl: stockholmWine, focus: "The official site presents a neighborhood wine bar with changing glasses and seasonal dishes.", cuisine: ["small plates"], drinks: ["wine"], moods: ["cozy", "knowledgeable", "neighborhood"], bestFor: ["quick_bite", "drinks"], band: "moderate", currency: "SEK" }),
  expandedPlace({ id: "sthlm-vina", cityId: "stockholm", name: "Vina", kind: "wine_bar", lat: 59.3121, lng: 18.0924, address: "Sofiagatan 1", neighborhood: "Södermalm", officialWebsite: "https://vina.se/", editorialUrl: stockholmWine, focus: "The official site pairs a rotating wine list with a compact dinner menu.", cuisine: ["European"], drinks: ["wine"], moods: ["intimate", "easygoing", "date-night"], bestFor: ["dinner", "drinks"], band: "moderate", currency: "SEK" }),
  expandedPlace({ id: "sthlm-nektar", cityId: "stockholm", name: "Nektar Mat & Vin", kind: "wine_bar", lat: 59.3400, lng: 18.0371, address: "Rörstrandsgatan 12", neighborhood: "Vasastan", officialWebsite: "https://nektarmatvin.se/", editorialUrl: stockholmWine, focus: "The official restaurant centers wine and seasonal plates in a neighborhood setting.", cuisine: ["seasonal"], drinks: ["wine"], moods: ["warm", "neighborhood", "food-led"], bestFor: ["dinner", "drinks"], band: "moderate", currency: "SEK" }),
  expandedPlace({ id: "sthlm-savant", cityId: "stockholm", name: "Savant Bar", kind: "wine_bar", lat: 59.3407, lng: 18.0542, address: "Tegnérgatan 4", neighborhood: "Norrmalm", officialWebsite: "https://savantbar.se/", editorialUrl: stockholmWine, focus: "The official bar combines natural wine, coffee craft and a small evening food offer.", cuisine: ["small plates"], drinks: ["natural wine"], moods: ["minimal", "curious", "low-key"], bestFor: ["quick_bite", "drinks"], band: "moderate", currency: "SEK" }),
  expandedPlace({ id: "sthlm-alba", cityId: "stockholm", name: "Alba Vinbar", kind: "wine_bar", lat: 59.3118, lng: 18.0756, address: "Skånegatan 88", neighborhood: "Södermalm", officialWebsite: "https://albavinbar.se/", editorialUrl: stockholmWine, focus: "The official site presents a small natural-wine bar with plates designed for sharing.", cuisine: ["small plates"], drinks: ["natural wine"], moods: ["intimate", "casual", "buzzy"], bestFor: ["quick_bite", "drinks"], band: "moderate", currency: "SEK" }),
  expandedPlace({ id: "sthlm-brannerian", cityId: "stockholm", name: "Brännerian", kind: "cocktail_lounge", lat: 59.3067, lng: 18.0645, address: "Folkungagatan 136A", neighborhood: "Södermalm", officialWebsite: "https://stockholmsbranneri.com/pages/brannerian", editorialUrl: stockholmCocktails, focus: "Stockholms Bränneri's official bar builds cocktails around spirits distilled on site.", drinks: ["gin", "aquavit", "cocktails"], moods: ["industrial", "local", "crafted"], bestFor: ["drinks", "late_drinks"], band: "moderate", currency: "SEK" }),
  expandedPlace({ id: "sthlm-coquetel-social", cityId: "stockholm", name: "Coquetel Social", kind: "cocktail_lounge", lat: 59.3359, lng: 18.0737, address: "Birger Jarlsgatan 20", neighborhood: "Norrmalm", officialWebsite: "https://coquetelsocial.se/", editorialUrl: stockholmCocktails, focus: "The official site presents a social cocktail bar with table service and late-evening energy.", drinks: ["cocktails"], moods: ["polished", "social", "late"], bestFor: ["drinks", "late_drinks"], band: "premium", currency: "SEK" }),
];

const sfEditorial = "https://www.sftravel.com/article/san-francisco-nightlife-neighborhood";
const sfBarHopping = "https://www.sftravel.com/article/best-streets-bar-hopping-san-francisco";

export const sanFranciscoPlaceExpansion: Place[] = [
  expandedPlace({ id: "sf-abv", cityId: "san-francisco", name: "ABV", kind: "cocktail_lounge", lat: 37.7647, lng: -122.4234, address: "3174 16th Street", neighborhood: "Mission", officialWebsite: "https://www.abvsf.com/", editorialUrl: sfBarHopping, focus: "The official site pairs a focused cocktail list with a full late-night kitchen.", cuisine: ["bar food"], drinks: ["cocktails"], moods: ["lively", "polished", "flexible"], bestFor: ["dinner", "quick_bite", "drinks", "late_drinks"], band: "moderate", price: [18, 45], currency: "USD", hours: ["16:00", "02:00", true], reservation: "walk_in" }),
  expandedPlace({ id: "sf-el-techo", cityId: "san-francisco", name: "El Techo", kind: "bar", lat: 37.7567, lng: -122.4192, address: "2516 Mission Street", neighborhood: "Mission", officialWebsite: "https://www.eltechosf.com/", editorialUrl: sfBarHopping, focus: "The official rooftop pairs Latin American food and cocktails with open-air Mission views.", cuisine: ["Latin American"], drinks: ["cocktails"], moods: ["rooftop", "lively", "social"], bestFor: ["dinner", "quick_bite", "drinks"], band: "moderate", price: [16, 42], currency: "USD", hours: ["16:00", "00:00", true], reservation: "available" }),
  expandedPlace({ id: "sf-beretta", cityId: "san-francisco", name: "Beretta", kind: "restaurant", lat: 37.7539, lng: -122.4205, address: "1199 Valencia Street", neighborhood: "Mission", officialWebsite: "https://www.berettasf.com/", editorialUrl: sfBarHopping, focus: "The official restaurant combines Italian plates, pizza and a cocktail-led bar.", cuisine: ["Italian", "pizza"], drinks: ["cocktails"], moods: ["buzzy", "date-night", "late"], bestFor: ["dinner", "quick_bite", "drinks"], band: "moderate", price: [18, 46], currency: "USD", hours: ["17:00", "01:00", true], reservation: "recommended" }),
  expandedPlace({ id: "sf-the-beehive", cityId: "san-francisco", name: "The Beehive", kind: "cocktail_lounge", lat: 37.7586, lng: -122.4215, address: "842 Valencia Street", neighborhood: "Mission", officialWebsite: "https://www.thebeehivesf.com/", editorialUrl: sfBarHopping, focus: "The official site presents a mid-century cocktail bar with shareable food.", cuisine: ["small plates"], drinks: ["cocktails"], moods: ["playful", "retro", "social"], bestFor: ["quick_bite", "drinks", "late_drinks"], band: "moderate", price: [17, 38], currency: "USD", hours: ["16:00", "02:00", true], reservation: "available" }),
  expandedPlace({ id: "sf-500-club", cityId: "san-francisco", name: "500 Club", kind: "bar", lat: 37.7631, lng: -122.4219, address: "500 Guerrero Street", neighborhood: "Mission", officialWebsite: "https://500clubsf.com/", editorialUrl: sfEditorial, focus: "The official bar preserves its neon-lit neighborhood dive identity, jukebox and pool table.", drinks: ["beer", "well drinks"], moods: ["dive", "unpretentious", "late"], bestFor: ["drinks", "late_drinks"], band: "budget", price: [7, 18], currency: "USD", hours: ["12:00", "02:00", true], reservation: "walk_in" }),
  expandedPlace({ id: "sf-benders", cityId: "san-francisco", name: "Bender's Bar & Grill", kind: "pub", lat: 37.7651, lng: -122.4151, address: "806 South Van Ness Avenue", neighborhood: "Mission", officialWebsite: "https://bendersbar.com/", editorialUrl: sfEditorial, focus: "The official neighborhood bar combines drinks, grills, pool and live programming.", cuisine: ["bar food"], drinks: ["beer", "cocktails"], moods: ["dive", "lively", "casual"], bestFor: ["quick_bite", "drinks", "late_drinks"], band: "budget", price: [10, 25], currency: "USD", hours: ["12:00", "02:00", true], reservation: "walk_in" }),
  expandedPlace({ id: "sf-the-chapel", cityId: "san-francisco", name: "The Chapel", kind: "music_bar", lat: 37.7605, lng: -122.4213, address: "777 Valencia Street", neighborhood: "Mission", officialWebsite: "https://thechapelsf.com/", editorialUrl: sfBarHopping, focus: "The official venue combines a concert hall, neighborhood bar and restaurant in a former chapel.", cuisine: ["California"], drinks: ["cocktails", "beer"], moods: ["music-led", "historic", "lively"], bestFor: ["dinner", "drinks", "late_drinks"], band: "moderate", price: [14, 36], currency: "USD", hours: ["17:00", "02:00", true], reservation: "available" }),
  expandedPlace({ id: "sf-make-out-room", cityId: "san-francisco", name: "Make-Out Room", kind: "music_bar", lat: 37.7554, lng: -122.4198, address: "3225 22nd Street", neighborhood: "Mission", officialWebsite: "https://www.makeoutroom.com/", editorialUrl: sfBarHopping, focus: "The official venue presents live bands, DJs and dancing in a long-running Mission room.", drinks: ["beer", "cocktails"], moods: ["dance", "local", "late"], bestFor: ["drinks", "late_drinks"], band: "budget", price: [8, 20], currency: "USD", hours: ["18:00", "02:00", true], reservation: "walk_in" }),
  expandedPlace({ id: "sf-latin-american-club", cityId: "san-francisco", name: "Latin American Club", kind: "bar", lat: 37.7553, lng: -122.4212, address: "3286 22nd Street", neighborhood: "Mission", officialWebsite: "https://latinamericanclubsf.com/", editorialUrl: sfBarHopping, focus: "The official site presents a colorful Mission neighborhood bar known for straightforward drinks.", drinks: ["margaritas", "beer"], moods: ["colorful", "casual", "social"], bestFor: ["drinks", "late_drinks"], band: "budget", price: [8, 18], currency: "USD", hours: ["16:00", "02:00", true], reservation: "walk_in" }),
  expandedPlace({ id: "sf-blondies", cityId: "san-francisco", name: "Blondie's Bar", kind: "bar", lat: 37.7634, lng: -122.4218, address: "540 Valencia Street", neighborhood: "Mission", officialWebsite: "https://blondiessf.com/", editorialUrl: sfBarHopping, focus: "The official bar focuses on large cocktails and a sociable Valencia Street room.", drinks: ["cocktails"], moods: ["lively", "casual", "group-friendly"], bestFor: ["drinks", "late_drinks"], band: "budget", currency: "USD" }),
  expandedPlace({ id: "sf-skylark", cityId: "san-francisco", name: "Skylark", kind: "bar", lat: 37.7647, lng: -122.4222, address: "3089 16th Street", neighborhood: "Mission", officialWebsite: "https://skylarksf.com/", editorialUrl: sfBarHopping, focus: "The official site presents cocktails, DJs and dancing near 16th Street BART.", drinks: ["cocktails"], moods: ["dance", "late", "unpretentious"], bestFor: ["drinks", "late_drinks"], band: "budget", currency: "USD" }),
  expandedPlace({ id: "sf-dna-lounge", cityId: "san-francisco", name: "DNA Lounge", kind: "club", lat: 37.7711, lng: -122.4125, address: "375 11th Street", neighborhood: "SoMa", officialWebsite: "https://www.dnalounge.com/", editorialUrl: sfEditorial, focus: "The official venue programs live bands and DJs across multiple rooms with an attached late-night cafe.", cuisine: ["pizza"], drinks: ["beer", "cocktails"], moods: ["alternative", "dance", "late"], bestFor: ["quick_bite", "drinks", "late_drinks"], band: "moderate", currency: "USD" }),
  expandedPlace({ id: "sf-cat-club", cityId: "san-francisco", name: "Cat Club", kind: "club", lat: 37.7754, lng: -122.4090, address: "1190 Folsom Street", neighborhood: "SoMa", officialWebsite: "https://www.sfcatclub.com/", editorialUrl: sfEditorial, focus: "The official club presents two dance floors with themed alternative nights.", drinks: ["beer", "cocktails"], moods: ["alternative", "dance", "late"], bestFor: ["drinks", "late_drinks"], band: "moderate", currency: "USD" }),
  expandedPlace({ id: "sf-oasis", cityId: "san-francisco", name: "OASIS", kind: "club", lat: 37.7719, lng: -122.4145, address: "298 11th Street", neighborhood: "SoMa", officialWebsite: "https://www.sfoasis.com/", editorialUrl: sfEditorial, focus: "The official venue centers drag, cabaret, DJs and queer nightlife.", drinks: ["cocktails"], moods: ["queer", "cabaret", "dance"], bestFor: ["drinks", "late_drinks"], band: "moderate", currency: "USD" }),
  expandedPlace({ id: "sf-audio", cityId: "san-francisco", name: "Audio", kind: "club", lat: 37.7710, lng: -122.4130, address: "316 11th Street", neighborhood: "SoMa", officialWebsite: "https://audiosf.com/", editorialUrl: sfEditorial, focus: "The official club is built around a high-spec sound system and electronic dance programming.", drinks: ["cocktails"], moods: ["electronic", "dance", "late"], bestFor: ["drinks", "late_drinks"], band: "premium", currency: "USD" }),
  expandedPlace({ id: "sf-mini-bar", cityId: "san-francisco", name: "Mini Bar SF", kind: "bar", lat: 37.7768, lng: -122.4378, address: "837 Divisadero Street", neighborhood: "NoPa", officialWebsite: "https://minibarsf.com/", editorialUrl: sfBarHopping, focus: "The official neighborhood bar combines cocktails with rotating work from local artists.", drinks: ["cocktails"], moods: ["intimate", "artful", "neighborhood"], bestFor: ["drinks", "late_drinks"], band: "moderate", price: [12, 22], currency: "USD", hours: ["16:00", "02:00", true], reservation: "walk_in" }),
  expandedPlace({ id: "sf-horsefeather", cityId: "san-francisco", name: "Horsefeather", kind: "cocktail_lounge", lat: 37.7742, lng: -122.4381, address: "528 Divisadero Street", neighborhood: "NoPa", officialWebsite: "https://horsefeather.com/", editorialUrl: sfBarHopping, focus: "The official site presents a neighborhood cocktail bar with a substantial food menu.", cuisine: ["California"], drinks: ["cocktails"], moods: ["casual", "designed", "neighborhood"], bestFor: ["dinner", "quick_bite", "drinks"], band: "moderate", price: [8, 33], currency: "USD", reservation: "recommended" }),
  expandedPlace({ id: "sf-the-page", cityId: "san-francisco", name: "The Page", kind: "pub", lat: 37.7728, lng: -122.4375, address: "298 Divisadero Street", neighborhood: "Lower Haight", officialWebsite: "https://www.thepagebar.com/", editorialUrl: sfBarHopping, focus: "The official neighborhood pub presents pool, games and a broad beer-and-spirits bar.", drinks: ["beer", "whiskey"], moods: ["casual", "games", "local"], bestFor: ["drinks", "late_drinks"], band: "budget", price: [5, 23], currency: "USD", reservation: "walk_in" }),
  expandedPlace({ id: "sf-tosca-cafe", cityId: "san-francisco", name: "Tosca Cafe", kind: "restaurant", lat: 37.7976, lng: -122.4056, address: "242 Columbus Avenue", neighborhood: "North Beach", officialWebsite: "https://www.toscacafe-sf.com/", editorialUrl: sfBarHopping, focus: "The official cafe preserves a historic North Beach bar while serving a full Italian dinner menu.", cuisine: ["Italian"], drinks: ["cocktails", "wine"], moods: ["historic", "romantic", "polished"], bestFor: ["dinner", "drinks"], band: "premium", price: [10, 63], currency: "USD", reservation: "recommended" }),
  expandedPlace({ id: "sf-comstock-saloon", cityId: "san-francisco", name: "Comstock Saloon", kind: "cocktail_lounge", lat: 37.7968, lng: -122.4053, address: "155 Columbus Avenue", neighborhood: "North Beach", officialWebsite: "https://comstocksaloon.com/", editorialUrl: sfBarHopping, focus: "The official saloon pairs classic cocktails, food and live music in a restored historic room.", cuisine: ["American"], drinks: ["classic cocktails"], moods: ["historic", "lively", "classic"], bestFor: ["dinner", "quick_bite", "drinks"], band: "moderate", price: [16, 42], currency: "USD", hours: ["16:00", "00:00", true], reservation: "available" }),
  expandedPlace({ id: "sf-red-window", cityId: "san-francisco", name: "Red Window", kind: "cocktail_lounge", lat: 37.8001, lng: -122.4090, address: "500 Columbus Avenue", neighborhood: "North Beach", officialWebsite: "https://theredwindow.com/", editorialUrl: sfBarHopping, focus: "The official site pairs low-proof cocktails with an evening tapas menu in North Beach.", cuisine: ["Spanish tapas"], drinks: ["cocktails", "wine"], moods: ["colorful", "social", "flexible"], bestFor: ["dinner", "quick_bite", "drinks"], band: "moderate", price: [6, 29], currency: "USD", reservation: "available" }),
  expandedPlace({ id: "sf-cafe-du-nord", cityId: "san-francisco", name: "Cafe Du Nord", kind: "music_bar", lat: 37.7666, lng: -122.4291, address: "2174 Market Street", neighborhood: "Upper Market", officialWebsite: "https://cafedunord.com/", editorialUrl: sfBarHopping, focus: "The official venue presents intimate live music in a basement room with a full bar.", drinks: ["beer", "cocktails"], moods: ["intimate", "music-led", "historic"], bestFor: ["drinks", "late_drinks"], band: "moderate", currency: "USD" }),
  expandedPlace({ id: "sf-churchill", cityId: "san-francisco", name: "Churchill", kind: "bar", lat: 37.7675, lng: -122.4286, address: "198 Church Street", neighborhood: "Upper Market", officialWebsite: "https://churchillsf.com/", editorialUrl: sfBarHopping, focus: "The official neighborhood bar combines cocktails, whiskey and a relaxed corner-room setting.", drinks: ["cocktails", "whiskey"], moods: ["relaxed", "neighborhood", "group-friendly"], bestFor: ["drinks", "late_drinks"], band: "moderate", currency: "USD" }),
  expandedPlace({ id: "sf-blackbird", cityId: "san-francisco", name: "Blackbird", kind: "cocktail_lounge", lat: 37.7676, lng: -122.4296, address: "2124 Market Street", neighborhood: "Upper Market", officialWebsite: "https://blackbirdbar.com/", editorialUrl: sfBarHopping, focus: "The official bar presents cocktails and whiskey in a neighborhood lounge near Castro event venues.", drinks: ["cocktails", "whiskey"], moods: ["moody", "neighborhood", "social"], bestFor: ["drinks", "late_drinks"], band: "moderate", currency: "USD" }),
  expandedPlace({ id: "sf-west-coast-wine-cheese", cityId: "san-francisco", name: "West Coast Wine + Cheese", kind: "wine_bar", lat: 37.7972, lng: -122.4351, address: "2165 Union Street", neighborhood: "Marina", officialWebsite: "https://westcoastsf.com/", editorialUrl: sfBarHopping, focus: "The official wine bar focuses on West Coast bottles, cheese and shareable plates.", cuisine: ["cheese", "small plates"], drinks: ["wine"], moods: ["intimate", "calm", "date-night"], bestFor: ["quick_bite", "drinks"], band: "moderate", currency: "USD" }),
];
