// Simmer local patch (SIM-2814 / SIM-2496): per-routine model-profile
// passthrough.
//
// Agents define modelProfiles in runtimeConfig (adapter-native, e.g.
// `cheap` -> Sonnet adapterConfig) and issue dispatch honors
// `issues.assigneeAdapterOverrides.modelProfile` (see
// resolveModelProfileApplication in heartbeat.ts). But routines had no way to
// request a profile for their execution issues, so every routine run dispatched
// on the agent's default (Opus) model.
//
// Rather than widening the routine schema/API (migration + zod + UI churn on a
// fork carrying rebase debt), the mapping lives in one env var:
//
//   PAPERCLIP_ROUTINE_MODEL_PROFILES="<routineId>=<profileKey>,<routineId>=<profileKey>"
//
// Example (Trinity volume routines -> cheap/Sonnet lane for the June-15
// Agent SDK credit cliff):
//
//   PAPERCLIP_ROUTINE_MODEL_PROFILES="2f0c...=cheap,9a1b...=cheap"
//
// Unknown profile keys are ignored with a warning. Routines absent from the
// map keep the agent's default model. Drop the env var to revert everything.

import { MODEL_PROFILE_KEYS, type ModelProfileKey } from "@paperclipai/shared";
import { logger } from "../middleware/logger.js";

const ROUTINE_MODEL_PROFILES_ENV = "PAPERCLIP_ROUTINE_MODEL_PROFILES";

export function parseRoutineModelProfileMap(
  raw: string | undefined,
): Map<string, ModelProfileKey> {
  const map = new Map<string, ModelProfileKey>();
  if (!raw) return map;
  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) {
      logger.warn({ entry: trimmed }, `${ROUTINE_MODEL_PROFILES_ENV}: skipping malformed entry`);
      continue;
    }
    const routineId = trimmed.slice(0, separator).trim();
    const profileKey = trimmed.slice(separator + 1).trim();
    if (!MODEL_PROFILE_KEYS.includes(profileKey as ModelProfileKey)) {
      logger.warn(
        { routineId, profileKey, known: MODEL_PROFILE_KEYS },
        `${ROUTINE_MODEL_PROFILES_ENV}: skipping unknown model profile key`,
      );
      continue;
    }
    map.set(routineId, profileKey as ModelProfileKey);
  }
  return map;
}

export function resolveRoutineAssigneeAdapterOverrides(
  routineId: string,
  env: Record<string, string | undefined> = process.env,
): Record<string, unknown> | undefined {
  const profile = parseRoutineModelProfileMap(env[ROUTINE_MODEL_PROFILES_ENV]).get(routineId);
  return profile ? { modelProfile: profile } : undefined;
}
