import { getCityDefinition } from "../data/cities";
import { eventSourceDescriptorsForCity } from "../data/eventSources";
import { localDate, localDateTimeToIso, shiftIsoDate } from "../lib/timeSearch";
import type {
  CityId,
  CityEventSnapshotWire,
  DiscoveryLead,
  DomainResult,
  EveningPlan,
  EventInventoryState,
  EventSourceState,
  Happening,
  LiveUpdate,
  LocalBuzzState,
  Place,
  PlacePurpose,
  PlaceSearchFilters,
  PlanConstraints,
  PlanStop,
  SearchFilters,
} from "./types";
import { buildEventLead, buildPlaceLead, canonicalEventFromLead, canonicalPlaceFromLead, type ProposeEventLeadInput, type ProposePlaceLeadInput } from "./discovery";
import { deduplicateHappenings } from "./happeningDedup";
import { isNightlyHappening, occurrenceEndMs } from "./happeningTiming";
import { mergePulseIntoHappenings, pulseSourceStatus, type CityPulsePayload } from "./cityPulse";

export type PlanHappeningInput = { happeningId: string; plannedStart: string };
export type AddPlaceStopInput = { placeId: string; purpose: PlacePurpose; plannedStart: string; budget?: number | null };
export type AddCustomPlaceStopInput = {
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
  budget?: number | null;
};
export type RepairInput = {
  reason: string;
  preserveLockedStops?: boolean;
  replacementHappeningIds?: string[];
};

const unavailable = new Set(["sold_out", "cancelled"]);

const currentHappeningIds = (happenings: Happening[], cityId: CityId, now: Date) => {
  const city = getCityDefinition(cityId);
  const cityDate = localDate(now, city.timeZone);
  const endOfToday = Date.parse(
    localDateTimeToIso(shiftIsoDate(cityDate, 1), "00:00:00", city.timeZone),
  );
  return happenings
    .filter((item) => item.cityId === cityId && isNightlyHappening(item) && !unavailable.has(item.status.availability))
    .filter((item) => occurrenceEndMs(item) > now.getTime())
    .filter((item) => Date.parse(item.timing.start) < endOfToday)
    .map((item) => item.id);
};

const isUnexpiredHappening = (item: Happening, cityId: CityId, now: Date) =>
  item.cityId === cityId && isNightlyHappening(item) && !unavailable.has(item.status.availability) && occurrenceEndMs(item) > now.getTime();

