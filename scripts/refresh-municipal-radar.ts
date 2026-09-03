import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { refreshMunicipalRadar } from "../server/discovery/municipal";
import type { MunicipalRadarSnapshot } from "../server/discovery/types";
import type { CityId } from "../src/domain/types";

const argument = (name: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const cityValue = argument("--city") ?? process.argv[2] ?? "san-francisco";
if (cityValue !== "stockholm" && cityValue !== "san-francisco") throw new Error("Use --city stockholm or --city san-francisco.");
const cityId = cityValue as CityId;
const outputDir = resolve(argument("--output-dir") ?? "coverage");
const outputPath = resolve(outputDir, `municipal-${cityId}.json`);
let previous: MunicipalRadarSnapshot | undefined;
try { previous = JSON.parse(await readFile(outputPath, "utf8")) as MunicipalRadarSnapshot; } catch { /* no last-good snapshot */ }
const snapshot = await refreshMunicipalRadar({ cityId, previous });
await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
process.stdout.write(`${cityId}: ${snapshot.records.length} municipal radar record(s) · ${snapshot.retained ? "retained last-good" : "current refresh"}\n${snapshot.sources.map((source) => `- ${source.sourceId}: ${source.status} (${source.recordCount})${source.message ? ` — ${source.message}` : ""}`).join("\n")}\nSnapshot: ${outputPath}\n`);
