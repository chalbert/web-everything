/**
 * @file gate-invariants.test.mjs — the TRIPWIRE suite for the auto-review/merge gate.
 *
 * WHAT THIS IS, AND WHY IT IS DIFFERENT FROM THE OTHER GATE TESTS.
 * The sibling suites (`review-escalation.test.mjs`, `pr-merge-gate.test.mjs`, `../../__tests__/
 * merge-ai-prs.test.mjs`, `../../__tests__/pr-land.test.mjs`) pin the CURRENT BEHAVIOUR of each gate
 * function with worked examples — they move with the code, so a change that intentionally alters an
 * output just updates its expectation. That is correct for behaviour, but it means those suites cannot,
 * by construction, catch a change that WEAKENS a safety property: the author edits the code and the
 * example in one PR and it stays green.
 *
 * This file is the other half. It does NOT assert what the gate returns for one input — it asserts, over
 * the ENTIRE cross-product of inputs, the small set of SAFETY INVARIANTS that must hold no matter how the
 * rubric is refactored. These are phrased independently of the implementation: "a human-gated PR never
 * reaches an auto-merge action, for ANY label set / escalation state / park age" rather than "input X →
 * action park". A refactor that keeps every invariant green is provably safe on the properties that matter;
 * a refactor that has to change an assertion HERE is, by definition, changing what "safe" means — and that
 * is exactly the diff a human should look at.
 *
 * SELF-REFERENCE (the load-bearing bit). This file's basename is in the `TRUST_CHAIN` roster (see
 * `../gate-config.mjs`, #2448), so editing it forces `review:human` on its own PR — the one class of change
 * that an agent reviewer may not clear. That closes the loop: the invariants review every future change to
 * the gate for free (in CI, via the required `test` check), and the ONLY gate change that still needs a
 * human is one that edits an invariant. Do not weaken an assertion here to make a diff pass; if an
 * invariant is genuinely wrong, changing it is a deliberate policy decision, reviewed by a human.
 *
 * Under #2162/#2171/#2285/#2366 (the auto-review gate) and #104 (gate-self ⇒ human).
 */
import { describe, it, expect } from 'vitest';
import {
  REVIEW_LABELS,
  isGateSelfPath,
  isStatutePath,
  scoreEscalation,
  coupleEscalation,
  decideReviewGate,
  producerReviewLabel,
  hasUnclearedReviewLabel,
  isCodificationOnly,
  isPolicySpecPath,
} from '../review-escalation.mjs';
import {
  TRUST_CHAIN,
  POLICY_LEASH,
  POLICY_CORE_BASENAMES,
  POLICY_SPEC_BASENAMES,
  POLICY_DERIVATION_BASENAMES,
  RATIFIED_POLICY_SPEC_FLOOR,
  isTrustChainPath,
} from '../gate-config.mjs';
import { assertMayMerge, hasNonEmptyBody } from '../pr-merge-gate.mjs';
import { classifyChecks } from '../../pr-land.mjs';
import { classifyPr } from '../../merge-ai-prs.mjs';

// ── enumeration helpers (deterministic — no Math.random, so a failure reproduces exactly) ────────────────
/** Every subset of `items` (the powerset), as arrays. */
function powerset(items) {
  return items.reduce((sets, item) => sets.concat(sets.map((s) => [...s, item])), [[]]);
}
/** Cartesian product of the given arrays. */
function product(...arrays) {
  return arrays.reduce((acc, arr) => acc.flatMap((a) => arr.map((b) => [...a, b])), [[]]);
}

