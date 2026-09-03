import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildCoverageReport } from "../server/discovery/coverage";
import { targetedQueriesFromCoverage } from "../server/discovery/queries";
import { runTargetedDiscovery } from "../server/discovery/targeted";
import type { TargetedDiscoverySnapshot } from "../server/discovery/types";
import { cityIds, getCityDefinition } from "../src/data/cities";
import type { CityId } from "../src/domain/types";

const argument = (name: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const cityValue = argument("--city") ?? process.argv[2];
if (cityValue !== "stockholm" && cityValue !== "san-francisco") throw new Error("Use --city stockholm or --city san-francisco.");
const cityId = cityValue as CityId;
const now = argument("--as-of") ? new Date(argument("--as-of")!) : new Date();
if (!Number.isFinite(now.getTime())) throw new Error("--as-of must be a valid ISO date-time.");
const happenings = cityIds.flatMap((id) => getCityDefinition(id).happenings);
const places = cityIds.flatMap((id) => getCityDefinition(id).places);
const report = buildCoverageReport({ happenings, places, now });
const candidates = targetedQueriesFromCoverage(report, report.cells.length).filter((target) => target.cell.cityId === cityId);
const requested = argument("--target");
const target = requested ? candidates.find((item) => item.id === requested) : candidates[0];
if (!target) throw new Error(requested ? `Unknown weak coverage target: ${requested}` : `No weak coverage target exists for ${cityId}.`);
const outputDir = resolve(argument("--output-dir") ?? "coverage");
const safeName = target.id.replace(/[^a-z0-9-]+/gi, "-").slice(0, 120);
const outputPath = resolve(outputDir, `discovery-${safeName}.json`);
let previous: TargetedDiscoverySnapshot | undefined;
try { previous = JSON.parse(await readFile(outputPath, "utf8")) as TargetedDiscoverySnapshot; } catch { /* no last-good snapshot */ }
const snapshot = await runTargetedDiscovery({ apiKey: process.env.XAI_API_KEY, model: process.env.XAI_MODEL, target, happenings: getCityDefinition(cityId).happenings, previous, now });
await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
process.stdout.write(`${snapshot.status.toUpperCase()}: ${target.query}\n${snapshot.leads.length} discovery lead(s) · ${snapshot.message ?? "validated"}\nSnapshot: ${outputPath}\n`);
if (snapshot.status === "unavailable" || snapshot.status === "invalid") process.exitCode = 2;
