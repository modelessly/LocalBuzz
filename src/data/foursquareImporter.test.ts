import { describe, expect, it } from "vitest";
import { eveningPlaceImportDefaults, importFoursquarePlaces, type FoursquareImportConfig, type FoursquarePlaceRow } from "./foursquareImporter";

const config: FoursquareImportConfig = { ...eveningPlaceImportDefaults, cityId: "stockholm", bounds: { minLat: 59.25, maxLat: 59.4, minLng: 17.9, maxLng: 18.2 } };
const base: FoursquarePlaceRow = { fsq_place_id: "fsq-1", name: "Independent Wine Bar", latitude: 59.32, longitude: 18.07, address: "Examplegatan 1", categories: [{ id: 13025, name: "Wine Bar" }], website: "https://example.com" };

describe("bounded Foursquare Open Source Places importer", () => {
  it("emits stable review candidates without pretending provider data is canonical", () => {
    const result = importFoursquarePlaces([base], config);
    expect(result.candidates).toEqual([expect.objectContaining({ providerId: "fsq-1", cityId: "stockholm", verification: expect.objectContaining({ status: "needs_review" }) })]);
  });

  it("filters closure, bounds, categories, chains and duplicate identities", () => {
    const result = importFoursquarePlaces([
      base,
      { ...base },
      { ...base, fsq_place_id: "outside", latitude: 60 },
      { ...base, fsq_place_id: "closed", closed_bucket: "very_likely_closed" },
      { ...base, fsq_place_id: "store", categories: [{ name: "Convenience Store" }] },
      { ...base, fsq_place_id: "chain", name: "Starbucks Central", chain_name: "Starbucks" },
    ], config);
    expect(result.candidates).toHaveLength(1);
    expect(result.rejected).toMatchObject({ duplicate: 1, out_of_bounds: 1, closed: 1, category: 1, chain: 1 });
  });

  it("rejects incomplete provider rows at the quality gate", () => {
    const result = importFoursquarePlaces([{ ...base, address: undefined }], config);
    expect(result.candidates).toEqual([]);
    expect(result.rejected.quality).toBe(1);
  });
});
