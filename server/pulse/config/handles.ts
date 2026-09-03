export {
  PULSE_HANDLE_GROUPS,
  isPulseHandleGroup as isHandleGroup,
  resolveTrustedHandles,
  type PulseHandleGroup as SfHandleGroup,
} from "./cities";

export const DEFAULT_SF_HANDLE_GROUPS = ["venues", "culture", "nightlife", "food"] as const;
