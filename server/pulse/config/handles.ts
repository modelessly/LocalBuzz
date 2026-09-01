export const SF_HANDLE_GROUPS = {
  venues: ["SFJAZZ", "TheFillmoreSF", "publicworkssf", "indysf", "TheMidwaySF"],
  promoters: ["noisepop", "apeconcerts"],
  culture: ["SFMOMA", "exploratorium", "deyoungmuseum", "asianartmuseum"],
  food: ["OfftheGridSF", "FerryBldg"],
  neighborhood: ["SFist", "sfgate"],
  "city-agencies": ["sfgov", "RecParkSF", "SFPort", "SFMTA_Muni"],
} as const;

export type SfHandleGroup = keyof typeof SF_HANDLE_GROUPS;
export const DEFAULT_SF_HANDLE_GROUPS: SfHandleGroup[] = ["venues", "promoters", "culture", "food"];

export function isHandleGroup(value: string): value is SfHandleGroup {
  return Object.hasOwn(SF_HANDLE_GROUPS, value);
}

export function resolveSfHandles(groups: readonly SfHandleGroup[]): string[] {
  const handles = [...new Set(groups.flatMap((group) => SF_HANDLE_GROUPS[group]))];
  if (handles.length > 20) {
    throw new Error(`Curated X Search accepts at most 20 handles; selection resolved to ${handles.length}.`);
  }
  return handles;
}
