import { getCityDefinition } from "../data/cities";
import { localDate, localDateTimeToIso, shiftIsoDate } from "../lib/timeSearch";
import type {
  CityId,
  DiscoveryLead,
  DomainResult,
  EveningPlan,
  Happening,
  LiveUpdate,
  LocalBuzzState,
  Place,
  PlacePurpose,
  PlaceSearchFilters,
  PlanChange,
  PlanConstraints,
  PlanStop,
  SearchFilters,
} from "./types";
import { buildEventLead, buildPlaceLead, canonicalEventFromLead, canonicalPlaceFromLead, type ProposeEventLeadInput, type ProposePlaceLeadInput } from "./discovery";
import { deduplicateHappenings } from "./happeningDedup";

export type StageStopInput = { happeningId: string; plannedStart: string };
export type StagePlaceStopInput = { placeId: string; purpose: PlacePurpose; plannedStart: string };
export type StageCustomPlaceInput = {
  name: string;
  purpose: PlacePurpose;
  plannedStart: string;
  location: Place["location"];
  typicalVisitDurationMinutes: number;
  pricePerPerson: number;
  currency: Place["priceRange"]["currency"];
  availableFrom: string;
  availableUntil: string;
  note?: string;
};
export type RepairInput = {
  reason: string;
  preserveLockedStops?: boolean;
  replacementHappeningIds?: string[];
};

const unavailable = new Set(["sold_out", "cancelled"]);

const occurrenceEndMs = (happening: Happening) => {
  const startMs = Date.parse(happening.timing.start);
  return happening.timing.end
    ? Date.parse(happening.timing.end)
    : startMs + (happening.timing.estimatedDurationMinutes ?? 90) * 60_000;
};

const currentHappeningIds = (happenings: Happening[], cityId: CityId, now: Date) => {
  const city = getCityDefinition(cityId);
  const cityDate = localDate(now, city.timeZone);
  const endOfToday = Date.parse(
    localDateTimeToIso(shiftIsoDate(cityDate, 1), "00:00:00", city.timeZone),
  );
  return happenings
    .filter((item) => !unavailable.has(item.status.availability))
    .filter((item) => occurrenceEndMs(item) > now.getTime())
    .filter((item) => Date.parse(item.timing.start) < endOfToday)
    .map((item) => item.id);
};

const canAttendAt = (happening: Happening, plannedStart: string) => {
  const plannedStartMs = Date.parse(plannedStart);
  const occurrenceStartMs = Date.parse(happening.timing.start);
  const occurrenceEnd = occurrenceEndMs(happening);
  return (
    Number.isFinite(plannedStartMs) &&
    Number.isFinite(occurrenceStartMs) &&
    Number.isFinite(occurrenceEnd) &&
    plannedStartMs >= occurrenceStartMs &&
    plannedStartMs < occurrenceEnd
  );
};

export const createInitialState = (cityId: CityId = "san-francisco", now = new Date()): LocalBuzzState => {
  const city = getCityDefinition(cityId);
  const visibleIds = currentHappeningIds(city.happenings, cityId, now);
  return {
    activeCityId: cityId,
    happenings: city.happenings.map((item) => structuredClone(item)),
    places: city.places.map((item) => structuredClone(item)),
    filters: {},
    placeFilters: {},
    visibleHappeningIds: visibleIds,
    candidateHappeningIds: [],
    visiblePlaceIds: city.places.map((item) => item.id),
    candidatePlaceIds: [],
    currentPlan: null,
    stagedPlan: null,
    stagedChanges: [],
    liveUpdates: [],
    discoveryLeads: [],
    activityMessage: `${city.snapshotLabel} loaded for the proof-of-concept window.`,
    webMcp: "checking",
  };
};

const distanceKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

const findHappening = (state: LocalBuzzState, id: string) =>
  state.happenings.find((item) => item.id === id);

const findPlace = (state: LocalBuzzState, id: string) =>
  state.places.find((item) => item.id === id);

export const isHappeningStop = (stop: PlanStop): stop is Extract<PlanStop, { kind: "happening" }> => stop.kind === "happening";
export const isPlaceStop = (stop: PlanStop): stop is Extract<PlanStop, { kind: "place" }> => stop.kind === "place";

const weekdayFor = (date: string) => {
  const names = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
  return names[new Date(`${date}T12:00:00Z`).getUTCDay()];
};

const placeOpenWindow = (place: Place, plannedStart: string, timeZone: string) => {
  const date = localDate(new Date(plannedStart), timeZone);
  const previousDate = shiftIsoDate(date, -1);
  const candidates = [
    ...(place.weeklyHours[weekdayFor(date)] ?? []).map((interval) => ({ date, interval })),
    ...(place.weeklyHours[weekdayFor(previousDate)] ?? [])
      .filter((interval) => interval.closesNextDay)
      .map((interval) => ({ date: previousDate, interval })),
  ];
  return candidates
    .map(({ date: intervalDate, interval }) => ({
      start: Date.parse(localDateTimeToIso(intervalDate, `${interval.opensAt}:00`, timeZone)),
      end: Date.parse(localDateTimeToIso(
        interval.closesNextDay ? shiftIsoDate(intervalDate, 1) : intervalDate,
        `${interval.closesAt}:00`,
        timeZone,
      )),
    }))
    .find((window) => Date.parse(plannedStart) >= window.start && Date.parse(plannedStart) < window.end);
};

