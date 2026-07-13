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

const GATE_SELF_FILES = [
  'scripts/lib/review-escalation.mjs',
  'scripts/merge-ai-prs.mjs',
  'scripts/lib/gate-config.mjs',              // #2448 — the trust-chain roster; editing it is gate-self (the closure)
  'frontierui/scripts/merge-ai-prs.mjs',      // a repo-prefixed clone path still counts
  'scripts/lib/__tests__/gate-invariants.test.mjs', // THIS file — self-referenced (see header)
];
// #2448 — the delivery engine, RELOCATED out of we:scripts/ (the #2445 coordinator: a plateau-app module,
// a new package dir, or its own repo). Basename-matched, so it stays gate-self across the move — the exact
// property the parent epic's red team flagged as silently lost. These are also the self-hosting boundary
// (#2285 one level up): a PR editing the relocated coordinator can never be agent-cleared.
const RELOCATED_ENGINE_FILES = [
  'plateau-app/tools/loop/review-escalation.mjs',   // extracted into plateau-app next to the dev-panel
  'packages/plateau-loop/src/merge-ai-prs.mjs',     // extracted into a package dir
  'plateau-loop/gate/gate-config.mjs',              // extracted into its own repo
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
// INVARIANT 1 — a diff that touches the gate's own trust chain is ALWAYS human-required (and escalates).
// A gate-self path can never be scored as agent-reviewable, whatever the other signals say.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('INVARIANT 1 — gate-self diff ⇒ humanRequired, universally', () => {
  it('every gate-self path is classified gate-self', () => {
    for (const f of GATE_SELF_FILES) expect(isGateSelfPath(f)).toBe(true);
  });
  it('holds across arbitrary other signals (size, dismissed, cross-repo, PR#, noise files)', () => {
    const noiseSignals = product(
      [0, 500],        // diffLines: below and above the size threshold
      [0, 3],          // dismissedFindings
      [false, true],   // crossRepo
      [3, 10],         // prNum: non-sampled and sampled
    );
    for (const gateFile of GATE_SELF_FILES) {
      for (const noise of powerset(LEAF_FILES)) {
        for (const [diffLines, dismissedFindings, crossRepo, prNum] of noiseSignals) {
          const r = scoreEscalation({ changedFiles: [...noise, gateFile], diffLines, dismissedFindings, crossRepo, prNum });
          expect(r.humanRequired).toBe(true); // the whole point — never falls to agent-reviewable
          expect(r.escalate).toBe(true);       // a gate-self file is always blast-radius too
        }
      }
    }
  });
  it('#2448 — the RELOCATED engine (extracted out of we:scripts/) is STILL humanRequired, across noise', () => {
    // The parent-epic red-team gap: once the engine leaves we:scripts/, the old path-literal regexes stop
    // matching and a trust-chain edit silently becomes agent-clearable. Basename matching closes that — a
    // member keeps tripping gate-self wherever it lands (a plateau-app module, a package dir, its own repo).
    for (const moved of RELOCATED_ENGINE_FILES) {
      expect(isGateSelfPath(moved)).toBe(true);
      for (const noise of powerset(LEAF_FILES)) {
        const r = scoreEscalation({ changedFiles: [...noise, moved], diffLines: 0, prNum: 3 });
        expect(r.humanRequired).toBe(true); // the coordinator can never auto-clear a change to itself
        expect(r.escalate).toBe(true);
      }
    }
  });
  it('a diff with NO gate-self path is never humanRequired (the converse — no false human-gating)', () => {
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
// INVARIANT 6 — the producer's PR-open label is consistent with the score: a gate-self open is ALWAYS
// review:human (never pending, never null), so a human-gated PR is human-gated from birth, not only once a
// drain sweeps it.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('INVARIANT 6 — producerReviewLabel matches the score, gate-self ⇒ review:human at open', () => {
  it('any gate-self diff ⇒ producer label review:human, across noise', () => {
    for (const gateFile of GATE_SELF_FILES) {
      for (const noise of powerset(LEAF_FILES)) {
        const score = scoreEscalation({ changedFiles: [...noise, gateFile], prNum: 3 });
        expect(producerReviewLabel(score)).toBe(REVIEW_LABELS.human);
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
