import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { collectSanFranciscoEvents } from "../server/events/collector";

async function main() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("Set XAI_API_KEY in the environment before running the collector.");
  const result = await collectSanFranciscoEvents({ apiKey, model: process.env.XAI_MODEL });
  const directory = resolve("fixtures/events");
  const outputPath = resolve(directory, "san-francisco.latest.json");
  await mkdir(directory, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result.payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    event: "sf_events_fixture_saved",
    outputPath,
    model: result.model,
    latencyMs: result.latencyMs,
    eventCount: result.payload.events.length,
    validationFailures: result.rejected,
  }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Collector failed.");
  process.exitCode = 1;
});
