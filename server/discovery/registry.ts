import type { MunicipalSourceDefinition } from "./types";

export const MUNICIPAL_SOURCE_REGISTRY: readonly MunicipalSourceDefinition[] = [
  {
    id: "datasf-special-event-closures",
    cityId: "san-francisco",
    publisher: "SFMTA / DataSF",
    canonicalUrl: "https://data.sfgov.org/Transportation/Current-and-Upcoming-Events-based-on-Temporary-Str/v9cz-kk5i",
    fetchUrl: "https://data.sfgov.org/resource/v9cz-kk5i.json",
    refreshCadenceMinutes: 24 * 60,
    enabled: true,
    status: "approved",
  },
  {
    id: "permitsf-special-event-intake",
    cityId: "san-francisco",
    publisher: "PermitSF / DataSF",
    canonicalUrl: "https://data.sfgov.org/Housing-and-Buildings/PermitSF-Permitting-Data/tyz3-vt28",
    fetchUrl: "https://data.sfgov.org/resource/tyz3-vt28.json",
    refreshCadenceMinutes: 6 * 60,
    enabled: true,
    status: "approved",
  },
  {
    id: "stockholm-land-permit-events",
    cityId: "stockholm",
    publisher: "Stockholms stad Trafikkontoret",
    canonicalUrl: "https://openstreetgs.stockholm.se/Home/Visualisering/Mark",
    refreshCadenceMinutes: 24 * 60,
    enabled: false,
    status: "credential_required",
    reason: "The official OGC/WFS service requires an issued API key, and the public preview does not expose a verified event collection contract with enough identity and date fields for unattended discovery. Keep disabled until the collection and permitted fields are confirmed.",
  },
] satisfies readonly MunicipalSourceDefinition[];
