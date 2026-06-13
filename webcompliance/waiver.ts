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
import type { GateResult, GateViolation, PolicyRule } from './gate';

/** A tracked, expiring, audited override of one policy rule's violation. */
export interface Waiver {
  /** The {@link PolicyRule.id} this waives. */
  readonly ruleId: string;
  /** Who granted the waiver — the accountable party. */
  readonly who: string;
  /** Why it was granted — the justification on record. */
  readonly why: string;
  /** Expiry — an ISO date (`YYYY-MM-DD` or full timestamp). On/after `now` the waiver is inert. */
  readonly until: string;
  /** Optional scope note, carried for the audit record (mirrors {@link PolicyRule.scope}). */
  readonly scope?: string;
}

/** A violation suppressed by an active waiver — kept for the audit trail, not counted as failing. */
export interface WaivedViolation extends GateViolation {
  readonly waiver: Waiver;
}

/** The gate verdict after waivers are applied. */
export interface WaiveredGateResult {
  /** True iff no *unwaived* `block`-severity rule was violated (CI may proceed). */
  readonly passed: boolean;
  /** True iff an *unwaived* `block`-severity rule was violated (CI must fail). */
  readonly blocked: boolean;
  /** Violations that remain after waivers (an active waiver removed the rest). */
  readonly violations: readonly GateViolation[];
  /** Violations suppressed by an active waiver — the audit trail (who/why/until). */
  readonly waived: readonly WaivedViolation[];
  /** Waivers that were present but expired (`until <= now`) — surfaced for renewal/removal, never silent. */
  readonly expiredWaivers: readonly Waiver[];
  /** The resolved rules that were evaluated (unchanged from the input result). */
  readonly evaluated: readonly PolicyRule[];
}

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
