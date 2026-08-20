// Simmer local patch (SIM-2814): frequency-based circuit breaker for
// wakeup/retry storms.
//
// The liveness judge's plan-only breaker is content-classified: a run that
// "produced useful output" is exempt and never enters the bounded
// continuation path. On 2026-05-29 a research-handoff mirror-loop exploited
// exactly that — 268 system-recovery wakes on one issue in ~2h, 265 of them
// classified "Planning/document task produced useful output and is exempt
// from plan-only classification". Each wake passed as productive, so nothing
// capped the spend (~$150-200 of Opus) while the loop ran.
//
// This breaker is deliberately independent of content classification: it
// counts system-recovery runs (any run whose context snapshot carries a
// retryReason) for the same issue inside a trailing window. Past the
// threshold, recovery enqueues are refused and the issue is escalated to
// blocked. Genuine work cannot trip it — only automation-recovery wakes
// carry retryReason.

export interface WakeStormBreakerConfig {
  windowMinutes: number;
  maxRecoveryRuns: number;
}

export const DEFAULT_WAKE_STORM_WINDOW_MINUTES = 30;
export const DEFAULT_WAKE_STORM_MAX_RECOVERY_RUNS = 20;

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readWakeStormBreakerConfig(
  env: Record<string, string | undefined> = process.env,
): WakeStormBreakerConfig {
  return {
    windowMinutes: readPositiveInt(
      env.PAPERCLIP_WAKE_STORM_WINDOW_MINUTES,
      DEFAULT_WAKE_STORM_WINDOW_MINUTES,
    ),
    maxRecoveryRuns: readPositiveInt(
      env.PAPERCLIP_WAKE_STORM_MAX_RECOVERY_RUNS,
      DEFAULT_WAKE_STORM_MAX_RECOVERY_RUNS,
    ),
  };
}

export function shouldTripWakeStormBreaker(input: {
  recentRecoveryRunCount: number;
  config: WakeStormBreakerConfig;
}) {
  return input.recentRecoveryRunCount >= input.config.maxRecoveryRuns;
}

export function buildWakeStormEscalationComment(input: {
  recentRecoveryRunCount: number;
  config: WakeStormBreakerConfig;
}) {
  return [
    "Paperclip's wakeup-storm circuit breaker tripped for this issue.",
    "",
    `- System-recovery runs in the last ${input.config.windowMinutes} min: ${input.recentRecoveryRunCount} (threshold: ${input.config.maxRecoveryRuns})`,
    "- Automatic recovery wakes for this issue are suspended and the issue is moved to `blocked`.",
    "- This usually means a mirror-loop or retry cascade: each wake completes \"successfully\" without real progress, so content-based liveness classification keeps approving continuations.",
    "- Next action: a human or manager should inspect the recent run history, resolve the underlying loop (often a status mirror between two issues), then move the issue back to `todo`/`in_progress` to resume.",
    "",
    "Breaker config: `PAPERCLIP_WAKE_STORM_WINDOW_MINUTES` / `PAPERCLIP_WAKE_STORM_MAX_RECOVERY_RUNS` (SIM-2814).",
  ].join("\n");
}
