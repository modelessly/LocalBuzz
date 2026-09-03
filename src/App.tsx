import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, ChevronDown, LocateFixed, Search } from "lucide-react";
import { ModelessButton, ModelessPanel, ModelessSearchField } from "@modeless/design-system";
import { AgentProgress, IntentLoom } from "./components/AgentMotion";
import { CityMap } from "./components/CityMap";
import { CityConditions } from "./components/CityConditions";
import { EveningTimeline } from "./components/EveningTimeline";
import { HappeningCard } from "./components/HappeningCard";
import { PlaceCard } from "./components/PlaceCard";
import { DiscoveryReview } from "./components/DiscoveryReview";
import { cityIds, getCityDefinition } from "./data/cities";
import { createInitialState, LocalBuzzActions } from "./domain/store";
import type { CityId, DomainResult, LocalBuzzState, PlaceKind, PlacePurpose, PlaceSearchFilters } from "./domain/types";
import {
  getSearchWindow,
  happeningSectionTitle,
  localDate,
  localDateTimeToIso,
  shiftIsoDate,
  timeSelectionLabel,
  type TimeSelection,
} from "./lib/timeSearch";
import { refreshCityData, refreshCityPulseData } from "./lib/cityStartup";
import { browserTitle, candidateReasonLead, placeCandidateSummary } from "./lib/presentation";
import { registerWebMcp } from "./webmcp/register";
import type { AgentActivity } from "./webmcp/activity";

const timeOptions: Array<{ id: Exclude<TimeSelection, "date">; label: string; description: string }> = [
  { id: "now", label: "Right Now", description: "What’s happening around you now" },
  { id: "later", label: "Later", description: "Plan for later today" },
  { id: "tomorrow", label: "Tomorrow", description: "See what’s happening tomorrow" },
];

