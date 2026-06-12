import { describe, expect, it } from "vitest";
import {
  DEFAULT_WAKE_STORM_MAX_RECOVERY_RUNS,
  DEFAULT_WAKE_STORM_WINDOW_MINUTES,
  buildWakeStormEscalationComment,
  readWakeStormBreakerConfig,
  shouldTripWakeStormBreaker,
} from "../services/recovery/wakeup-storm-breaker.ts";

describe("readWakeStormBreakerConfig", () => {
  it("returns defaults when env is empty", () => {
    expect(readWakeStormBreakerConfig({})).toEqual({
      windowMinutes: DEFAULT_WAKE_STORM_WINDOW_MINUTES,
      maxRecoveryRuns: DEFAULT_WAKE_STORM_MAX_RECOVERY_RUNS,
    });
  });

  it("honors env overrides", () => {
    expect(
      readWakeStormBreakerConfig({
        PAPERCLIP_WAKE_STORM_WINDOW_MINUTES: "10",
        PAPERCLIP_WAKE_STORM_MAX_RECOVERY_RUNS: "5",
      }),
    ).toEqual({ windowMinutes: 10, maxRecoveryRuns: 5 });
  });

  it("falls back to defaults on malformed or non-positive values", () => {
    expect(
      readWakeStormBreakerConfig({
        PAPERCLIP_WAKE_STORM_WINDOW_MINUTES: "zero",
        PAPERCLIP_WAKE_STORM_MAX_RECOVERY_RUNS: "-3",
      }),
    ).toEqual({
      windowMinutes: DEFAULT_WAKE_STORM_WINDOW_MINUTES,
      maxRecoveryRuns: DEFAULT_WAKE_STORM_MAX_RECOVERY_RUNS,
    });
  });
});

describe("shouldTripWakeStormBreaker", () => {
  const config = { windowMinutes: 30, maxRecoveryRuns: 20 };

  it("does not trip below the threshold", () => {
    expect(shouldTripWakeStormBreaker({ recentRecoveryRunCount: 19, config })).toBe(false);
  });

  it("trips at and above the threshold", () => {
    expect(shouldTripWakeStormBreaker({ recentRecoveryRunCount: 20, config })).toBe(true);
    expect(shouldTripWakeStormBreaker({ recentRecoveryRunCount: 268, config })).toBe(true);
  });
});

describe("buildWakeStormEscalationComment", () => {
  it("names the counts, the window, and the resume path", () => {
    const comment = buildWakeStormEscalationComment({
      recentRecoveryRunCount: 23,
      config: { windowMinutes: 30, maxRecoveryRuns: 20 },
    });
    expect(comment).toContain("23");
    expect(comment).toContain("30 min");
    expect(comment).toContain("threshold: 20");
    expect(comment).toContain("blocked");
    expect(comment).toContain("SIM-2814");
  });
});
