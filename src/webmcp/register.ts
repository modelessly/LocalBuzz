import type { LocalBuzzActions, RepairInput, StageCustomPlaceInput, StageStopInput } from "../domain/store";
import type { CityId, DiscoveryLeadEvidence, EventDiscoveryFields, HappeningCategory, PlaceDiscoveryFields, PlaceKind, PlacePurpose, PlaceSearchFilters, SearchFilters } from "../domain/types";
import { executeWithAgentActivity, type AgentActivityReporter } from "./activity";

const objectInput = (input: unknown): Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};

const stringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const toolError = (message: string) => ({
  ok: false,
  code: "INVALID_INPUT",
  message,
  suggestion: "Call the tool again with arguments matching its input schema.",
});

const sourceTypes = ["official_page", "venue_calendar", "ticket_page", "editorial_page", "other_public_page"] as const;
const evidenceFrom = (value: unknown): DiscoveryLeadEvidence[] => Array.isArray(value) ? value.flatMap((item) => {
  const entry = objectInput(item);
  return typeof entry.field === "string" && typeof entry.sourceUrl === "string" ? [{ field: entry.field, sourceUrl: entry.sourceUrl, note: typeof entry.note === "string" ? entry.note : undefined }] : [];
}) : [];

const proposalBaseSchema = {
  cityId: { type: "string", enum: ["stockholm", "san-francisco"] },
  sourceUrl: { type: "string", format: "uri", maxLength: 2048 },
  sourceType: { type: "string", enum: [...sourceTypes] },
  evidence: { type: "array", minItems: 1, maxItems: 30, items: { type: "object", properties: { field: { type: "string", maxLength: 80 }, sourceUrl: { type: "string", format: "uri", maxLength: 2048 }, note: { type: "string", maxLength: 500 } }, required: ["field", "sourceUrl"], additionalProperties: false } },
} as const;

const proposalHeader = (input: Record<string, unknown>) => {
  if ((input.cityId !== "stockholm" && input.cityId !== "san-francisco") || typeof input.sourceUrl !== "string" || !sourceTypes.includes(input.sourceType as typeof sourceTypes[number]) || !Array.isArray(input.evidence)) return undefined;
  return { cityId: input.cityId as CityId, sourceUrl: input.sourceUrl, sourceType: input.sourceType as typeof sourceTypes[number], evidence: evidenceFrom(input.evidence) };
};