const validatePlaceVisit = (
  place: Place,
  purpose: PlacePurpose,
  plannedStart: string,
  timeZone: string,
): DomainResult<{ plannedEnd: string }> => {
  if (place.priceRange.min === undefined || place.priceRange.max === undefined) {
    return error("PLACE_DATA_INCOMPLETE", `${place.name} does not have a verified-enough per-person price range.`, "Review the official source or stage it as a custom unverified place with explicit assumptions.");
  }
  if (!Object.keys(place.weeklyHours).length) {
    return error("PLACE_DATA_INCOMPLETE", `${place.name} does not have a complete weekly-hours record.`);
  }
  const window = placeOpenWindow(place, plannedStart, timeZone);
  if (!window) return error("PLACE_CLOSED", `${place.name} is not open at the proposed arrival time.`);
  const end = Date.parse(plannedStart) + place.typicalVisitDurationMinutes * 60_000;
  if (end > window.end) return error("PLACE_CLOSED", `${place.name} closes before the typical visit would finish.`);
  if (purpose === "dinner" || purpose === "quick_bite") {
    const arrivalDate = localDate(new Date(plannedStart), timeZone);
    const kitchenRule = place.serviceTimes?.kitchenLastOrder?.[weekdayFor(arrivalDate)];
    if (kitchenRule) {
      let cutoff = kitchenRule.type === "before_close"
        ? window.end - kitchenRule.minutes * 60_000
        : Date.parse(localDateTimeToIso(arrivalDate, `${kitchenRule.localTime}:00`, timeZone));
      if (kitchenRule.type === "at" && cutoff <= window.start) cutoff = Date.parse(localDateTimeToIso(shiftIsoDate(arrivalDate, 1), `${kitchenRule.localTime}:00`, timeZone));
      if (Date.parse(plannedStart) > cutoff) return error("PLACE_CLOSED", `${place.name}'s kitchen has stopped taking orders by the proposed arrival.`);
    }
  }
  return { ok: true, plannedEnd: new Date(end).toISOString() };
};

const costFor = (happening: Happening, partySize: number) =>
  (happening.commerce.priceMin ?? 0) * partySize;

const stopCost = (state: LocalBuzzState, stop: PlanStop, partySize: number) => {
  if (isHappeningStop(stop)) {
    const happening = findHappening(state, stop.happeningId);
    return happening ? costFor(happening, partySize) : 0;
  }
  if (isPlaceStop(stop)) return (findPlace(state, stop.placeId)?.priceRange.min ?? 0) * partySize;
  return stop.customPlace.pricePerPerson * partySize;
};

const plannedEnd = (happening: Happening, start: string) => {
  const startMs = Date.parse(start);
  const durationMs = (happening.timing.estimatedDurationMinutes ?? 90) * 60_000;
  const naturalEnd = startMs + durationMs;
  const sourceEnd = occurrenceEndMs(happening);
  return new Date(sourceEnd > startMs ? Math.min(naturalEnd, sourceEnd) : naturalEnd).toISOString();
};

const summarizePlan = (
  state: LocalBuzzState,
  stops: PlanStop[],
  status: EveningPlan["status"],
  constraints: PlanConstraints,
  rationale?: string,
): EveningPlan => {
  const ordered = [...stops].sort(
    (a, b) => Date.parse(a.plannedStart) - Date.parse(b.plannedStart),
  );
  const city = getCityDefinition(state.activeCityId);
  const planDate = ordered[0]
    ? localDate(new Date(ordered[0].plannedStart), city.timeZone)
    : undefined;
  return {
    id: planDate ? `evening-${state.activeCityId}-${planDate}` : state.currentPlan?.id ?? `evening-${state.activeCityId}`,
    status,
    stops: ordered,
    totalEstimatedCost: ordered.reduce((sum, stop) => {
      return sum + stopCost(state, stop, constraints.partySize);
    }, 0),
    startTime: ordered[0]?.plannedStart ?? "",
    endTime: ordered.at(-1)?.plannedEnd ?? "",
    constraints,
    rationale,
  };
};

const hasTimeConflict = (stops: PlanStop[]) => {
  const ordered = [...stops].sort(
    (a, b) => Date.parse(a.plannedStart) - Date.parse(b.plannedStart),
  );
  return ordered.some(
    (stop, index) =>
      index > 0 && Date.parse(ordered[index - 1].plannedEnd) > Date.parse(stop.plannedStart),
  );
};

const error = <T>(
  code: Extract<DomainResult<T>, { ok: false }>["code"],
  message: string,
  suggestion?: string,
): DomainResult<T> => ({ ok: false, code, message, suggestion });

type StateWriter = (next: LocalBuzzState) => void;

export class LocalBuzzActions {
  constructor(
    private readonly read: () => LocalBuzzState,
    private readonly write: StateWriter,
  ) {}

  private update(recipe: (state: LocalBuzzState) => LocalBuzzState) {
    const next = recipe(this.read());
    this.write(next);
    return next;
  }

  proposeEventLead(input: ProposeEventLeadInput): DomainResult<{ lead: DiscoveryLead }> {
    const state = this.read();
    const result = buildEventLead(input, state.activeCityId, state.happenings);
    if (!result.ok) return result;
    if (state.discoveryLeads.some((lead) => lead.id === result.lead.id && !lead.reviewOutcome)) return error("DUPLICATE", "This source is already staged for review.");
    this.update((current) => ({ ...current, discoveryLeads: [result.lead, ...current.discoveryLeads], activityMessage: `Agent proposed ${result.lead.fields.title ?? "an event"}. It is discovery-only until human review.` }));
    return result;
  }

  proposePlaceLead(input: ProposePlaceLeadInput): DomainResult<{ lead: DiscoveryLead }> {
    const state = this.read();
    const result = buildPlaceLead(input, state.activeCityId, state.places);
    if (!result.ok) return result;
    if (state.discoveryLeads.some((lead) => lead.id === result.lead.id && !lead.reviewOutcome)) return error("DUPLICATE", "This source is already staged for review.");
    this.update((current) => ({ ...current, discoveryLeads: [result.lead, ...current.discoveryLeads], activityMessage: `Agent proposed ${result.lead.fields.name ?? "a place"}. It is discovery-only until human review.` }));
    return result;
  }