const buildInitialEventInventory = (cityId: CityId, happenings: Happening[], now: Date): EventInventoryState => {
  const currentCount = happenings.filter((item) => isUnexpiredHappening(item, cityId, now)).length;
  const expiredCount = happenings.filter((item) => item.cityId === cityId && occurrenceEndMs(item) <= now.getTime()).length;
  const attemptedAt = now.toISOString();
  const bundled: EventSourceState = {
    sourceId: `bundled-${cityId}-prototype-snapshot`,
    publisher: `${getCityDefinition(cityId).name} prototype snapshot`,
    status: "retained",
    attemptedAt,
    acceptedCount: 0,
    rejectedCount: 0,
    retainedCount: currentCount,
    expiredCount,
    emptySuccessful: false,
    message: expiredCount
      ? `${expiredCount} historical snapshot record${expiredCount === 1 ? " is" : "s are"} retained for provenance and excluded from current results.`
      : "Checked-in, unexpired prototype records are retained while permitted sources refresh.",
  };
  const configured = eventSourceDescriptorsForCity(cityId).map((source): EventSourceState => ({
    sourceId: source.sourceId,
    publisher: source.publisher,
    status: source.enabled ? "refreshing" : "disabled",
    attemptedAt,
    acceptedCount: 0,
    rejectedCount: 0,
    retainedCount: 0,
    expiredCount: 0,
    emptySuccessful: false,
    message: source.enabled ? "Startup refresh is in progress." : source.disabledReason,
  }));
  return {
    cityId,
    refreshId: "startup-pending",
    refreshing: configured.some((source) => source.status === "refreshing"),
    currentCount,
    retainedCount: currentCount,
    expiredCount,
    sources: [bundled, ...configured],
  };
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
  const initialHappenings = city.happenings.filter(isNightlyHappening);
  const visibleIds = currentHappeningIds(initialHappenings, cityId, now);
  return {
    activeCityId: cityId,
    happenings: initialHappenings.map((item) => structuredClone(item)),
    places: city.places.map((item) => structuredClone(item)),
    filters: {},
    placeFilters: {},
    visibleHappeningIds: visibleIds,
    candidateHappeningIds: [],
    visiblePlaceIds: city.places.map((item) => item.id),
    candidatePlaceIds: [],
    currentPlan: null,
    liveUpdates: [],
    eventInventory: buildInitialEventInventory(cityId, initialHappenings, now),
    discoveryLeads: [],
    discoveryMode: visibleIds.length ? "events" : "places",
    activityMessage: visibleIds.length
      ? `${visibleIds.length} current prototype events and ${city.places.length} canonical places are available while sources refresh.`
      : `No current events are retained. ${city.places.length} canonical places are ready to browse while sources refresh.`,
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
    return error("PLACE_DATA_INCOMPLETE", `${place.name} does not have a usable per-person price range.`, "Check the official source or add it as a custom place with explicit assumptions.");
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
  if (happening.timing.end) return new Date(happening.timing.end).toISOString();
  return new Date(Date.parse(start) + (happening.timing.estimatedDurationMinutes ?? 90) * 60_000).toISOString();
};

const unknownPriceStop = (state: LocalBuzzState, stops: PlanStop[]) => stops.find((stop) =>
  isHappeningStop(stop) && findHappening(state, stop.happeningId)?.commerce.priceMin === undefined,
);

const summarizePlan = (
  state: LocalBuzzState,
  stops: PlanStop[],
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

export const recheckPlanOperationalReadiness = (
  state: LocalBuzzState,
  plan: EveningPlan,
  now = new Date(),
): DomainResult<{ warnings: string[] }> => {
  const warnings: string[] = [];
  const timeZone = getCityDefinition(state.activeCityId).timeZone;
  for (const stop of plan.stops) {
    if (isHappeningStop(stop)) {
      const happening = findHappening(state, stop.happeningId);
      if (!happening) return error("INVALID_HAPPENING_ID", `Unknown happening: ${stop.happeningId}`);
      if (!isNightlyHappening(happening)) return error("HAPPENING_UNAVAILABLE", `${happening.title} is not an eligible single-night event.`);
      if (unavailable.has(happening.status.availability)) return error("HAPPENING_UNAVAILABLE", `${happening.title} is ${happening.status.availability.replace("_", " ")} and cannot remain in the itinerary.`);
      if (occurrenceEndMs(happening) <= now.getTime()) return error("HAPPENING_UNAVAILABLE", `${happening.title} has already ended and cannot remain in the itinerary.`);
      if (plan.constraints.budget !== undefined && happening.commerce.priceMin === undefined) return error("BUDGET_CONFLICT", `${happening.title} has no confirmed minimum price, so the explicit budget cannot be checked.`);
      const verifiedAt = Date.parse(happening.source.lastVerifiedAt ?? happening.source.fetchedAt ?? "");
      if (!Number.isFinite(verifiedAt) || now.getTime() - verifiedAt > 14 * 24 * 60 * 60_000) warnings.push(`${happening.title}'s source evidence is stale or undated.`);
      continue;
    }
    if (isPlaceStop(stop)) {
      const place = findPlace(state, stop.placeId);
      if (!place) return error("INVALID_PLACE_ID", `Unknown place: ${stop.placeId}`);
      const visit = validatePlaceVisit(place, stop.purpose, stop.plannedStart, timeZone);
      if (!visit.ok) return visit;
      if (place.reservationMode === "required") return error("RESERVATION_CONFLICT", `${place.name} requires a reservation and cannot be used for a spontaneous itinerary.`);
      const verifiedAt = Date.parse(place.verification.verifiedAt ?? "");
      if (place.verification.status !== "verified") warnings.push(`${place.name}'s current operating details should be checked at the source.`);
      if (!Number.isFinite(verifiedAt) || now.getTime() - verifiedAt > 90 * 24 * 60 * 60_000) warnings.push(`${place.name}'s operating details are stale or undated.`);
      if (place.exceptionalHours.status === "unknown") warnings.push(`Exceptional hours remain unknown for ${place.name}.`);
      if (place.reservationMode === "recommended") warnings.push(`A reservation is recommended at ${place.name}.`);
      continue;
    }
    warnings.push(`${stop.customPlace.name} is a custom Place; confirm its assumptions before relying on it.`);
  }
  return { ok: true, warnings: [...new Set(warnings)] };
};

type StateWriter = (next: LocalBuzzState) => void;

export class LocalBuzzActions {
  constructor(
    private readonly read: () => LocalBuzzState,
    private readonly write: StateWriter,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private update(recipe: (state: LocalBuzzState) => LocalBuzzState) {
    const next = recipe(this.read());
    this.write(next);
    return next;
  }

  applyCityPulse(payload: CityPulsePayload, now = this.now()): DomainResult<{ applied: boolean; liveSignalCount: number; enrichedCount: number }> {
    const state = this.read();
    if (state.activeCityId !== payload.cityId) return { ok: true, applied: false, liveSignalCount: 0, enrichedCount: 0 };
    const scheduled = state.happenings
      .filter((item) => item.kind === undefined || item.kind === "scheduled_event")
      .map((item) => { const { socialPulse: _socialPulse, ...rest } = item; void _socialPulse; return rest as Happening; });
    const merged = mergePulseIntoHappenings(payload.cityId, scheduled, state.places, payload, now);
    const wire = pulseSourceStatus(payload.cityId, payload, now.toISOString());
    const source: EventSourceState = {
      sourceId: wire.sourceId, publisher: wire.publisher, status: wire.status, attemptedAt: wire.attemptedAt,
      lastSuccessfulRefresh: wire.lastSuccessfulRefresh, acceptedCount: wire.status === "fresh" ? wire.eventCount : 0,
      rejectedCount: wire.rejectedCount, retainedCount: wire.retainedCount, expiredCount: wire.expiredCount,
      emptySuccessful: wire.emptySuccessful, message: wire.message,
    };
    this.update((current) => ({
      ...current,
      happenings: merged.happenings,
      visibleHappeningIds: current.visibleHappeningIds.filter((id) => merged.happenings.some((item) => item.id === id)),
      candidateHappeningIds: current.candidateHappeningIds.filter((id) => merged.happenings.some((item) => item.id === id)),
      eventInventory: { ...current.eventInventory, sources: [...current.eventInventory.sources.filter((item) => item.sourceId !== source.sourceId), source] },
      activityMessage: `${merged.liveSignalCount} live signal${merged.liveSignalCount === 1 ? "" : "s"} · ${merged.enrichedCount} scheduled event${merged.enrichedCount === 1 ? "" : "s"} socially supported.`,
    }));
    return { ok: true, applied: true, liveSignalCount: merged.liveSignalCount, enrichedCount: merged.enrichedCount };
  }

  failCityPulse(cityId: CityId, message = "Social pulse is unavailable; canonical events are unchanged.", now = this.now()): DomainResult<{ applied: boolean }> {
    const state = this.read();
    if (state.activeCityId !== cityId) return { ok: true, applied: false };
    const sourceId = `xai-${cityId}-social-pulse`;
    const happenings = state.happenings.filter((item) => item.kind === undefined || item.kind === "scheduled_event").map((item) => {
      const { socialPulse: _socialPulse, ...rest } = item; void _socialPulse; return rest as Happening;
    });
    const source: EventSourceState = { sourceId, publisher: "xAI X Search social pulse", status: "unavailable", attemptedAt: now.toISOString(), acceptedCount: 0, rejectedCount: 0, retainedCount: 0, expiredCount: 0, emptySuccessful: false, message };
    this.update((current) => ({ ...current, happenings, visibleHappeningIds: current.visibleHappeningIds.filter((id) => happenings.some((item) => item.id === id)), candidateHappeningIds: current.candidateHappeningIds.filter((id) => happenings.some((item) => item.id === id)), eventInventory: { ...current.eventInventory, sources: [...current.eventInventory.sources.filter((item) => item.sourceId !== sourceId), source] } }));
    return { ok: true, applied: true };
  }

  stageDiscoveryLeads(leads: DiscoveryLead[]): DomainResult<{ leads: DiscoveryLead[]; count: number }> {
    const state = this.read();
    if (leads.some((lead) => lead.cityId !== state.activeCityId)) return error("WRONG_CITY", "Discovery leads must match the active city before entering the review frontier.");
    if (leads.some((lead) => lead.reviewOutcome)) return error("INVALID_INPUT", "Reviewed leads cannot be proposed as new discovery work.");
    const existing = new Set(state.discoveryLeads.filter((lead) => !lead.reviewOutcome).map((lead) => lead.id));
    const proposed = leads.filter((lead) => !existing.has(lead.id));
    if (!proposed.length) return error("DUPLICATE", "Every discovery lead is already awaiting review.");
    this.update((current) => ({ ...current, discoveryLeads: [...proposed, ...current.discoveryLeads], activityMessage: `${proposed.length} targeted discovery lead${proposed.length === 1 ? "" : "s"} proposed for human review; canonical inventory is unchanged.` }));
    return { ok: true, leads: proposed, count: proposed.length };
  }

  proposeEventLead(input: ProposeEventLeadInput): DomainResult<{ lead: DiscoveryLead }> {
    const state = this.read();
    const result = buildEventLead(input, state.activeCityId, state.happenings);
    if (!result.ok) return result;
    if (state.discoveryLeads.some((lead) => lead.id === result.lead.id && !lead.reviewOutcome)) return error("DUPLICATE", "This source is already awaiting review.");
    this.update((current) => ({ ...current, discoveryLeads: [result.lead, ...current.discoveryLeads], activityMessage: `Agent proposed ${result.lead.fields.title ?? "an event"}. It is discovery-only until human review.` }));
    return result;
  }

  proposePlaceLead(input: ProposePlaceLeadInput): DomainResult<{ lead: DiscoveryLead }> {
    const state = this.read();
    const result = buildPlaceLead(input, state.activeCityId, state.places);
    if (!result.ok) return result;
    if (state.discoveryLeads.some((lead) => lead.id === result.lead.id && !lead.reviewOutcome)) return error("DUPLICATE", "This source is already awaiting review.");
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
    const added = this.addCustomPlaceStop({ name: fields.name, purpose: input.purpose, plannedStart: input.plannedStart, location: { address: fields.location.address, neighborhood: fields.location.neighborhood, lat: fields.location.lat, lng: fields.location.lng }, typicalVisitDurationMinutes: fields.typicalVisitDurationMinutes, pricePerPerson: fields.priceRange.min, currency: fields.priceRange.currency, availableFrom: input.availableFrom, availableUntil: input.availableUntil, note: `Discovery lead from ${lead.originalSourceUrl}` }, "Human retained a discovery lead as custom.");
    if (!added.ok) return added;
    const reviewed: DiscoveryLead = { ...lead, verificationStatus: "unverified_custom", reviewedAt: new Date().toISOString(), reviewOutcome: "kept_custom" };
    this.update((current) => ({ ...current, discoveryLeads: current.discoveryLeads.map((item) => item.id === leadId ? reviewed : item), activityMessage: `${fields.name} was added as a custom stop outside the catalog.` }));
    return { ok: true, lead: reviewed, plan: added.plan };
  }

  searchHappenings(filters: SearchFilters): DomainResult<{ happenings: Happening[]; count: number }> {
    const state = this.read();
    const query = filters.query?.trim().toLowerCase();
    const startAfter = filters.startAfter ? Date.parse(filters.startAfter) : undefined;
    const endBefore = filters.endBefore ? Date.parse(filters.endBefore) : undefined;
    const activeAt = filters.activeAt ? Date.parse(filters.activeAt) : undefined;
    const matches = state.happenings
      .filter(isNightlyHappening)
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
        if (activeAt === undefined) return true;
        const start = Date.parse(item.timing.start);
        const end = occurrenceEndMs(item);
        return start <= activeAt && end > activeAt;
      })
      .filter((item) => (startAfter === undefined ? true : Date.parse(item.timing.start) >= startAfter))
      .filter((item) => (endBefore === undefined ? true : Date.parse(item.timing.start) < endBefore))
      .filter((item) =>
        filters.maxPrice === undefined
          ? true
          : (item.commerce.priceMin ?? 0) <= filters.maxPrice,
      )
      .filter((item) =>
        filters.categories?.length ? filters.categories.includes(item.category) : true,
      )
      .filter((item) => filters.happeningKinds?.length ? filters.happeningKinds.includes(item.kind ?? "scheduled_event") : true)
      .filter((item) => filters.minBuzzScore === undefined ? true : (item.socialPulse?.buzzScore ?? 0) >= filters.minBuzzScore)
      .filter((item) => filters.actionableNow === undefined ? true : Boolean(item.socialPulse?.actionableNow) === filters.actionableNow)
      .filter((item) => {
        if (!filters.near || filters.maxDistanceKm === undefined) return true;
        return distanceKm(filters.near, item.venue) <= filters.maxDistanceKm;
      })
      .sort((a, b) => {
        if (activeAt !== undefined || filters.actionableNow) {
          const byBuzz = (b.socialPulse?.buzzScore ?? 0) - (a.socialPulse?.buzzScore ?? 0);
          if (byBuzz !== 0) return byBuzz;
        }
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

  showCandidates(ids: string[], reason?: string, origin: "human" | "agent" = "agent"): DomainResult<{ visibleCount: number }> {
    const state = this.read();
    const invalid = ids.find((id) => !findHappening(state, id));
    if (invalid) return error("INVALID_HAPPENING_ID", `Unknown happening: ${invalid}`);
    this.update((current) => ({
      ...current,
      visibleHappeningIds: [...new Set([...current.visibleHappeningIds, ...ids])],
      candidateHappeningIds: ids,
      candidateReason: reason,
      selectedHappeningId: ids[0],
      activityMessage: `${ids.length} candidates are highlighted on the map and in the current listing.`,
      candidateReasonOrigin: reason ? origin : undefined,
      discoveryMode: "events",
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
      selectedHappeningId: undefined,
      discoveryMode: "events",
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
      visiblePlaceIds: [...new Set([...current.visiblePlaceIds, ...ids])],
      candidatePlaceIds: ids,
      selectedPlaceId: ids[0],
      candidateReason: reason,
      candidateReasonOrigin: reason ? "agent" : undefined,
      discoveryMode: "places",
      activityMessage: `${ids.length} place candidates are highlighted in the current listing.`,
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
      selectedPlaceId: undefined,
      discoveryMode: "places",
      activityMessage: message ?? `${ids.length} places are visible.`,
    }));
    return { ok: true, visibleCount: ids.length };
  }

  readPlaceDetails(placeId: string): DomainResult<{ place: Place }> {
    const placeItem = findPlace(this.read(), placeId);
    return placeItem ? { ok: true, place: placeItem } : error("INVALID_PLACE_ID", `Unknown place: ${placeId}`);
  }

  private addAdditionalStop(stop: PlanStop, reason?: string, warnings: string[] = [], budget?: number | null): DomainResult<{ plan: EveningPlan; warnings: string[] }> {
    const state = this.read();
    const base = state.currentPlan;
    const city = getCityDefinition(state.activeCityId);
    const date = localDate(new Date(stop.plannedStart), city.timeZone);
    const inheritedConstraints = base?.constraints ?? {
      ...city.constraints,
      latestEndTime: localDateTimeToIso(shiftIsoDate(date, 1), "00:00:00", city.timeZone),
    };
    const constraints: PlanConstraints = { ...inheritedConstraints };
    if (budget === null) delete constraints.budget;
    else if (budget !== undefined) constraints.budget = budget;
    if (constraints.budget !== undefined && (!Number.isFinite(constraints.budget) || constraints.budget < 0)) {
      return error("INVALID_INPUT", "Budget must be a non-negative number or null for no cap.");
    }
    const stops = [...(base?.stops ?? []), stop];
    if (hasTimeConflict(stops)) return error("TIME_CONFLICT", "The place stop overlaps another stop.");
    const unknown = unknownPriceStop(state, stops);
    if (constraints.budget !== undefined && unknown && isHappeningStop(unknown)) return error("BUDGET_CONFLICT", `${findHappening(state, unknown.happeningId)?.title ?? unknown.happeningId} has no confirmed minimum price, so the explicit budget cannot be checked.`);
    const plan = summarizePlan(state, stops, constraints, reason ?? base?.rationale);
    if (Date.parse(plan.endTime) > Date.parse(constraints.latestEndTime)) return error("TIME_CONFLICT", "The place visit ends after the night's latest-end constraint.");
    if (constraints.budget !== undefined && plan.totalEstimatedCost > constraints.budget) return error("BUDGET_CONFLICT", `Estimated total is ${plan.totalEstimatedCost} ${constraints.currency}, above the ${constraints.budget} ${constraints.currency} budget.`);
    const readiness = recheckPlanOperationalReadiness(state, plan, this.now());
    if (!readiness.ok) return readiness;
    this.update((current) => ({
      ...current,
      currentPlan: plan,
      visiblePlaceIds: stop.kind === "place" ? Array.from(new Set([...current.visiblePlaceIds, stop.placeId])) : current.visiblePlaceIds,
      activityMessage: `${plan.stops.length}-stop night updated.`,
    }));
    return { ok: true, plan, warnings: [...new Set([...warnings, ...readiness.warnings])] };
  }

  addPlaceStop(input: AddPlaceStopInput, reason?: string): DomainResult<{ plan: EveningPlan; warnings: string[] }> {
    const state = this.read();
    const placeItem = findPlace(state, input.placeId);
    if (!placeItem) return error("INVALID_PLACE_ID", `Unknown place: ${input.placeId}`);
    if (!placeItem.bestFor.includes(input.purpose)) return error("INVALID_INPUT", `${placeItem.name} is not catalogued for ${input.purpose.replace("_", " ")}.`);
    if (placeItem.reservationMode === "required") return error("RESERVATION_CONFLICT", `${placeItem.name} requires a reservation, which conflicts with this spontaneous plan.`);
    const base = state.currentPlan;
    const constraints = base?.constraints ?? getCityDefinition(state.activeCityId).constraints;
    if (placeItem.priceRange.currency !== constraints.currency) return error("CURRENCY_CONFLICT", `${placeItem.name}'s price currency does not match this night.`);
    const visit = validatePlaceVisit(placeItem, input.purpose, input.plannedStart, getCityDefinition(state.activeCityId).timeZone);
    if (!visit.ok) return visit;
    const stop: PlanStop = {
      id: `stop-${Math.max(0, ...(base?.stops.map((item) => Number(item.id.match(/\d+$/)?.[0] ?? 0)) ?? [])) + 1}`,
      kind: "place", placeId: input.placeId, purpose: input.purpose,
      plannedStart: input.plannedStart, plannedEnd: visit.plannedEnd,
      locked: false, status: "active",
    };
    const verifiedAt = placeItem.verification.verifiedAt ? Date.parse(placeItem.verification.verifiedAt) : Number.NaN;
    const warnings = [
      ...(placeItem.verification.status !== "verified" ? [`Check ${placeItem.name}'s current operating details at its source.`] : []),
      ...(Number.isFinite(verifiedAt) && Date.now() - verifiedAt > 90 * 24 * 60 * 60_000 ? [`${placeItem.name}'s operating details are older than 90 days.`] : []),
      ...(placeItem.exceptionalHours.status === "unknown" ? [`Exceptional hours are unknown for ${placeItem.name}.`] : []),
      ...(placeItem.reservationMode === "recommended" ? [`A reservation is recommended at ${placeItem.name}.`] : []),
    ];
    return this.addAdditionalStop(stop, reason, warnings, input.budget);
  }

  addHappeningStop(input: PlanHappeningInput & { budget?: number | null }, reason?: string): DomainResult<{ plan: EveningPlan; warnings: string[] }> {
    const state = this.read();
    const happening = findHappening(state, input.happeningId);
    if (!happening) return error("INVALID_HAPPENING_ID", `Unknown happening: ${input.happeningId}`);
    if (!isNightlyHappening(happening)) return error("HAPPENING_UNAVAILABLE", `${happening.title} is not an eligible single-night event.`);
    if (unavailable.has(happening.status.availability)) return error("HAPPENING_UNAVAILABLE", `${happening.title} is unavailable.`);
    if (occurrenceEndMs(happening) <= this.now().getTime()) return error("HAPPENING_UNAVAILABLE", `${happening.title} has already ended.`);
    if (!canAttendAt(happening, input.plannedStart)) return error("TIME_CONFLICT", `${happening.title} is not happening at the proposed start time.`);
    const base = state.currentPlan;
    const stop: PlanStop = {
      id: `stop-${Math.max(0, ...(base?.stops.map((item) => Number(item.id.match(/\d+$/)?.[0] ?? 0)) ?? [])) + 1}`,
      kind: "happening", happeningId: input.happeningId, plannedStart: input.plannedStart,
      plannedEnd: plannedEnd(happening, input.plannedStart), locked: false, status: "active",
    };
    return this.addAdditionalStop(stop, reason, [], input.budget);
  }

  addCustomPlaceStop(input: AddCustomPlaceStopInput, reason?: string): DomainResult<{ plan: EveningPlan; warnings: string[] }> {
    const state = this.read();
    const base = state.currentPlan;
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
      plannedStart: input.plannedStart, plannedEnd: new Date(end).toISOString(), locked: false, status: "active",
    };
    return this.addAdditionalStop(stop, reason, ["Confirm the custom place assumptions before relying on this stop."], input.budget);
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
    const eligible = happenings.filter(isNightlyHappening);
    const incomingIds = new Set(eligible.map((item) => item.id));
    const retainedSnapshots = state.happenings.filter((item) => !incomingIds.has(item.id) && (item.kind === undefined || item.kind === "scheduled_event") && isNightlyHappening(item));
    const merged = [...eligible, ...retainedSnapshots];
    const currentCount = merged.filter((item) => isUnexpiredHappening(item, cityId, now)).length;
    const expiredCount = merged.filter((item) => item.cityId === cityId && occurrenceEndMs(item) <= now.getTime()).length;
    this.update((current) => ({
      ...current,
      happenings: merged,
      filters: {},
      visibleHappeningIds: currentHappeningIds(merged, cityId, now),
      candidateHappeningIds: [],
      candidateReason: undefined,
      selectedHappeningId: undefined,
      activityMessage: message,
      eventInventory: {
        ...current.eventInventory,
        currentCount,
        expiredCount,
        retainedCount: retainedSnapshots.filter((item) => isUnexpiredHappening(item, cityId, now)).length,
      },
    }));
    return { ok: true, applied: true, count: merged.length };
  }

  beginCityRefresh(cityId: CityId, refreshId: string, attemptedAt = this.now().toISOString()): DomainResult<{ refreshId: string }> {
    const state = this.read();
    if (state.activeCityId !== cityId) return error("WRONG_CITY", "The refresh city is no longer active.");
    const known = new Map(state.eventInventory.sources.map((source) => [source.sourceId, source]));
    const configured = eventSourceDescriptorsForCity(cityId).map((descriptor): EventSourceState => {
      const previous = known.get(descriptor.sourceId);
      return {
        sourceId: descriptor.sourceId,
        publisher: descriptor.publisher,
        status: descriptor.enabled ? "refreshing" : "disabled",
        attemptedAt,
        lastSuccessfulRefresh: previous?.lastSuccessfulRefresh,
        acceptedCount: 0,
        rejectedCount: previous?.rejectedCount ?? 0,
        retainedCount: (previous?.acceptedCount ?? 0) + (previous?.retainedCount ?? 0),
        expiredCount: previous?.expiredCount ?? 0,
        emptySuccessful: false,
        message: descriptor.enabled
          ? "Refresh in progress; any still-valid prior records remain available."
          : descriptor.disabledReason,
      };
    });
    const bundled = state.eventInventory.sources.filter((source) => source.sourceId.startsWith("bundled-"));
    this.update((current) => ({
      ...current,
      eventInventory: {
        ...current.eventInventory,
        cityId,
        refreshId,
        refreshing: configured.some((source) => source.status === "refreshing"),
        sources: [...bundled, ...configured],
      },
      activityMessage: `Refreshing permitted ${getCityDefinition(cityId).name} event sources. Canonical Places remain available.`,
    }));
    return { ok: true, refreshId };
  }

  applyCityEventSnapshot(
    snapshot: CityEventSnapshotWire,
    refreshId: string,
    now = this.now(),
  ): DomainResult<{ applied: boolean; currentCount: number; placeCount: number }> {
    const state = this.read();
    if (state.activeCityId !== snapshot.cityId || state.eventInventory.refreshId !== refreshId) {
      return { ok: true, applied: false, currentCount: state.eventInventory.currentCount, placeCount: state.places.length };
    }
    if (!Number.isFinite(Date.parse(snapshot.generatedAt)) || snapshot.happenings.some((item) => item.cityId !== snapshot.cityId)) {
      return this.failCityRefresh(snapshot.cityId, refreshId, "The collector returned an invalid city snapshot.", "invalid", now);
    }
    const incoming = deduplicateHappenings(snapshot.happenings.filter(isNightlyHappening));
    const incomingIds = new Set(incoming.map((item) => item.id));
    const retainedHistorical = state.happenings.filter((item) => !incomingIds.has(item.id) && (item.kind === undefined || item.kind === "scheduled_event") && isNightlyHappening(item));
    const merged = deduplicateHappenings([...incoming, ...retainedHistorical]);
    const current = merged.filter((item) => isUnexpiredHappening(item, snapshot.cityId, now));
    const retainedCount = current.filter((item) => !incomingIds.has(item.id)).length;
    const expiredCount = merged.filter((item) => item.cityId === snapshot.cityId && occurrenceEndMs(item) <= now.getTime()).length;
    const bundled = state.eventInventory.sources.filter((source) => source.sourceId.startsWith("bundled-"));
    const sources: EventSourceState[] = snapshot.sources.map((source) => {
      const sourceEvents = incoming.filter((item) => item.source.name === source.publisher);
      const sourceExpired = source.expiredCount ?? sourceEvents.filter((item) => occurrenceEndMs(item) <= now.getTime()).length;
      const emptySuccessful = source.emptySuccessful ?? (source.status === "fresh" && source.eventCount === 0 && source.rejectedCount === 0);
      const retained = source.retainedCount ?? (source.status === "retained" || snapshot.retained ? source.eventCount : 0);
      return {
        sourceId: source.sourceId,
        publisher: source.publisher,
        status: source.status,
        attemptedAt: source.attemptedAt,
        lastSuccessfulRefresh: source.lastSuccessfulRefresh,
        acceptedCount: source.status === "fresh" ? source.eventCount : 0,
        rejectedCount: source.rejectedCount,
        retainedCount: retained,
        expiredCount: sourceExpired,
        emptySuccessful,
        candidateCount: source.candidateCount,
        marginalUniqueCount: source.marginalUniqueCount,
        uniqueVenueCount: source.uniqueVenueCount,
        todayCount: source.todayCount,
        tonightCount: source.tonightCount,
        next24HoursCount: source.next24HoursCount,
        rejectionReasons: source.rejectionReasons,
        message: source.message ?? (emptySuccessful ? "Source responded successfully but returned no publishable events." : undefined),
      };
    });
    const visibleHappeningIds = state.candidateHappeningIds.length
      ? state.visibleHappeningIds.filter((id) => merged.some((item) => item.id === id))
      : currentHappeningIds(merged, snapshot.cityId, now);
    const message = current.length
      ? `${current.length} current event${current.length === 1 ? "" : "s"} · ${state.places.length} places. Event source refresh complete.`
      : `0 current events · ${state.places.length} places. Event source refresh complete; no expired record is shown as current.`;
    this.update((currentState) => ({
      ...currentState,
      happenings: merged,
      visibleHappeningIds,
      discoveryMode: current.length || currentState.candidateHappeningIds.length ? currentState.discoveryMode : "places",
      activityMessage: message,
      eventInventory: {
        cityId: snapshot.cityId,
        refreshId,
        generatedAt: snapshot.generatedAt,
        refreshing: false,
        currentCount: current.length,
        retainedCount,
        expiredCount,
        sources: [...bundled, ...sources],
      },
    }));
    return { ok: true, applied: true, currentCount: current.length, placeCount: state.places.length };
  }

  failCityRefresh(
    cityId: CityId,
    refreshId: string,
    safeMessage: string,
    status: "unavailable" | "invalid" = "unavailable",
    now = this.now(),
  ): DomainResult<{ applied: boolean; currentCount: number; placeCount: number }> {
    const state = this.read();
    if (state.activeCityId !== cityId || state.eventInventory.refreshId !== refreshId) {
      return { ok: true, applied: false, currentCount: state.eventInventory.currentCount, placeCount: state.places.length };
    }
    const currentCount = state.happenings.filter((item) => isUnexpiredHappening(item, cityId, now)).length;
    const sources = state.eventInventory.sources.map((source): EventSourceState => source.status === "refreshing"
      ? { ...source, status, attemptedAt: now.toISOString(), message: safeMessage }
      : source);
    this.update((current) => ({
      ...current,
      discoveryMode: currentCount ? current.discoveryMode : "places",
      activityMessage: `${currentCount} current events · ${current.places.length} places. Refresh unavailable; valid retained inventory was preserved.`,
      eventInventory: { ...current.eventInventory, refreshing: false, currentCount, sources },
    }));
    return { ok: true, applied: true, currentCount, placeCount: state.places.length };
  }

  buildEveningPlan(
    stopInputs: PlanHappeningInput[],
    rationale?: string,
    budget?: number | null,
  ): DomainResult<{ plan: EveningPlan; warnings: string[] }> {
    if (stopInputs.length === 0) return error("INVALID_INPUT", "A plan needs at least one stop.");
    const state = this.read();
    if (state.currentPlan?.stops.some((stop) => stop.locked)) {
      return error("LOCKED_STOP_CONFLICT", "Unlock the current itinerary before replacing it with a new build.");
    }
    const invalidStart = stopInputs.find((input) => !Number.isFinite(Date.parse(input.plannedStart)));
    if (invalidStart) return error("INVALID_INPUT", `Invalid planned start: ${invalidStart.plannedStart}`);
    const city = getCityDefinition(state.activeCityId);
    const earliestStart = Math.min(...stopInputs.map((input) => Date.parse(input.plannedStart)));
    const planDate = localDate(new Date(earliestStart), city.timeZone);
    const planConstraints: PlanConstraints = {
      ...city.constraints,
      latestEndTime: localDateTimeToIso(
        shiftIsoDate(planDate, 1),
        "00:00:00",
        city.timeZone,
      ),
    };
    if (budget !== undefined && budget !== null) planConstraints.budget = budget;
    if (!Number.isFinite(Date.parse(planConstraints.latestEndTime))) {
      return error("INVALID_INPUT", "The latest end time must be a valid ISO date-time.");
    }
    if (planConstraints.currency !== city.currency || !Number.isInteger(planConstraints.partySize) || planConstraints.partySize < 1 || (planConstraints.budget !== undefined && (!Number.isFinite(planConstraints.budget) || planConstraints.budget < 0))) {
      return error("INVALID_INPUT", "Plan constraints must use the active city's currency, a positive party size and an optional non-negative budget.");
    }
    const stops: PlanStop[] = [];
    for (const [index, input] of stopInputs.entries()) {
      const happening = findHappening(state, input.happeningId);
      if (!happening) return error("INVALID_HAPPENING_ID", `Unknown happening: ${input.happeningId}`);
      if (!isNightlyHappening(happening)) return error("HAPPENING_UNAVAILABLE", `${happening.title} is not an eligible single-night event.`);
      if (unavailable.has(happening.status.availability)) {
        return error("HAPPENING_UNAVAILABLE", `${happening.title} is unavailable.`);
      }
      if (occurrenceEndMs(happening) <= this.now().getTime()) return error("HAPPENING_UNAVAILABLE", `${happening.title} has already ended.`);
      if (planConstraints.budget !== undefined && happening.commerce.priceMin === undefined) return error("BUDGET_CONFLICT", `${happening.title} has no confirmed minimum price, so the explicit budget cannot be checked.`);
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
        status: "active",
      });
    }
    if (hasTimeConflict(stops)) {
      return error("TIME_CONFLICT", "At least two proposed stops overlap.", "Adjust planned start times.");
    }
    const unknown = unknownPriceStop(state, stops);
    if (planConstraints.budget !== undefined && unknown && isHappeningStop(unknown)) return error("BUDGET_CONFLICT", `${findHappening(state, unknown.happeningId)?.title ?? unknown.happeningId} has no confirmed minimum price, so the explicit budget cannot be checked.`);
    const plan = summarizePlan(state, stops, planConstraints, rationale);
    if (Date.parse(plan.endTime) > Date.parse(planConstraints.latestEndTime)) {
      return error(
        "TIME_CONFLICT",
        `The plan ends after the ${planConstraints.latestEndTime} latest-end constraint.`,
        "Remove or retime the final stop.",
      );
    }
    if (planConstraints.budget !== undefined && plan.totalEstimatedCost > planConstraints.budget) {
      return error(
        "BUDGET_CONFLICT",
        `Estimated total is ${plan.totalEstimatedCost} ${planConstraints.currency}, above the ${planConstraints.budget} ${planConstraints.currency} budget.`,
      );
    }
    const readiness = recheckPlanOperationalReadiness(state, plan, this.now());
    if (!readiness.ok) return readiness;
    this.update((current) => ({
      ...current,
      currentPlan: plan,
      visibleHappeningIds: Array.from(new Set([...current.visibleHappeningIds, ...stops.filter(isHappeningStop).map((s) => s.happeningId)])),
      activityMessage: `${stops.length}-stop night built and ready to edit.`,
    }));
    return { ok: true, plan, warnings: readiness.warnings };
  }

  readCurrentPlan(): DomainResult<{
    city: { id: CityId; name: string; currency: string; timeZone: string };
    inventory: {
      currentEventCount: number;
      placeCount: number;
      visibleEventCount: number;
      visiblePlaceCount: number;
      eventSources: EventSourceState[];
      refreshing: boolean;
      generatedAt?: string;
    };
    currentPlan: EveningPlan | null;
    liveUpdates: LiveUpdate[];
  }> {
    const state = this.read();
    const city = getCityDefinition(state.activeCityId);
    return {
      ok: true,
      city: { id: city.id, name: city.name, currency: city.currency, timeZone: city.timeZone },
      inventory: {
        currentEventCount: state.eventInventory.currentCount,
        placeCount: state.places.length,
        visibleEventCount: state.visibleHappeningIds.length,
        visiblePlaceCount: state.visiblePlaceIds.length,
        eventSources: state.eventInventory.sources,
        refreshing: state.eventInventory.refreshing,
        generatedAt: state.eventInventory.generatedAt,
      },
      currentPlan: state.currentPlan,
      liveUpdates: state.liveUpdates,
    };
  }

  readInventoryStatus(): DomainResult<{
    currentEventCount: number;
    placeCount: number;
    visibleEventCount: number;
    visiblePlaceCount: number;
    eventSources: EventSourceState[];
    refreshing: boolean;
    generatedAt?: string;
  }> {
    const result = this.readCurrentPlan();
    if (!result.ok) return result;
    return { ok: true, ...result.inventory };
  }

  lockPlanStop(stopId: string): DomainResult<{ stopId: string; locked: true }> {
    return this.setStopLock(stopId, true) as DomainResult<{ stopId: string; locked: true }>;
  }

  unlockPlanStop(stopId: string): DomainResult<{ stopId: string; locked: false }> {
    return this.setStopLock(stopId, false) as DomainResult<{ stopId: string; locked: false }>;
  }

  private setStopLock(stopId: string, locked: boolean): DomainResult<{ stopId: string; locked: boolean }> {
    const state = this.read();
    const sourcePlan = state.currentPlan;
    if (!sourcePlan) return error("PLAN_NOT_FOUND", "There is no active plan.");
    if (!sourcePlan.stops.some((stop) => stop.id === stopId)) {
      return error("INVALID_STOP_ID", `Unknown plan stop: ${stopId}`);
    }
    const plan = { ...sourcePlan, stops: sourcePlan.stops.map((stop) => (stop.id === stopId ? { ...stop, locked } : stop)) };
    this.update((current) => ({
      ...current,
      currentPlan: plan,
      activityMessage: locked
        ? "Human decision recorded: this stop must survive repair."
        : "Stop unlocked and available for repair.",
    }));
    return { ok: true, stopId, locked };
  }

  removePlanStop(stopId: string, actor: "human" | "agent" = "agent"): DomainResult<{ stopId: string; plan: EveningPlan | null }> {
    const state = this.read();
    const sourcePlan = state.currentPlan;
    if (!sourcePlan) return error("PLAN_NOT_FOUND", "There is no active plan.");
    const target = sourcePlan.stops.find((stop) => stop.id === stopId);
    if (!target) return error("INVALID_STOP_ID", `Unknown plan stop: ${stopId}`);
    if (target.locked && actor !== "human") return error("LOCKED_STOP_CONFLICT", "The stop is locked and cannot be removed by the agent.");
    const stops = sourcePlan.stops.filter((stop) => stop.id !== stopId);
    const plan = stops.length ? summarizePlan(state, stops, sourcePlan.constraints, sourcePlan.rationale) : null;
    this.update((current) => ({
      ...current,
      currentPlan: plan,
      activityMessage: "Stop removed from the shared itinerary.",
    }));
    return { ok: true, stopId, plan };
  }

  replacePlanStop(stopId: string, replacementHappeningId: string): DomainResult<{ stop: PlanStop }> {
    const state = this.read();
    const sourcePlan = state.currentPlan;
    if (!sourcePlan) return error("PLAN_NOT_FOUND", "There is no active plan.");
    const target = sourcePlan.stops.find((stop) => stop.id === stopId);
    if (!target) return error("INVALID_STOP_ID", `Unknown plan stop: ${stopId}`);
    if (!isHappeningStop(target)) return error("INVALID_INPUT", "Event replacement can only target a happening stop.");
    if (target.locked) return error("LOCKED_STOP_CONFLICT", "Unlock the stop before replacing it.");
    const replacement = findHappening(state, replacementHappeningId);
    if (!replacement) return error("INVALID_HAPPENING_ID", `Unknown happening: ${replacementHappeningId}`);
    if (unavailable.has(replacement.status.availability)) {
      return error("HAPPENING_UNAVAILABLE", `${replacement.title} is unavailable.`);
    }
    if (occurrenceEndMs(replacement) <= this.now().getTime()) return error("HAPPENING_UNAVAILABLE", `${replacement.title} has already ended.`);
    if (sourcePlan.constraints.budget !== undefined && replacement.commerce.priceMin === undefined) return error("BUDGET_CONFLICT", `${replacement.title} has no confirmed minimum price, so the explicit budget cannot be checked.`);
    const start = replacement.timing.start;
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
      status: "active",
    };
    const stops = sourcePlan.stops.map((item) => (item.id === stopId ? stop : item));
    if (hasTimeConflict(stops)) return error("TIME_CONFLICT", "The replacement overlaps another stop.");
    const plan = summarizePlan(state, stops, sourcePlan.constraints, sourcePlan.rationale);
    if (Date.parse(plan.endTime) > Date.parse(plan.constraints.latestEndTime)) {
      return error("TIME_CONFLICT", "The replacement would end after the night’s latest-end constraint.");
    }
    if (plan.constraints.budget !== undefined && plan.totalEstimatedCost > plan.constraints.budget) {
      return error("BUDGET_CONFLICT", "The replacement would exceed the night’s budget.");
    }
    this.update((current) => ({
      ...current,
      currentPlan: plan,
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
    const base = state.currentPlan;
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
      .filter(isNightlyHappening)
      .filter((item) => !unavailable.has(item.status.availability))
      .filter((item) => occurrenceEndMs(item) > this.now().getTime())
      .filter((item) => !base.stops.some((stop) => isHappeningStop(stop) && stop.happeningId === item.id));
    const eligibleReplacements = base.constraints.budget === undefined
      ? replacements
      : replacements.filter((item) => item.commerce.priceMin !== undefined);
    if (base.constraints.budget !== undefined && replacements.length > 0 && eligibleReplacements.length === 0) {
      return error("BUDGET_CONFLICT", "Every supplied replacement has an unknown price, so the explicit budget cannot be confirmed.");
    }

    const repairedStops = [...base.stops];
    const changedStopIds: string[] = [];
    const city = getCityDefinition(state.activeCityId);
    for (const target of broken) {
      const targetIndex = repairedStops.findIndex((stop) => stop.id === target.id);
      const previous = targetIndex > 0 ? repairedStops[targetIndex - 1] : undefined;
      const next = targetIndex < repairedStops.length - 1 ? repairedStops[targetIndex + 1] : undefined;
      const replacement = eligibleReplacements.find((candidate) => {
        if (localDate(new Date(candidate.timing.start), city.timeZone) !== localDate(new Date(target.plannedStart), city.timeZone)) {
          return false;
        }
        const start = Date.parse(candidate.timing.start);
        const plannedStart = candidate.timing.start;
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
      const start = replacement.timing.start;
      const repaired: PlanStop = {
        ...target,
        happeningId: replacement.id,
        plannedStart: start,
        plannedEnd: plannedEnd(replacement, start),
        locked: false,
        status: "active",
      };
      repairedStops[targetIndex] = repaired;
      changedStopIds.push(target.id);
    }
    const plan = summarizePlan(state, repairedStops, base.constraints, input.reason);
    if (plan.constraints.budget !== undefined && plan.totalEstimatedCost > plan.constraints.budget) {
      return error("BUDGET_CONFLICT", "The available repair would exceed the night’s budget.");
    }
    const readiness = recheckPlanOperationalReadiness(state, plan, this.now());
    if (!readiness.ok) return readiness;
    const preservedLockedStopIds = base.stops.filter((stop) => stop.locked).map((stop) => stop.id);
    this.update((current) => ({
      ...current,
      currentPlan: plan,
      visibleHappeningIds: Array.from(new Set([...current.visibleHappeningIds, ...plan.stops.filter(isHappeningStop).map((s) => s.happeningId)])),
      activityMessage: `Repair applied: ${changedStopIds.length} stop changed; ${preservedLockedStopIds.length} locked stop preserved.`,
    }));
    return {
      ok: true,
      changedStopIds,
      preservedLockedStopIds,
      plan,
      warnings: readiness.warnings,
    };
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
    const affectedStopIds = (state.currentPlan?.stops ?? [])
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
    this.write({ ...createInitialState(cityId, this.now()), webMcp: status });
  }

  resetDemo() {
    const { activeCityId, webMcp } = this.read();
    this.write({ ...createInitialState(activeCityId, this.now()), webMcp });
  }
}
