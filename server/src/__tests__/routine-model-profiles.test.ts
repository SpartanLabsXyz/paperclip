import { describe, expect, it } from "vitest";
import {
  parseRoutineModelProfileMap,
  resolveRoutineAssigneeAdapterOverrides,
} from "../services/routine-model-profiles.ts";

const ROUTINE_A = "2f0c0d8e-1111-4222-8333-444455556666";
const ROUTINE_B = "9a1b2c3d-7777-4888-9999-000011112222";

describe("parseRoutineModelProfileMap", () => {
  it("returns an empty map for unset/empty input", () => {
    expect(parseRoutineModelProfileMap(undefined).size).toBe(0);
    expect(parseRoutineModelProfileMap("").size).toBe(0);
  });

  it("parses comma-separated routineId=profile entries with whitespace", () => {
    const map = parseRoutineModelProfileMap(` ${ROUTINE_A}=cheap , ${ROUTINE_B}=cheap `);
    expect(map.get(ROUTINE_A)).toBe("cheap");
    expect(map.get(ROUTINE_B)).toBe("cheap");
  });

  it("skips malformed entries and unknown profile keys", () => {
    const map = parseRoutineModelProfileMap(
      `${ROUTINE_A}=cheap,garbage,=cheap,${ROUTINE_B}=ultra-premium`,
    );
    expect(map.size).toBe(1);
    expect(map.get(ROUTINE_A)).toBe("cheap");
    expect(map.has(ROUTINE_B)).toBe(false);
  });
});

describe("resolveRoutineAssigneeAdapterOverrides", () => {
  const env = { PAPERCLIP_ROUTINE_MODEL_PROFILES: `${ROUTINE_A}=cheap` };

  it("returns the override object for mapped routines", () => {
    expect(resolveRoutineAssigneeAdapterOverrides(ROUTINE_A, env)).toEqual({
      modelProfile: "cheap",
    });
  });

  it("returns undefined for unmapped routines (agent default model)", () => {
    expect(resolveRoutineAssigneeAdapterOverrides(ROUTINE_B, env)).toBeUndefined();
    expect(resolveRoutineAssigneeAdapterOverrides(ROUTINE_A, {})).toBeUndefined();
  });
});