  acceptDiscoveryLead(leadId: string): DomainResult<{ lead: DiscoveryLead; canonicalId: string }> {
    const state = this.read();
    const lead = state.discoveryLeads.find((item) => item.id === leadId);
    if (!lead) return error("INVALID_INPUT", `Unknown discovery lead: ${leadId}`);
    if (lead.reviewOutcome) return error("INVALID_INPUT", "This discovery lead has already been reviewed.");
    const reviewedAt = new Date().toISOString();
    if (lead.leadType === "event") {
      const canonical = canonicalEventFromLead(lead);
      if (!canonical.ok) return canonical;
      const deduplicated = deduplicateHappenings([...state.happenings, canonical.happening]);
      if (!deduplicated.some((item) => item.id === canonical.happening.id)) return error("DUPLICATE", "The event now matches canonical inventory and cannot be accepted twice.");
      const reviewed: DiscoveryLead = { ...lead, verificationStatus: "verified", reviewedAt, reviewOutcome: "accepted_canonical" };
      this.update((current) => ({ ...current, happenings: [...current.happenings, canonical.happening], discoveryLeads: current.discoveryLeads.map((item) => item.id === leadId ? reviewed : item), visibleHappeningIds: [...current.visibleHappeningIds, canonical.happening.id], activityMessage: `${canonical.happening.title} passed canonical validation and was accepted.` }));
      return { ok: true, lead: reviewed, canonicalId: canonical.happening.id };
    }
    const canonical = canonicalPlaceFromLead(lead);
    if (!canonical.ok) return canonical;
    if (state.places.some((place) => place.name.toLowerCase() === canonical.place.name.toLowerCase() || place.officialWebsite === canonical.place.officialWebsite)) return error("DUPLICATE", "The Place now matches canonical inventory and cannot be accepted twice.");
    const reviewed: DiscoveryLead = { ...lead, verificationStatus: "verified", reviewedAt, reviewOutcome: "accepted_canonical" };
    this.update((current) => ({ ...current, places: [...current.places, canonical.place], discoveryLeads: current.discoveryLeads.map((item) => item.id === leadId ? reviewed : item), visiblePlaceIds: [...current.visiblePlaceIds, canonical.place.id], activityMessage: `${canonical.place.name} passed canonical validation and was accepted.` }));
    return { ok: true, lead: reviewed, canonicalId: canonical.place.id };
  }

  rejectDiscoveryLead(leadId: string): DomainResult<{ lead: DiscoveryLead }> {
    const lead = this.read().discoveryLeads.find((item) => item.id === leadId);
    if (!lead) return error("INVALID_INPUT", `Unknown discovery lead: ${leadId}`);
    if (lead.reviewOutcome) return error("INVALID_INPUT", "This discovery lead has already been reviewed.");
    const reviewed: DiscoveryLead = { ...lead, verificationStatus: "rejected", reviewedAt: new Date().toISOString(), reviewOutcome: "rejected" };
    this.update((current) => ({ ...current, discoveryLeads: current.discoveryLeads.map((item) => item.id === leadId ? reviewed : item), activityMessage: "Discovery lead rejected; canonical inventory is unchanged." }));
    return { ok: true, lead: reviewed };
  }

  keepDiscoveryLeadAsCustom(leadId: string, input: { purpose: PlacePurpose; plannedStart: string; availableFrom: string; availableUntil: string }): DomainResult<{ lead: DiscoveryLead; plan: EveningPlan }> {
    const lead = this.read().discoveryLeads.find((item) => item.id === leadId);
    if (!lead) return error("INVALID_INPUT", `Unknown discovery lead: ${leadId}`);
    if (lead.leadType !== "place") return error("UNSUPPORTED_PLACE", "Only Place leads can become custom Place stops.");
    const fields = lead.fields;
    if (!fields.name || !fields.location?.address || !fields.location.neighborhood || fields.location.lat === undefined || fields.location.lng === undefined || !fields.typicalVisitDurationMinutes || fields.priceRange?.min === undefined) return error("PLACE_DATA_INCOMPLETE", "The Place lead needs name, location, duration and a per-person price before it can be retained as a custom stop.");
    const staged = this.stageCustomPlace({ name: fields.name, purpose: input.purpose, plannedStart: input.plannedStart, location: { address: fields.location.address, neighborhood: fields.location.neighborhood, lat: fields.location.lat, lng: fields.location.lng }, typicalVisitDurationMinutes: fields.typicalVisitDurationMinutes, pricePerPerson: fields.priceRange.min, currency: fields.priceRange.currency, availableFrom: input.availableFrom, availableUntil: input.availableUntil, note: `Discovery lead from ${lead.originalSourceUrl}` }, "Human retained an insufficiently verified discovery lead as custom.");
    if (!staged.ok) return staged;
    const reviewed: DiscoveryLead = { ...lead, verificationStatus: "unverified_custom", reviewedAt: new Date().toISOString(), reviewOutcome: "kept_custom" };
    this.update((current) => ({ ...current, discoveryLeads: current.discoveryLeads.map((item) => item.id === leadId ? reviewed : item), activityMessage: `${fields.name} is staged as an unverified custom stop, not canonical inventory.` }));
    return { ok: true, lead: reviewed, plan: staged.plan };
  }

  searchHappenings(filters: SearchFilters): DomainResult<{ happenings: Happening[]; count: number }> {
    const state = this.read();
    const query = filters.query?.trim().toLowerCase();
    const startAfter = filters.startAfter ? Date.parse(filters.startAfter) : undefined;
    const endBefore = filters.endBefore ? Date.parse(filters.endBefore) : undefined;
    const matches = state.happenings
      .filter((item) => !unavailable.has(item.status.availability))
      .filter((item) => {
        if (!query) return true;
        const text = [
          item.title,
          item.description,
          item.category,
          item.venue.name,
          item.venue.neighborhood,
          ...(item.enrichment?.moodTags ?? []),
        ]
          .join(" ")
          .toLowerCase();
        return query
          .split(/\s+/)
          .filter((token) => !["or", "and", "something"].includes(token))
          .some((token) => text.includes(token));
      })
      .filter((item) => {
        if (startAfter === undefined) return true;
        return Date.parse(item.timing.end ?? item.timing.start) > startAfter;
      })
      .filter((item) => (endBefore === undefined ? true : Date.parse(item.timing.start) < endBefore))
      .filter((item) =>
        filters.maxPrice === undefined
          ? true
          : (item.commerce.priceMin ?? 0) <= filters.maxPrice,
      )
      .filter((item) =>
        filters.categories?.length ? filters.categories.includes(item.category) : true,
      )
      .filter((item) => {
        if (!filters.near || filters.maxDistanceKm === undefined) return true;
        return distanceKm(filters.near, item.venue) <= filters.maxDistanceKm;
      })
      .sort((a, b) => {
        if (filters.near) {
          const byDistance = distanceKm(filters.near, a.venue) - distanceKm(filters.near, b.venue);
          if (Math.abs(byDistance) > 0.1) return byDistance;
        }
        return Date.parse(a.timing.start) - Date.parse(b.timing.start);
      })
      .slice(0, filters.maxResults ?? 12);

    this.update((current) => ({
      ...current,
      filters,
      activityMessage: `Agent search found ${matches.length} actionable happenings.`,
    }));
    return { ok: true, happenings: matches, count: matches.length };
  }