// #2445 two-tier flip + the #2771/#2785 POLICY-tier split. The trust chain has two TIERS (policy / engine), and
// the policy tier has two LEASHES:
//   • DECLARATIVE LEASH (`leash: 'spec'`) — the encoded policy itself. Forces review:human. Permanently pinned
//     by #2840 trigger 3: these files have no behaviour-preserving edit.
//   • DERIVATION CODE (`leash: 'code'`) — the code that derives the gate from that leash. Still ESCALATES, but a
//     converged INDEPENDENT committee verdict may clear it (#2771 Fork A) — it no longer forces a human.
//   • ENGINE tier — the lander, which obeys the gate. Escalates, agent-reviewable (unchanged, #2445).
const DECLARATIVE_LEASH_FILES = [
  'scripts/lib/review-policy.contract.json',  // #2566 — the machine-diffable policy SPEC; a diff here IS a policy change
  'scripts/lib/__tests__/review-policy.conformance.test.mjs', // #2566 — the impl↔contract bridge (weakening it is a spec change)
  'scripts/lib/gate-config.mjs',              // #2448 — the trust-chain roster; editing it is the closure
  'scripts/lib/__tests__/gate-invariants.test.mjs', // THIS file — self-referenced (see header)
  'scripts/check-standards.contract.json',    // #2769 — the check:standards definition-of-green contract
  'scripts/lib/__tests__/check-standards.conformance.test.mjs', // #2769 — its conformance bridge
  'scripts/lib/review-runner-core.mjs',       // #2830 — the forced-SHADOW zero-mutation guarantee (leash `spec` pending a #2840-trigger-2 ruling)
  'scripts/review-runner.mjs',                // #2830 — the `--enforce` refusal, the other half of that guarantee
];
const DERIVATION_CODE_FILES = [
  'scripts/lib/review-escalation.mjs',        // the escalation rubric — derives the gate from the contract
  'scripts/lib/review-core.mjs',              // the converge-vs-human disposition router + round caps
  'scripts/lib/review-policy.mjs',            // #2566 — the spec loader + executable oracle
  'scripts/lib/disposition-land-seam.mjs',    // #2674 — the disposition→label router
  'scripts/lib/auto-land-seam.mjs',           // #2675 — the acting seam
];
// Both halves are still the POLICY TIER — `isGateSelfPath` (i.e. "is this the policy tier?") is true for every
// one of them, and every one of them ESCALATES. Only `humanRequired` distinguishes the two.
const POLICY_CORE_FILES = [...DECLARATIVE_LEASH_FILES, ...DERIVATION_CODE_FILES];
const ENGINE_FILES = [
  'scripts/merge-ai-prs.mjs',                 // the lander — obeys the gate, so agent-reviewable (#2445 flip)
  'frontierui/scripts/merge-ai-prs.mjs',      // a repo-prefixed clone path still counts
];
// The STATUTE layer (#2412) — governance rules a human must ratify; forces review:human like the policy tier.
const STATUTE_FILES = ['docs/agent/platform-decisions.md', 'docs/agent/2026-06-example-statute.md'];
// #2448 — a trust-chain member RELOCATED out of we:scripts/ (the #2445 coordinator: a plateau-app module, a
// package dir, or its own repo). Basename-matched, so the TIER travels: a relocated POLICY file stays human, a
// relocated ENGINE file still escalates (it can never silently drop out of review) but stays agent-reviewable.
const RELOCATED_LEASH_FILES = [
  'plateau-loop/gate/gate-config.mjs',              // the roster, its own repo → still human
  'plateau-app/tools/loop/review-policy.contract.json', // the contract, extracted → still human
];
const RELOCATED_DERIVATION_FILES = [
  'plateau-app/tools/loop/review-escalation.mjs',   // derivation code, extracted → escalates, committee-clearable
];
const RELOCATED_POLICY_FILES = [...RELOCATED_LEASH_FILES, ...RELOCATED_DERIVATION_FILES];
const RELOCATED_ENGINE_FILES = [
  'packages/plateau-loop/src/merge-ai-prs.mjs',     // engine, extracted into a package dir → escalates, agent-reviewable
];
const LEAF_FILES = ['backlog/123-x.md', 'demos/spa.html', 'src/_data/other.json', 'reports/2026-07-09-x.md'];
// x30jq9n — the merge-anyway timeout is REMOVED; decideReviewGate no longer reads park age. These legacy
// park-age shapes are still swept below purely as tripwires: a caller passing them must change NOTHING.
const PARK_AGES = [
  { parkedSinceMs: null, nowMs: 0 },              // never parked
  { parkedSinceMs: 0, nowMs: 60_000 },            // freshly parked
  { parkedSinceMs: 0, nowMs: 1e12 },              // absurdly old park (would have timed out under the old window)
];
const AUTO_MERGE_ACTIONS = ['merge']; // the ONE action that puts a PR onto main without a human (merge-anyway removed, x30jq9n)

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// INVARIANT 1 — the two-tier trust chain (#2445 flip). POLICY-CORE and STATUTE paths are ALWAYS human-required
// (and escalate). ENGINE paths (the lander) ALWAYS escalate but are NEVER human-required — a converged agent
// verdict may clear them. The tier travels with a relocated file's basename.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('INVARIANT 1 — policy/statute ⇒ human; engine ⇒ escalate-but-agent-reviewable', () => {
  const noiseSignals = product(
    [0, 500],        // diffLines: below and above the size threshold
    [0, 3],          // dismissedFindings
    [false, true],   // crossRepo
  );
  it('every POLICY-CORE path is classified gate-self (human); every ENGINE path is NOT', () => {
    for (const f of POLICY_CORE_FILES) expect(isGateSelfPath(f)).toBe(true);
    for (const f of ENGINE_FILES) expect(isGateSelfPath(f)).toBe(false);
  });
  it('the DECLARATIVE LEASH ⇒ humanRequired across arbitrary other signals + noise (#2771/#2785)', () => {
    for (const gateFile of DECLARATIVE_LEASH_FILES) {
      for (const noise of powerset(LEAF_FILES)) {
        for (const [diffLines, dismissedFindings, crossRepo] of noiseSignals) {
          const r = scoreEscalation({ changedFiles: [...noise, gateFile], diffLines, dismissedFindings, crossRepo });
          expect(r.humanRequired).toBe(true); // the encoded policy — never falls to agent-reviewable
          expect(r.escalate).toBe(true);
        }
      }
    }
  });
  it('#2771 Fork A — policy-tier DERIVATION CODE ESCALATES but is NOT humanRequired, across noise', () => {
    for (const gateFile of DERIVATION_CODE_FILES) {
      for (const noise of powerset(LEAF_FILES)) {
        for (const [diffLines, dismissedFindings, crossRepo] of noiseSignals) {
          const r = scoreEscalation({ changedFiles: [...noise, gateFile], diffLines, dismissedFindings, crossRepo });
          expect(r.escalate).toBe(true);       // still gets a full independent review…
          expect(r.humanRequired).toBe(false); // …but the committee may clear it — the ratified narrowing
        }
      }
    }
  });
  it('MIXED — a diff touching BOTH the leash and derivation code stays humanRequired (the strictest half wins)', () => {
    for (const leash of DECLARATIVE_LEASH_FILES) {
      for (const code of DERIVATION_CODE_FILES) {
        for (const noise of powerset(LEAF_FILES).slice(0, 4)) {
          const r = scoreEscalation({ changedFiles: [...noise, code, leash] });
          expect(r.humanRequired).toBe(true);
          // …and on the cumulative human basis too, where the leash rides an ancestor commit (#2390).
          expect(scoreEscalation({ changedFiles: [code], humanBasisFiles: [code, leash] }).humanRequired).toBe(true);
        }
      }
    }
  });
  it('the leash never LOSES its human gate to a de-inflated stacked base (#2390 — the human basis wins)', () => {
    for (const leash of DECLARATIVE_LEASH_FILES) {
      // own-delta looks innocuous; the cumulative basis carries the leash edit → still human.
      expect(scoreEscalation({ changedFiles: ['demos/spa.html'], humanBasisFiles: ['demos/spa.html', leash] }).humanRequired).toBe(true);
    }
  });
  it('the STATUTE layer ⇒ humanRequired (a governance rule a human must ratify, #2412)', () => {
    for (const s of STATUTE_FILES) {
      expect(isStatutePath(s)).toBe(true);
      for (const noise of powerset(LEAF_FILES)) {
        const r = scoreEscalation({ changedFiles: [...noise, s] });
        expect(r.humanRequired).toBe(true);
        expect(r.escalate).toBe(true);
      }
    }
  });
  it('#2445 flip — an ENGINE (lander) edit ESCALATES but is NOT humanRequired (agent-reviewable)', () => {
    for (const engineFile of ENGINE_FILES) {
      for (const noise of powerset(LEAF_FILES)) {
        for (const [diffLines, dismissedFindings, crossRepo] of noiseSignals) {
          const r = scoreEscalation({ changedFiles: [...noise, engineFile], diffLines, dismissedFindings, crossRepo });
          expect(r.escalate).toBe(true);        // the lander always gets an independent review
          expect(r.humanRequired).toBe(false);  // but a converged agent verdict may clear it — the flip
        }
      }
    }
  });
  it('#2448/#2445/#2785 — the tier AND the leash TRAVEL: a relocated LEASH file stays human; relocated derivation code + a relocated ENGINE file escalate but stay agent-reviewable', () => {
    for (const moved of RELOCATED_POLICY_FILES) expect(isGateSelfPath(moved)).toBe(true);
    for (const moved of RELOCATED_LEASH_FILES) {
      for (const noise of powerset(LEAF_FILES)) {
        const r = scoreEscalation({ changedFiles: [...noise, moved], diffLines: 0 });
        expect(r.humanRequired).toBe(true); // the coordinator can never auto-clear a change to its own leash
        expect(r.escalate).toBe(true);
      }
    }
    for (const moved of RELOCATED_DERIVATION_FILES) {
      for (const noise of powerset(LEAF_FILES)) {
        const r = scoreEscalation({ changedFiles: [...noise, moved], diffLines: 0 });
        expect(r.humanRequired).toBe(false); // derivation code — the committee clears it wherever it lives
        expect(r.escalate).toBe(true);       // but it can never silently drop out of review
      }
    }
    for (const moved of RELOCATED_ENGINE_FILES) {
      expect(isGateSelfPath(moved)).toBe(false);
      for (const noise of powerset(LEAF_FILES)) {
        const r = scoreEscalation({ changedFiles: [...noise, moved], diffLines: 0 });
        expect(r.humanRequired).toBe(false);
        expect(r.escalate).toBe(true); // still escalates even though a package path no longer matches ^scripts/
      }
    }
  });
  it('a diff with NO policy/statute path is never humanRequired (the converse — no false human-gating)', () => {
    for (const files of powerset(LEAF_FILES)) {
      expect(scoreEscalation({ changedFiles: files, diffLines: 999, dismissedFindings: 9, crossRepo: true }).humanRequired).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// INVARIANT 2 — a human-gated PR NEVER reaches an auto-merge action without an explicit human accept.
// This is the core safety property: no refactor of decideReviewGate may open a path by which a PR that is
// human-required (fresh score) OR already carries the sticky review:human label lands on main, EXCEPT when a
// human has applied review:accepted. Proven over the full cross-product of escalation × human signal ×
// label set × park age.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('INVARIANT 2 — human-gated ⇒ no auto-merge without review:accepted', () => {
  const otherLabels = powerset([REVIEW_LABELS.pending, REVIEW_LABELS.changes]);
  const cases = product(
    [false, true],   // escalate (a sticky human label must veto even a de-escalated PR)
    [false, true],   // humanRequired (fresh gate-self score)
    [false, true],   // review:human label present (the sticky veto)
    [false, true],   // review:accepted present (the ONE human clear)
  );

  it('for every (escalate, humanRequired, humanLabel, accepted, extra labels, park age): human-tainted ⇒ never auto-merges unless accepted', () => {
    for (const [escalate, humanRequired, humanLabel, accepted] of cases) {
      for (const extra of otherLabels) {
        for (const age of PARK_AGES) {
          const labels = [...extra];
          if (humanLabel) labels.push(REVIEW_LABELS.human);
          if (accepted) labels.push(REVIEW_LABELS.accepted);
          const tainted = humanRequired || humanLabel; // the PR is under the human gate
          const g = decideReviewGate({ escalate, humanRequired, labels, ...age });

          if (tainted && !accepted) {
            // the safety property: a human-gated PR with no human accept must NOT land, ever.
            expect(AUTO_MERGE_ACTIONS).not.toContain(g.action);
            // and no timeout path may resurrect (x30jq9n removed merge-anyway; the #289 hole stays closed)
            expect(g.action).not.toBe('merge-anyway');
            // the caller keys its auto-review routing on this: a tainted PR always reports humanRequired
            expect(g.humanRequired).toBe(true);
          }
          if (accepted) {
            // a human accept always wins — even over a sticky human label or a fresh human-required score
            expect(g.action).toBe('merge');
          }
        }
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// INVARIANT 3 — a red required check is NEVER mergeable. Neither the check classifier nor the PR classifier
// may ever call a PR with a failing required check landable, whatever else is true about it.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('INVARIANT 3 — a failed required check is never mergeable', () => {
  it('classifyChecks: any failing bucket ⇒ status "failed", regardless of other passed/pending rows', () => {
    const failBuckets = ['fail', 'cancel', 'timed_out', 'timeout', 'FAIL'];
    const filler = powerset([{ bucket: 'pass' }, { bucket: 'pending' }, { bucket: 'skipping' }]);
    for (const fb of failBuckets) {
      for (const rows of filler) {
        const r = classifyChecks([...rows, { bucket: fb }]);
        expect(r.status).toBe('failed');
        expect(r.status).not.toBe('passed');
      }
    }
  });
  it('classifyPr: a not-green required check ⇒ decision "skip" (never "merge"), across other signals', () => {
    const base = {
      number: 7,
      title: 'x',
      body: 'a real non-empty body',
      mergeStateStatus: 'CLEAN',
      mergeable: 'MERGEABLE',
      labels: [{ name: 'ready-to-merge' }],
      statusCheckRollup: [{ name: 'test', conclusion: 'FAILURE', status: 'COMPLETED' }],
    };
    // even fully certified + clean + mergeable + bodied, a red required check must skip
    const v = classifyPr(base);
    expect(v.decision).toBe('skip');
    expect(v.decision).not.toBe('merge');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// INVARIANT 4 — the drain is the SOLE writer to main. assertMayMerge lets ONLY caller 'drain' through; every
// other route throws unless break-glass is explicitly armed (and then it audits).
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('INVARIANT 4 — only the drain may write to main', () => {
  const nonDrainCallers = ['pr-land', 'lane-resume', 'merge', 'finish', '', 'drainish', 'DRAIN'];
  it('the drain always passes, without break-glass', () => {
    expect(assertMayMerge({ caller: 'drain', env: {} })).toEqual({ breakGlass: false });
  });
  it('every non-drain caller THROWS without break-glass', () => {
    for (const caller of nonDrainCallers) {
      expect(() => assertMayMerge({ caller, env: {} })).toThrow(/only the drain may merge/i);
    }
  });
  it('break-glass lets a non-drain caller through, but audits loudly every time', () => {
    for (const caller of nonDrainCallers) {
      const lines = [];
      const log = { write: (s) => lines.push(s) };
      const r = assertMayMerge({ caller, env: { WE_MERGE_BREAK_GLASS: '1' }, log });
      expect(r.breakGlass).toBe(true);
      expect(lines.join('')).toMatch(/BREAK-GLASS/); // never silent
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// INVARIANT 5 — the concurrent-lander backstop (#2366). A merge path that does NOT run the full rubric this
// pass must refuse any un-cleared review label; review:accepted always clears; and review:human/review:changes
// are refused even under the operator's --no-review-escalation override.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('INVARIANT 5 — hasUnclearedReviewLabel refuses un-cleared labels', () => {
  const all = [REVIEW_LABELS.pending, REVIEW_LABELS.human, REVIEW_LABELS.changes, REVIEW_LABELS.accepted];
  it('review:accepted always clears — no label set with accepted is ever refused', () => {
    for (const set of powerset(all).filter((s) => s.includes(REVIEW_LABELS.accepted))) {
      expect(hasUnclearedReviewLabel(set, { allowPending: false })).toBe(false);
      expect(hasUnclearedReviewLabel(set, { allowPending: true })).toBe(false);
    }
  });
  it('bare sweep (allowPending:false): ANY of pending/human/changes (without accepted) ⇒ refuse', () => {
    for (const set of powerset(all).filter((s) => !s.includes(REVIEW_LABELS.accepted))) {
      const hasUncleared = [REVIEW_LABELS.pending, REVIEW_LABELS.human, REVIEW_LABELS.changes].some((l) => set.includes(l));
      expect(hasUnclearedReviewLabel(set, { allowPending: false })).toBe(hasUncleared);
    }
  });
  it('operator override (allowPending:true): pending is honoured, but human/changes are STILL refused', () => {
    for (const set of powerset(all).filter((s) => !s.includes(REVIEW_LABELS.accepted))) {
      const humanOrChanges = set.includes(REVIEW_LABELS.human) || set.includes(REVIEW_LABELS.changes);
      // human/changes always refuse; a lone pending is allowed through the override
      expect(hasUnclearedReviewLabel(set, { allowPending: true })).toBe(humanOrChanges);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// INVARIANT 6 — the producer's PR-open label is consistent with the score: a POLICY-CORE or STATUTE open is
// ALWAYS review:human (never pending, never null), so a human-gated PR is human-gated from birth, not only once
// a drain sweeps it. An ENGINE (lander) open is review:pending (escalated, agent-reviewable — the #2445 flip).
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('INVARIANT 6 — producerReviewLabel matches the score across both tiers', () => {
  it('any DECLARATIVE-LEASH or STATUTE diff ⇒ producer label review:human, across noise', () => {
    for (const gateFile of [...DECLARATIVE_LEASH_FILES, ...STATUTE_FILES]) {
      for (const noise of powerset(LEAF_FILES)) {
        const score = scoreEscalation({ changedFiles: [...noise, gateFile] });
        expect(producerReviewLabel(score)).toBe(REVIEW_LABELS.human);
      }
    }
  });
  it('#2771 Fork A — a policy-tier DERIVATION-CODE diff ⇒ review:pending (committee), never review:human', () => {
    for (const gateFile of DERIVATION_CODE_FILES) {
      for (const noise of powerset(LEAF_FILES)) {
        expect(producerReviewLabel(scoreEscalation({ changedFiles: [...noise, gateFile] }))).toBe(REVIEW_LABELS.pending);
      }
    }
  });
  it('#2445 flip — an ENGINE (lander) diff ⇒ review:pending (escalated, agent-reviewable), never review:human', () => {
    for (const engineFile of ENGINE_FILES) {
      for (const noise of powerset(LEAF_FILES)) {
        expect(producerReviewLabel(scoreEscalation({ changedFiles: [...noise, engineFile] }))).toBe(REVIEW_LABELS.pending);
      }
    }
  });
  it('escalated-but-agent-reviewable ⇒ review:pending; a plain leaf ⇒ null', () => {
    expect(producerReviewLabel(scoreEscalation({ changedFiles: ['scripts/pr-land.mjs'] }))).toBe(REVIEW_LABELS.pending);
    expect(producerReviewLabel(scoreEscalation({ changedFiles: ['backlog/x.md'] }))).toBe(null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// INVARIANT 7 — a couple inherits the strictest member: one gate-self half makes the WHOLE couple human.
// Impl-first/WE-last ordering cannot tolerate half a human-gated couple slipping through.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('INVARIANT 7 — a gate-self half taints the whole couple', () => {
  it('any member humanRequired ⇒ couple humanRequired, for every member arrangement', () => {
    const members = [{ escalate: true, humanRequired: true }, { escalate: false, humanRequired: false }, { escalate: true, humanRequired: false }];
    for (const a of members) for (const b of members) {
      const expected = a.humanRequired || b.humanRequired;
      expect(coupleEscalation([a, b]).humanRequired).toBe(expected);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// INVARIANT 8 — an empty/whitespace-only PR body never lands (#2324). Both the shared body guard and the PR
// classifier refuse it, even when everything else about the PR is landable.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('INVARIANT 8 — an empty PR body never lands', () => {
  it('hasNonEmptyBody rejects every whitespace-only / absent body', () => {
    for (const b of ['', '   ', '\n\t ', undefined, null, 0]) expect(hasNonEmptyBody(b)).toBe(false);
    expect(hasNonEmptyBody('real content')).toBe(true);
  });
  it('classifyPr skips an otherwise-perfect PR with an empty body', () => {
    const v = classifyPr({
      number: 9, title: 'x', body: '   ',
      mergeStateStatus: 'CLEAN', mergeable: 'MERGEABLE',
      labels: [{ name: 'ready-to-merge' }],
      statusCheckRollup: [{ name: 'test', conclusion: 'SUCCESS', status: 'COMPLETED' }],
    });
    expect(v.decision).toBe('skip');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// INVARIANT 9 — a stale review:accepted NEVER auto-merges THROUGH decideReviewGate (#2409). A review:accepted
// verdict vouches ONLY for the tree the reviewer looked at. If the head has advanced past the reviewed
// commit-set, the acceptance is stale and this gate must NOT land it — no matter the escalation state, the
// human signal, or any other label. (This is the PR #368 hole: a second, unrelated commit honoured under an
// accept that named only the first.) SCOPE (honest): this pins the label-scoped DRAIN path, which routes
// through decideReviewGate. The bare `/merge` orphan-sweep path clears on the review:accepted LABEL alone via
// hasUnclearedReviewLabel (no SHA context) and is a documented residual, NOT covered by this invariant.
// The complementary property — an accept whose head STILL matches always merges — is pinned too, so the gate
// can never over-park (invalidate a legitimately-fresh accept). Proven over the full cross-product of inputs.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('INVARIANT 9 — a stale review:accepted never auto-merges (#2409)', () => {
  const extraLabels = powerset([REVIEW_LABELS.pending, REVIEW_LABELS.human]);
  const cases = product(
    [false, true], // escalate
    [false, true], // humanRequired
  );
  it('accepted + head ADVANCED past the reviewed SHA ⇒ never merges, for every input arrangement', () => {
    for (const [escalate, humanRequired] of cases) {
      for (const extra of extraLabels) {
        const labels = [...extra, REVIEW_LABELS.accepted];
        const g = decideReviewGate({ escalate, humanRequired, labels, acceptedSha: 'aaaaaaa', headSha: 'bbbbbbb' });
        expect(AUTO_MERGE_ACTIONS).not.toContain(g.action);
        expect(g.staleAcceptance).toBe(true);
      }
    }
  });
  it('accepted + head STILL matches the reviewed SHA ⇒ always merges (never over-parks a fresh accept)', () => {
    for (const [escalate, humanRequired] of cases) {
      for (const extra of extraLabels) {
        const labels = [...extra, REVIEW_LABELS.accepted];
        const g = decideReviewGate({ escalate, humanRequired, labels, acceptedSha: 'abc1234', headSha: 'abc1234' });
        expect(g.action).toBe('merge');
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// INVARIANT 12 — THE LEASH SPLIT IS FAIL-CLOSED AND CANNOT SHRINK (#2771/#2785, pinned permanent by #2840
// trigger 3). The whole point of the narrowing is that a change to the ENCODED POLICY still reaches a human
// while its IMPLEMENTATION does not. Those two guarantees are only as good as the roster's classification, so
// this block pins the classification itself: the ratified leash floor is always human, the split partitions the
// policy tier exactly, every policy member declares its side explicitly, and an UNCLASSIFIED member falls to
// HUMAN rather than to the committee. A diff that has to weaken an assertion here is, by definition, moving the
// human boundary — the one class of change a human must look at.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('INVARIANT 12 — the declarative-leash split is fail-closed and its floor cannot shrink', () => {
  it('every basename #2771 ratified as the declarative leash is STILL in POLICY_SPEC_BASENAMES', () => {
    for (const f of RATIFIED_POLICY_SPEC_FLOOR) {
      expect(POLICY_SPEC_BASENAMES.has(f)).toBe(true);   // dropping one would let an agent clear a policy change
      expect(POLICY_DERIVATION_BASENAMES.has(f)).toBe(false);
      expect(isPolicySpecPath(`any/relocated/dir/${f}`)).toBe(true); // the floor travels, like every other member
    }
  });
  it('every POLICY-tier member declares a VALID leash — an omission or a typo is a failing test, not a silent default', () => {
    for (const m of TRUST_CHAIN.filter((e) => e.tier === 'policy')) {
      expect([POLICY_LEASH.SPEC, POLICY_LEASH.CODE], `roster entry '${m.role}' must declare leash`).toContain(m.leash);
    }
  });
  it('an ENGINE-tier member never carries a leash (the field is meaningless off the policy tier)', () => {
    for (const m of TRUST_CHAIN.filter((e) => e.tier === 'engine')) expect(m.leash).toBeUndefined();
  });
  it('the two halves PARTITION the policy tier exactly — nothing lost, nothing double-counted', () => {
    const union = new Set([...POLICY_SPEC_BASENAMES, ...POLICY_DERIVATION_BASENAMES]);
    expect([...union].sort()).toEqual([...POLICY_CORE_BASENAMES].sort());
    for (const f of POLICY_SPEC_BASENAMES) expect(POLICY_DERIVATION_BASENAMES.has(f)).toBe(false);
    // …and every member of BOTH halves is still a trust-chain path, so both still ESCALATE.
    for (const f of union) expect(isTrustChainPath(f)).toBe(true);
  });
  it('FAIL-CLOSED — an unclassified / misspelled policy leash resolves to the HUMAN half, never the committee', () => {
    // The derivation predicate is `leash === 'code'` and the spec predicate is its complement WITHIN the policy
    // tier, so every value that is not exactly 'code' lands on the human side. Proven over the shapes a bad edit
    // actually produces rather than by re-reading the source.
    for (const bad of [undefined, null, '', 'CODE', 'Code', 'derivation', 'impl', 'spec ', 0, false, {}]) {
      const entry = { role: 'hypothetical', file: 'hypothetical.mjs', tier: 'policy', leash: bad };
      const specSide = entry.tier === 'policy' && entry.leash !== POLICY_LEASH.CODE;
      expect(specSide, `leash ${JSON.stringify(bad)} must fall to the HUMAN half`).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// INVARIANT 13 — THE CODIFICATION EXEMPTION ONLY EVER FIRES ON PROOF (#2771 Fork B). A statute edit drops off
// the human gate iff the diff PROVES it merely records an already-ruled decision. Everything else — no diff, a
// partial diff, a rewritten rule, a smuggled second anchor, an ordinary (non-decision) resolve — stays human.
// The bad direction here is a false POSITIVE (a real new rule cleared by agents), so the sweep below is written
// as "these all stay human" with a single positive case, not the other way round.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('INVARIANT 13 — a statute edit leaves the human gate only on a PROVEN codification shape', () => {
  const ANCHOR = 'some-ratified-rule';
  const decisionResolve = [
    'diff --git a/backlog/2771-a-decision.md b/backlog/2771-a-decision.md',
    '--- a/backlog/2771-a-decision.md',
    '+++ b/backlog/2771-a-decision.md',
    '@@ -1,6 +1,7 @@',
    ' ---',
    ' kind: decision',
    '-status: open',
    '+status: resolved',
    `+codifiedIn: "docs/agent/platform-decisions.md#${ANCHOR}"`,
    ' ---',
  ].join('\n');
  const anchorAddition = [
    'diff --git a/docs/agent/platform-decisions.md b/docs/agent/platform-decisions.md',
    '--- a/docs/agent/platform-decisions.md',
    '+++ b/docs/agent/platform-decisions.md',
    '@@ -100,3 +100,5 @@',
    ' previous rule body',
    '+',
    `+### Some ratified rule {#${ANCHOR}}`,
    '+',
    '+**Ratified 2026-08-08 by the operator.** The body of the rule.',
  ].join('\n');
  const STATUTE = 'docs/agent/platform-decisions.md';
  const files = [STATUTE, 'backlog/2771-a-decision.md'];
  const score = (diffText, changedFiles = files) => scoreEscalation({ changedFiles, diffText });

  it('the PROVEN shape (resolve+codifiedIn AND only that anchor added) ⇒ escalates, committee, NOT human', () => {
    const r = score(`${decisionResolve}\n${anchorAddition}`);
    expect(r.escalate).toBe(true);
    expect(r.humanRequired).toBe(false);
    expect(producerReviewLabel(r)).toBe(REVIEW_LABELS.pending);
    expect(r.reasons.join(' ')).toMatch(/codification/);
  });

  const refusals = {
    'no diff text at all (the default — absence of proof is not proof)': null,
    'an empty diff': '',
    'the statute edit ALONE, with no decision resolve (an author writing a NEW rule)': anchorAddition,
    'the resolve ALONE, with the statute file unaccounted for in the diff': decisionResolve,
    'a REMOVED line in the statute file (rewriting existing rule text)': `${decisionResolve}\n${anchorAddition}\n-an existing rule line`,
    'an added anchor the resolve never named (the smuggled-rule case)': `${decisionResolve}\n${anchorAddition}\n+### Sneaky extra {#a-rule-nobody-ratified}`,
    'an added statute body with NO anchor heading (an unprovable pure extension)': [decisionResolve,
      'diff --git a/docs/agent/platform-decisions.md b/docs/agent/platform-decisions.md',
      '@@ -100,1 +100,2 @@', ' body', '+a quietly appended sentence'].join('\n'),
    'a non-DECISION item resolve (an ordinary story must not license a statute edit)':
      `${decisionResolve.replace('kind: decision', 'kind: story')}\n${anchorAddition}`,
    'an item that was ALREADY resolved (no non-resolved status removed)':
      `${decisionResolve.replace('-status: open', '-someOtherField: x')}\n${anchorAddition}`,
    // ── the POSITIONAL half of condition (ii) (#2785 review-fix). Each of the four below has ZERO removals and
    // adds ONLY the anchor heading the resolve names — they pass the anchor-NAME test verbatim. What refuses
    // them is WHERE the added lines sit: only a single contiguous append that opens with the named heading and
    // runs to the end of the document proves the addition belongs to that anchor's own section. The real-diff
    // proof of the same four rows, driven end-to-end through the producer, is in pr-land.test.mjs.
    'added prose ABOVE the new anchor heading (it attaches to the PRECEDING rule, not the new one)':
      `${decisionResolve}\n${anchorAddition.replace(' previous rule body\n+', ' previous rule body\n+A smuggled amendment to the rule above.\n+')}`,
    'the new anchor heading followed by PRE-EXISTING context (inserted mid-file, annexing the rule below it)':
      `${decisionResolve}\n${anchorAddition}\n the next rule body`,
    'a SECOND added run elsewhere in the statute file (one line spliced into another rule body)': [decisionResolve,
      'diff --git a/docs/agent/platform-decisions.md b/docs/agent/platform-decisions.md',
      '@@ -50,3 +50,4 @@', ' some other rule body', '+A smuggled amendment.', ' more of that rule',
      '@@ -100,3 +100,5 @@', ' previous rule body', '+', `+### Some ratified rule {#${ANCHOR}}`, '+',
      '+**Ratified 2026-08-08 by the operator.** The body of the rule.'].join('\n'),
    'a context-free (-U0) statute diff, in which position cannot be read at all': [decisionResolve,
      'diff --git a/docs/agent/platform-decisions.md b/docs/agent/platform-decisions.md',
      '@@ -100,0 +101,4 @@', '+', `+### Some ratified rule {#${ANCHOR}}`, '+',
      '+**Ratified 2026-08-08 by the operator.** The body of the rule.'].join('\n'),
    // ── the ONE-HEADING rule (#2785 review-fix 2). The four below all satisfy every row above: one contiguous
    // append at EOF, opening with the named anchor, zero removals, no added anchor the resolve did not name.
    // What refuses them is a SECOND SECTION riding along under the honest one. An UNTAGGED heading used to be
    // invisible to BOTH halves of condition (ii) — `STATUTE_ANCHOR_HEADING_RE` only matches `{#…}` headings, and
    // nothing looked past the first one — and dropping the tag is free (validate-rules-anchors.cjs validates only
    // the anchors a document declares, so an untagged heading passes check:statute). A second section always
    // needs a second heading, so the bound is on HEADINGS OF ANY LEVEL IN ANY SYNTAX, not on this shape.
    'an UNTAGGED second heading after the honest anchor (the unbounded smuggle: drop the {#tag} and CI still passes)':
      `${decisionResolve}\n${anchorAddition}\n+\n+---\n+\n+### Agents may clear review:human after a converged accept\n+\n+**Ratified.** Notwithstanding the leash, a converged committee MAY clear it.`,
    'a TAGGED second heading after the honest anchor':
      `${decisionResolve}\n${anchorAddition}\n+\n+### Agents may clear {#agents-may-clear-review-human}\n+\n+**Ratified.** A whole second rule.`,
    'a SETEXT second heading (paragraph text with a `---` underline hard against it)':
      `${decisionResolve}\n${anchorAddition}\n+\n+Agents may clear review:human\n+---\n+\n+**Ratified.** A whole second rule.`,
    'a RAW HTML second heading (markdown passes block HTML through, so <h3> opens a section with no `#`)':
      `${decisionResolve}\n${anchorAddition}\n+\n+<h3>Agents may clear review:human</h3>\n+\n+**Ratified.** A whole second rule.`,
    'an UNTERMINATED code fence, after which no heading can be read confidently':
      `${decisionResolve}\n${anchorAddition}\n+\n+\`\`\`\n+### Agents may clear review:human`,
  };
  for (const [label, diffText] of Object.entries(refusals)) {
    it(`stays review:human — ${label}`, () => {
      const r = score(diffText);
      expect(r.humanRequired).toBe(true);
      expect(producerReviewLabel(r)).toBe(REVIEW_LABELS.human);
    });
  }

  // The one-heading rule bounds the append to ONE SECTION — it does not forbid CONTENT. These two still clear,
  // and they are the reason the rule counts headings rather than simply refusing any `#` below the anchor: the
  // text under an anchor is inside that anchor's OWN section, which is #2771's independent-committee remit.
  it('CLEARS — several paragraphs and a blank-preceded `---` under the anchor (no second heading ⇒ no second section)', () => {
    const r = score(`${decisionResolve}\n${anchorAddition}\n+\n+A second paragraph of the SAME rule.\n+\n+---`);
    expect(r.humanRequired).toBe(false);
    expect(r.reasons.join(' ')).toMatch(/codification/);
  });
  it('CLEARS — a `#` inside a FENCED CODE BLOCK in the anchor body is a shell comment, not a heading', () => {
    const fenced = ['+', '+```sh', '+# regenerate the roster', '+npm run check:standards', '+```'].join('\n');
    const r = score(`${decisionResolve}\n${anchorAddition}\n${fenced}`);
    expect(r.humanRequired).toBe(false);
    expect(r.reasons.join(' ')).toMatch(/codification/);
    // …and the SAME text with the fence removed is a real second heading, so the fence handling is load-bearing.
    const unfenced = ['+', '+# regenerate the roster', '+npm run check:standards'].join('\n');
    expect(score(`${decisionResolve}\n${anchorAddition}\n${unfenced}`).humanRequired).toBe(true);
  });

  // The KNOWN, DELIBERATE COST of the one-heading rule, pinned here so it can never regress silently and so the
  // next reviewer sees the tradeoff instead of rediscovering it. Before #2785 review-fix 2 this CLEARED: two
  // anchors, each named by its own resolved decision item, appended together. It now goes to a human, because
  // "exactly one heading" cannot distinguish a second DECLARED anchor from a second smuggled one by SHAPE — only
  // by the resolve that accompanies it, and the attacker writes that half of the diff too. Relaxing this to
  // "every heading must be an anchor the resolve named" is a one-line change in `isSingleAnchorAppend`; it is
  // deliberately NOT taken, because the cost of refusing is one human review of a rare multi-decision batch and
  // the cost of accepting is a second rule riding in on a fabricated companion resolve.
  it('KNOWN OVER-REFUSAL — two honest anchors in ONE append, each named by its own resolve, still goes to a human', () => {
    const second = decisionResolve
      .replace(/2771-a-decision/g, '2772-another-decision')
      .replace(`#${ANCHOR}`, '#a-second-ratified-rule');
    const both = `${anchorAddition}\n+\n+### A second ratified rule {#a-second-ratified-rule}\n+\n+Its body.`;
    const r = score(`${decisionResolve}\n${second}\n${both}`,
      [...files, 'backlog/2772-another-decision.md']);
    expect(r.humanRequired).toBe(true);
  });

  it('a SECOND statute doc in the diff basis is never exempted, however clean the codify shape looks', () => {
    const r = score(`${decisionResolve}\n${anchorAddition}`, [...files, 'docs/agent/2026-06-example-statute.md']);
    expect(r.humanRequired).toBe(true);
  });
  it('isCodificationOnly is itself fail-closed on junk input', () => {
    for (const bad of [undefined, null, 0, {}, [], 'not a diff at all']) {
      expect(isCodificationOnly({ diffText: bad, changedFiles: files })).toBe(false);
    }
    expect(isCodificationOnly({ diffText: `${decisionResolve}\n${anchorAddition}`, changedFiles: [] })).toBe(false);
  });
});
