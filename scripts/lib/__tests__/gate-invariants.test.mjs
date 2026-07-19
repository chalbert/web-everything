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
} from '../review-escalation.mjs';
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

// #2445 two-tier flip — the trust chain has two tiers. POLICY-CORE files (the leash-defining code) force
// review:human; ENGINE files (the lander, which obeys the gate) escalate + run the panel but a converged agent
// verdict may clear them.
const POLICY_CORE_FILES = [
  'scripts/lib/review-escalation.mjs',
  'scripts/lib/review-core.mjs',              // the converge-vs-human disposition router + round caps
  'scripts/lib/review-policy.contract.json',  // #2566 — the review-escalation policy SPEC; a diff here is a policy change
  'scripts/lib/review-policy.mjs',            // #2566 — the spec loader + executable oracle
  'scripts/lib/__tests__/review-policy.conformance.test.mjs', // #2566 — the conformance bridge (weakening it is a spec change)
  'scripts/lib/gate-config.mjs',              // #2448 — the trust-chain roster; editing it is gate-self (the closure)
  'scripts/lib/__tests__/gate-invariants.test.mjs', // THIS file — self-referenced (see header)
];
const ENGINE_FILES = [
  'scripts/merge-ai-prs.mjs',                 // the lander — obeys the gate, so agent-reviewable (#2445 flip)
  'frontierui/scripts/merge-ai-prs.mjs',      // a repo-prefixed clone path still counts
];
// The STATUTE layer (#2412) — governance rules a human must ratify; forces review:human like the policy tier.
const STATUTE_FILES = ['docs/agent/platform-decisions.md', 'docs/agent/2026-06-example-statute.md'];
// #2448 — a trust-chain member RELOCATED out of we:scripts/ (the #2445 coordinator: a plateau-app module, a
// package dir, or its own repo). Basename-matched, so the TIER travels: a relocated POLICY file stays human, a
// relocated ENGINE file still escalates (it can never silently drop out of review) but stays agent-reviewable.
const RELOCATED_POLICY_FILES = [
  'plateau-app/tools/loop/review-escalation.mjs',   // policy, extracted next to the dev-panel → still human
  'plateau-loop/gate/gate-config.mjs',              // policy, its own repo → still human
];
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
    [3, 10],         // prNum: non-sampled and sampled
  );
  it('every POLICY-CORE path is classified gate-self (human); every ENGINE path is NOT', () => {
    for (const f of POLICY_CORE_FILES) expect(isGateSelfPath(f)).toBe(true);
    for (const f of ENGINE_FILES) expect(isGateSelfPath(f)).toBe(false);
  });
  it('POLICY-CORE ⇒ humanRequired across arbitrary other signals + noise', () => {
    for (const gateFile of POLICY_CORE_FILES) {
      for (const noise of powerset(LEAF_FILES)) {
        for (const [diffLines, dismissedFindings, crossRepo, prNum] of noiseSignals) {
          const r = scoreEscalation({ changedFiles: [...noise, gateFile], diffLines, dismissedFindings, crossRepo, prNum });
          expect(r.humanRequired).toBe(true); // leash-defining code — never falls to agent-reviewable
          expect(r.escalate).toBe(true);
        }
      }
    }
  });
  it('the STATUTE layer ⇒ humanRequired (a governance rule a human must ratify, #2412)', () => {
    for (const s of STATUTE_FILES) {
      expect(isStatutePath(s)).toBe(true);
      for (const noise of powerset(LEAF_FILES)) {
        const r = scoreEscalation({ changedFiles: [...noise, s], prNum: 3 });
        expect(r.humanRequired).toBe(true);
        expect(r.escalate).toBe(true);
      }
    }
  });
  it('#2445 flip — an ENGINE (lander) edit ESCALATES but is NOT humanRequired (agent-reviewable)', () => {
    for (const engineFile of ENGINE_FILES) {
      for (const noise of powerset(LEAF_FILES)) {
        for (const [diffLines, dismissedFindings, crossRepo, prNum] of noiseSignals) {
          const r = scoreEscalation({ changedFiles: [...noise, engineFile], diffLines, dismissedFindings, crossRepo, prNum });
          expect(r.escalate).toBe(true);        // the lander always gets an independent review
          expect(r.humanRequired).toBe(false);  // but a converged agent verdict may clear it — the flip
        }
      }
    }
  });
  it('#2448/#2445 — the tier TRAVELS: a relocated POLICY file stays human; a relocated ENGINE file escalates but stays agent-reviewable', () => {
    for (const moved of RELOCATED_POLICY_FILES) {
      expect(isGateSelfPath(moved)).toBe(true);
      for (const noise of powerset(LEAF_FILES)) {
        const r = scoreEscalation({ changedFiles: [...noise, moved], diffLines: 0, prNum: 3 });
        expect(r.humanRequired).toBe(true); // the coordinator can never auto-clear a change to its own leash
        expect(r.escalate).toBe(true);
      }
    }
    for (const moved of RELOCATED_ENGINE_FILES) {
      expect(isGateSelfPath(moved)).toBe(false);
      for (const noise of powerset(LEAF_FILES)) {
        const r = scoreEscalation({ changedFiles: [...noise, moved], diffLines: 0, prNum: 3 });
        expect(r.humanRequired).toBe(false);
        expect(r.escalate).toBe(true); // still escalates even though a package path no longer matches ^scripts/
      }
    }
  });
  it('a diff with NO policy/statute path is never humanRequired (the converse — no false human-gating)', () => {
    for (const files of powerset(LEAF_FILES)) {
      for (const prNum of [1, 3, 10]) {
        expect(scoreEscalation({ changedFiles: files, diffLines: 999, dismissedFindings: 9, crossRepo: true, prNum }).humanRequired).toBe(false);
      }
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
  it('any POLICY-CORE or STATUTE diff ⇒ producer label review:human, across noise', () => {
    for (const gateFile of [...POLICY_CORE_FILES, ...STATUTE_FILES]) {
      for (const noise of powerset(LEAF_FILES)) {
        const score = scoreEscalation({ changedFiles: [...noise, gateFile], prNum: 3 });
        expect(producerReviewLabel(score)).toBe(REVIEW_LABELS.human);
      }
    }
  });
  it('#2445 flip — an ENGINE (lander) diff ⇒ review:pending (escalated, agent-reviewable), never review:human', () => {
    for (const engineFile of ENGINE_FILES) {
      for (const noise of powerset(LEAF_FILES)) {
        expect(producerReviewLabel(scoreEscalation({ changedFiles: [...noise, engineFile], prNum: 3 }))).toBe(REVIEW_LABELS.pending);
      }
    }
  });
  it('escalated-but-agent-reviewable ⇒ review:pending; a plain leaf ⇒ null', () => {
    expect(producerReviewLabel(scoreEscalation({ changedFiles: ['scripts/pr-land.mjs'], prNum: 3 }))).toBe(REVIEW_LABELS.pending);
    expect(producerReviewLabel(scoreEscalation({ changedFiles: ['backlog/x.md'], prNum: 3 }))).toBe(null);
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