  showCandidates(ids: string[], reason?: string): DomainResult<{ visibleCount: number }> {
    const state = this.read();
    const invalid = ids.find((id) => !findHappening(state, id));
    if (invalid) return error("INVALID_HAPPENING_ID", `Unknown happening: ${invalid}`);
    this.update((current) => ({
      ...current,
      visibleHappeningIds: ids,
      candidateHappeningIds: ids,
      candidateReason: reason,
      selectedHappeningId: ids[0],
      activityMessage: `${ids.length} candidates are now visible on the shared map.`,
    }));
    return { ok: true, visibleCount: ids.length };
  }

  showListings(ids: string[], message?: string): DomainResult<{ visibleCount: number }> {
    const state = this.read();
    const invalid = ids.find((id) => !findHappening(state, id));
    if (invalid) return error("INVALID_HAPPENING_ID", `Unknown happening: ${invalid}`);
    this.update((current) => ({
      ...current,
      visibleHappeningIds: ids,
      candidateHappeningIds: [],
      candidateReason: undefined,
      selectedHappeningId: undefined,
      activityMessage: message ?? `${ids.length} happenings are visible.`,
    }));
    return { ok: true, visibleCount: ids.length };
  }

  searchPlaces(filters: PlaceSearchFilters): DomainResult<{ places: Place[]; count: number }> {
    const state = this.read();
    const city = getCityDefinition(state.activeCityId);
    const query = filters.query?.trim().toLowerCase();
    const matches = state.places
      .filter((item) => {
        if (!query) return true;
        return [item.name, item.kind, item.location.neighborhood, ...item.cuisine, ...item.drinkFocus, ...item.moodTags, ...item.bestFor]
          .join(" ").toLowerCase().includes(query);
      })
      .filter((item) => filters.kinds?.length ? filters.kinds.includes(item.kind) : true)
      .filter((item) => filters.purposes?.length ? filters.purposes.some((purpose) => item.bestFor.includes(purpose)) : true)
      .filter((item) => filters.moods?.length ? filters.moods.some((mood) => item.moodTags.includes(mood)) : true)
      .filter((item) => filters.neighborhoods?.length ? filters.neighborhoods.includes(item.location.neighborhood) : true)
      .filter((item) => filters.maxPrice === undefined ? true : item.priceRange.min !== undefined && item.priceRange.min <= filters.maxPrice)
      .filter((item) => filters.openAt ? Boolean(placeOpenWindow(item, filters.openAt, city.timeZone)) : true)
      .filter((item) => !filters.near || filters.maxDistanceKm === undefined ? true : distanceKm(filters.near, item.location) <= filters.maxDistanceKm)
      .sort((a, b) => filters.near ? distanceKm(filters.near, a.location) - distanceKm(filters.near, b.location) : a.name.localeCompare(b.name))
      .slice(0, filters.maxResults ?? 12);
    this.update((current) => ({ ...current, placeFilters: filters, activityMessage: `Agent search found ${matches.length} place candidates.` }));
    return { ok: true, places: matches, count: matches.length };
  }

  showPlaceCandidates(ids: string[], reason?: string): DomainResult<{ visibleCount: number }> {
    const state = this.read();
    const invalid = ids.find((id) => !findPlace(state, id));
    if (invalid) return error("INVALID_PLACE_ID", `Unknown place: ${invalid}`);
    this.update((current) => ({
      ...current,
      visiblePlaceIds: ids,
      candidatePlaceIds: ids,
      selectedPlaceId: ids[0],
      candidateReason: reason,
      activityMessage: `${ids.length} place candidates are now visible on the shared map.`,
    }));
    return { ok: true, visibleCount: ids.length };
  }

  showPlaceListings(ids: string[], message?: string): DomainResult<{ visibleCount: number }> {
    const state = this.read();
    const invalid = ids.find((id) => !findPlace(state, id));
    if (invalid) return error("INVALID_PLACE_ID", `Unknown place: ${invalid}`);
    this.update((current) => ({
      ...current,
      visiblePlaceIds: ids,
      candidatePlaceIds: [],
      selectedPlaceId: undefined,
      candidateReason: undefined,
      activityMessage: message ?? `${ids.length} places are visible.`,
    }));
    return { ok: true, visibleCount: ids.length };
  }

  readPlaceDetails(placeId: string): DomainResult<{ place: Place }> {
    const placeItem = findPlace(this.read(), placeId);
    return placeItem ? { ok: true, place: placeItem } : error("INVALID_PLACE_ID", `Unknown place: ${placeId}`);
  }

  private stageAdditionalStop(stop: PlanStop, reason?: string, warnings: string[] = []): DomainResult<{ plan: EveningPlan; warnings: string[] }> {
    const state = this.read();
    const base = state.stagedPlan ?? state.currentPlan;
    const city = getCityDefinition(state.activeCityId);
    const date = localDate(new Date(stop.plannedStart), city.timeZone);
    const constraints = base?.constraints ?? {
      ...city.constraints,
      latestEndTime: localDateTimeToIso(shiftIsoDate(date, 1), "00:00:00", city.timeZone),
    };
    const stops = [...(base?.stops ?? []), stop];
    if (hasTimeConflict(stops)) return error("TIME_CONFLICT", "The place stop overlaps another stop.");
    const plan = summarizePlan(state, stops, "staged", constraints, reason ?? base?.rationale);
    if (Date.parse(plan.endTime) > Date.parse(constraints.latestEndTime)) return error("TIME_CONFLICT", "The place visit ends after the night's latest-end constraint.");
    if (plan.totalEstimatedCost > constraints.budget) return error("BUDGET_CONFLICT", `Estimated total is ${plan.totalEstimatedCost} ${constraints.currency}, above the ${constraints.budget} ${constraints.currency} budget.`);
    const change: PlanChange = { id: `change-add-${stop.id}`, type: "add", after: stop, reason, status: "staged" };
    this.update((current) => ({
      ...current,
      stagedPlan: plan,
      stagedChanges: [...current.stagedChanges, change],
      visiblePlaceIds: stop.kind === "place" ? Array.from(new Set([...current.visiblePlaceIds, stop.placeId])) : current.visiblePlaceIds,
      activityMessage: `A ${plan.stops.length}-stop mixed night is staged for review—not committed.`,
    }));
    return { ok: true, plan, warnings };
  }

