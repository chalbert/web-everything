/**
 * @file scripts/__tests__/lane-verify.test.mjs
 * @description Unit proof of the #2833 verification finish-guard core (`scripts/lib/lane-verify.mjs`). The
 *   observed stall: a build subagent backgrounded its suite run, then yielded/terminated mid-run — the lane sat
 *   half-verified but LOOKED complete, so nothing reclaimed it. The gate here makes an unfinished verification
 *   NOT look complete: a HEAD with no recorded green result (or a stranded `running` marker) is REFUSED; a HEAD
 *   whose synchronous run finished green PASSES. The suite runner + marker IO are the impure boundary
 *   (`scripts/verify-lane.mjs`) and pr-land's finish-guard calls `verifyGateDecision` here.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  VERIFY_FILENAME,
  DEFAULT_VERIFY_TTL_MINUTES,
  verifyStartBody,
  verifyFinishBody,
  isVerifyAbandoned,
  verifyGateDecision,
  normalizeVerifyRecord,
  resolveVerifyOptions,
} from '../lib/lane-verify.mjs';

const SHA = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);
const T0 = Date.parse('2026-08-02T00:00:00.000Z');
const min = (n) => n * 60_000;

describe('marker lifecycle bodies (running → green/red)', () => {
  it('verifyStartBody stamps a running marker keyed to the sha, finish fields null', () => {
    const r = verifyStartBody({ sha: SHA, suites: 'npm run test:unit', startedAt: '2026-08-02T00:00:00.000Z' });
    expect(r).toMatchObject({ sha: SHA, status: 'running', startedAt: '2026-08-02T00:00:00.000Z', finishedAt: null, suites: 'npm run test:unit', exitCode: null });
  });
  it('verifyFinishBody(exit 0) → green, preserving sha/startedAt/suites', () => {
    const start = verifyStartBody({ sha: SHA, suites: 'gate', startedAt: '2026-08-02T00:00:00.000Z' });
    const done = verifyFinishBody(start, { finishedAt: '2026-08-02T00:05:00.000Z', exitCode: 0 });
    expect(done).toMatchObject({ sha: SHA, status: 'green', startedAt: '2026-08-02T00:00:00.000Z', finishedAt: '2026-08-02T00:05:00.000Z', suites: 'gate', exitCode: 0 });
  });
  it('verifyFinishBody(non-zero) → red, recording the exit code', () => {
    const done = verifyFinishBody(verifyStartBody({ sha: SHA, suites: 'gate', startedAt: 't' }), { finishedAt: 'u', exitCode: 2 });
    expect(done.status).toBe('red');
    expect(done.exitCode).toBe(2);
  });
});

describe('isVerifyAbandoned — a running marker that outlived its TTL is abandoned', () => {
  const running = verifyStartBody({ sha: SHA, suites: 'gate', startedAt: new Date(T0).toISOString() });
  it('a fresh running marker is NOT (yet) abandoned', () => {
    expect(isVerifyAbandoned(running, T0 + min(5))).toBe(false);
  });
  it('a running marker past the TTL IS abandoned', () => {
    expect(isVerifyAbandoned(running, T0 + min(DEFAULT_VERIFY_TTL_MINUTES + 1))).toBe(true);
  });
  it('a green/red marker never abandons by time (sha-identity is its freshness, not the clock)', () => {
    const green = verifyFinishBody(running, { finishedAt: new Date(T0).toISOString(), exitCode: 0 });
    expect(isVerifyAbandoned(green, T0 + min(9999))).toBe(false);
  });
  it('a malformed / dateless running marker reads as abandoned (fail toward "not fresh")', () => {
    expect(isVerifyAbandoned({ status: 'running', startedAt: 'not-a-date' }, T0)).toBe(true);
    expect(isVerifyAbandoned(null, T0)).toBe(true);
  });
});

describe('verifyGateDecision — the finish-guard the delivery path applies (#2833)', () => {
  const green = verifyFinishBody(verifyStartBody({ sha: SHA, suites: 'gate', startedAt: new Date(T0).toISOString() }), { finishedAt: new Date(T0).toISOString(), exitCode: 0 });
  const running = verifyStartBody({ sha: SHA, suites: 'gate', startedAt: new Date(T0).toISOString() });
  const red = verifyFinishBody(running, { finishedAt: new Date(T0).toISOString(), exitCode: 2 });

  it('a completed green run for THIS head → ok (delivery proceeds)', () => {
    const v = verifyGateDecision({ record: green, headSha: SHA, nowMs: T0 + min(10) });
    expect(v.ok).toBe(true);
    expect(v.reason).toBe('verified');
  });

  it('THE STALL: a running (unfinished) marker for THIS head → REFUSED, even without --require-verified', () => {
    const v = verifyGateDecision({ record: running, headSha: SHA, nowMs: T0 + min(1), requireVerified: false });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('verify-unfinished');
    expect(v.detail).toMatch(/in-flight/);
  });

  it('an ABANDONED running marker (past TTL) under --require-verified → still refused (fail-closed), says abandoned', () => {
    const v = verifyGateDecision({ record: running, headSha: SHA, nowMs: T0 + min(DEFAULT_VERIFY_TTL_MINUTES + 5), requireVerified: true });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('verify-unfinished');
    expect(v.detail).toMatch(/abandoned/);
  });

  // #2833 finding 1 — the TTL must actually GATE, not just re-word: a stranded (past-TTL) running marker must not
  // wedge the CI-gated drain forever. THE PIN: running × past-TTL × requireVerified:false → ok (untracked).
  it('finding 1: a PAST-TTL running marker + requireVerified:false → ok (untracked) — cannot wedge the CI-gated drain', () => {
    const v = verifyGateDecision({ record: running, headSha: SHA, nowMs: T0 + min(DEFAULT_VERIFY_TTL_MINUTES + 5), requireVerified: false });
    expect(v.ok).toBe(true);
    expect(v.reason).toBe('untracked');
  });
  it('finding 1: a FRESH (in-flight) running marker + requireVerified:false → STILL refused (the exact live stall)', () => {
    const v = verifyGateDecision({ record: running, headSha: SHA, nowMs: T0 + min(1), requireVerified: false });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('verify-unfinished');
    expect(v.detail).toMatch(/in-flight/);
  });

  it('a recorded RED result for THIS head under --require-verified → refused (fix + re-verify)', () => {
    // #2833 finding 2: red is refused only when a local green was DEMANDED. Without --require-verified the
    // required CI check gates the merge, so a red marker does not block (asserted in the decision-table block).
    const v = verifyGateDecision({ record: red, headSha: SHA, nowMs: T0, requireVerified: true });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('verify-red');
  });

  it('NO marker + --require-verified → refused as unverified (the solo/conveyor build gate)', () => {
    const v = verifyGateDecision({ record: null, headSha: SHA, requireVerified: true });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('unverified');
  });

  it('NO marker under the EXPLICIT opt-out (requireVerified:false) → ok (a caller that verifies elsewhere)', () => {
    const v = verifyGateDecision({ record: null, headSha: SHA, requireVerified: false });
    expect(v.ok).toBe(true);
    expect(v.reason).toBe('untracked');
  });

  it('a green marker for a DIFFERENT commit does NOT satisfy the gate for this HEAD (stale sha)', () => {
    const stale = { ...green, sha: OTHER };
    expect(verifyGateDecision({ record: stale, headSha: SHA, requireVerified: true }).ok).toBe(false);
    // ...and without require-verified it reads as untracked-for-this-head (allow), not a false green
    const v = verifyGateDecision({ record: stale, headSha: SHA, requireVerified: false });
    expect(v.ok).toBe(true);
    expect(v.reason).toBe('untracked');
  });

  it('WE_LAND_UNVERIFIED break-glass overrides every refusal (even an unfinished run)', () => {
    const v = verifyGateDecision({ record: running, headSha: SHA, nowMs: T0, breakGlass: true });
    expect(v.ok).toBe(true);
    expect(v.reason).toBe('break-glass');
  });
});

describe('verifyFinishBody stamps the sha the run verified, never the on-disk marker (#2833 finding 1)', () => {
  it('an explicit sha wins over prev.sha — a finish never inherits a moved marker\'s sha', () => {
    // `prev` is a marker that moved to OTHER (an overlapping run) while THIS run verified SHA.
    const moved = verifyStartBody({ sha: OTHER, suites: 'gate', startedAt: 't' });
    const done = verifyFinishBody(moved, { finishedAt: 'u', exitCode: 0, sha: SHA });
    expect(done.sha).toBe(SHA); // the run's own sha, NOT the on-disk OTHER
    expect(done.status).toBe('green');
  });
  it('THE FALSE-GREEN: a green finish at X does NOT produce a green record for a different sha Y', () => {
    // On disk is a RED record for Y (a newer overlapping run finished red at Y). This slow run passes green at X.
    const redY = verifyFinishBody(verifyStartBody({ sha: OTHER, suites: 'gate', startedAt: 't' }), { finishedAt: 'u', exitCode: 2, sha: OTHER });
    const greenX = verifyFinishBody(redY, { finishedAt: 'v', exitCode: 0, sha: SHA });
    expect(greenX.sha).toBe(SHA); // stamped X — it must NEVER stamp green for Y
    expect(greenX.sha).not.toBe(OTHER);
    // The gate at Y therefore still sees the red record, never a green for Y.
    expect(verifyGateDecision({ record: redY, headSha: OTHER, requireVerified: true }).reason).toBe('verify-red');
  });
  it('falls back to prev.sha only when no explicit sha is passed (legacy same-process caller)', () => {
    const start = verifyStartBody({ sha: SHA, suites: 'gate', startedAt: 't' });
    expect(verifyFinishBody(start, { finishedAt: 'u', exitCode: 0 }).sha).toBe(SHA);
  });
});

describe('verifyGateDecision decision table — red is conditional on requireVerified (#2833 finding 2)', () => {
  const rec = (status, exitCode = status === 'red' ? 2 : 0) => ({ sha: SHA, status, exitCode, startedAt: new Date(T0).toISOString() });
  it('red × requireVerified:true → refused (verify-red)', () => {
    const v = verifyGateDecision({ record: rec('red'), headSha: SHA, requireVerified: true });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('verify-red');
  });
  it('red × requireVerified:false → allowed (red-ci-gated) — the required CI check gates the merge', () => {
    const v = verifyGateDecision({ record: rec('red'), headSha: SHA, requireVerified: false });
    expect(v.ok).toBe(true);
    expect(v.reason).toBe('red-ci-gated');
  });
  it('running is refused for BOTH requireVerified values (asymmetry: never-finished ≠ finished-badly)', () => {
    expect(verifyGateDecision({ record: rec('running'), headSha: SHA, nowMs: T0 + min(1), requireVerified: false }).ok).toBe(false);
    expect(verifyGateDecision({ record: rec('running'), headSha: SHA, nowMs: T0 + min(1), requireVerified: true }).ok).toBe(false);
  });
  it('green is ok for BOTH requireVerified values', () => {
    expect(verifyGateDecision({ record: rec('green'), headSha: SHA, requireVerified: false }).ok).toBe(true);
    expect(verifyGateDecision({ record: rec('green'), headSha: SHA, requireVerified: true }).ok).toBe(true);
  });
});

describe('verifyGateDecision — a corrupt marker refuses, never fails open (#2833 finding 5)', () => {
  it('a corrupt record is refused regardless of requireVerified', () => {
    expect(verifyGateDecision({ record: { corrupt: true }, headSha: SHA, requireVerified: false }).ok).toBe(false);
    const v = verifyGateDecision({ record: { corrupt: true }, headSha: SHA, requireVerified: true });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('verify-corrupt');
  });
  it('break-glass still overrides a corrupt marker', () => {
    expect(verifyGateDecision({ record: { corrupt: true }, headSha: SHA, breakGlass: true }).ok).toBe(true);
  });
});

describe('normalizeVerifyRecord — the SHARED normalizer both readers use (#2833 finding 2)', () => {
  it('a valid-JSON NON-object (the finding-2 hole) folds to { corrupt: true } — never passes as absent', () => {
    // null / a string / a number / an array are all valid JSON but not a verification record. pr-land used to
    // catch only a throw, so these slipped through as "no sha → untracked → land unverified". Now they refuse.
    for (const bad of [null, 'x', 42, [], [{ sha: 'a' }]]) {
      expect(normalizeVerifyRecord(bad)).toEqual({ corrupt: true });
    }
  });
  it('a plain object passes through untouched (field validation is the gate\'s job)', () => {
    const rec = { sha: SHA, status: 'green', exitCode: 0 };
    expect(normalizeVerifyRecord(rec)).toBe(rec);
  });
  it('a folded non-object is REFUSED by the gate (does not fail open)', () => {
    expect(verifyGateDecision({ record: normalizeVerifyRecord('x'), headSha: SHA, requireVerified: false }).ok).toBe(false);
    expect(verifyGateDecision({ record: normalizeVerifyRecord([]), headSha: SHA, requireVerified: false }).reason).toBe('verify-corrupt');
  });
});

describe('resolveVerifyOptions — one flag/env resolver for BOTH entry points (#2833 finding 5)', () => {
  it('--require-verified OR WE_REQUIRE_VERIFIED=1 → requireVerified true; WE_LAND_UNVERIFIED=1 → breakGlass', () => {
    // #3321 flipped the bare default from false to true; the two POSITIVE spellings below still resolve the same.
    expect(resolveVerifyOptions({ flags: {}, env: {} })).toEqual({ requireVerified: true, breakGlass: false });
    expect(resolveVerifyOptions({ flags: { 'require-verified': true }, env: {} })).toEqual({ requireVerified: true, breakGlass: false });
    expect(resolveVerifyOptions({ flags: {}, env: { WE_REQUIRE_VERIFIED: '1' } })).toEqual({ requireVerified: true, breakGlass: false });
    // break-glass is reported SEPARATELY and does not relax `requireVerified` — the gate reads both.
    expect(resolveVerifyOptions({ flags: {}, env: { WE_LAND_UNVERIFIED: '1' } })).toEqual({ requireVerified: true, breakGlass: true });
  });
  it('the SAME flag/env pair yields IDENTICAL options at both call sites (they call one function)', () => {
    // verify-lane `check` and pr-land both call resolveVerifyOptions with {flags, env}; identical input ⇒ identical
    // output by construction. This pins that the resolution is single-sourced (finding 5: `check` used to ignore
    // WE_REQUIRE_VERIFIED, so the same env produced two verdicts).
    const flags = { 'require-verified': true };
    const env = { WE_REQUIRE_VERIFIED: '1', WE_LAND_UNVERIFIED: '1' };
    const atVerifyLane = resolveVerifyOptions({ flags, env });
    const atPrLand = resolveVerifyOptions({ flags, env });
    expect(atVerifyLane).toEqual(atPrLand);
    expect(atVerifyLane).toEqual({ requireVerified: true, breakGlass: true });
  });
});

/**
 * #3321 — VERIFICATION IS MANDATORY BEFORE A LANE LANDS.
 *
 * #2833 built the gate but defaulted `requireVerified` FALSE, so its mandatory half never engaged: a lane whose
 * suites had never run at all landed on the `untracked` verdict — "no marker → not tracked here → allow". A gate
 * that PASSES WHEN IT CANNOT TELL. The cost is measured: 18 of the 39 confirmed findings in the review corpus had
 * their input available at COMMIT time, where the suite this marker records would have caught them; and the suite
 * itself sat red on every macOS host precisely because nothing on the delivery path was obliged to look.
 *
 * These tests pin BOTH directions, because a gate that refuses everything is worse than the hole it closes:
 *   · the REFUSAL — unverified/red/unidentifiable now blocks by default, at both the resolver and the decision; and
 *   · the PASS — a legitimately verified lane (green marker for THIS head) sails through with no options at all.
 * Plus the two escapes, kept at deliberately different strengths: the opt-out relaxes only "we never saw a
 * result"; only break-glass overrides a broken one.
 */
