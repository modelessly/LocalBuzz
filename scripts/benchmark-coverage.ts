import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getCityDefinition } from "../src/data/cities";
import type { CityId } from "../src/domain/types";
import { runBenchmark } from "../server/benchmarks/runner";
import type { KnownPerformer } from "../server/benchmarks/bandsintown";
import type { BenchmarkProviderId, BenchmarkSnapshot } from "../server/benchmarks/types";

const argument = (name: string) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; };
const values = (name: string) => process.argv.flatMap((value, index) => value === name && process.argv[index + 1] ? [process.argv[index + 1]] : []);
const cityId = argument("--city") as CityId | undefined; const provider = argument("--provider") as BenchmarkProviderId | undefined;
if (cityId !== "stockholm" && cityId !== "san-francisco") throw new Error("--city must be stockholm or san-francisco.");
if (!provider || !["predicthq", "bandsintown", "songkick"].includes(provider)) throw new Error("--provider must be predicthq, bandsintown or songkick.");
const city = getCityDefinition(cityId); const outputDir = resolve(argument("--output-dir") ?? "coverage");
const output = resolve(outputDir, `local-buzz.benchmark.${provider}.${cityId}.json`);
let previous: BenchmarkSnapshot | undefined;
try { previous = JSON.parse(await readFile(output, "utf8")) as BenchmarkSnapshot; } catch { previous = undefined; }
const performers: KnownPerformer[] = values("--performer").map((value) => {
  const [name, stableId, sourceHappeningId] = value.split("|");
  if (!name || !sourceHappeningId || !city.happenings.some((event) => event.id === sourceHappeningId)) throw new Error("--performer must be 'name|stableId|trustedHappeningId' and reference canonical inventory.");
  return { name, stableId: stableId || undefined, sourceHappeningId };
});
const snapshot = await runBenchmark({ provider, cityId, happenings: city.happenings, previous, predictHqApiKey: process.env.PREDICTHQ_API_KEY, bandsintownAppId: process.env.BANDSINTOWN_APP_ID, bandsintownTermsApproved: process.env.BANDSINTOWN_TERMS_APPROVED === "true", performers });
await mkdir(outputDir, { recursive: true }); await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
process.stdout.write(`${provider} ${cityId}: ${snapshot.status}; ${snapshot.records.length} benchmark-only records, ${snapshot.metrics.overlapCount} overlap, ${snapshot.metrics.credibleMissingCount} credible missing.\nSnapshot: ${output}\n`);