  stagePlaceStop(input: StagePlaceStopInput, reason?: string): DomainResult<{ plan: EveningPlan; warnings: string[] }> {
    const state = this.read();
    const placeItem = findPlace(state, input.placeId);
    if (!placeItem) return error("INVALID_PLACE_ID", `Unknown place: ${input.placeId}`);
    if (!placeItem.bestFor.includes(input.purpose)) return error("INVALID_INPUT", `${placeItem.name} is not catalogued for ${input.purpose.replace("_", " ")}.`);
    if (placeItem.reservationMode === "required") return error("RESERVATION_CONFLICT", `${placeItem.name} requires a reservation, which conflicts with this spontaneous plan.`);
    const base = state.stagedPlan ?? state.currentPlan;
    const constraints = base?.constraints ?? getCityDefinition(state.activeCityId).constraints;
    if (placeItem.priceRange.currency !== constraints.currency) return error("CURRENCY_CONFLICT", `${placeItem.name}'s price currency does not match this night.`);
    const visit = validatePlaceVisit(placeItem, input.purpose, input.plannedStart, getCityDefinition(state.activeCityId).timeZone);
    if (!visit.ok) return visit;
    const stop: PlanStop = {
      id: `stop-${Math.max(0, ...(base?.stops.map((item) => Number(item.id.match(/\d+$/)?.[0] ?? 0)) ?? [])) + 1}`,
      kind: "place", placeId: input.placeId, purpose: input.purpose,
      plannedStart: input.plannedStart, plannedEnd: visit.plannedEnd,
      locked: false, status: "proposed",
    };
    const verifiedAt = placeItem.verification.verifiedAt ? Date.parse(placeItem.verification.verifiedAt) : Number.NaN;
    const warnings = [
      ...(placeItem.verification.status !== "verified" ? [`${placeItem.name} is marked ${placeItem.verification.status.replace("_", " ")}; review its official source before relying on it.`] : []),
      ...(Number.isFinite(verifiedAt) && Date.now() - verifiedAt > 90 * 24 * 60 * 60_000 ? [`${placeItem.name}'s verification is older than 90 days.`] : []),
      ...(placeItem.exceptionalHours.status === "unknown" ? [`Exceptional hours are unknown for ${placeItem.name}.`] : []),
      ...(placeItem.reservationMode === "recommended" ? [`A reservation is recommended at ${placeItem.name}.`] : []),
    ];
    return this.stageAdditionalStop(stop, reason, warnings);
  }

  stageHappeningStop(input: StageStopInput, reason?: string): DomainResult<{ plan: EveningPlan; warnings: string[] }> {
    const state = this.read();
    const happening = findHappening(state, input.happeningId);
    if (!happening) return error("INVALID_HAPPENING_ID", `Unknown happening: ${input.happeningId}`);
    if (unavailable.has(happening.status.availability)) return error("HAPPENING_UNAVAILABLE", `${happening.title} is unavailable.`);
    if (!canAttendAt(happening, input.plannedStart)) return error("TIME_CONFLICT", `${happening.title} is not happening at the proposed start time.`);
    const base = state.stagedPlan ?? state.currentPlan;
    const stop: PlanStop = {
      id: `stop-${Math.max(0, ...(base?.stops.map((item) => Number(item.id.match(/\d+$/)?.[0] ?? 0)) ?? [])) + 1}`,
      kind: "happening", happeningId: input.happeningId, plannedStart: input.plannedStart,
      plannedEnd: plannedEnd(happening, input.plannedStart), locked: false, status: "proposed",
    };
    return this.stageAdditionalStop(stop, reason);
  }

  stageCustomPlace(input: StageCustomPlaceInput, reason?: string): DomainResult<{ plan: EveningPlan; warnings: string[] }> {
    const state = this.read();
    const base = state.stagedPlan ?? state.currentPlan;
    if (!input.name.trim() || input.typicalVisitDurationMinutes <= 0 || input.pricePerPerson < 0) return error("INVALID_INPUT", "Custom places need a name, positive duration and non-negative per-person price.");
    if (input.currency !== (base?.constraints.currency ?? getCityDefinition(state.activeCityId).currency)) return error("CURRENCY_CONFLICT", "Custom place currency must match the active night.");
    const start = Date.parse(input.plannedStart);
    const availableFrom = Date.parse(input.availableFrom);
    const availableUntil = Date.parse(input.availableUntil);
    const end = start + input.typicalVisitDurationMinutes * 60_000;
    if (![start, availableFrom, availableUntil].every(Number.isFinite) || start < availableFrom || end > availableUntil) return error("PLACE_CLOSED", "The custom place's stated availability does not cover the full planned visit.");
    if (input.location.lat < -90 || input.location.lat > 90 || input.location.lng < -180 || input.location.lng > 180) return error("INVALID_INPUT", "Custom place coordinates are invalid.");
    const stop: PlanStop = {
      id: `stop-${Math.max(0, ...(base?.stops.map((item) => Number(item.id.match(/\d+$/)?.[0] ?? 0)) ?? [])) + 1}`,
      kind: "custom_place", purpose: input.purpose,
      customPlace: {
        name: input.name.trim(), location: input.location, typicalVisitDurationMinutes: input.typicalVisitDurationMinutes,
        pricePerPerson: input.pricePerPerson, currency: input.currency, availableFrom: input.availableFrom,
        availableUntil: input.availableUntil, note: input.note, verification: { status: "unverified" },
      },
      plannedStart: input.plannedStart, plannedEnd: new Date(end).toISOString(), locked: false, status: "proposed",
    };
    return this.stageAdditionalStop(stop, reason, ["Custom place assumptions are unverified and must be reviewed before acceptance."]);
  }