describe('#3321 — the gate no longer passes when it cannot tell (requireVerified defaults true)', () => {
  const greenFor = (sha) => verifyFinishBody(verifyStartBody({ sha, suites: 'gate', startedAt: new Date(T0).toISOString() }), { finishedAt: new Date(T0).toISOString(), exitCode: 0 });
  const runningFor = (sha) => verifyStartBody({ sha, suites: 'gate', startedAt: new Date(T0).toISOString() });

  describe('the resolver: silence means "verified, please", never "don\'t bother"', () => {
    it('#3321 no flags, no env → requireVerified TRUE (the flip; was false before this item)', () => {
      expect(resolveVerifyOptions({ flags: {}, env: {} }).requireVerified).toBe(true);
      expect(resolveVerifyOptions()).toEqual({ requireVerified: true, breakGlass: false });
    });

    it('#3321 every documented OPT-OUT spelling resolves to requireVerified false', () => {
      const optOuts = [
        { flags: { 'no-require-verified': true }, env: {} },
        { flags: { 'require-verified': '0' }, env: {} },
        { flags: { 'require-verified': 'false' }, env: {} },
        { flags: { 'require-verified': 'no' }, env: {} },
        { flags: { 'require-verified': 'OFF' }, env: {} },
        { flags: {}, env: { WE_REQUIRE_VERIFIED: '0' } },
        { flags: {}, env: { WE_REQUIRE_VERIFIED: 'false' } },
      ];
      for (const input of optOuts) {
        expect(resolveVerifyOptions(input).requireVerified, JSON.stringify(input)).toBe(false);
      }
    });

    it('#3321 only an EXPLICIT negative opts out — absence and an empty/unknown value stay required', () => {
      // An env var set to empty is an accident, not a decision. A fail-closed gate must not read an accident as
      // consent, so `WE_REQUIRE_VERIFIED=` (and any value that is not one of the negative tokens) stays required.
      expect(resolveVerifyOptions({ flags: {}, env: { WE_REQUIRE_VERIFIED: '' } }).requireVerified).toBe(true);
      expect(resolveVerifyOptions({ flags: {}, env: { WE_REQUIRE_VERIFIED: 'maybe' } }).requireVerified).toBe(true);
      expect(resolveVerifyOptions({ flags: { 'require-verified': undefined }, env: {} }).requireVerified).toBe(true);
    });

    it('#3321 an explicit --require-verified BEATS an ambient WE_REQUIRE_VERIFIED=0 (precedence, fail-closed)', () => {
      // Review finding (b) on PR #1609: the first cut of #3321 collapsed flag and env into one flat OR, so an
      // ambient negative env DEFEATED an explicit positive flag — a silent regression of the pre-#3321 precedence
      // (`!!flags['require-verified'] || env === '1'`, where the flag won) and fail-OPEN on a contradictory
      // invocation. A flag is a decision made for THIS run; an env var may be inherited from a parent that knew
      // nothing about this call. The deliberate one wins, and it wins toward verifying.
      for (const env of [{ WE_REQUIRE_VERIFIED: '0' }, { WE_REQUIRE_VERIFIED: 'false' }, { WE_REQUIRE_VERIFIED: 'off' }]) {
        expect(resolveVerifyOptions({ flags: { 'require-verified': true }, env }).requireVerified, JSON.stringify(env)).toBe(true);
        expect(resolveVerifyOptions({ flags: { 'require-verified': '1' }, env }).requireVerified, JSON.stringify(env)).toBe(true);
      }
      // The env still decides when the flag is absent — the opt-out is not being broken, only out-ranked.
      expect(resolveVerifyOptions({ flags: {}, env: { WE_REQUIRE_VERIFIED: '0' } }).requireVerified).toBe(false);
      // ...and an explicitly NEGATIVE flag still opts out; it is not "any mention of the flag wins".
      expect(resolveVerifyOptions({ flags: { 'require-verified': '0' }, env: { WE_REQUIRE_VERIFIED: '1' } }).requireVerified).toBe(false);
    });

    it('#3321 contradictory flags resolve fail-closed: --require-verified beats --no-require-verified', () => {
      // Nobody means both. A gate whose purpose is to refuse when it cannot tell must not read "I cannot tell"
      // as consent, so the contradiction resolves toward verifying.
      expect(resolveVerifyOptions({ flags: { 'require-verified': true, 'no-require-verified': true }, env: {} }).requireVerified).toBe(true);
    });

    it('#3321 break-glass is reported SEPARATELY and never relaxes requireVerified', () => {
      // The two escapes are different strengths and must stay distinguishable: collapsing WE_LAND_UNVERIFIED into
      // requireVerified would silently turn the narrow opt-out into the full bypass.
      expect(resolveVerifyOptions({ flags: {}, env: { WE_LAND_UNVERIFIED: '1' } })).toEqual({ requireVerified: true, breakGlass: true });
    });

    /**
     * #3321 — THE DOUBLE-NEGATIVE CORNER (PR #1609 r2, the correctness juror's CONFIRMED finding). The resolver's
     * comments state that `--no-require-verified=0` is "a double negative nobody means" and resolves toward
     * REQUIRED. That was documented, hand-traced and correct — and untested, which is how a stated contract turns
     * into an accidental one. It is a real corner even if `pr-land`'s regex parser is unlikely to emit it: the
     * parser accepts `--flag=<anything>`, so a caller CAN produce every row below, and the whole subject of this
     * card is a gate that must never resolve an input it cannot read as "go ahead".
     *
     * Exhaustive over the resolver's inputs: {absent, affirmative, negative} for each of the two flag spellings ×
     * {absent, '1', negative} for the env var = 27 rows, each asserted against the documented rule
     * (affirmative flag → required; else any explicit negative → opt-out; else required).
     */
    it('#3321 every flag×flag×env combination resolves exactly as the comments claim (27 rows, negated negatives included)', () => {
      const FLAG = { absent: undefined, affirmative: true, negative: '0' };
      const ENV = { absent: undefined, on: '1', negative: '0' };
      for (const [rvName, rv] of Object.entries(FLAG)) {
        for (const [nrvName, nrv] of Object.entries(FLAG)) {
          for (const [envName, ev] of Object.entries(ENV)) {
            const flags = {};
            if (rv !== undefined) flags['require-verified'] = rv;
            if (nrv !== undefined) flags['no-require-verified'] = nrv;
            const env = ev === undefined ? {} : { WE_REQUIRE_VERIFIED: ev };

            // The documented rule, restated independently of the implementation.
            const expected = rvName === 'affirmative' ? true
              : !(nrvName === 'affirmative' || rvName === 'negative' || envName === 'negative');

            const label = `require-verified:${rvName} no-require-verified:${nrvName} env:${envName}`;
            expect(resolveVerifyOptions({ flags, env }).requireVerified, label).toBe(expected);
          }
        }
      }
      // The two rows the finding named, called out by name so a regression reads as itself in the failure output:
      // a NEGATED negative is not an opt-out (it cancels, leaving the mandatory default)...
      expect(resolveVerifyOptions({ flags: { 'no-require-verified': '0' }, env: {} }).requireVerified).toBe(true);
      expect(resolveVerifyOptions({ flags: { 'no-require-verified': 'false' }, env: {} }).requireVerified).toBe(true);
      // ...and a negated `--require-verified` still opts out even against WE_REQUIRE_VERIFIED=1, because the
      // command line is the deliberate signal and it said "no".
      expect(resolveVerifyOptions({ flags: { 'require-verified': 'off' }, env: { WE_REQUIRE_VERIFIED: '1' } }).requireVerified).toBe(false);
    });
  });

  describe('the decision: a caller that omits the option gets the STRICT gate', () => {
    it('#3321 THE HOLE, CLOSED: no marker + no requireVerified argument → REFUSED as unverified', () => {
      // Before this item this exact call returned { ok: true, reason: 'untracked' } — a lane whose suites had
      // never run was allowed to land because the gate could not tell that they had not.
      const v = verifyGateDecision({ record: null, headSha: SHA });
      expect(v.ok).toBe(false);
      expect(v.reason).toBe('unverified');
      expect(v.detail).toMatch(/verify-lane/);
    });

    it('#3321 a RED marker for this head + no requireVerified argument → REFUSED (was advisory)', () => {
      const redRec = verifyFinishBody(runningFor(SHA), { finishedAt: new Date(T0).toISOString(), exitCode: 2 });
      const v = verifyGateDecision({ record: redRec, headSha: SHA, nowMs: T0 });
      expect(v.ok).toBe(false);
      expect(v.reason).toBe('verify-red');
    });

    it('#3321 a marker for a DIFFERENT sha + no requireVerified argument → REFUSED (stale ≠ verified)', () => {
      const v = verifyGateDecision({ record: greenFor(OTHER), headSha: SHA });
      expect(v.ok).toBe(false);
      expect(v.reason).toBe('unverified');
    });

    it('#3321 an UNIDENTIFIABLE head (no headSha) does not wave a green marker through', () => {
      // Nothing can match a missing head, so this falls to the absent cell. Not being able to identify the tree
      // is not evidence that the tree is fine — the whole defect class this item closes.
      expect(verifyGateDecision({ record: greenFor(SHA), headSha: null }).ok).toBe(false);
      expect(verifyGateDecision({ record: greenFor(SHA), headSha: undefined }).reason).toBe('unverified');
    });

    it('#3321 an ABANDONED (past-TTL) running marker no longer degrades to allow by default', () => {
      // #2833 finding 1's degrade survives, but only for a caller that explicitly opted out.
      const abandoned = { record: runningFor(SHA), headSha: SHA, nowMs: T0 + min(DEFAULT_VERIFY_TTL_MINUTES + 5) };
      expect(verifyGateDecision(abandoned).ok).toBe(false);
      expect(verifyGateDecision(abandoned).reason).toBe('verify-unfinished');
      expect(verifyGateDecision({ ...abandoned, requireVerified: false }).ok).toBe(true);
    });
  });

  describe('the counter-test: a legitimately verified lane still LANDS', () => {
    // A gate that blocks everything is worse than the hole. These are the passes that must survive the flip.
    it('#3321 a green marker for THIS head passes with NO options at all', () => {
      const v = verifyGateDecision({ record: greenFor(SHA), headSha: SHA, nowMs: T0 + min(10) });
      expect(v.ok).toBe(true);
      expect(v.reason).toBe('verified');
    });

    it('#3321 a green marker still passes long after the TTL — sha-identity is the freshness test, not the clock', () => {
      const v = verifyGateDecision({ record: greenFor(SHA), headSha: SHA, nowMs: T0 + min(DEFAULT_VERIFY_TTL_MINUTES * 100) });
      expect(v.ok).toBe(true);
      expect(v.reason).toBe('verified');
    });

    it('#3321 END TO END: the resolver\'s own output, fed to the gate, lands a verified lane and refuses a bare one', () => {
      // The exact wiring both entry points do — `resolveVerifyOptions(…)` straight into `verifyGateDecision(…)`.
      const opts = resolveVerifyOptions({ flags: {}, env: {} });
      expect(verifyGateDecision({ record: greenFor(SHA), headSha: SHA, ...opts }).ok).toBe(true);
      expect(verifyGateDecision({ record: null, headSha: SHA, ...opts }).ok).toBe(false);
    });
  });

  describe('the two escapes are different strengths', () => {
    it('#3321 the OPT-OUT is not a bypass: a fresh running marker and a corrupt marker still refuse under it', () => {
      const optOut = resolveVerifyOptions({ flags: { 'no-require-verified': true }, env: {} });
      expect(optOut).toEqual({ requireVerified: false, breakGlass: false });
      // the #2833 stall — a half-run verification must never look complete, opt-out or not
      expect(verifyGateDecision({ record: runningFor(SHA), headSha: SHA, nowMs: T0 + min(1), ...optOut }).reason).toBe('verify-unfinished');
      // a marker that exists but did not parse is evidence of a BROKEN verification, not a missing one
      expect(verifyGateDecision({ record: { corrupt: true }, headSha: SHA, ...optOut }).reason).toBe('verify-corrupt');
      // ...while the cells it IS meant to relax do relax
      expect(verifyGateDecision({ record: null, headSha: SHA, ...optOut }).reason).toBe('untracked');
    });

    it('#3321 BREAK-GLASS is the full bypass, and reaches cells the opt-out does not', () => {
      const bg = resolveVerifyOptions({ flags: {}, env: { WE_LAND_UNVERIFIED: '1' } });
      expect(bg.requireVerified).toBe(true); // still "required" — break-glass overrides, it does not un-require
      for (const record of [null, { corrupt: true }, runningFor(SHA)]) {
        const v = verifyGateDecision({ record, headSha: SHA, nowMs: T0 + min(1), ...bg });
        expect(v.ok).toBe(true);
        expect(v.reason).toBe('break-glass');
      }
    });
  });
});

