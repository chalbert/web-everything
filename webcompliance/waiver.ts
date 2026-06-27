/**
 * @file webcompliance/waiver.ts
 * @description Waiver / exception machinery — backlog #438 (phase 3 of #351), built on the #437 gate.
 *   A gate that can only block is brittle: a known, accepted violation forces either a red CI or deleting
 *   the rule. A {@link Waiver} is the governable middle — a tracked, **expiring**, **audited** override that
 *   suppresses one rule's violation (so a `block` no longer fails CI) **without** weakening the policy, and
 *   that lapses on its own so an exception can't quietly become permanent.
 *
 *   A waiver records **who** granted it, **why**, and **until** when — the accountability trail. It applies
 *   to a {@link GateViolation} when its `ruleId` matches the violated rule AND it is still active (`until >=
 *   now`). {@link applyWaivers} takes a raw {@link GateResult}, moves each waived violation onto a separate
 *   `waived[]` audit list (still recorded, just not failing), recomputes `blocked`, and surfaces any
 *   `expiredWaivers[]` so a lapsed exception is renewed or removed rather than silently ignored.
 *
 * Pure + dependency-free like {@link ./gate}: `now` is passed in (no clock read), so it's deterministic and
 * testable. The result is *data* — a runner maps `blocked` to an exit code; a report / audit trail logs the
 * `waived[]` and `expiredWaivers[]` as evidence.
 */
import type { GateResult, GateViolation, Waiver, WaivedViolation, WaiveredGateResult } from './contract';

// The waiver types ({@link Waiver}/{@link WaivedViolation}/{@link WaiveredGateResult}) are the pure-contract
// half — they live in `./contract.ts` (the `@webeverything/contracts/webcompliance` entry, #1294 C1).
// Re-exported here so importers reach the types + the runtime from one site (mirrors `webpolicy/proof.ts`).
export type * from './contract';

/** Is the waiver still active at `now`? Active ⇒ `now` is strictly before `until` (expires *on* the date). */
export function isActive(waiver: Waiver, now: string): boolean {
  return new Date(now).getTime() < new Date(waiver.until).getTime();
}

/**
 * Apply waivers to a {@link GateResult}. Each violation whose `rule.id` has an **active** waiver moves to
 * `waived[]` (recorded, not failing); the rest stay in `violations[]`. `blocked` is recomputed over the
 * remaining violations, so an active waiver on a `block` rule lets CI pass — while the override stays
 * auditable and expires by `until`. Expired waivers do **not** suppress anything and are returned in
 * `expiredWaivers[]` so a lapsed exception is visible. When two waivers target the same rule, the first
 * **active** one in `waivers` order is the one recorded.
 */
export function applyWaivers(
  result: GateResult,
  waivers: readonly Waiver[],
  now: string,
): WaiveredGateResult {
  const activeByRule = new Map<string, Waiver>();
  const expiredWaivers: Waiver[] = [];
  for (const w of waivers) {
    if (isActive(w, now)) {
      if (!activeByRule.has(w.ruleId)) activeByRule.set(w.ruleId, w);
    } else {
      expiredWaivers.push(w);
    }
  }

  const violations: GateViolation[] = [];
  const waived: WaivedViolation[] = [];
  for (const v of result.violations) {
    const waiver = activeByRule.get(v.rule.id);
    if (waiver) waived.push({ ...v, waiver });
    else violations.push(v);
  }

  const blocked = violations.some((v) => v.rule.severity === 'block');
  return { passed: !blocked, blocked, violations, waived, expiredWaivers, evaluated: result.evaluated };
}