  replaceCityHappenings(
    cityId: CityId,
    happenings: Happening[],
    message: string,
    now = new Date(),
  ): DomainResult<{ applied: boolean; count: number }> {
    const state = this.read();
    if (state.activeCityId !== cityId) return { ok: true, applied: false, count: 0 };
    if (happenings.some((item) => item.cityId !== cityId)) {
      return error("INVALID_INPUT", "Fresh happenings must belong to the active city.");
    }
    const incomingIds = new Set(happenings.map((item) => item.id));
    const retainedSnapshots = state.happenings.filter((item) => !incomingIds.has(item.id));
    const merged = [...happenings, ...retainedSnapshots];
    this.update((current) => ({
      ...current,
      happenings: merged,
      filters: {},
      visibleHappeningIds: currentHappeningIds(merged, cityId, now),
      candidateHappeningIds: [],
      candidateReason: undefined,
      selectedHappeningId: undefined,
      activityMessage: message,
    }));
    return { ok: true, applied: true, count: merged.length };
  }

  stagePlan(
    stopInputs: StageStopInput[],
    rationale?: string,
    constraints?: PlanConstraints,
  ): DomainResult<{ plan: EveningPlan; warnings: string[] }> {
    if (stopInputs.length === 0) return error("INVALID_INPUT", "A plan needs at least one stop.");
    const state = this.read();
    const invalidStart = stopInputs.find((input) => !Number.isFinite(Date.parse(input.plannedStart)));
    if (invalidStart) return error("INVALID_INPUT", `Invalid planned start: ${invalidStart.plannedStart}`);
    const city = getCityDefinition(state.activeCityId);
    const earliestStart = Math.min(...stopInputs.map((input) => Date.parse(input.plannedStart)));
    const planDate = localDate(new Date(earliestStart), city.timeZone);
    const planConstraints = constraints ?? {
      ...city.constraints,
      latestEndTime: localDateTimeToIso(
        shiftIsoDate(planDate, 1),
        "00:00:00",
        city.timeZone,
      ),
    };
    if (!Number.isFinite(Date.parse(planConstraints.latestEndTime))) {
      return error("INVALID_INPUT", "The latest end time must be a valid ISO date-time.");
    }
    const stops: PlanStop[] = [];
    for (const [index, input] of stopInputs.entries()) {
      const happening = findHappening(state, input.happeningId);
      if (!happening) return error("INVALID_HAPPENING_ID", `Unknown happening: ${input.happeningId}`);
      if (unavailable.has(happening.status.availability)) {
        return error("HAPPENING_UNAVAILABLE", `${happening.title} is unavailable.`);
      }
      if (!canAttendAt(happening, input.plannedStart)) {
        return error(
          "TIME_CONFLICT",
          `${happening.title} is not happening at the proposed start time.`,
          "Use a planned start within the source occurrence window.",
        );
      }
      stops.push({
        id: `stop-${index + 1}`,
        kind: "happening",
        happeningId: input.happeningId,
        plannedStart: input.plannedStart,
        plannedEnd: plannedEnd(happening, input.plannedStart),
        locked: false,
        status: "proposed",
      });
    }
    if (hasTimeConflict(stops)) {
      return error("TIME_CONFLICT", "At least two proposed stops overlap.", "Adjust planned start times.");
    }
    const plan = summarizePlan(state, stops, "staged", planConstraints, rationale);
    if (Date.parse(plan.endTime) > Date.parse(planConstraints.latestEndTime)) {
      return error(
        "TIME_CONFLICT",
        `The plan ends after the ${planConstraints.latestEndTime} latest-end constraint.`,
        "Remove or retime the final stop.",
      );
    }
    if (plan.totalEstimatedCost > planConstraints.budget) {
      return error(
        "BUDGET_CONFLICT",
        `Estimated total is ${plan.totalEstimatedCost} ${planConstraints.currency}, above the ${planConstraints.budget} ${planConstraints.currency} budget.`,
      );
    }
    const changes: PlanChange[] = stops.map((stop, index) => ({
      id: `change-add-${index + 1}`,
      type: "add",
      after: stop,
      status: "staged",
      reason: rationale,
    }));
    this.update((current) => ({
      ...current,
      stagedPlan: plan,
      stagedChanges: changes,
      visibleHappeningIds: Array.from(new Set([...current.visibleHappeningIds, ...stops.filter(isHappeningStop).map((s) => s.happeningId)])),
      activityMessage: `A ${stops.length}-stop night is staged for review—not committed.`,
    }));
    return { ok: true, plan, warnings: [] };
  }

  readCurrentPlan(): DomainResult<{
    city: { id: CityId; name: string; currency: string; timeZone: string };
    currentPlan: EveningPlan | null;
    stagedPlan: EveningPlan | null;
    stagedChanges: PlanChange[];
    liveUpdates: LiveUpdate[];
  }> {
    const state = this.read();
    const city = getCityDefinition(state.activeCityId);
    return {
      ok: true,
      city: { id: city.id, name: city.name, currency: city.currency, timeZone: city.timeZone },
      currentPlan: state.currentPlan,
      stagedPlan: state.stagedPlan,
      stagedChanges: state.stagedChanges,
      liveUpdates: state.liveUpdates,
    };
  }

  lockPlanStop(stopId: string): DomainResult<{ stopId: string; locked: true }> {
    return this.setStopLock(stopId, true) as DomainResult<{ stopId: string; locked: true }>;
  }

  unlockPlanStop(stopId: string): DomainResult<{ stopId: string; locked: false }> {
    return this.setStopLock(stopId, false) as DomainResult<{ stopId: string; locked: false }>;
  }

