/**
 * @file review-policy.conformance.test.mjs — the CONFORMANCE SUITE for the review-escalation policy contract (#2566).
 *
 * WHAT THIS PROVES, AND WHY IT IS THE OTHER HALF OF THE CONTRACT.
 * `review-policy.contract.json` declares the policy as DATA (thresholds, reason families/clearance, the
 * disposition decision table). `review-policy.mjs` is its executable form. The DERIVATION CODE
 * (`review-escalation.mjs` scoreEscalation, `review-core.mjs` deriveReviewDisposition) is a SEPARATE, hand-written
 * realization of that same policy. This suite proves the code CONFORMS to the contract — over the full input
 * space, not one worked example — so that:
 *
 *   • a diff to the CONTRACT is a spec change (it lands on the trust-chain policy tier → review:human), and
 *   • an implementation change that keeps THIS suite green is agent-clearable: a behaviour-preserving refactor of
 *     the branches conforms; a change to what they DO diverges from the contract and turns this suite red, which
 *     forces the author to also edit the contract (→ human). That is the spec-based-programming gate (#2564,
 *     first instance #2563 Fork 1) made mechanical.
 *
 * SELF-REFERENCE (load-bearing). This file's basename is registered on the trust-chain policy tier
 * (`../gate-config.mjs`), so weakening a conformance assertion here is itself a human-gated spec change — you
 * cannot quietly relax the bridge to make an impl diff pass. Do not do that; if the contract is genuinely wrong,
 * change the CONTRACT (a deliberate, human-reviewed spec edit), not this suite.
 */
import { describe, it, expect } from 'vitest';
import {
  REVIEW_POLICY,
  POLICY_THRESHOLDS,
  POLICY_REASON_TOKENS,
  POLICY_CARE_JURY,
  POLICY_CARE_BAND_NAMES,
  derivePolicyDisposition,
} from '../review-policy.mjs';
import { DEFAULT_THRESHOLDS, CARE_LEVELS, CARE_LEVEL_ORDER } from '../review-escalation.mjs';
import { REVIEW_REASONS, deriveReviewDisposition, REVIEW_DISPOSITIONS } from '../review-core.mjs';
import { panelRigorForCareLevel, PANEL_LENSES } from '../jury-core.mjs';

