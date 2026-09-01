import { useEffect, useRef, useState } from "react";
import { type GeoJSONSource, Map as MapLibreMap, Marker, NavigationControl } from "maplibre-gl";
import type { FeatureCollection, LineString } from "geojson";
import type { EveningPlan, Happening, Place, PlanChange, PlanStop } from "../domain/types";
import { eventSignalState } from "../lib/eventSignal";

type CityMapProps = {
  cityName: string;
  center: [number, number];
  zoom: number;
  startLocation: { lat: number; lng: number; label: string };
  happenings: Happening[];
  places: Place[];
  visibleIds: string[];
  visiblePlaceIds: string[];
  candidateIds: string[];
  candidatePlaceIds: string[];
  selectedId?: string;
  selectedPlaceId?: string;
  plan: EveningPlan | null;
  changes: PlanChange[];
  onSelect: (id: string) => void;
  onSelectPlace: (id: string) => void;
};

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const ROUTE_SOURCE_ID = "local-buzz-route";
const ROUTE_GLOW_LAYER_ID = "local-buzz-route-glow";
const ROUTE_LAYER_ID = "local-buzz-route-line";
const REPAIR_SOURCE_ID = "local-buzz-repair-scar";
const REPAIR_GLOW_LAYER_ID = "local-buzz-repair-scar-glow";
const REPAIR_LAYER_ID = "local-buzz-repair-scar-line";