  private setStopLock(stopId: string, locked: boolean): DomainResult<{ stopId: string; locked: boolean }> {
    const state = this.read();
    const sourcePlan = state.stagedPlan ?? state.currentPlan;
    if (!sourcePlan) return error("PLAN_NOT_FOUND", "There is no active or staged plan.");
    if (!sourcePlan.stops.some((stop) => stop.id === stopId)) {
      return error("INVALID_STOP_ID", `Unknown plan stop: ${stopId}`);
    }
    const apply = (plan: EveningPlan | null) =>
      plan
        ? {
            ...plan,
            stops: plan.stops.map((stop) => (stop.id === stopId ? { ...stop, locked } : stop)),
          }
        : null;
    this.update((current) => ({
      ...current,
      currentPlan: apply(current.currentPlan),
      stagedPlan: apply(current.stagedPlan),
      activityMessage: locked
        ? "Human decision recorded: this stop must survive repair."
        : "Stop unlocked and available for repair.",
    }));
    return { ok: true, stopId, locked };
  }

  removePlanStop(stopId: string): DomainResult<{ stopId: string }> {
    const state = this.read();
    const sourcePlan = state.stagedPlan ?? state.currentPlan;
    if (!sourcePlan) return error("PLAN_NOT_FOUND", "There is no active or staged plan.");
    const target = sourcePlan.stops.find((stop) => stop.id === stopId);
    if (!target) return error("INVALID_STOP_ID", `Unknown plan stop: ${stopId}`);
    if (target.locked) return error("LOCKED_STOP_CONFLICT", "Unlock the stop before removing it.");
    const stops = sourcePlan.stops.filter((stop) => stop.id !== stopId);
    const plan = summarizePlan(state, stops, sourcePlan.status, sourcePlan.constraints, sourcePlan.rationale);
    this.update((current) => ({
      ...current,
      stagedPlan: current.stagedPlan ? plan : null,
      currentPlan: current.stagedPlan ? current.currentPlan : { ...plan, status: "accepted" },
      activityMessage: "Human edit applied directly to the shared plan.",
    }));
    return { ok: true, stopId };
  }

  replacePlanStop(stopId: string, replacementHappeningId: string): DomainResult<{ stop: PlanStop }> {
    const state = this.read();
    const sourcePlan = state.stagedPlan ?? state.currentPlan;
    if (!sourcePlan) return error("PLAN_NOT_FOUND", "There is no active or staged plan.");
    const target = sourcePlan.stops.find((stop) => stop.id === stopId);
    if (!target) return error("INVALID_STOP_ID", `Unknown plan stop: ${stopId}`);
    if (!isHappeningStop(target)) return error("INVALID_INPUT", "Event replacement can only target a happening stop.");
    if (target.locked) return error("LOCKED_STOP_CONFLICT", "Unlock the stop before replacing it.");
    const replacement = findHappening(state, replacementHappeningId);
    if (!replacement) return error("INVALID_HAPPENING_ID", `Unknown happening: ${replacementHappeningId}`);
    if (unavailable.has(replacement.status.availability)) {
      return error("HAPPENING_UNAVAILABLE", `${replacement.title} is unavailable.`);
    }
    const start = new Date(
      Math.max(Date.parse(target.plannedStart), Date.parse(replacement.timing.start)),
    ).toISOString();
    if (!canAttendAt(replacement, start)) {
      return error(
        "TIME_CONFLICT",
        `${replacement.title} is not happening at the replacement time.`,
        "Choose a replacement occurrence that overlaps this stop's time window.",
      );
    }
    const stop: PlanStop = {
      ...target,
      happeningId: replacementHappeningId,
      plannedStart: start,
      plannedEnd: plannedEnd(replacement, start),
      status: sourcePlan.status === "staged" ? "proposed" : "accepted",
    };
    const stops = sourcePlan.stops.map((item) => (item.id === stopId ? stop : item));
    if (hasTimeConflict(stops)) return error("TIME_CONFLICT", "The replacement overlaps another stop.");
    const plan = summarizePlan(state, stops, sourcePlan.status, sourcePlan.constraints, sourcePlan.rationale);
    if (Date.parse(plan.endTime) > Date.parse(plan.constraints.latestEndTime)) {
      return error("TIME_CONFLICT", "The replacement would end after the night’s latest-end constraint.");
    }
    if (plan.totalEstimatedCost > plan.constraints.budget) {
      return error("BUDGET_CONFLICT", "The replacement would exceed the night’s budget.");
    }
    this.update((current) => ({
      ...current,
      stagedPlan: current.stagedPlan ? plan : null,
      currentPlan: current.stagedPlan ? current.currentPlan : { ...plan, status: "accepted" },
      visibleHappeningIds: Array.from(new Set([...current.visibleHappeningIds, replacementHappeningId])),
      activityMessage: "Human replacement applied; the agent can now read this changed state.",
    }));
    return { ok: true, stop };
  }

