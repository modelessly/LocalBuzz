import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getCityDefinition } from "../src/data/cities";
import type { CityId } from "../src/domain/types";
import { buildEventGraph } from "../server/eventGraph/graph";
import type { EventGraphExpansionCandidate, EventGraphSeed } from "../server/eventGraph/types";

const argument = (name: string) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; };
const values = (name: string) => process.argv.flatMap((value, index) => value === name && process.argv[index + 1] ? [process.argv[index + 1]] : []);
const cityId = argument("--city") as CityId | undefined;
if (cityId !== "stockholm" && cityId !== "san-francisco") throw new Error("--city must be stockholm or san-francisco.");
const city = getCityDefinition(cityId);
const happeningIds = values("--happening");
if (!happeningIds.length) throw new Error("Provide at least one trusted canonical --happening ID.");
const seeds: EventGraphSeed[] = happeningIds.map((id) => {
  const happening = city.happenings.find((item) => item.id === id);
  if (!happening) throw new Error(`Unknown canonical happening: ${id}`);
  return { happening };
});
const inputPath = argument("--candidates");
const candidates = inputPath ? JSON.parse(await readFile(resolve(inputPath), "utf8")) as EventGraphExpansionCandidate[] : [];
if (!Array.isArray(candidates)) throw new Error("--candidates must contain a JSON array.");
const snapshot = buildEventGraph({ seeds, candidates, existingHappenings: city.happenings });
const outputDir = resolve(argument("--output-dir") ?? "coverage");
await mkdir(outputDir, { recursive: true });
const output = resolve(outputDir, `local-buzz.event-graph.${cityId}.json`);
await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
process.stdout.write(`Event graph: ${snapshot.nodes.length} nodes, ${snapshot.edges.length} edges, ${snapshot.leads.length} review leads, ${snapshot.rejected.length} rejected.\nSnapshot: ${output}\n`);
