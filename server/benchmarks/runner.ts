import type { CityId, Happening } from "../../src/domain/types";
import { collectBandsintown, type KnownPerformer } from "./bandsintown";
import { compareBenchmark } from "./compare";
import { collectPredictHq } from "./predicthq";
import type { BenchmarkCollection, BenchmarkProviderId, BenchmarkSnapshot } from "./types";

const emptyMetrics = (happenings: Happening[]) => compareBenchmark([], happenings, 0, 0);

export async function runBenchmark(input: { provider: BenchmarkProviderId; cityId: CityId; happenings: Happening[]; previous?: BenchmarkSnapshot; now?: Date; predictHqApiKey?: string; bandsintownAppId?: string; bandsintownTermsApproved?: boolean; performers?: KnownPerformer[]; fetchImpl?: typeof fetch }): Promise<BenchmarkSnapshot> {
  const now = input.now ?? new Date();
  if (input.previous?.provider === input.provider && input.previous.cityId === input.cityId && now.getTime() - Date.parse(input.previous.generatedAt) < 24 * 60 * 60_000) {
    return { ...input.previous, retained: false, status: "cached", message: "Benchmark refresh interval has not elapsed; reused the prior benchmark without a provider request." };
  }
  const retain = (status: BenchmarkSnapshot["status"], message: string, termsStatus: BenchmarkSnapshot["termsStatus"]): BenchmarkSnapshot => input.previous?.records.length ? { ...input.previous, retained: true, status: "retained", message } : { provider: input.provider, cityId: input.cityId, generatedAt: now.toISOString(), retained: false, status, records: [], metrics: emptyMetrics(input.happenings), message, termsStatus, benchmarkOnly: true };
  if (input.provider === "songkick") return retain("disabled", "Songkick requires licensed access and is not implemented.", "licensed_access_required");
  if (input.provider === "bandsintown" && !input.bandsintownTermsApproved) return retain("disabled", "Bandsintown organizational API access has not been approved.", "approval_required");
  let collection: BenchmarkCollection;
  try {
    collection = input.provider === "predicthq"
      ? await collectPredictHq({ apiKey: input.predictHqApiKey, cityId: input.cityId, start: now.toISOString(), end: new Date(now.getTime() + 30 * 24 * 60 * 60_000).toISOString(), now, fetchImpl: input.fetchImpl })
      : await collectBandsintown({ appId: input.bandsintownAppId, termsApproved: true, performers: input.performers ?? [], cityId: input.cityId, now, fetchImpl: input.fetchImpl });
  } catch (error) {
    return retain("unavailable", error instanceof Error ? error.message : "Benchmark provider failed.", "approved");
  }
  if (!collection.records.length) return retain(collection.message ? "unavailable" : "invalid", collection.message ?? "Provider returned no valid benchmark records; preserved last-good results when available.", "approved");
  const metrics = compareBenchmark(collection.records, input.happenings, collection.rejected.length, collection.queryCount);
  return { provider: input.provider, cityId: input.cityId, generatedAt: now.toISOString(), retained: false, status: collection.records.length ? "fresh" : "invalid", records: collection.records, metrics, message: collection.message ?? (collection.rejected.length ? `${collection.rejected.length} record(s) rejected.` : undefined), termsStatus: "approved", benchmarkOnly: true };
}