  repairPlan(input: RepairInput): DomainResult<{
    changedStopIds: string[];
    preservedLockedStopIds: string[];
    plan: EveningPlan;
    warnings: string[];
  }> {
    const state = this.read();
    const base = state.stagedPlan ?? state.currentPlan;
    if (!base) return error("PLAN_NOT_FOUND", "There is no plan to repair.");
    const broken = base.stops.filter((stop): stop is Extract<PlanStop, { kind: "happening" }> => {
      if (!isHappeningStop(stop)) return false;
      const happening = findHappening(state, stop.happeningId);
      return stop.status === "conflict" || stop.status === "unavailable" || !happening || unavailable.has(happening.status.availability);
    });
    if (broken.length === 0) {
      return error("NO_REPAIR_FOUND", "The current plan has no disrupted stop to repair.");
    }
    const lockedBroken = broken.find((stop) => stop.locked);
    if (lockedBroken && input.preserveLockedStops !== false) {
      return error(
        "LOCKED_STOP_CONFLICT",
        "The disrupted stop is locked and cannot be silently replaced.",
        "Ask the human to unlock it or preserve it as a known conflict.",
      );
    }
    const candidateIds = input.replacementHappeningIds?.length
      ? input.replacementHappeningIds
      : state.candidateHappeningIds;
    const replacements = candidateIds
      .map((id) => findHappening(state, id))
      .filter((item): item is Happening => Boolean(item))
      .filter((item) => !unavailable.has(item.status.availability))
      .filter((item) => !base.stops.some((stop) => isHappeningStop(stop) && stop.happeningId === item.id));

    const repairedStops = [...base.stops];
    const changes: PlanChange[] = [];
    for (const target of broken) {
      const targetIndex = repairedStops.findIndex((stop) => stop.id === target.id);
      const previous = targetIndex > 0 ? repairedStops[targetIndex - 1] : undefined;
      const next = targetIndex < repairedStops.length - 1 ? repairedStops[targetIndex + 1] : undefined;
      const replacement = replacements.find((candidate) => {
        const start = Math.max(Date.parse(target.plannedStart), Date.parse(candidate.timing.start));
        const plannedStart = new Date(start).toISOString();
        if (!canAttendAt(candidate, plannedStart)) return false;
        const end = Date.parse(plannedEnd(candidate, plannedStart));
        return (
          (!previous || Date.parse(previous.plannedEnd) <= start) &&
          (!next || end <= Date.parse(next.plannedStart)) &&
          end <= Date.parse(base.constraints.latestEndTime)
        );
      });
      if (!replacement) {
        return error(
          "NO_REPAIR_FOUND",
          `No supplied replacement fits around ${target.id}.`,
          "Search for another nearby happening in the available time window.",
        );
      }
      const start = new Date(
        Math.max(Date.parse(target.plannedStart), Date.parse(replacement.timing.start)),
      ).toISOString();
      const repaired: PlanStop = {
        ...target,
        happeningId: replacement.id,
        plannedStart: start,
        plannedEnd: plannedEnd(replacement, start),
        locked: false,
        status: "proposed",
      };
      repairedStops[targetIndex] = repaired;
      changes.push({
        id: `change-repair-${target.id}`,
        type: "replace",
        stopId: target.id,
        before: target,
        after: repaired,
        reason: input.reason,
        status: "staged",
      });
    }
    const plan = summarizePlan(state, repairedStops, "staged", base.constraints, input.reason);
    if (plan.totalEstimatedCost > plan.constraints.budget) {
      return error("BUDGET_CONFLICT", "The available repair would exceed the night’s budget.");
    }
    const preservedLockedStopIds = base.stops.filter((stop) => stop.locked).map((stop) => stop.id);
    this.update((current) => ({
      ...current,
      stagedPlan: plan,
      stagedChanges: changes,
      visibleHappeningIds: Array.from(new Set([...current.visibleHappeningIds, ...plan.stops.filter(isHappeningStop).map((s) => s.happeningId)])),
      activityMessage: `Repair staged: ${changes.length} stop changed; ${preservedLockedStopIds.length} locked stop preserved.`,
    }));
    return {
      ok: true,
      changedStopIds: changes.map((change) => change.stopId ?? ""),
      preservedLockedStopIds,
      plan,
      warnings: [],
    };
  }

  acceptStagedChanges(): DomainResult<{ plan: EveningPlan }> {
    const state = this.read();
    if (!state.stagedPlan) return error("NO_STAGED_CHANGES", "There are no staged changes to accept.");
    const plan: EveningPlan = {
      ...state.stagedPlan,
      status: "accepted",
      stops: state.stagedPlan.stops.map((stop) => ({
        ...stop,
        status: isHappeningStop(stop) && unavailable.has(findHappening(state, stop.happeningId)?.status.availability ?? "unknown")
          ? "unavailable"
          : "accepted",
      })),
    };
    this.update((current) => ({
      ...current,
      currentPlan: plan,
      stagedPlan: null,
      stagedChanges: [],
      activityMessage: "The human accepted the staged night. It is now canonical.",
    }));
    return { ok: true, plan };
  }

  rejectStagedChanges(): DomainResult<{ rejectedChangeCount: number }> {
    const state = this.read();
    if (!state.stagedPlan) return error("NO_STAGED_CHANGES", "There are no staged changes to reject.");
    const rejectedChangeCount = state.stagedChanges.length;
    this.update((current) => ({
      ...current,
      stagedPlan: null,
      stagedChanges: [],
      activityMessage: "Staged agent changes rejected; canonical state is untouched.",
    }));
    return { ok: true, rejectedChangeCount };
  }

  applyLiveUpdate(update: LiveUpdate): DomainResult<{ happeningId: string; affectedStopIds: string[] }> {
    const state = this.read();
    if (!findHappening(state, update.happeningId)) {
      return error("INVALID_HAPPENING_ID", `Unknown happening: ${update.happeningId}`);
    }
    const affectPlan = (plan: EveningPlan | null) =>
      plan
        ? {
            ...plan,
            stops: plan.stops.map((stop) =>
              isHappeningStop(stop) && stop.happeningId === update.happeningId
                ? { ...stop, status: "unavailable" as const }
                : stop,
            ),
          }
        : null;
    const affectedStopIds = [state.currentPlan, state.stagedPlan]
      .flatMap((plan) => plan?.stops ?? [])
      .filter((stop) => isHappeningStop(stop) && stop.happeningId === update.happeningId)
      .map((stop) => stop.id);
    this.update((current) => ({
      ...current,
      happenings: current.happenings.map((item) =>
        item.id === update.happeningId
          ? {
              ...item,
              status: {
                availability: update.availability,
                statusUpdatedAt: update.appliedAt,
                statusSource: "demo_simulation",
              },
            }
          : item,
      ),
      currentPlan: affectPlan(current.currentPlan),
      stagedPlan: affectPlan(current.stagedPlan),
      liveUpdates: [...current.liveUpdates, update],
      activityMessage: "Demo simulation: a selected event is now unavailable. The night needs repair.",
    }));
    return { ok: true, happeningId: update.happeningId, affectedStopIds };
  }

  selectHappening(id: string | undefined) {
    this.update((state) => ({ ...state, selectedHappeningId: id, selectedPlaceId: undefined }));
  }

  selectPlace(id: string | undefined) {
    this.update((state) => ({ ...state, selectedPlaceId: id, selectedHappeningId: undefined }));
  }

  setWebMcpStatus(webMcp: LocalBuzzState["webMcp"]) {
    this.update((state) => ({ ...state, webMcp }));
  }

  switchCity(cityId: CityId) {
    if (cityId === this.read().activeCityId) return;
    const status = this.read().webMcp;
    this.write({ ...createInitialState(cityId), webMcp: status });
  }

  resetDemo() {
    const { activeCityId, webMcp } = this.read();
    this.write({ ...createInitialState(activeCityId), webMcp });
  }
}
