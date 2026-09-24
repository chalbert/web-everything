import { isStatuteTierPath, DEFAULT_BACKDOWN_THRESHOLDS } from './provider-routing.mjs';

/** PLACEHOLDER values to calibrate from scorecard data later. Medium equals the
 * router's DEFAULT_BACKDOWN_THRESHOLDS today. Independent PR review still gates
 * EVERY PR landing, so in-story supervision may be cheaper than the PR-level gate.
 * High applies to SUPERVISOR eligibility; high-risk TASKS never reach spot-check.
 */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export const GRADUATION_THRESHOLDS_BY_RISK = Object.freeze({
  low: Object.freeze({ minCleanStreak: 2, requireInformativeTrial: false }),
  medium: Object.freeze({ ...DEFAULT_BACKDOWN_THRESHOLDS }),
  high: Object.freeze({ minCleanStreak: 8, requireInformativeTrial: true }),
});
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function thresholdsForRisk(risk) {
  return Object.freeze({ ...GRADUATION_THRESHOLDS_BY_RISK[typeof risk === 'string' && Object.hasOwn(GRADUATION_THRESHOLDS_BY_RISK, risk) ? risk : 'high'] });
}
/** Spot-check is AFTER-THE-FACT: work proceeds without blocking validation; a
 * deterministic sampler selects independent validation later. A sampled failure
 * is a calibration miss, becoming an unclean ground-truth trial that fires the
 * existing router veto and resets the streak. Samples become trials ONLY through
 * ground truth and graduation gates. Placeholder rates; low samples more early.
 */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export const SPOT_CHECK_SAMPLE_RATE_BY_RISK = Object.freeze({ low: 500, medium: 250, high: 1000 });
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function spotCheckSample(taskKey, risk) {
  const closed = { sampled: true, bucket: null, ratePermille: 1000 };
  try {
    if (!taskKey || typeof taskKey.storyRef !== 'string' || !/^[A-Za-z0-9._#]+$/.test(taskKey.storyRef)
      || !Number.isSafeInteger(taskKey.round) || taskKey.round < 1 || typeof taskKey.taskId !== 'string'
      || !/^[A-Za-z0-9._-]+$/.test(taskKey.taskId) || typeof risk !== 'string' || !Object.hasOwn(SPOT_CHECK_SAMPLE_RATE_BY_RISK, risk)) return closed;
    const text = `${taskKey.storyRef}\n${taskKey.round}\n${taskKey.taskId}`;
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
    const bucket = hash % 1000, ratePermille = SPOT_CHECK_SAMPLE_RATE_BY_RISK[risk];
    return { sampled: bucket < ratePermille, bucket, ratePermille };
  } catch { return closed; }
}
/** Placeholder groups to be curated; prefix matching is deliberately string-level. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export const NEVER_SPOT_CHECK_PATH_PREFIXES = Object.freeze({
  statute: Object.freeze(['docs/agent/', 'AGENTS.md', 'CLAUDE.md']),
  gateSelf: Object.freeze(['scripts/check-standards', 'scripts/guard-', 'scripts/verify-lane', 'scripts/lib/provider-routing', 'scripts/lib/model-capability-ratings', 'scripts/lib/dispatch-', 'scripts/conveyor/run-scorecard', 'scripts/lib/poc-branches.json', '.claude/']),
  irreversible: Object.freeze(['.github/workflows/', 'scripts/pr-land', 'scripts/merge-ai-prs', 'scripts/operations/poc-land', 'scripts/operations/dispatch-lane', 'scripts/lane-pool']),
});
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function isNeverSpotCheckPath(path) {
  return typeof path !== 'string' || !path.trim() || isStatuteTierPath(path)
    || Object.values(NEVER_SPOT_CHECK_PATH_PREFIXES).some(group => group.some(prefix => path.startsWith(prefix)));
}
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function neverSpotCheck(profile) {
  try {
    return !profile || typeof profile !== 'object' || Array.isArray(profile) || !['low', 'medium', 'high'].includes(profile.risk) || !Array.isArray(profile.filesTouched)
      || !profile.filesTouched.length || profile.risk === 'high' || Array.from(profile.filesTouched).some(path =>
        typeof path !== 'string' || !path.trim() || path.startsWith('/') || path.startsWith('./')
        || path.includes('\\') || path.includes('\0') || path.split('/').includes('..') || /^[a-z][a-z0-9+.-]*:/i.test(path) || isNeverSpotCheckPath(path));
  } catch { return true; }
}