export function App() {
  const [state, setState] = useState<LocalBuzzState>(() => createInitialState());
  const stateRef = useRef(state);
  stateRef.current = state;
  const actionsRef = useRef<LocalBuzzActions | null>(null);
  if (!actionsRef.current) {
    actionsRef.current = new LocalBuzzActions(
      () => stateRef.current,
      (next) => {
        stateRef.current = next;
        setState(next);
      },
    );
  }
  const actions = actionsRef.current;
  const city = getCityDefinition(state.activeCityId);
  const [query, setQuery] = useState("");
  const [timeSelection, setTimeSelection] = useState<TimeSelection>("now");
  const refreshSequenceRef = useRef(0);
  const [selectedDate, setSelectedDate] = useState(() => localDate(new Date(), city.timeZone));
  const [feedback, setFeedback] = useState<string>();
  const discoveryMode = state.discoveryMode;
  const [customPlaceName, setCustomPlaceName] = useState("");
  const [customPlacePrice, setCustomPlacePrice] = useState("");
  const [customPlaceDuration, setCustomPlaceDuration] = useState("60");
  const [customPlacePurpose, setCustomPlacePurpose] = useState<PlacePurpose>("drinks");
  const [placeFilterState, setPlaceFilterState] = useState<{ purpose: PlacePurpose | ""; kind: PlaceKind | ""; mood: string; neighborhood: string; maxPrice: string; openAt: boolean }>({ purpose: "", kind: "", mood: "", neighborhood: "", maxPrice: "", openAt: false });
  const [agentActivity, setAgentActivity] = useState<AgentActivity | null>(null);
  const cityMenuRef = useRef<HTMLDetailsElement>(null);
  const timeMenuRef = useRef<HTMLDetailsElement>(null);
  const plan = state.currentPlan;
  const visibleHappenings = useMemo(
    () => state.visibleHappeningIds
      .map((id) => state.happenings.find((item) => item.id === id))
      .filter((item): item is LocalBuzzState["happenings"][number] => Boolean(item)),
    [state.happenings, state.visibleHappeningIds],
  );
  const visiblePlaces = useMemo(
    () => state.visiblePlaceIds.map((id) => state.places.find((item) => item.id === id)).filter((item): item is LocalBuzzState["places"][number] => Boolean(item)),
    [state.places, state.visiblePlaceIds],
  );
  const placeNeighborhoods = useMemo(() => Array.from(new Set(state.places.map((place) => place.location.neighborhood))).sort(), [state.places]);

  const reportAgentActivity = useCallback((activity: AgentActivity) => {
    setAgentActivity((current) => {
      if (activity.status === "clear") return current?.id === activity.id ? null : current;
      return activity;
    });
  }, []);

  useEffect(() => registerWebMcp(
    actions,
    (status) => actions.setWebMcpStatus(status),
    document.modelContext,
    reportAgentActivity,
  ), [actions, reportAgentActivity]);

  useEffect(() => {
    document.title = browserTitle(city.name);
  }, [city.name]);

  useEffect(() => {
    const cityId = state.activeCityId;
    const controller = new AbortController();
    const refreshId = `${cityId}-${++refreshSequenceRef.current}`;
    setFeedback(undefined);
    void refreshCityData({ cityId, refreshId, actions, signal: controller.signal });
    void refreshCityPulseData({ cityId, actions, signal: controller.signal });
    return () => controller.abort();
  }, [actions, state.activeCityId]);

  const handleResult = <T,>(result: DomainResult<T>, success?: string) => {
    if (result.ok) setFeedback(success);
    else setFeedback(`${result.code}: ${result.message}`);
    return result.ok;
  };

  const copyAgentPrompt = async () => {
    try {
      await navigator.clipboard.writeText(city.agentPrompt);
      setFeedback("Agent prompt copied. Paste it into the chat panel beside Local Buzz.");
    } catch {
      setFeedback(`Copy unavailable. Ask your agent: “${city.agentPrompt}”`);
    }
  };

  const searchContextFor = (selection: TimeSelection, date: string) => selection === "date"
    ? date
    : ({ now: "right now", later: "later", tomorrow: "tomorrow" } as const)[selection];
  const searchContext = searchContextFor(timeSelection, selectedDate);

  const timeLabel = timeSelectionLabel(timeSelection, selectedDate, city.locale);
  const happeningTitle = happeningSectionTitle(timeSelection, selectedDate, city.locale);

  const restoreFullListing = (
    selection: TimeSelection = timeSelection,
    date: string = selectedDate,
  ) => {
    const context = searchContextFor(selection, date);
    const searchWindow = getSearchWindow(selection, date, city.timeZone);
    const result = actions.searchHappenings({
      startAfter: searchWindow.startAfter,
      endBefore: searchWindow.endBefore,
      activeAt: searchWindow.activeAt,
      maxResults: state.happenings.length,
    });
    if (result.ok) {
      actions.showListings(
        result.happenings.map((item) => item.id),
        `Full ${context} listing restored.`,
      );
      setFeedback(`${result.count} happenings shown for ${context}.`);
    } else handleResult(result);
  };

  useEffect(() => {
    if (state.eventInventory.refreshing) return;
    const searchWindow = getSearchWindow(timeSelection, selectedDate, city.timeZone);
    const result = actions.searchHappenings({
      startAfter: searchWindow.startAfter,
      endBefore: searchWindow.endBefore,
      activeAt: searchWindow.activeAt,
      maxResults: state.happenings.length,
    });
    if (result.ok) {
      actions.showListings(
        result.happenings.map((item) => item.id),
        `${result.count} happenings match ${searchContextFor(timeSelection, selectedDate)}.`,
      );
    }
  }, [actions, city.timeZone, selectedDate, state.activeCityId, state.eventInventory.generatedAt, state.eventInventory.refreshing, state.happenings.length, timeSelection]);

  const search = () => {
    if (!query.trim()) {
      restoreFullListing();
      return;
    }
    const searchWindow = getSearchWindow(timeSelection, selectedDate, city.timeZone);
    const result = actions.searchHappenings({
      query,
      startAfter: searchWindow.startAfter,
      endBefore: searchWindow.endBefore,
      activeAt: searchWindow.activeAt,
      maxPrice: city.searchDefaults.maxPrice,
      near: city.constraints.startLocation,
      maxDistanceKm: city.searchDefaults.maxDistanceKm,
      maxResults: 9,
    });
    if (result.ok) {
      actions.showListings(
        result.happenings.map((item) => item.id),
        `Search results for “${query}” near ${city.constraints.startLocation.label}.`,
      );
      setFeedback(`${result.count} happenings match your search.`);
    } else handleResult(result);
  };

  const rejectCandidate = (id: string) => {
    const ids = state.candidateHappeningIds.filter((candidateId) => candidateId !== id);
    handleResult(actions.showCandidates(ids, state.candidateReason, state.candidateReasonOrigin ?? "human"), "Candidate removed by the human.");
  };

  const swapIn = (happeningId: string) => {
    const target = plan?.stops.find((stop) => stop.kind === "happening" && !stop.locked && stop.happeningId !== happeningId);
    if (!target || target.kind !== "happening") {
      setFeedback("Lock-aware edit: there is no unlocked stop available to replace.");
      return;
    }
    handleResult(
      actions.replacePlanStop(target.id, happeningId),
      "Human replacement applied. The next agent read will see it.",
    );
  };

  const addPlace = (placeId: string, purpose: PlacePurpose) => {
    const place = state.places.find((item) => item.id === placeId);
    if (!place) return;
    const duration = place.typicalVisitDurationMinutes * 60_000;
    const earliest = plan?.stops.reduce((value, stop) => Math.min(value, Date.parse(stop.plannedStart)), Number.POSITIVE_INFINITY);
    const latest = plan?.endTime ? Date.parse(plan.endTime) : undefined;
    const fallbackTime = purpose === "dinner" || purpose === "quick_bite" ? "18:00:00" : "21:30:00";
    const proposedMs = purpose === "dinner" || purpose === "quick_bite"
      ? (Number.isFinite(earliest) ? (earliest as number) - duration - 30 * 60_000 : Date.parse(localDateTimeToIso(selectedDate, fallbackTime, city.timeZone)))
      : (latest ? latest + 30 * 60_000 : Date.parse(localDateTimeToIso(selectedDate, fallbackTime, city.timeZone)));
    const result = actions.addPlaceStop({ placeId, purpose, plannedStart: new Date(proposedMs).toISOString() }, `Human added ${purpose.replace("_", " ")}`);
    if (result.ok) setFeedback(`${place.name} added as ${purpose.replace("_", " ")}. ${result.warnings.join(" ")}`.trim());
    else handleResult(result);
  };

  const addEvent = (happeningId: string) => {
    const happening = state.happenings.find((item) => item.id === happeningId);
    if (!happening) return;
    handleResult(actions.addHappeningStop({ happeningId, plannedStart: happening.timing.start }, "Human added an event"), `${happening.title} added.`);
  };

  const addCustomPlace = () => {
    const plannedStart = localDateTimeToIso(selectedDate, customPlacePurpose === "dinner" ? "18:00:00" : "21:30:00", city.timeZone);
    const result = actions.addCustomPlaceStop({
      name: customPlaceName, purpose: customPlacePurpose, plannedStart,
      location: { ...city.constraints.startLocation, address: "User-provided location", neighborhood: city.constraints.startLocation.label },
      typicalVisitDurationMinutes: Number(customPlaceDuration), pricePerPerson: Number(customPlacePrice), currency: city.currency,
      availableFrom: localDateTimeToIso(selectedDate, "17:00:00", city.timeZone),
      availableUntil: localDateTimeToIso(selectedDate, "23:59:00", city.timeZone),
      note: "Human-entered place; hours, price and location are explicit assumptions.",
    }, "Human added a custom place");
    if (result.ok) {
      setFeedback(`${customPlaceName} added as a custom place. ${result.warnings.join(" ")}`);
      setCustomPlaceName("");
    } else handleResult(result);
  };

  const applyPlaceFilters = (next: typeof placeFilterState) => {
    setPlaceFilterState(next);
    const filters: PlaceSearchFilters = {
      purposes: next.purpose ? [next.purpose] : undefined,
      kinds: next.kind ? [next.kind] : undefined,
      moods: next.mood.trim() ? [next.mood.trim().toLowerCase()] : undefined,
      neighborhoods: next.neighborhood ? [next.neighborhood] : undefined,
      maxPrice: next.maxPrice === "" ? undefined : Number(next.maxPrice),
      openAt: next.openAt ? localDateTimeToIso(selectedDate, "20:00:00", city.timeZone) : undefined,
      maxResults: state.places.length,
    };
    const result = actions.searchPlaces(filters);
    if (result.ok) actions.showPlaceListings(result.places.map((place) => place.id), `${result.count} qualified places match the active filters.`);
    else handleResult(result);
  };
  const clearPlaceFilters = () => applyPlaceFilters({ purpose: "", kind: "", mood: "", neighborhood: "", maxPrice: "", openAt: false });

  const switchCity = (cityId: CityId) => {
    const nextCity = getCityDefinition(cityId);
    actions.switchCity(cityId);
    setQuery("");
    setSelectedDate(localDate(new Date(), nextCity.timeZone));
    setPlaceFilterState({ purpose: "", kind: "", mood: "", neighborhood: "", maxPrice: "", openAt: false });
    setFeedback(`${nextCity.name} is now active. The previous city night was cleared.`);
    cityMenuRef.current?.removeAttribute("open");
  };

  return (
    <main className="modeless-theme app-shell">
      <header className="topbar">
        <div className="brand">
          <div>
            <strong><span>Local</span> <em>Buzz</em></strong>
            <small>People. Places. Good Times.</small>
          </div>
        </div>
        <div className="header-controls">
          <CityConditions
            cityName={city.name}
            center={city.mapCenter}
            locale={city.locale}
            timeZone={city.timeZone}
            temperatureUnit={city.id === "san-francisco" ? "fahrenheit" : "celsius"}
          />
          <details className="header-menu header-menu--city" ref={cityMenuRef}>
            <summary aria-label={`Choose city. ${city.name} selected`}>
              <LocateFixed aria-hidden="true" size={15} />
              <span>{city.name}</span>
              <ChevronDown aria-hidden="true" size={15} />
            </summary>
            <div className="header-menu__popover" role="listbox" aria-label="Choose proof-of-concept city">
              {cityIds.map((cityId) => {
                const option = getCityDefinition(cityId);
                const active = cityId === state.activeCityId;
                return (
                  <button key={cityId} type="button" role="option" aria-selected={active} onClick={() => switchCity(cityId)}>
                    <span>{option.name}</span>
                    {active ? <Check aria-hidden="true" size={15} /> : null}
                  </button>
                );
              })}
            </div>
          </details>

          <details className="header-menu header-menu--time" ref={timeMenuRef}>
            <summary aria-label={`Choose time. ${timeLabel} selected`}>
              <span>{timeLabel}</span>
              <ChevronDown aria-hidden="true" size={15} />
            </summary>
            <div className="header-menu__popover time-menu" aria-label="Choose when to search">
              {timeOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={timeSelection === option.id ? "is-active" : ""}
                  onClick={() => {
                    setTimeSelection(option.id);
                    restoreFullListing(option.id);
                    timeMenuRef.current?.removeAttribute("open");
                  }}
                >
                  <span><strong>{option.label}</strong><small>{option.description}</small></span>
                  {timeSelection === option.id ? <Check aria-hidden="true" size={15} /> : null}
                </button>
              ))}
              <div className={`time-menu__date ${timeSelection === "date" ? "is-active" : ""}`}>
                <button type="button" onClick={() => {
                  setTimeSelection("date");
                  restoreFullListing("date");
                }}>
                  <CalendarDays aria-hidden="true" size={15} />
                  <span><strong>Pick a date</strong><small>Choose a specific date</small></span>
                  {timeSelection === "date" ? <Check aria-hidden="true" size={15} /> : null}
                </button>
                {timeSelection === "date" ? (
                  <input
                    type="date"
                    aria-label="Specific search date"
                    value={selectedDate}
                    onChange={(event) => {
                      if (event.target.value) {
                        setSelectedDate(event.target.value);
                        restoreFullListing("date", event.target.value);
                        timeMenuRef.current?.removeAttribute("open");
                      }
                    }}
                  />
                ) : null}
              </div>
            </div>
          </details>

          <AgentProgress activity={agentActivity} webMcpStatus={state.webMcp} />
        </div>
      </header>

      <IntentLoom activity={agentActivity} />

      <div className="workspace">
        <ModelessPanel
          className="map-panel"
          title={city.name}
          motion="subtle"
        >
          <CityMap
            key={city.id}
            cityName={city.name}
            center={city.mapCenter}
            zoom={city.mapZoom}
            startLocation={city.constraints.startLocation}
            happenings={state.happenings}
            places={state.places}
            visibleIds={state.visibleHappeningIds}
            visiblePlaceIds={state.visiblePlaceIds}
            candidateIds={state.candidateHappeningIds}
            candidatePlaceIds={state.candidatePlaceIds}
            selectedId={state.selectedHappeningId}
            selectedPlaceId={state.selectedPlaceId}
            plan={plan}
            onSelect={(id) => actions.selectHappening(id)}
            onSelectPlace={(id) => actions.selectPlace(id)}
          />
        </ModelessPanel>

        <ModelessPanel
          className="night-panel"
          title="Your night"
          motion="subtle"
        >
          <EveningTimeline
            currentPlan={state.currentPlan}
            happenings={state.happenings}
            places={state.places}
            onCopyAgentPrompt={copyAgentPrompt}
            webMcpStatus={state.webMcp}
            onLock={(id) => handleResult(actions.lockPlanStop(id), "Human lock recorded.")}
            onUnlock={(id) => handleResult(actions.unlockPlanStop(id), "Stop unlocked.")}
            onRemove={(id) => handleResult(actions.removePlanStop(id, "human"), "Stop removed by the human.")}
            timeZone={city.timeZone}
            agentActivity={agentActivity}
          />
        </ModelessPanel>
      </div>

      {feedback ? <p className="product-feedback" role="status">{feedback}</p> : null}

      <DiscoveryReview
        leads={state.discoveryLeads}
        timeZone={city.timeZone}
        onAccept={(id) => handleResult(actions.acceptDiscoveryLead(id), "Added to Options.")}
        onReject={(id) => handleResult(actions.rejectDiscoveryLead(id), "Option removed.")}
        onKeepCustom={(id) => {
          const plannedStart = localDateTimeToIso(selectedDate, "20:00:00", city.timeZone);
          handleResult(actions.keepDiscoveryLeadAsCustom(id, {
            purpose: "drinks",
            plannedStart,
            availableFrom: localDateTimeToIso(selectedDate, "17:00:00", city.timeZone),
            availableUntil: localDateTimeToIso(shiftIsoDate(selectedDate, 1), "00:00:00", city.timeZone),
          }), "Added to Your Night.");
        }}
      />

      <section className="discover-section">
        <div className="discover-header">
          <div>
            <h2>{discoveryMode === "events" ? happeningTitle : "Places for your night"}</h2>
            <div className="discovery-tabs" role="tablist" aria-label="Discover events or places">
              <button type="button" role="tab" aria-selected={discoveryMode === "events"} onClick={() => actions.showListings(state.visibleHappeningIds)}>Events</button>
              <button type="button" role="tab" aria-selected={discoveryMode === "places"} onClick={() => actions.showPlaceListings(state.places.map((item) => item.id))}>Places</button>
            </div>
          </div>
          {discoveryMode === "events" ? <div className="search-controls">
            <ModelessSearchField
              aria-label="Search happenings"
              value={query}
              onChange={(event) => {
                const nextQuery = event.target.value;
                setQuery(nextQuery);
                if (!nextQuery.trim()) restoreFullListing();
              }}
              onKeyDown={(event) => event.key === "Enter" && search()}
              placeholder="music, strange, quiet…"
            />
            <ModelessButton variant="outline" onClick={search}><Search aria-hidden="true" size={15} /> Search {searchContext}</ModelessButton>
          </div> : null}
        </div>
        {state.candidateReason && (discoveryMode === "events" ? state.candidateHappeningIds.length : state.candidatePlaceIds.length) ? (
          <div className="candidate-reason">
            <span>{discoveryMode === "places" && state.candidatePlaceIds.length
              ? `${placeCandidateSummary(state.candidatePlaceIds.length, state.candidateReasonOrigin)} ${state.candidateReason}`
              : `${candidateReasonLead(state.candidateReasonOrigin)}: ${state.candidateReason}`}</span>
          </div>
        ) : null}
        {discoveryMode === "places" ? (
          <div className="place-filters" aria-label="Filter places">
            <label>Purpose<select value={placeFilterState.purpose} onChange={(event) => applyPlaceFilters({ ...placeFilterState, purpose: event.target.value as PlacePurpose | "" })}><option value="">All</option><option value="dinner">Dinner</option><option value="quick_bite">Quick bite</option><option value="drinks">Drinks</option><option value="late_drinks">Late drinks</option></select></label>
            <label>Kind<select value={placeFilterState.kind} onChange={(event) => applyPlaceFilters({ ...placeFilterState, kind: event.target.value as PlaceKind | "" })}><option value="">All</option><option value="restaurant">Restaurant</option><option value="bar">Bar</option><option value="pub">Pub</option><option value="cocktail_lounge">Cocktail lounge</option><option value="wine_bar">Wine bar</option><option value="music_bar">Music bar</option><option value="club">Club</option><option value="cafe">Cafe</option></select></label>
            <label>Neighborhood<select value={placeFilterState.neighborhood} onChange={(event) => applyPlaceFilters({ ...placeFilterState, neighborhood: event.target.value })}><option value="">All</option>{placeNeighborhoods.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
            <label>Mood<input value={placeFilterState.mood} placeholder="cozy" onChange={(event) => applyPlaceFilters({ ...placeFilterState, mood: event.target.value })} /></label>
            <label>Max / person<input type="number" min="0" value={placeFilterState.maxPrice} onChange={(event) => applyPlaceFilters({ ...placeFilterState, maxPrice: event.target.value })} /></label>
            <label className="place-filters__check"><input type="checkbox" checked={placeFilterState.openAt} onChange={(event) => applyPlaceFilters({ ...placeFilterState, openAt: event.target.checked })} /> Open at 20:00</label>
            <button type="button" onClick={clearPlaceFilters}>Clear</button>
          </div>
        ) : null}
        {discoveryMode === "places" ? (
          <details className="custom-place-form">
            <summary>Add a custom place</summary>
            <div>
              <label>Name<input value={customPlaceName} onChange={(event) => setCustomPlaceName(event.target.value)} placeholder="Place name" /></label>
              <label>Purpose<select value={customPlacePurpose} onChange={(event) => setCustomPlacePurpose(event.target.value as PlacePurpose)}><option value="dinner">Dinner</option><option value="quick_bite">Quick bite</option><option value="drinks">Drinks</option><option value="late_drinks">Late drinks</option></select></label>
              <label>Per person ({city.currency})<input type="number" min="0" value={customPlacePrice} onChange={(event) => setCustomPlacePrice(event.target.value)} /></label>
              <label>Minutes<input type="number" min="15" value={customPlaceDuration} onChange={(event) => setCustomPlaceDuration(event.target.value)} /></label>
              <ModelessButton variant="outline" size="sm" disabled={!customPlaceName.trim() || customPlacePrice === ""} onClick={addCustomPlace}>Add custom place</ModelessButton>
            </div>
            <p>Uses the current start location and an explicit 17:00–23:59 availability assumption for the selected date.</p>
          </details>
        ) : null}
        <div className={discoveryMode === "events" ? "happening-grid" : "place-grid"}>
          {discoveryMode === "events" ? visibleHappenings.length ? visibleHappenings.map((happening) => (
            <HappeningCard
              key={happening.id}
              happening={happening}
              timeZone={city.timeZone}
              candidate={state.candidateHappeningIds.includes(happening.id)}
              selected={state.selectedHappeningId === happening.id}
              inPlan={Boolean(plan?.stops.some((stop) => stop.kind === "happening" && stop.happeningId === happening.id))}
              canSwap={Boolean(plan?.stops.some((stop) => stop.kind === "happening" && !stop.locked))}
              onSelect={() => actions.selectHappening(happening.id)}
              onSwap={() => swapIn(happening.id)}
              onReject={() => rejectCandidate(happening.id)}
              onAdd={() => addEvent(happening.id)}
            />
          )) : <div className="catalog-empty" role="status"><strong>No matching events</strong><p>{query.trim() ? "Nothing matched your search in this time window." : "No current events are available in Local Buzz for this time window. Source updates may be incomplete."}</p>{query.trim() ? <button type="button" onClick={() => { setQuery(""); restoreFullListing(); }}>Clear search</button> : null}</div> : visiblePlaces.length ? visiblePlaces.map((place) => (
            <PlaceCard key={place.id} place={place} timeZone={city.timeZone} candidate={state.candidatePlaceIds.includes(place.id)} selected={state.selectedPlaceId === place.id}
              inPlan={Boolean(plan?.stops.some((stop) => stop.kind === "place" && stop.placeId === place.id))}
              onSelect={() => actions.selectPlace(place.id)} onAdd={(purpose) => addPlace(place.id, purpose)} />
          )) : <div className="catalog-empty" role="status"><strong>No matching places</strong><p>No places match the current filters.</p><button type="button" onClick={clearPlaceFilters}>Clear filters</button></div>}
        </div>
      </section>

      <footer className="data-disclosure">Local Buzz | 2026</footer>
    </main>
  );
}
