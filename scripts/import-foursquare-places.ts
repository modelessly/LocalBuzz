import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { eveningPlaceImportDefaults, importFoursquarePlaces, type FoursquarePlaceRow } from "../src/data/foursquareImporter";
import type { CityId } from "../src/domain/types";

const args = new Map(process.argv.slice(2).flatMap((value, index, values) => value.startsWith("--") ? [[value.slice(2), values[index + 1]]] : []));
const input = args.get("input"); const output = args.get("output"); const city = args.get("city") as CityId | undefined;
const bounds = args.get("bounds")?.split(",").map(Number);
if (!input || !output || !city || !["stockholm", "san-francisco"].includes(city) || bounds?.length !== 4 || bounds.some((value) => !Number.isFinite(value))) {
  throw new Error("Usage: npm run places:import -- --city stockholm --bounds minLat,maxLat,minLng,maxLng --input city.ndjson --output fixtures/place-import/stockholm.json");
}
const rows = (await readFile(input, "utf8")).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as FoursquarePlaceRow);
const result = importFoursquarePlaces(rows, { ...eveningPlaceImportDefaults, cityId: city, bounds: { minLat: bounds[0], maxLat: bounds[1], minLng: bounds[2], maxLng: bounds[3] } });
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify({ generatedAt: new Date().toISOString(), cityId: city, ...result }, null, 2)}\n`, "utf8");
console.log(`Wrote ${result.candidates.length} review candidates to ${output}. Rejected: ${JSON.stringify(result.rejected)}`);
