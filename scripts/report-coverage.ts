import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { cityIds, getCityDefinition } from "../src/data/cities";
import { buildCoverageReport, formatCoverageReport } from "../server/discovery/coverage";
import { targetedQueriesFromCoverage } from "../server/discovery/queries";

const argument = (name: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const asOfValue = argument("--as-of");
const now = asOfValue ? new Date(asOfValue) : new Date();
if (!Number.isFinite(now.getTime())) throw new Error("--as-of must be a valid ISO date-time.");
const outputDir = resolve(argument("--output-dir") ?? "coverage");
const happenings = cityIds.flatMap((cityId) => getCityDefinition(cityId).happenings);
const places = cityIds.flatMap((cityId) => getCityDefinition(cityId).places);
const report = buildCoverageReport({ happenings, places, now });
const queries = targetedQueriesFromCoverage(report);
await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, "local-buzz.coverage.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(resolve(outputDir, "local-buzz.queries.json"), `${JSON.stringify(queries, null, 2)}\n`, "utf8");
process.stdout.write(`${formatCoverageReport(report)}\nMachine report: ${resolve(outputDir, "local-buzz.coverage.json")}\nTarget queries: ${resolve(outputDir, "local-buzz.queries.json")}\n`);