// ── #3321 — THE CALLER SWEEP, as a test instead of an assertion in a comment ──────────────────────────────────
//
// The residual this item's round-3 fix named and deferred, built here instead. Twice now, a docblock has asserted
// a completed sweep of the callers the flipped default re-points, and twice the sweep had missed one: round 1
// missed `we:scripts/lane-drain.mjs`, round 2 missed
// `we:skills-src/batch-backlog-items/parallel-execute.workflow.js` (four flag-free argvs, so every `/workflow`
// lane died at pr-land's step-1b gate with exit 3 / `unverified`).
//
// The lesson is not "remember the workflow" — it is that a caller list maintained BY HAND in a comment is a claim
// that rots the moment someone adds a caller. So the sweep runs here, over the real committed source: every
// `node scripts/pr-land.mjs …` command string this repo ships must state its verification posture explicitly, and
// each is driven through pr-land's own flag parser, `resolveVerifyOptions`, and `verifyGateDecision` against the
// marker state that path actually sees. Add a fifth flag-free invocation and this reddens instead of shipping.
describe('#3321 — every committed pr-land invocation declares its verification posture (caller sweep)', () => {
  const REPO = process.cwd();
  const WORKFLOW = 'skills-src/batch-backlog-items/parallel-execute.workflow.js';
  const DRAIN = 'scripts/lane-drain.mjs';

  // pr-land's OWN flag parser (`scripts/pr-land.mjs`, the argv loop) — the same regex, not a re-implementation.
  const parseArgv = (cmd) => {
    const flags = {};
    for (const a of cmd.split(/\s+/).slice(2)) {
      const m = a.match(/^--([^=]+)(?:=(.*))?$/);
      if (m) flags[m[1]] = m[2] === undefined ? true : m[2];
    }
    return flags;
  };
  // A REAL invocation, not the prose form: at least one `--flag` must follow, so a docblock's
  // "the `node scripts/pr-land.mjs …` argv" is not mistaken for a call site that forgot its posture.
  const PR_LAND_CMD = /node scripts\/pr-land\.mjs(?:\s+--[^\s`\\]+)+/g;
  const VERIFY_FLAGS = ['require-verified', 'no-require-verified'];
  const srcOf = (f) => readFileSync(resolve(REPO, f), 'utf8');
  const invocationsIn = (f) => [...srcOf(f).matchAll(PR_LAND_CMD)].map((m) => m[0].trim());

  it('the parallel /workflow producer passes the opt-out on EVERY argv it emits', () => {
    const invocations = invocationsIn(WORKFLOW);
    // Step 8 emits two (the WE PR and the impl-repo PR); the #2216 label-reconcile pass emits two more.
    expect(invocations.length).toBe(4);
    for (const cmd of invocations) {
      const opts = resolveVerifyOptions({ flags: parseArgv(cmd), env: {} });
      expect(opts, cmd).toEqual({ requireVerified: false, breakGlass: false });
      // The marker state this path REALLY has: absent. Its step-4 gate shells the suites directly and never
      // writes `.git/.lane-verify`, and the reconcile pass runs from the PRIMARY checkout against a lane ref,
      // where a lane clone's marker is structurally unreachable.
      expect(verifyGateDecision({ record: null, headSha: SHA, ...opts }), cmd)
        .toMatchObject({ ok: true, reason: 'untracked' });
    }
  });

  it('the same argvs WITHOUT the flag are the wedge — so the flag is provably load-bearing', () => {
    const stripped = invocationsIn(WORKFLOW).map((c) => c.replace(/\s--no-require-verified\b/g, ''));
    expect(stripped.length).toBe(4);
    for (const cmd of stripped) {
      const opts = resolveVerifyOptions({ flags: parseArgv(cmd), env: {} });
      expect(opts.requireVerified, cmd).toBe(true);
      expect(verifyGateDecision({ record: null, headSha: SHA, ...opts }), cmd)
        .toMatchObject({ ok: false, reason: 'unverified' });
    }
  });

  it('no emitter ships a pr-land invocation that says nothing about verification', () => {
    const silent = [];
    for (const file of [WORKFLOW, DRAIN]) {
      for (const cmd of invocationsIn(file)) {
        if (!VERIFY_FLAGS.some((f) => f in parseArgv(cmd))) silent.push(`${file}: ${cmd.slice(0, 80)}`);
      }
    }
    expect(silent).toEqual([]);
  });

  it('the drain builds its argv as an ARRAY, and that array declares the posture too', () => {
    // `buildPrLandArgs` is an array literal, not a command string, so the regex above cannot see it. Pinned here
    // as well, so the sweep has no hole the drain could slip back through. (`lane-drain.test.mjs` pins the
    // resolved behaviour; this pins that the sweep itself covers the shape.)
    expect(srcOf(DRAIN)).toMatch(/const args = \['scripts\/pr-land\.mjs',[^\]]*'--no-require-verified'/);
  });
});

describe('the marker filename is the never-tracked in-.git convention', () => {
  it('VERIFY_FILENAME matches the .lane-lease sibling convention', () => {
    expect(VERIFY_FILENAME).toBe('.lane-verify');
  });
});