export function CityMap({
  cityName,
  center,
  zoom,
  startLocation,
  happenings,
  places,
  visibleIds,
  visiblePlaceIds,
  candidateIds,
  candidatePlaceIds,
  selectedId,
  selectedPlaceId,
  plan,
  changes,
  onSelect,
  onSelectPlace,
}: CityMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onSelectPlaceRef = useRef(onSelectPlace);
  onSelectPlaceRef.current = onSelectPlace;

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    setMapStatus("loading");

    const map = new MapLibreMap({
      container: containerRef.current,
      style: MAP_STYLE,
      center,
      zoom,
      minZoom: 10,
      maxZoom: 18,
      pitchWithRotate: false,
      dragRotate: false,
    });

    const handleError = () => setMapStatus("error");
    const handleIdle = () => {
      map.off("error", handleError);
      setMapStatus("ready");
    };
    map.once("idle", handleIdle);
    map.once("error", handleError);

    map.addControl(new NavigationControl({ showCompass: false }), "top-left");

    const originElement = document.createElement("div");
    originElement.className = "city-map__origin";
    const originDot = document.createElement("span");
    originElement.append(originDot, document.createTextNode(startLocation.label));
    new Marker({ element: originElement, anchor: "center" })
      .setLngLat([startLocation.lng, startLocation.lat])
      .addTo(map);

    mapRef.current = map;

    return () => {
      map.off("idle", handleIdle);
      map.off("error", handleError);
      markersRef.current = [];
      mapRef.current = null;
      map.remove();
    };
  }, [center, startLocation, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const byId = new Map(happenings.map((item) => [item.id, item]));
    const visible = visibleIds
      .map((id) => byId.get(id))
      .filter((item): item is Happening => Boolean(item));
    const repairScarIds = new Set(
      changes
        .filter((change) => change.type === "replace")
        .map((change) => change.before?.kind === "happening" ? change.before.happeningId : undefined)
        .filter((id): id is string => Boolean(id)),
    );

    const eventMarkers = visible.map((item) => {
      const stopIndex = plan?.stops.findIndex((stop) => stop.kind === "happening" && stop.happeningId === item.id) ?? -1;
      const planned = stopIndex >= 0;
      const stopId = planned ? plan?.stops[stopIndex]?.id : undefined;
      const repaired = Boolean(stopId && changes.some((change) => change.type === "replace" && change.stopId === stopId));
      const unavailable = ["sold_out", "cancelled"].includes(item.status.availability);
      const signal = eventSignalState(item, nowMs);
      const markerRoot = document.createElement("div");
      markerRoot.className = [
        "local-buzz-marker",
        signal !== "quiet" ? `is-${signal}` : "",
        repairScarIds.has(item.id) ? "is-repair-scar" : "",
      ].filter(Boolean).join(" ");

      const button = document.createElement("button");
      button.type = "button";
      button.className = [
        "map-pin",
        candidateIds.includes(item.id) ? "is-candidate" : "",
        selectedId === item.id ? "is-selected" : "",
        planned ? "is-planned" : "",
        repaired ? "is-repaired" : "",
        unavailable ? "is-unavailable" : "",
      ]
        .filter(Boolean)
        .join(" ");
      button.ariaLabel = `${planned ? `Stop ${stopIndex + 1}: ` : ""}${item.title} at ${item.venue.name}`;
      button.title = `${item.title} · ${item.venue.name}`;
      const pinLabel = document.createElement("span");
      pinLabel.textContent = planned ? String(stopIndex + 1) : "";
      button.append(pinLabel);
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        onSelectRef.current(item.id);
      });
      markerRoot.append(button);

      return new Marker({ element: markerRoot, anchor: "center" })
        .setLngLat([item.venue.lng, item.venue.lat])
        .addTo(map);
    });
    const byPlaceId = new Map(places.map((item) => [item.id, item]));
    const placeMarkers = visiblePlaceIds.map((id) => byPlaceId.get(id)).filter((item): item is Place => Boolean(item)).map((item) => {
      const stopIndex = plan?.stops.findIndex((stop) => stop.kind === "place" && stop.placeId === item.id) ?? -1;
      const markerRoot = document.createElement("div");
      markerRoot.className = "local-buzz-marker is-place";
      const button = document.createElement("button");
      button.type = "button";
      button.className = ["map-pin", "is-place", candidatePlaceIds.includes(item.id) ? "is-candidate" : "", selectedPlaceId === item.id ? "is-selected" : "", stopIndex >= 0 ? "is-planned" : ""].filter(Boolean).join(" ");
      button.ariaLabel = `${stopIndex >= 0 ? `Stop ${stopIndex + 1}: ` : "Place: "}${item.name}`;
      button.title = `${item.name} · ${item.location.neighborhood}`;
      const label = document.createElement("span"); label.textContent = stopIndex >= 0 ? String(stopIndex + 1) : "P"; button.append(label);
      button.addEventListener("click", (event) => { event.stopPropagation(); onSelectPlaceRef.current(item.id); });
      markerRoot.append(button);
      return new Marker({ element: markerRoot, anchor: "center" }).setLngLat([item.location.lng, item.location.lat]).addTo(map);
    });
    const customMarkers = (plan?.stops ?? []).filter((stop): stop is Extract<PlanStop, { kind: "custom_place" }> => stop.kind === "custom_place").map((stop) => {
      const markerRoot = document.createElement("div"); markerRoot.className = "local-buzz-marker is-place is-custom";
      const button = document.createElement("button"); button.type = "button"; button.className = "map-pin is-place is-planned is-unverified";
      button.ariaLabel = `Unverified custom place: ${stop.customPlace.name}`; button.title = `${stop.customPlace.name} · unverified custom place`;
      const label = document.createElement("span"); label.textContent = String((plan?.stops.indexOf(stop) ?? 0) + 1); button.append(label); markerRoot.append(button);
      return new Marker({ element: markerRoot, anchor: "center" }).setLngLat([stop.customPlace.location.lng, stop.customPlace.location.lat]).addTo(map);
    });
    markersRef.current = [...eventMarkers, ...placeMarkers, ...customMarkers];
  }, [candidateIds, candidatePlaceIds, changes, happenings, nowMs, places, plan, selectedId, selectedPlaceId, visibleIds, visiblePlaceIds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const byId = new Map(happenings.map((item) => [item.id, item]));
    const byPlaceId = new Map(places.map((item) => [item.id, item]));
    const coordinatesFor = (stop: PlanStop): [number, number] | undefined => {
      if (stop.kind === "happening") { const item = byId.get(stop.happeningId); return item ? [item.venue.lng, item.venue.lat] : undefined; }
      if (stop.kind === "place") { const item = byPlaceId.get(stop.placeId); return item ? [item.location.lng, item.location.lat] : undefined; }
      return [stop.customPlace.location.lng, stop.customPlace.location.lat];
    };
    const coordinates = (plan?.stops ?? [])
      .map(coordinatesFor)
      .filter((item): item is [number, number] => Boolean(item));
    const route: FeatureCollection<LineString> = {
      type: "FeatureCollection",
      features: coordinates.length >= 2
        ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } }]
        : [],
    };
    const repairScar: FeatureCollection<LineString> = {
      type: "FeatureCollection",
      features: changes.flatMap((change) => {
        if (change.type !== "replace" || !change.before || !change.after) return [];
        const before = coordinatesFor(change.before);
        const after = coordinatesFor(change.after);
        if (!before || !after) return [];
        return [{
          type: "Feature" as const,
          properties: { changeId: change.id },
          geometry: {
            type: "LineString" as const,
            coordinates: [before, after],
          },
        }];
      }),
    };

    const syncRoute = () => {
      const existing = map.getSource(ROUTE_SOURCE_ID) as GeoJSONSource | undefined;
      if (existing) {
        existing.setData(route);
      } else {
        map.addSource(ROUTE_SOURCE_ID, { type: "geojson", data: route });
        map.addLayer({
          id: ROUTE_GLOW_LAYER_ID,
          type: "line",
          source: ROUTE_SOURCE_ID,
          paint: {
            "line-color": "#080808",
            "line-width": 8,
            "line-opacity": 0.58,
          },
        });
        map.addLayer({
          id: ROUTE_LAYER_ID,
          type: "line",
          source: ROUTE_SOURCE_ID,
          paint: {
            "line-color": "#c7ff2a",
            "line-width": 3,
            "line-dasharray": [1.5, 1.5],
          },
        });
      }

      const existingRepair = map.getSource(REPAIR_SOURCE_ID) as GeoJSONSource | undefined;
      if (existingRepair) {
        existingRepair.setData(repairScar);
        return;
      }
      map.addSource(REPAIR_SOURCE_ID, { type: "geojson", data: repairScar });
      map.addLayer({
        id: REPAIR_GLOW_LAYER_ID,
        type: "line",
        source: REPAIR_SOURCE_ID,
        paint: {
          "line-color": "#ff526f",
          "line-width": 10,
          "line-blur": 5,
          "line-opacity": 0.2,
        },
      });
      map.addLayer({
        id: REPAIR_LAYER_ID,
        type: "line",
        source: REPAIR_SOURCE_ID,
        paint: {
          "line-color": "#d195ff",
          "line-width": 2,
          "line-opacity": 0.78,
          "line-dasharray": [1, 2.4],
        },
      });
    };

    if (map.isStyleLoaded()) syncRoute();
    else map.once("load", syncRoute);

    return () => {
      map.off("load", syncRoute);
    };
  }, [changes, happenings, places, plan]);

  return (
    <div className="city-map" data-map-status={mapStatus} aria-label={`Interactive map of ${cityName} events and places`}>
      <div ref={containerRef} className="city-map__canvas" />
      {mapStatus !== "ready" ? (
        <div className="city-map__status" role={mapStatus === "error" ? "alert" : "status"}>
          {mapStatus === "error" ? "Map tiles unavailable · event locations remain active" : `Loading ${cityName} map…`}
        </div>
      ) : null}
      <div className="city-map__legend">
        <span><i className="legend-dot legend-dot--live" /> happening now</span>
        <span><i className="legend-dot legend-dot--candidate" /> candidate</span>
        <span><i className="legend-dot legend-dot--place" /> place</span>
        <span><i className="legend-dot legend-dot--plan" /> your night</span>
        <span><i className="legend-dot legend-dot--closed" /> unavailable</span>
      </div>
    </div>
  );
}