export const createWebMcpTools = (actions: LocalBuzzActions): WebMcpTool[] => [
  {
    name: "propose_event_from_url",
    title: "Propose a public event for human review",
    description: "Submit structured facts already read by the browser agent from a public HTTPS event or venue page. Local Buzz validates and stages a discovery lead immediately; it never fetches the URL, publishes canonically, or changes a night automatically.",
    inputSchema: { type: "object", properties: { ...proposalBaseSchema, fields: { type: "object", properties: {
      title: { type: "string", maxLength: 300 }, description: { type: "string", maxLength: 5000 }, category: { type: "string", enum: ["live_music", "club", "comedy", "food_drink", "culture", "film", "talk", "market", "activity", "other"] },
      venue: { type: "object", properties: { name: { type: "string", maxLength: 300 }, address: { type: "string", maxLength: 500 }, neighborhood: { type: "string", maxLength: 200 }, lat: { type: "number" }, lng: { type: "number" } }, additionalProperties: false },
      timing: { type: "object", properties: { start: { type: "string", format: "date-time" }, end: { type: "string", format: "date-time" } }, additionalProperties: false },
      commerce: { type: "object", properties: { priceMin: { type: "number", minimum: 0 }, priceMax: { type: "number", minimum: 0 }, currency: { type: "string", enum: ["SEK", "USD"] }, bookingUrl: { type: "string", format: "uri" } }, additionalProperties: false },
      availability: { type: "string", enum: ["unknown", "available", "limited", "sold_out", "cancelled", "walk_in"] }, performer: { type: "string", maxLength: 300 }, organizer: { type: "string", maxLength: 300 },
    }, additionalProperties: false } }, required: ["cityId", "sourceUrl", "sourceType", "fields", "evidence"], additionalProperties: false },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute(input) {
      const value = objectInput(input); const header = proposalHeader(value); const fields = objectInput(value.fields);
      if (!header) return toolError("cityId, sourceUrl, sourceType and evidence are required.");
      const venue = objectInput(fields.venue); const timing = objectInput(fields.timing); const commerce = objectInput(fields.commerce);
      const facts: EventDiscoveryFields = {
        title: typeof fields.title === "string" ? fields.title : undefined, description: typeof fields.description === "string" ? fields.description : undefined,
        category: typeof fields.category === "string" ? fields.category as HappeningCategory : undefined,
        venue: Object.keys(venue).length ? { name: typeof venue.name === "string" ? venue.name : undefined, address: typeof venue.address === "string" ? venue.address : undefined, neighborhood: typeof venue.neighborhood === "string" ? venue.neighborhood : undefined, lat: typeof venue.lat === "number" ? venue.lat : undefined, lng: typeof venue.lng === "number" ? venue.lng : undefined } : undefined,
        timing: Object.keys(timing).length ? { start: typeof timing.start === "string" ? timing.start : undefined, end: typeof timing.end === "string" ? timing.end : undefined } : undefined,
        commerce: Object.keys(commerce).length ? { priceMin: typeof commerce.priceMin === "number" ? commerce.priceMin : undefined, priceMax: typeof commerce.priceMax === "number" ? commerce.priceMax : undefined, currency: commerce.currency === "SEK" || commerce.currency === "USD" ? commerce.currency : undefined, bookingUrl: typeof commerce.bookingUrl === "string" ? commerce.bookingUrl : undefined } : undefined,
        availability: typeof fields.availability === "string" ? fields.availability as EventDiscoveryFields["availability"] : undefined, performer: typeof fields.performer === "string" ? fields.performer : undefined, organizer: typeof fields.organizer === "string" ? fields.organizer : undefined,
      };
      return actions.proposeEventLead({ ...header, fields: facts });
    },
  },
  {
    name: "propose_place_from_url",
    title: "Propose a public place for human review",
    description: "Submit structured restaurant, bar, club or cafe facts already read from a public HTTPS page. Local Buzz stages a provisional discovery lead with missing-field and duplicate warnings; it does not fetch the URL, publish the Place, or stage a night.",
    inputSchema: { type: "object", properties: { ...proposalBaseSchema, fields: { type: "object", properties: {
      name: { type: "string", maxLength: 300 }, officialWebsite: { type: "string", format: "uri" }, kind: { type: "string", enum: ["restaurant", "bar", "pub", "cocktail_lounge", "wine_bar", "music_bar", "club", "cafe"] },
      location: { type: "object", properties: { address: { type: "string", maxLength: 500 }, neighborhood: { type: "string", maxLength: 200 }, lat: { type: "number" }, lng: { type: "number" } }, additionalProperties: false },
      cuisine: { type: "array", items: { type: "string" }, maxItems: 20 }, drinkFocus: { type: "array", items: { type: "string" }, maxItems: 20 }, moodTags: { type: "array", items: { type: "string" }, maxItems: 20 }, bestFor: { type: "array", items: { type: "string", enum: ["dinner", "quick_bite", "drinks", "late_drinks"] } },
      typicalVisitDurationMinutes: { type: "integer", minimum: 15, maximum: 480 }, priceRange: { type: "object", properties: { min: { type: "number", minimum: 0 }, max: { type: "number", minimum: 0 }, currency: { type: "string", enum: ["SEK", "USD"] }, basis: { type: "string", const: "per_person" }, band: { type: "string", enum: ["budget", "moderate", "premium", "unknown"] }, evidence: { type: "string", enum: ["official_menu", "provider_estimate", "unknown"] }, evidenceUrl: { type: "string", format: "uri" } }, required: ["currency", "basis", "band", "evidence"], additionalProperties: false },
      weeklyHours: { type: "object", properties: Object.fromEntries(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => [day, { type: "array", items: { type: "object", properties: { opensAt: { type: "string", pattern: "^(?:[01]\\d|2[0-3]):[0-5]\\d$" }, closesAt: { type: "string", pattern: "^(?:[01]\\d|2[0-3]):[0-5]\\d$" }, closesNextDay: { type: "boolean" } }, required: ["opensAt", "closesAt"], additionalProperties: false } }])), additionalProperties: false },
      openingHoursEvidence: { type: "object", properties: { status: { type: "string", enum: ["verified", "unknown"] }, sourceUrl: { type: "string", format: "uri" }, checkedAt: { type: "string", format: "date-time" } }, required: ["status", "checkedAt"], additionalProperties: false },
      exceptionalHours: { type: "object", properties: { status: { type: "string", enum: ["none_known", "confirmed", "unknown"] }, note: { type: "string", maxLength: 500 } }, required: ["status"], additionalProperties: false },
      reservationMode: { type: "string", enum: ["required", "recommended", "available", "walk_in", "unknown"] },
    }, additionalProperties: false } }, required: ["cityId", "sourceUrl", "sourceType", "fields", "evidence"], additionalProperties: false },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute(input) {
      const value = objectInput(input); const header = proposalHeader(value); const fields = objectInput(value.fields); const location = objectInput(fields.location); const price = objectInput(fields.priceRange);
      if (!header) return toolError("cityId, sourceUrl, sourceType and evidence are required.");
      const facts: PlaceDiscoveryFields = {
        name: typeof fields.name === "string" ? fields.name : undefined, officialWebsite: typeof fields.officialWebsite === "string" ? fields.officialWebsite : undefined, kind: typeof fields.kind === "string" ? fields.kind as PlaceKind : undefined,
        location: Object.keys(location).length ? { address: typeof location.address === "string" ? location.address : undefined, neighborhood: typeof location.neighborhood === "string" ? location.neighborhood : undefined, lat: typeof location.lat === "number" ? location.lat : undefined, lng: typeof location.lng === "number" ? location.lng : undefined } : undefined,
        cuisine: stringArray(fields.cuisine), drinkFocus: stringArray(fields.drinkFocus), moodTags: stringArray(fields.moodTags), bestFor: stringArray(fields.bestFor) as PlacePurpose[], typicalVisitDurationMinutes: typeof fields.typicalVisitDurationMinutes === "number" ? fields.typicalVisitDurationMinutes : undefined,
        priceRange: Object.keys(price).length && (price.currency === "SEK" || price.currency === "USD") ? price as PlaceDiscoveryFields["priceRange"] : undefined,
        weeklyHours: typeof fields.weeklyHours === "object" && fields.weeklyHours !== null ? fields.weeklyHours as PlaceDiscoveryFields["weeklyHours"] : undefined,
        openingHoursEvidence: typeof fields.openingHoursEvidence === "object" && fields.openingHoursEvidence !== null ? fields.openingHoursEvidence as PlaceDiscoveryFields["openingHoursEvidence"] : undefined,
        exceptionalHours: typeof fields.exceptionalHours === "object" && fields.exceptionalHours !== null ? fields.exceptionalHours as PlaceDiscoveryFields["exceptionalHours"] : undefined,
        reservationMode: typeof fields.reservationMode === "string" ? fields.reservationMode as PlaceDiscoveryFields["reservationMode"] : undefined,
      };
      return actions.proposePlaceLead({ ...header, fields: facts });
    },
  },
  {
    name: "search_happenings",
    title: "Search happenings in the active city",
    description:
      "Search Local Buzz's structured inventory for the city currently selected by the human, using time, budget, category, text, and distance constraints. Use this before showing candidates or staging a plan. This reads inventory and does not commit a plan.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Mood, category, venue, or free-text intent." },
        startAfter: { type: "string", format: "date-time" },
        endBefore: { type: "string", format: "date-time" },
        maxPrice: { type: "number", minimum: 0, description: "Maximum price per person in the active city's currency." },
        categories: {
          type: "array",
          items: {
            type: "string",
            enum: ["live_music", "club", "comedy", "food_drink", "culture", "film", "talk", "market", "activity", "other"],
          },
        },
        near: {
          type: "object",
          properties: { lat: { type: "number" }, lng: { type: "number" } },
          required: ["lat", "lng"],
          additionalProperties: false,
        },
        maxDistanceKm: { type: "number", minimum: 0 },
        maxResults: { type: "integer", minimum: 1, maximum: 20 },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute(input) {
      const value = objectInput(input);
      const nearValue = objectInput(value.near);
      const filters: SearchFilters = {
        query: typeof value.query === "string" ? value.query : undefined,
        startAfter: typeof value.startAfter === "string" ? value.startAfter : undefined,
        endBefore: typeof value.endBefore === "string" ? value.endBefore : undefined,
        maxPrice: typeof value.maxPrice === "number" ? value.maxPrice : undefined,
        categories: stringArray(value.categories) as HappeningCategory[],
        near:
          typeof nearValue.lat === "number" && typeof nearValue.lng === "number"
            ? { lat: nearValue.lat, lng: nearValue.lng }
            : undefined,
        maxDistanceKm: typeof value.maxDistanceKm === "number" ? value.maxDistanceKm : undefined,
        maxResults: typeof value.maxResults === "number" ? value.maxResults : undefined,
      };
      const result = actions.searchHappenings(filters);
      if (!result.ok) return result;
      return {
        ok: true,
        count: result.count,
        happenings: result.happenings.map((item) => ({
          id: item.id,
          title: item.title,
          category: item.category,
          venue: item.venue,
          timing: item.timing,
          priceMin: item.commerce.priceMin,
          currency: item.commerce.currency,
          availability: item.status.availability,
          moodTags: item.enrichment?.moodTags ?? [],
          source: item.source,
        })),
      };
    },
  },
  {
    name: "show_candidates",
    title: "Show candidates on Local Buzz",
    description:
      "Make specific happening IDs visibly prominent on the shared map and card grid. Use after search_happenings so the human can visually inspect and reject options.",
    inputSchema: {
      type: "object",
      properties: {
        happeningIds: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 20 },
        reason: { type: "string", description: "Short explanation visible above the candidates." },
      },
      required: ["happeningIds"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute(input) {
      const value = objectInput(input);
      const ids = stringArray(value.happeningIds);
      if (!ids.length) return toolError("happeningIds must contain at least one ID.");
      return actions.showCandidates(ids, typeof value.reason === "string" ? value.reason : undefined);
    },
  },
  {
    name: "search_places",
    title: "Search places in the active city",
    description: "Search the canonical Local Buzz place catalog by text, kind, purpose, price, open time and distance. Results retain source and verification metadata.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        kinds: { type: "array", items: { type: "string", enum: ["restaurant", "bar", "pub", "cocktail_lounge", "wine_bar", "music_bar", "club", "cafe"] } },
        purposes: { type: "array", items: { type: "string", enum: ["dinner", "quick_bite", "drinks", "late_drinks"] } },
        moods: { type: "array", items: { type: "string" } },
        neighborhoods: { type: "array", items: { type: "string" } },
        openAt: { type: "string", format: "date-time" },
        maxPrice: { type: "number", minimum: 0 },
        near: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" } }, required: ["lat", "lng"], additionalProperties: false },
        maxDistanceKm: { type: "number", minimum: 0 },
        maxResults: { type: "integer", minimum: 1, maximum: 20 },
      }, additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute(input) {
      const value = objectInput(input);
      const near = objectInput(value.near);
      const filters: PlaceSearchFilters = {
        query: typeof value.query === "string" ? value.query : undefined,
        kinds: stringArray(value.kinds) as PlaceKind[], purposes: stringArray(value.purposes) as PlacePurpose[],
        moods: stringArray(value.moods), neighborhoods: stringArray(value.neighborhoods),
        openAt: typeof value.openAt === "string" ? value.openAt : undefined,
        maxPrice: typeof value.maxPrice === "number" ? value.maxPrice : undefined,
        near: typeof near.lat === "number" && typeof near.lng === "number" ? { lat: near.lat, lng: near.lng } : undefined,
        maxDistanceKm: typeof value.maxDistanceKm === "number" ? value.maxDistanceKm : undefined,
        maxResults: typeof value.maxResults === "number" ? value.maxResults : undefined,
      };
      const result = actions.searchPlaces(filters);
      if (!result.ok) return result;
      return { ok: true, count: result.count, places: result.places.map((place) => ({
        id: place.id, name: place.name, kind: place.kind, location: place.location, cuisine: place.cuisine,
        drinkFocus: place.drinkFocus, moodTags: place.moodTags, bestFor: place.bestFor,
        typicalVisitDurationMinutes: place.typicalVisitDurationMinutes, priceRange: place.priceRange,
        openingHoursEvidence: place.openingHoursEvidence, officialWebsite: place.officialWebsite,
        verification: place.verification, provenance: place.provenance,
      })) };
    },
  },
  {
    name: "show_place_candidates",
    title: "Show place candidates on Local Buzz",
    description: "Make canonical place IDs visible on the same shared map and place-card surface used by the human.",
    inputSchema: { type: "object", properties: { placeIds: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 20 }, reason: { type: "string" } }, required: ["placeIds"], additionalProperties: false },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute(input) {
      const value = objectInput(input);
      const ids = stringArray(value.placeIds);
      return ids.length ? actions.showPlaceCandidates(ids, typeof value.reason === "string" ? value.reason : undefined) : toolError("placeIds must contain at least one ID.");
    },
  },
  {
    name: "read_place_details",
    title: "Read canonical place details",
    description: "Read one Place record including typed hours, service cutoffs, price, evidence, provenance and verification status before staging it.",
    inputSchema: { type: "object", properties: { placeId: { type: "string" } }, required: ["placeId"], additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute(input) {
      const value = objectInput(input);
      return typeof value.placeId === "string" ? actions.readPlaceDetails(value.placeId) : toolError("placeId must be a string.");
    },
  },
  {
    name: "stage_place_stop",
    title: "Stage a canonical place stop",
    description: "Append a dinner, quick-bite or drinks stop from the canonical Place catalog. The shared domain validates purpose, hours, duration, party-size cost, currency, overlap and latest end; the result remains staged.",
    inputSchema: { type: "object", properties: {
      placeId: { type: "string" }, purpose: { type: "string", enum: ["dinner", "quick_bite", "drinks", "late_drinks"] },
      plannedStart: { type: "string", format: "date-time" }, reason: { type: "string" },
    }, required: ["placeId", "purpose", "plannedStart"], additionalProperties: false },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute(input) {
      const value = objectInput(input);
      if (typeof value.placeId !== "string" || typeof value.purpose !== "string" || typeof value.plannedStart !== "string") return toolError("placeId, purpose and plannedStart are required.");
      return actions.stagePlaceStop({ placeId: value.placeId, purpose: value.purpose as PlacePurpose, plannedStart: value.plannedStart }, typeof value.reason === "string" ? value.reason : undefined);
    },
  },
  {
    name: "stage_custom_place",
    title: "Stage an unverified custom place",
    description: "Append a visibly unverified place using explicit location, duration, per-person price, currency and stated availability. Local Buzz validates the assumptions but does not add the place to the canonical catalog.",
    inputSchema: { type: "object", properties: {
      name: { type: "string" }, purpose: { type: "string", enum: ["dinner", "quick_bite", "drinks", "late_drinks"] }, plannedStart: { type: "string", format: "date-time" },
      location: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" }, address: { type: "string" }, neighborhood: { type: "string" } }, required: ["lat", "lng", "address", "neighborhood"], additionalProperties: false },
      typicalVisitDurationMinutes: { type: "integer", minimum: 15 }, pricePerPerson: { type: "number", minimum: 0 }, currency: { type: "string", enum: ["SEK", "USD"] },
      availableFrom: { type: "string", format: "date-time" }, availableUntil: { type: "string", format: "date-time" }, note: { type: "string" }, reason: { type: "string" },
    }, required: ["name", "purpose", "plannedStart", "location", "typicalVisitDurationMinutes", "pricePerPerson", "currency", "availableFrom", "availableUntil"], additionalProperties: false },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute(input) {
      const value = objectInput(input); const location = objectInput(value.location);
      if (typeof value.name !== "string" || typeof value.purpose !== "string" || typeof value.plannedStart !== "string" || typeof value.typicalVisitDurationMinutes !== "number" || typeof value.pricePerPerson !== "number" || (value.currency !== "SEK" && value.currency !== "USD") || typeof value.availableFrom !== "string" || typeof value.availableUntil !== "string" || typeof location.lat !== "number" || typeof location.lng !== "number" || typeof location.address !== "string" || typeof location.neighborhood !== "string") return toolError("Custom place fields do not match the required schema.");
      const custom: StageCustomPlaceInput = { name: value.name, purpose: value.purpose as PlacePurpose, plannedStart: value.plannedStart, location: { lat: location.lat, lng: location.lng, address: location.address, neighborhood: location.neighborhood }, typicalVisitDurationMinutes: value.typicalVisitDurationMinutes, pricePerPerson: value.pricePerPerson, currency: value.currency, availableFrom: value.availableFrom, availableUntil: value.availableUntil, note: typeof value.note === "string" ? value.note : undefined };
      return actions.stageCustomPlace(custom, typeof value.reason === "string" ? value.reason : undefined);
    },
  },
  {
    name: "stage_evening_plan",
    title: "Stage an evening plan",
    description:
      "Create a reviewable proposed evening from known happening IDs and planned start times. This updates the visible timeline but does not commit the night; the human can lock, edit, accept, or reject it.",
    inputSchema: {
      type: "object",
      properties: {
        stops: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              happeningId: { type: "string" },
              plannedStart: { type: "string", format: "date-time" },
            },
            required: ["happeningId", "plannedStart"],
            additionalProperties: false,
          },
        },
        rationale: { type: "string" },
      },
      required: ["stops"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute(input) {
      const value = objectInput(input);
      if (!Array.isArray(value.stops)) return toolError("stops must be an array.");
      const stops = value.stops
        .map(objectInput)
        .filter(
          (stop) => typeof stop.happeningId === "string" && typeof stop.plannedStart === "string",
        )
        .map(
          (stop): StageStopInput => ({
            happeningId: stop.happeningId as string,
            plannedStart: stop.plannedStart as string,
          }),
        );
      if (stops.length !== value.stops.length || !stops.length) {
        return toolError("Every stop needs a happeningId and ISO plannedStart.");
      }
      return actions.stagePlan(stops, typeof value.rationale === "string" ? value.rationale : undefined);
    },
  },
  {
    name: "read_current_plan",
    title: "Read the shared evening plan",
    description:
      "Read the canonical plan, current staged proposal, human locks and edits, staged changes, constraints, and disruptions. Always use this after the human changes the UI and before attempting a repair.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute() {
      return actions.readCurrentPlan();
    },
  },
  {
    name: "lock_plan_stop",
    title: "Lock a plan stop",
    description:
      "Lock one existing plan stop as an explicit human constraint. A locked stop cannot be silently removed or replaced by repair_plan. The lock appears immediately in the shared timeline.",
    inputSchema: {
      type: "object",
      properties: { stopId: { type: "string" } },
      required: ["stopId"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute(input) {
      const value = objectInput(input);
      return typeof value.stopId === "string"
        ? actions.lockPlanStop(value.stopId)
        : toolError("stopId must be a string.");
    },
  },
  {
    name: "repair_plan",
    title: "Repair the current night",
    description:
      "Stage the smallest possible repair after a disruption. Read the current plan first. Preserve locked stops and unaffected stops; do not regenerate the full itinerary. The repair remains uncommitted until accepted.",
    inputSchema: {
      type: "object",
      properties: {
        reason: { type: "string" },
        preserveLockedStops: { type: "boolean", const: true },
        replacementHappeningIds: {
          type: "array",
          items: { type: "string" },
          description: "Ordered candidate IDs returned by search_happenings.",
        },
      },
      required: ["reason"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute(input) {
      const value = objectInput(input);
      if (typeof value.reason !== "string") return toolError("reason must be a string.");
      const repair: RepairInput = {
        reason: value.reason,
        preserveLockedStops: true,
        replacementHappeningIds: stringArray(value.replacementHappeningIds),
      };
      return actions.repairPlan(repair);
    },
  },
  {
    name: "accept_staged_changes",
    title: "Accept staged plan changes",
    description:
      "Commit the currently staged plan only after the human explicitly approves it. This makes the staged timeline canonical and clears its review state.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute() {
      return actions.acceptStagedChanges();
    },
  },
  {
    name: "reject_staged_changes",
    title: "Reject staged plan changes",
    description:
      "Discard the currently staged proposal or repair without modifying the accepted canonical plan. Use when the human rejects the visible changes.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute() {
      return actions.rejectStagedChanges();
    },
  },
];

export function registerWebMcp(
  actions: LocalBuzzActions,
  onStatus: (status: "available" | "unavailable" | "error") => void,
  modelContext: WebMcpModelContext | undefined = document.modelContext,
  onActivity?: AgentActivityReporter,
) {
  const controller = new AbortController();
  if (!modelContext?.registerTool) {
    onStatus("unavailable");
    return () => controller.abort();
  }
  void Promise.all(
      createWebMcpTools(actions).map((tool) => modelContext.registerTool(
        onActivity
          ? {
              ...tool,
              execute: (input, options) => executeWithAgentActivity(
                tool,
                input,
                options?.signal ? options : { signal: controller.signal },
                onActivity,
              ),
            }
          : tool,
        { signal: controller.signal },
      )),
    )
    .then(() => {
      if (!controller.signal.aborted) onStatus("available");
    })
    .catch((cause: unknown) => {
      if (!controller.signal.aborted) {
        console.error("WebMCP tool registration failed", cause);
        onStatus("error");
      }
    });
  return () => controller.abort();
}