/** Every non-empty subset of `items` (the powerset minus the empty set), as arrays — deterministic, no random. */
function nonEmptyPowerset(items) {
  const all = items.reduce((sets, item) => sets.concat(sets.map((s) => [...s, item])), [[]]);
  return all.filter((s) => s.length > 0);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// STATIC CONFORMANCE — the contract loads, is well-formed, and its vocabulary matches the impl's token enum.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('static conformance — contract shape + vocabulary', () => {
  it('the contract loaded and is frozen (a validated, immutable spec)', () => {
    expect(Object.isFrozen(REVIEW_POLICY)).toBe(true);
    expect(REVIEW_POLICY.contract).toBe('review-escalation-policy');
  });

  it('every contract reason carries prose (schema skeleton + first-class prose layer, #2564)', () => {
    for (const r of REVIEW_POLICY.reasons) {
      expect(typeof r.description).toBe('string');
      expect(r.description.trim().length).toBeGreaterThan(0);
    }
    expect(REVIEW_POLICY.disposition.description.trim().length).toBeGreaterThan(0);
  });

  it('the contract token vocabulary EXACTLY matches REVIEW_REASONS (no drift between data and code enum)', () => {
    const contractTokens = [...POLICY_REASON_TOKENS].sort();
    const codeTokens = Object.values(REVIEW_REASONS).sort();
    expect(contractTokens).toEqual(codeTokens);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// THRESHOLD CONFORMANCE — the impl's thresholds ARE the contract's values (single source of truth). A flip in
// the contract necessarily moves DEFAULT_THRESHOLDS; nothing else can.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('threshold conformance — DEFAULT_THRESHOLDS is sourced from the contract', () => {
  it('DEFAULT_THRESHOLDS deep-equals the contract threshold values', () => {
    expect(DEFAULT_THRESHOLDS).toEqual({
      diffLines: REVIEW_POLICY.thresholds.diffLines.value,
    });
    expect(POLICY_THRESHOLDS).toEqual(DEFAULT_THRESHOLDS);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// DISPOSITION CONFORMANCE — the CORE bridge. Over the ENTIRE powerset of reason tokens, the hand-written
// imperative branches of deriveReviewDisposition produce EXACTLY the outcome the contract's executable table
// (derivePolicyDisposition) computes. Any divergence — a mis-ordered branch, a wrong autoLand, a dropped
// precedence rule — fails here, on the specific reason set that exposes it.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('disposition conformance — deriveReviewDisposition realizes the contract table over the full input space', () => {
  const tokens = [...POLICY_REASON_TOKENS];

  it('every single reason token: impl outcome === contract-oracle outcome', () => {
    for (const token of tokens) {
      expect(deriveReviewDisposition({ reason: token })).toEqual(derivePolicyDisposition({ reason: token }));
    }
  });

  it('every non-empty COMBINATION of reasons (strictest-wins): impl === contract-oracle', () => {
    for (const subset of nonEmptyPowerset(tokens)) {
      expect(deriveReviewDisposition({ reasons: subset })).toEqual(derivePolicyDisposition({ reasons: subset }));
    }
  });

  it('the contract-oracle itself is exhaustive — no reason set falls through the precedence table', () => {
    for (const subset of nonEmptyPowerset(tokens)) {
      const d = derivePolicyDisposition({ reasons: subset });
      expect(['converge', 'human']).toContain(d.mode);
      expect(typeof d.autoLand).toBe('boolean');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// DECORATED-STRING CONFORMANCE — the drain carries DECORATED reason strings (from scoreEscalation), not bare
// tokens; the impl canonicalizes them before deriving. This proves canonicalization + derivation together still
// land on the contract's outcome for each reason's real decorated form.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('decorated-string conformance — the drain\'s real reason strings derive the contract outcome', () => {
  // One representative decorated string per token, in the exact shape scoreEscalation emits.
  const DECORATED = {
    [REVIEW_REASONS.GATE_SELF]: 'gate-self (scripts/lib/review-escalation.mjs) — human review required',
    [REVIEW_REASONS.STATUTE]: 'statute (docs/agent/platform-decisions.md) — human review required',
    [REVIEW_REASONS.BLAST_RADIUS]: 'blast-radius (scripts/foo.mjs, scripts/bar.mjs)',
    [REVIEW_REASONS.SIZE]: 'size (1080 ≥ 400 changed lines)',
    [REVIEW_REASONS.DISMISSED_FINDINGS]: 'dismissed-findings (2 pre-PR review finding(s) the lane dismissed)',
    [REVIEW_REASONS.CROSS_REPO]: 'cross-repo impl+WE couple',
    [REVIEW_REASONS.NON_CONVERGENCE]: 'non-convergence',
    [REVIEW_REASONS.MANDATE_CONFLICT]: 'mandate-conflict',
  };

  it('covers every token (the decorated map does not silently miss a reason)', () => {
    expect(Object.keys(DECORATED).sort()).toEqual([...POLICY_REASON_TOKENS].sort());
  });

  it('each decorated reason derives the SAME disposition as its bare contract token', () => {
    for (const [token, decorated] of Object.entries(DECORATED)) {
      expect(deriveReviewDisposition({ reason: decorated })).toEqual(derivePolicyDisposition({ reason: token }));
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// The contract's disposition outcomes match the ratified policy tokens (a guard that the CONTRACT itself still
// encodes the #2445 two-tier flip: deadlock ⇒ human, gate-self/statute ⇒ converge-no-autoland, else auto-land).
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// CARE→JURY CONFORMANCE (#2633) — the care→jury table is the DATA form of the bands hardcoded today in
// jury-core.mjs panelRigorForCareLevel. This is the same "contract single-sources the impl" bridge the
// threshold block enforces: the contract declares the bands, and the impl must realize EXACTLY them. A re-tune
// of the contract that jury-core does not (yet) mirror fails here, on the band that diverged — so "the policy
// changed" stays a deterministic diff to the contract, and the two can never silently drift apart.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('care→jury conformance — the contract table single-sources jury-core panelRigorForCareLevel bands', () => {
  it('the care→jury table loaded, is frozen, and carries prose (schema skeleton + prose layer, #2564)', () => {
    expect(Object.isFrozen(POLICY_CARE_JURY)).toBe(true);
    expect(POLICY_CARE_JURY.description.trim().length).toBeGreaterThan(0);
    expect(POLICY_CARE_JURY.rosterTimingMode.description.trim().length).toBeGreaterThan(0);
    for (const name of POLICY_CARE_BAND_NAMES) {
      expect(POLICY_CARE_JURY.bands[name].description.trim().length).toBeGreaterThan(0);
    }
  });

  it('the contract band names EXACTLY match the CARE_LEVELS enum, in least→most order (no vocabulary drift)', () => {
    expect(POLICY_CARE_BAND_NAMES).toEqual([...CARE_LEVEL_ORDER]);
    expect([...POLICY_CARE_BAND_NAMES].sort()).toEqual(Object.values(CARE_LEVELS).sort());
    expect(Object.keys(POLICY_CARE_JURY.bands).sort()).toEqual(Object.values(CARE_LEVELS).sort());
  });

  it('the roster-timing mode (knob #4) is a valid, single value', () => {
    expect(['up-front', 'incremental']).toContain(POLICY_CARE_JURY.rosterTimingMode.value);
  });

  it('every band lens is drawn from the real PANEL_LENSES set (no lens the panel cannot fan out)', () => {
    for (const name of POLICY_CARE_BAND_NAMES) {
      for (const lens of POLICY_CARE_JURY.bands[name].lenses) {
        expect(PANEL_LENSES).toContain(lens);
      }
    }
  });

  it('each band conforms to panelRigorForCareLevel: lenses, jurorsPerLens, and roundCap===rounds match the impl', () => {
    for (const name of POLICY_CARE_BAND_NAMES) {
      const band = POLICY_CARE_JURY.bands[name];
      const rigor = panelRigorForCareLevel(name);
      expect(band.lenses).toEqual(rigor.lenses);
      expect(band.jurorsPerLens).toBe(rigor.jurorsPerLens);
      expect(band.roundCap).toBe(rigor.rounds);
    }
  });
});

describe('the contract encodes the ratified two-tier flip (#2445)', () => {
  it('deadlock reasons ⇒ human, never auto-land', () => {
    for (const token of REVIEW_POLICY.reasons.filter((r) => r.family === 'deadlock').map((r) => r.token)) {
      expect(derivePolicyDisposition({ reason: token })).toEqual({ mode: REVIEW_DISPOSITIONS.HUMAN, autoLand: false });
    }
  });
  it('human-clearance sensitivity reasons (gate-self/statute) ⇒ converge, never auto-land', () => {
    for (const token of REVIEW_POLICY.reasons.filter((r) => r.family === 'sensitivity' && r.clearance === 'human').map((r) => r.token)) {
      expect(derivePolicyDisposition({ reason: token })).toEqual({ mode: REVIEW_DISPOSITIONS.CONVERGE, autoLand: false });
    }
  });
  it('agent-clearance sensitivity reasons ⇒ converge, auto-land', () => {
    for (const token of REVIEW_POLICY.reasons.filter((r) => r.family === 'sensitivity' && r.clearance === 'agent').map((r) => r.token)) {
      expect(derivePolicyDisposition({ reason: token })).toEqual({ mode: REVIEW_DISPOSITIONS.CONVERGE, autoLand: true });
    }
  });
});
