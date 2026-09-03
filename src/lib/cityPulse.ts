import type { CityId } from "../domain/types";
import { isCityPulsePayload, type CityPulsePayload } from "../domain/cityPulse";

export * from "../domain/cityPulse";

export async function loadCityPulse(cityId: CityId, signal?: AbortSignal): Promise<CityPulsePayload> {
  const response = await fetch(`/api/pulse/${cityId}`, { signal });
  const payload = await response.json() as unknown;
  if (!response.ok || !isCityPulsePayload(payload, cityId)) throw new Error(`Social pulse returned HTTP ${response.status}`);
  return payload;
}
