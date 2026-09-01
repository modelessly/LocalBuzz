import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { collectSanFranciscoPulse } from "../server/pulse/collector";
import { isHandleGroup, type SfHandleGroup } from "../server/pulse/config/handles";
import type { CollectionMode } from "../server/pulse/types";

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function parseMode(): CollectionMode {
  const mode = argument("mode") ?? "broad";
  if (mode !== "broad" && mode !== "curated") throw new Error("--mode must be broad or curated");
  return mode;
}

function parseGroups(): SfHandleGroup[] | undefined {
  const value = argument("groups");
  if (!value) return undefined;
  const groups = value.split(",").map((group) => group.trim()).filter(Boolean);
  if (!groups.every(isHandleGroup)) throw new Error("--groups contains an unknown handle group");
  return groups;
}

async function main() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("Set XAI_API_KEY in the environment before running the collector.");
  const result = await collectSanFranciscoPulse({
    apiKey,
    model: process.env.XAI_MODEL,
    mode: parseMode(),
    groups: parseGroups(),
    enableImageUnderstanding: process.argv.includes("--images"),
  });
  const directory = resolve("fixtures/pulse");
  const outputPath = resolve(directory, "san-francisco.latest.json");
  await mkdir(directory, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result.payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    event: "sf_pulse_fixture_saved",
    outputPath,
    model: result.model,
    latencyMs: result.latencyMs,
    signalCount: result.payload.signals.length,
    validationFailureCount: result.rejected.length,
  }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Collector failed.");
  process.exitCode = 1;
});
