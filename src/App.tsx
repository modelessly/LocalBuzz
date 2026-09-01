import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, ChevronDown, LocateFixed, RefreshCw, Search } from "lucide-react";
import { ModelessButton, ModelessPanel, ModelessSearchField, SignalBadge } from "@modeless/design-system";
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
  initialPopulatedTimeSelection,
  localDate,
  localDateTimeToIso,
  shiftIsoDate,
  timeSelectionLabel,
  type TimeSelection,
} from "./lib/timeSearch";
import { loadSanFranciscoFreshData } from "./lib/sanFranciscoFresh";
import { describeCityEventSnapshot, loadCityEventSnapshot } from "./lib/cityEvents";
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
  const [query, setQuery] = useState(city.searchDefaults.query);
  const [timeSelection, setTimeSelection] = useState<TimeSelection>("now");
  const timeSelectionRef = useRef(timeSelection);
  timeSelectionRef.current = timeSelection;
  const [selectedDate, setSelectedDate] = useState(() => localDate(new Date(), city.timeZone));
  const [feedback, setFeedback] = useState<string>();
  const [discoveryMode, setDiscoveryMode] = useState<"events" | "places">("events");
  const [customPlaceName, setCustomPlaceName] = useState("");
  const [customPlacePrice, setCustomPlacePrice] = useState("");
  const [customPlaceDuration, setCustomPlaceDuration] = useState("60");
  const [customPlacePurpose, setCustomPlacePurpose] = useState<PlacePurpose>("drinks");
  const [placeFilterState, setPlaceFilterState] = useState<{ purpose: PlacePurpose | ""; kind: PlaceKind | ""; mood: string; neighborhood: string; maxPrice: string; openAt: boolean }>({ purpose: "", kind: "", mood: "", neighborhood: "", maxPrice: "", openAt: false });
  const [agentActivity, setAgentActivity] = useState<AgentActivity | null>(null);
  const cityMenuRef = useRef<HTMLDetailsElement>(null);
  const timeMenuRef = useRef<HTMLDetailsElement>(null);
  const plan = state.stagedPlan ?? state.currentPlan;
  const canRepair = Boolean(plan?.stops.some((stop) => stop.kind === "happening" && stop.status === "unavailable"));
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
    const cityId = state.activeCityId;
    const controller = new AbortController();
    void loadCityEventSnapshot(cityId, controller.signal)
      .then((snapshot) => {
        if (controller.signal.aborted || stateRef.current.activeCityId !== cityId) return;
        const message = describeCityEventSnapshot(snapshot);
        actions.replaceCityHappenings(cityId, snapshot.happenings, message, new Date());
        setFeedback(message);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setFeedback(error instanceof Error ? `Canonical event refresh unavailable: ${error.message}. Existing inventory retained.` : "Canonical event refresh unavailable. Existing inventory retained.");
      });
    return () => controller.abort();
  }, [actions, state.activeCityId]);

  useEffect(() => {
    if (state.activeCityId !== "san-francisco") return;
    const controller = new AbortController();
    const knownPlaces = getCityDefinition("san-francisco").happenings;
    setFeedback("Refreshing source-backed San Francisco events and live pulse…");
    void loadSanFranciscoFreshData(knownPlaces, controller.signal)
      .then((result) => {
        if (controller.signal.aborted || stateRef.current.activeCityId !== "san-francisco") return;
        const refreshedAt = new Date();
        let message = `${result.scheduledCount} fresh scheduled events · ${result.liveSignalCount} mapped live signals loaded into shared state.`;
        actions.replaceCityHappenings("san-francisco", result.happenings, message, refreshedAt);

        const suggestedSelection = initialPopulatedTimeSelection(
          result.happenings,
          getCityDefinition("san-francisco").timeZone,
          refreshedAt,
        );
        if (timeSelectionRef.current === "now" && suggestedSelection === "tomorrow") {
          const tomorrowWindow = getSearchWindow(
            "tomorrow",
            localDate(refreshedAt, getCityDefinition("san-francisco").timeZone),
            getCityDefinition("san-francisco").timeZone,
            refreshedAt,
          );
          const tomorrow = actions.searchHappenings({
            startAfter: tomorrowWindow.startAfter,
            endBefore: tomorrowWindow.endBefore,
            maxResults: stateRef.current.happenings.length,
          });
          if (tomorrow.ok && tomorrow.count > 0) {
            setTimeSelection("tomorrow");
            actions.showListings(
              tomorrow.happenings.map((item) => item.id),
              `Nothing remains tonight. ${tomorrow.count} happenings are visible for tomorrow.`,
            );
            message = `Nothing remains tonight. Showing ${tomorrow.count} happenings tomorrow.`;
          }
        }
        setFeedback(message);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setFeedback(error instanceof Error
          ? `Fresh San Francisco data unavailable: ${error.message}`
          : "Fresh San Francisco data unavailable.");
      });
    return () => controller.abort();
  }, [actions, state.activeCityId]);

  const handleResult = <T,>(result: DomainResult<T>, success?: string) => {
    if (result.ok) setFeedback(success);
    else setFeedback(`${result.code}: ${result.message}`);
    return result.ok;
  };

  const stageDemo = () => {
    actions.showCandidates(city.demoHappeningIds, `Local options for tonight in ${city.name}`);
    handleResult(
      actions.stagePlan(
        city.demoInitialPlanIds.map((happeningId) => ({
          happeningId,
          plannedStart: city.demoStarts[happeningId],
        })),
        `A distinctive ${city.name} night that finishes before midnight`,
      ),
      "Night staged. Lock what you love, reject what you don’t.",
    );
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
      maxResults: state.happenings.length,
    });
    if (result.ok) {
      if (selection === "later" && result.count === 0) {
        const tomorrowWindow = getSearchWindow("tomorrow", date, city.timeZone);
        const tomorrow = actions.searchHappenings({
          startAfter: tomorrowWindow.startAfter,
          endBefore: tomorrowWindow.endBefore,
          maxResults: stateRef.current.happenings.length,
        });
        if (tomorrow.ok && tomorrow.count > 0) {
          const noun = tomorrow.count === 1 ? "happening" : "happenings";
          setTimeSelection("tomorrow");
          actions.showListings(
            tomorrow.happenings.map((item) => item.id),
            `Nothing is listed later today. ${tomorrow.count} ${noun} ${tomorrow.count === 1 ? "is" : "are"} visible for tomorrow.`,
          );
          setFeedback(`Nothing is listed later today. Showing ${tomorrow.count} ${noun} tomorrow.`);
          return;
        }
      }
      actions.showListings(
        result.happenings.map((item) => item.id),
        `Full ${context} listing restored.`,
      );
      setFeedback(`${result.count} happenings shown for ${context}.`);
    } else handleResult(result);
  };

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
      maxPrice: city.searchDefaults.maxPrice,
      near: city.constraints.startLocation,
      maxDistanceKm: city.searchDefaults.maxDistanceKm,
      maxResults: 9,
    });
    if (result.ok) {
      actions.showCandidates(
        result.happenings.map((item) => item.id),
        `Matches “${query}” near ${city.constraints.startLocation.label}`,
      );
      setFeedback(`${result.count} candidates surfaced on the map.`);
    } else handleResult(result);
  };

  const rejectCandidate = (id: string) => {
    const ids = state.candidateHappeningIds.filter((candidateId) => candidateId !== id);
    handleResult(actions.showCandidates(ids, state.candidateReason), "Candidate removed by the human.");
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

  const disrupt = () => {
    const target = plan?.stops.find((stop) => stop.kind === "happening" && !stop.locked);
    if (!target || target.kind !== "happening") {
      setFeedback("Every stop is locked; the simulation will not override a human decision.");
      return;
    }
    handleResult(
      actions.applyLiveUpdate({
        id: `demo-update-${state.liveUpdates.length + 1}`,
        happeningId: target.happeningId,
        availability: "sold_out",
        label: "Demo live-status simulation",
        source: "demo_simulation",
        appliedAt: new Date().toISOString(),
      }),
      "Simulated venue update applied and clearly labeled.",
    );
  };

  const stagePlace = (placeId: string, purpose: PlacePurpose) => {
    const place = state.places.find((item) => item.id === placeId);
    if (!place) return;
    const duration = place.typicalVisitDurationMinutes * 60_000;
    const earliest = plan?.stops.reduce((value, stop) => Math.min(value, Date.parse(stop.plannedStart)), Number.POSITIVE_INFINITY);
    const latest = plan?.endTime ? Date.parse(plan.endTime) : undefined;
    const fallbackTime = purpose === "dinner" || purpose === "quick_bite" ? "18:00:00" : "21:30:00";
    const proposedMs = purpose === "dinner" || purpose === "quick_bite"
      ? (Number.isFinite(earliest) ? (earliest as number) - duration - 30 * 60_000 : Date.parse(localDateTimeToIso(selectedDate, fallbackTime, city.timeZone)))
      : (latest ? latest + 30 * 60_000 : Date.parse(localDateTimeToIso(selectedDate, fallbackTime, city.timeZone)));
    const result = actions.stagePlaceStop({ placeId, purpose, plannedStart: new Date(proposedMs).toISOString() }, `Human added ${purpose.replace("_", " ")}`);
    if (result.ok) setFeedback(`${place.name} staged as ${purpose.replace("_", " ")}. ${result.warnings.join(" ")}`.trim());
    else handleResult(result);
  };

  const stageEvent = (happeningId: string) => {
    const happening = state.happenings.find((item) => item.id === happeningId);
    if (!happening) return;
    handleResult(actions.stageHappeningStop({ happeningId, plannedStart: happening.timing.start }, "Human added an event"), `${happening.title} staged.`);
  };

  const stageCustomPlace = () => {
    const plannedStart = localDateTimeToIso(selectedDate, customPlacePurpose === "dinner" ? "18:00:00" : "21:30:00", city.timeZone);
    const result = actions.stageCustomPlace({
      name: customPlaceName, purpose: customPlacePurpose, plannedStart,
      location: { ...city.constraints.startLocation, address: "User-provided location", neighborhood: city.constraints.startLocation.label },
      typicalVisitDurationMinutes: Number(customPlaceDuration), pricePerPerson: Number(customPlacePrice), currency: city.currency,
      availableFrom: localDateTimeToIso(selectedDate, "17:00:00", city.timeZone),
      availableUntil: localDateTimeToIso(selectedDate, "23:59:00", city.timeZone),
      note: "Human-entered place; hours, price and location are explicit unverified assumptions.",
    }, "Human added an unverified custom place");
    if (result.ok) {
      setFeedback(`${customPlaceName} staged and visibly marked unverified. ${result.warnings.join(" ")}`);
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

  const repair = () => {
    handleResult(
      actions.repairPlan({
        reason: "Selected event became unavailable; preserve the rest of the night",
        preserveLockedStops: true,
        replacementHappeningIds: city.repairHappeningIds,
      }),
      "Minimum repair staged. Locked and unaffected stops remain intact.",
    );
  };

  const switchCity = (cityId: CityId) => {
    const nextCity = getCityDefinition(cityId);
    actions.switchCity(cityId);
    setQuery(nextCity.searchDefaults.query);
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

      <section className="mission-strip" aria-label="Current mission">
        <span>MISSION 01</span>
        <p>“{city.mission}”</p>
        <ModelessButton variant="ghost" size="sm" onClick={() => { actions.resetDemo(); setFeedback("Demo reset."); }}>
          <RefreshCw aria-hidden="true" size={14} /> Reset
        </ModelessButton>
      </section>

      <div className="workspace">
        <ModelessPanel
          className="map-panel"
          title={`${city.name} in reach`}
          actions={<span className="inventory-count">{visibleHappenings.length + visiblePlaces.length} in view · {state.happenings.length} events · {state.places.length} places</span>}
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
            changes={state.stagedChanges}
            onSelect={(id) => actions.selectHappening(id)}
            onSelectPlace={(id) => actions.selectPlace(id)}
          />
        </ModelessPanel>

        <ModelessPanel
          className="night-panel"
          title="Your night"
          actions={<span className="end-cap">By 00:00</span>}
          motion="subtle"
        >
          <EveningTimeline
            currentPlan={state.currentPlan}
            stagedPlan={state.stagedPlan}
            changes={state.stagedChanges}
            happenings={state.happenings}
            places={state.places}
            onStageDemo={stageDemo}
            onCopyAgentPrompt={copyAgentPrompt}
            webMcpStatus={state.webMcp}
            onAccept={() => handleResult(actions.acceptStagedChanges(), "Night accepted.")}
            onReject={() => handleResult(actions.rejectStagedChanges(), "Staged changes rejected.")}
            onLock={(id) => handleResult(actions.lockPlanStop(id), "Human lock recorded.")}
            onUnlock={(id) => handleResult(actions.unlockPlanStop(id), "Stop unlocked.")}
            onRemove={(id) => handleResult(actions.removePlanStop(id), "Stop removed by the human.")}
            onDisrupt={disrupt}
            onRepair={repair}
            canRepair={canRepair}
            timeZone={city.timeZone}
            agentActivity={agentActivity}
          />
        </ModelessPanel>
      </div>

      <section className="activity-bar" aria-live="polite">
        <span className="activity-bar__pulse" />
        <strong>Shared state</strong>
        <p>{feedback ?? state.activityMessage}</p>
        {state.liveUpdates.length ? <SignalBadge variant="warning">demo simulation active</SignalBadge> : null}
      </section>

      <DiscoveryReview
        leads={state.discoveryLeads}
        onAccept={(id) => handleResult(actions.acceptDiscoveryLead(id), "Discovery lead accepted into canonical inventory.")}
        onReject={(id) => handleResult(actions.rejectDiscoveryLead(id), "Discovery lead rejected; inventory unchanged.")}
        onKeepCustom={(id) => {
          const plannedStart = localDateTimeToIso(selectedDate, "20:00:00", city.timeZone);
          handleResult(actions.keepDiscoveryLeadAsCustom(id, {
            purpose: "drinks",
            plannedStart,
            availableFrom: localDateTimeToIso(selectedDate, "17:00:00", city.timeZone),
            availableUntil: localDateTimeToIso(shiftIsoDate(selectedDate, 1), "00:00:00", city.timeZone),
          }), "Place retained as a staged unverified custom stop.");
        }}
      />

      <section className="discover-section">
        <div className="discover-header">
          <div>
            <h2>{discoveryMode === "events" ? happeningTitle : "Places for your night"}</h2>
            <div className="discovery-tabs" role="tablist" aria-label="Discover events or places">
              <button type="button" role="tab" aria-selected={discoveryMode === "events"} onClick={() => setDiscoveryMode("events")}>Events</button>
              <button type="button" role="tab" aria-selected={discoveryMode === "places"} onClick={() => { setDiscoveryMode("places"); actions.showPlaceListings(state.places.map((item) => item.id)); }}>Places</button>
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
        {state.candidateReason ? <p className="candidate-reason">Agent surfaced: {state.candidateReason}</p> : null}
        {discoveryMode === "places" ? (
          <div className="place-filters" aria-label="Filter places">
            <label>Purpose<select value={placeFilterState.purpose} onChange={(event) => applyPlaceFilters({ ...placeFilterState, purpose: event.target.value as PlacePurpose | "" })}><option value="">All</option><option value="dinner">Dinner</option><option value="quick_bite">Quick bite</option><option value="drinks">Drinks</option><option value="late_drinks">Late drinks</option></select></label>
            <label>Kind<select value={placeFilterState.kind} onChange={(event) => applyPlaceFilters({ ...placeFilterState, kind: event.target.value as PlaceKind | "" })}><option value="">All</option><option value="restaurant">Restaurant</option><option value="bar">Bar</option><option value="pub">Pub</option><option value="cocktail_lounge">Cocktail lounge</option><option value="wine_bar">Wine bar</option><option value="music_bar">Music bar</option><option value="club">Club</option><option value="cafe">Cafe</option></select></label>
            <label>Neighborhood<select value={placeFilterState.neighborhood} onChange={(event) => applyPlaceFilters({ ...placeFilterState, neighborhood: event.target.value })}><option value="">All</option>{placeNeighborhoods.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
            <label>Mood<input value={placeFilterState.mood} placeholder="cozy" onChange={(event) => applyPlaceFilters({ ...placeFilterState, mood: event.target.value })} /></label>
            <label>Max / person<input type="number" min="0" value={placeFilterState.maxPrice} onChange={(event) => applyPlaceFilters({ ...placeFilterState, maxPrice: event.target.value })} /></label>
            <label className="place-filters__check"><input type="checkbox" checked={placeFilterState.openAt} onChange={(event) => applyPlaceFilters({ ...placeFilterState, openAt: event.target.checked })} /> Open at 20:00</label>
            <button type="button" onClick={() => applyPlaceFilters({ purpose: "", kind: "", mood: "", neighborhood: "", maxPrice: "", openAt: false })}>Clear</button>
          </div>
        ) : null}
        {discoveryMode === "places" ? (
          <details className="custom-place-form">
            <summary>Add a custom place <span>Always marked unverified</span></summary>
            <div>
              <label>Name<input value={customPlaceName} onChange={(event) => setCustomPlaceName(event.target.value)} placeholder="Place name" /></label>
              <label>Purpose<select value={customPlacePurpose} onChange={(event) => setCustomPlacePurpose(event.target.value as PlacePurpose)}><option value="dinner">Dinner</option><option value="quick_bite">Quick bite</option><option value="drinks">Drinks</option><option value="late_drinks">Late drinks</option></select></label>
              <label>Per person ({city.currency})<input type="number" min="0" value={customPlacePrice} onChange={(event) => setCustomPlacePrice(event.target.value)} /></label>
              <label>Minutes<input type="number" min="15" value={customPlaceDuration} onChange={(event) => setCustomPlaceDuration(event.target.value)} /></label>
              <ModelessButton variant="outline" size="sm" disabled={!customPlaceName.trim() || customPlacePrice === ""} onClick={stageCustomPlace}>Stage unverified place</ModelessButton>
            </div>
            <p>Uses the current start location and an explicit 17:00–23:59 availability assumption for the selected date. Review before accepting.</p>
          </details>
        ) : null}
        <div className={discoveryMode === "events" ? "happening-grid" : "place-grid"}>
          {discoveryMode === "events" ? visibleHappenings.map((happening) => (
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
              onStage={() => stageEvent(happening.id)}
            />
          )) : visiblePlaces.map((place) => (
            <PlaceCard key={place.id} place={place} timeZone={city.timeZone} candidate={state.candidatePlaceIds.includes(place.id)} selected={state.selectedPlaceId === place.id}
              inPlan={Boolean(plan?.stops.some((stop) => stop.kind === "place" && stop.placeId === place.id))}
              onSelect={() => actions.selectPlace(place.id)} onStage={(purpose) => stagePlace(place.id, purpose)} />
          ))}
        </div>
      </section>

      <footer className="data-disclosure">
        <strong>Prototype data</strong>
        <span>{city.snapshotLabel} · {state.places.length} official-source place records with field-level provenance · Local Buzz mood/duration enrichment · clearly labeled deterministic availability simulation</span>
      </footer>
    </main>
  );
}
