import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { collectCityPulse, collectSanFranciscoPulse } from "../server/pulse/collector";
import { isPulseHandleGroup, type PulseHandleGroup } from "../server/pulse/config/cities";
import type { CollectionMode, PulseCityId } from "../server/pulse/types";

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function parseMode(): CollectionMode {
  const mode = argument("mode") ?? "broad";
  if (mode !== "broad" && mode !== "curated") throw new Error("--mode must be broad or curated");
  return mode;
}

function parseGroups(): PulseHandleGroup[] | undefined {
  const value = argument("groups");
  if (!value) return undefined;
  const groups = value.split(",").map((group) => group.trim()).filter(Boolean);
  if (!groups.every(isPulseHandleGroup)) throw new Error("--groups contains an unknown handle group");
  return groups;
}

function parseCity(): PulseCityId {
  const city = argument("city") ?? "san-francisco";
  if (city !== "stockholm" && city !== "san-francisco") throw new Error("--city must be stockholm or san-francisco");
  return city;
}

async function main() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("Set XAI_API_KEY in the environment before running the collector.");
  const cityId = parseCity();
  const modeArgument = argument("mode");
  const common = { apiKey, model: process.env.XAI_MODEL, groups: parseGroups(), enableImageUnderstanding: process.argv.includes("--images") };
  const result = cityId === "san-francisco" && modeArgument
    ? await collectSanFranciscoPulse({ ...common, mode: parseMode() })
    : await collectCityPulse({ ...common, cityId });
  const directory = resolve("fixtures/pulse");
  const outputPath = resolve(directory, `${cityId}.latest.json`);
  await mkdir(directory, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result.payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    event: "city_pulse_fixture_saved",
    cityId,
    outputPath,
    model: result.model,
    latencyMs: result.latencyMs,
    signalCount: result.payload.signals.length,
    validationFailureCount: result.rejected.length,
    passes: result.passes,
  }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Collector failed.");
  process.exitCode = 1;
});
