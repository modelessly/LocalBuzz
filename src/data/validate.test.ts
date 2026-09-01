import { describe, expect, it } from "vitest";
import { happenings } from "./happenings";
import { sanFranciscoHappenings } from "./sanFranciscoHappenings";
import { sanFranciscoPlaces, stockholmPlaces } from "./places";
import { validateHappenings, validatePlaces } from "./validate";

describe("happening fixture", () => {
  it("contains the requested credible prototype slice", () => {
    expect(happenings).toHaveLength(48);
    expect(new Set(happenings.map((item) => item.venue.name)).size).toBeGreaterThanOrEqual(20);
  });

  it("keeps a small explicit Place catalog for both cities", () => {
    expect(stockholmPlaces).toHaveLength(33);
    expect(sanFranciscoPlaces).toHaveLength(33);
    expect(validatePlaces(stockholmPlaces)).toEqual([]);
    expect(validatePlaces(sanFranciscoPlaces)).toEqual([]);
    expect([...stockholmPlaces, ...sanFranciscoPlaces].every((place) => place.provenance.every((source) => source.url.startsWith("https://")))).toBe(true);
    expect([...stockholmPlaces, ...sanFranciscoPlaces].every((place) => place.verification.verifiedAt && place.officialWebsite && place.priceRange.band)).toBe(true);
  });

  it("contains no excluded category/name leakage or duplicate stable identities", () => {
    const all = [...stockholmPlaces, ...sanFranciscoPlaces];
    expect(new Set(all.map((place) => place.id)).size).toBe(all.length);
    expect(new Set(all.map((place) => `${place.cityId}:${place.name.toLowerCase()}`)).size).toBe(all.length);
    expect(all.map((place) => `${place.name} ${place.kind} ${place.cuisine.join(" ")}`.toLowerCase()).join(" ")).not.toMatch(/mcdonald|burger king|7-eleven|convenience store|supermarket|gas station|food court|delivery-only/);
  });

  it("keeps at least three operational options near each supported evening corridor", () => {
    const corridors = [
      { name: "Stockholm central", city: stockholmPlaces, lat: 59.3326, lng: 18.0649 },
      { name: "Stockholm Södermalm", city: stockholmPlaces, lat: 59.3158, lng: 18.0732 },
      { name: "Stockholm Vasastan", city: stockholmPlaces, lat: 59.3407, lng: 18.0448 },
      { name: "San Francisco Mission", city: sanFranciscoPlaces, lat: 37.7599, lng: -122.4194 },
      { name: "San Francisco SoMa", city: sanFranciscoPlaces, lat: 37.7744, lng: -122.4124 },
      { name: "San Francisco Divisadero", city: sanFranciscoPlaces, lat: 37.7750, lng: -122.4378 },
      { name: "San Francisco North Beach", city: sanFranciscoPlaces, lat: 37.7980, lng: -122.4060 },
    ];
    const distanceKm = (latA: number, lngA: number, latB: number, lngB: number) => {
      const radians = (degrees: number) => degrees * Math.PI / 180;
      const dLat = radians(latB - latA);
      const dLng = radians(lngB - lngA);
      const a = Math.sin(dLat / 2) ** 2
        + Math.cos(radians(latA)) * Math.cos(radians(latB)) * Math.sin(dLng / 2) ** 2;
      return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    for (const corridor of corridors) {
      const operationalNearby = corridor.city.filter((place) =>
        place.openingHoursEvidence.status === "verified"
        && place.priceRange.min !== undefined
        && place.priceRange.max !== undefined
        && distanceKm(corridor.lat, corridor.lng, place.location.lat, place.location.lng) <= 3.5
      );
      expect(operationalNearby.length, corridor.name).toBeGreaterThanOrEqual(3);
    }
  });

  it("passes provenance and structural validation", () => {
    expect(validateHappenings(happenings)).toEqual([]);
    expect(validateHappenings(sanFranciscoHappenings)).toEqual([]);
  });

  it("keeps source data and Local Buzz enrichment distinct", () => {
    for (const item of happenings) {
      expect(item.source.url).toMatch(/^https:\/\//);
      expect(item.enrichment?.enrichmentMethod).toBe("manual");
      expect(item.status.statusSource).toBe("source");
    }
  });

  it("keeps the two city inventories explicit and isolated", () => {
    expect(sanFranciscoHappenings).toHaveLength(12);
    expect(happenings.every((item) => item.cityId === "stockholm")).toBe(true);
    expect(sanFranciscoHappenings.every((item) => item.cityId === "san-francisco")).toBe(true);
  });
});
