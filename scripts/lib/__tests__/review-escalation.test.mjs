/**
 * @file review-escalation.test.mjs — proof of the #2171 deterministic drain review-escalation rubric: the
 *   SCORER (which signals escalate), the COUPLE rule (strictest member wins), and the non-blocking REVIEW
 *   gate (park / merge / wait-author — no timeout, x30jq9n). All pure — the drain supplies signals + labels.
 */
import { describe, it, expect } from 'vitest';
import {
  REVIEW_LABELS,
  REVIEW_LABEL_META,
  DEFAULT_THRESHOLDS,
  isBlastRadiusPath,
  isGateSelfPath,
  scoreEscalation,
  coupleEscalation,
  hasReviewLabel,
  decideReviewGate,
  producerReviewLabel,
  shouldApplyReviewLabel,
  CARE_LEVELS,
  CARE_LEVEL_ORDER,
  deriveCareLevel,
} from '../review-escalation.mjs';

describe('isBlastRadiusPath', () => {
  it('flags tooling / skills / hooks / CI / statute / standards-defs', () => {
    for (const p of [
      'scripts/merge-ai-prs.mjs',
      '.claude/skills/drain/SKILL.md',
      '.githooks/pre-push',
      '.github/workflows/ci.yml',
      'docs/agent/platform-decisions.md',
      'src/_data/blocks.json',
    ]) expect(isBlastRadiusPath(p)).toBe(true);
  });
  it('does NOT flag a leaf edit (a backlog file, a demo, a component)', () => {
    for (const p of ['backlog/2171-x.md', 'demos/declarative-spa.html', 'src/_data/other.json']) {
      expect(isBlastRadiusPath(p)).toBe(false);
    }
  });

  // #2479 (sibling to #2448/#2480) — the blast-radius surface TRAVELS with the delivery engine on extraction.
  describe('#2479 — relocatable engine files trip blast-radius by BASENAME wherever they land', () => {
    it('a RELOCATED engine file still trips (basename travels out of we:scripts/), an unrelated file does not', () => {
      // pr-land / lane-drain / lane-pool extracted into the #2445 coordinator (plateau-app or a package) still escalate
      for (const p of ['plateau-app/tools/loop/pr-land.mjs', 'packages/plateau-loop/src/lane-drain.mjs',
                       'plateau-app/tools/loop/lane-pool.mjs', 'packages/plateau-loop/src/review-set-label.mjs']) {
        expect(isBlastRadiusPath(p)).toBe(true);
      }
      // an UNRELATED relocated file (a feature module, an unregistered lib) must NOT trip — the basename is the boundary
      for (const p of ['plateau-app/src/some-feature.mjs', 'packages/plateau-loop/src/unrelated-helper.mjs']) {
        expect(isBlastRadiusPath(p)).toBe(false);
      }
    });
    it('a WE-ONLY script does NOT travel (it stays `^scripts/`-matched only) — the precise which-travels boundary', () => {
      // in WE, a WE-only script escalates via the `^scripts/` literal…
      expect(isBlastRadiusPath('scripts/check-standards.mjs')).toBe(true);
      // …but it is NOT registered to travel: relocated, it correctly stops tripping (WE is its permanent home).
      expect(isBlastRadiusPath('plateau-app/tools/check-standards.mjs')).toBe(false);
    });
    it('scoreEscalation escalates end-to-end for a relocated engine file, and not for an unrelated relocated file', () => {
      expect(scoreEscalation({ changedFiles: ['plateau-app/tools/loop/pr-land.mjs'] }).escalate).toBe(true);
      expect(scoreEscalation({ changedFiles: ['plateau-app/src/some-feature.mjs'] }).escalate).toBe(false);
    });
  });
});

describe('isGateSelfPath — the POLICY tier of the trust chain (#2285 v1, #2448, #2445 two-tier flip)', () => {
  it('flags the POLICY-CORE files (rubric, router, roster, invariants) — human-required', () => {
    expect(isGateSelfPath('scripts/lib/review-escalation.mjs')).toBe(true);
    expect(isGateSelfPath('scripts/lib/review-core.mjs')).toBe(true);
    expect(isGateSelfPath('scripts/lib/gate-config.mjs')).toBe(true);           // #2448 — the roster (the closure)
    expect(isGateSelfPath('scripts/lib/__tests__/gate-invariants.test.mjs')).toBe(true);
  });
  it('#2445 flip — does NOT flag the ENGINE tier (the lander): it obeys the gate, so it is agent-reviewable', () => {
    expect(isGateSelfPath('scripts/merge-ai-prs.mjs')).toBe(false);
    expect(isGateSelfPath('frontierui/scripts/merge-ai-prs.mjs')).toBe(false);
  });
  it('#2448/#2445 — the TIER travels with the basename: a relocated POLICY file still matches, a relocated ENGINE file does not', () => {
    for (const p of ['plateau-app/tools/loop/review-escalation.mjs', 'plateau-loop/gate/gate-config.mjs']) {
      expect(isGateSelfPath(p)).toBe(true);   // policy tier stays human wherever it lands
    }
    expect(isGateSelfPath('packages/plateau-loop/src/merge-ai-prs.mjs')).toBe(false); // engine stays agent-reviewable
  });
  it('does NOT flag other blast-radius code — those stay agent-reviewable', () => {
    for (const p of ['scripts/pr-land.mjs', 'scripts/lane-pool.mjs', '.claude/skills/drain/SKILL.md',
                     'src/_data/blocks.json', 'scripts/lib/rebase-drop-manifest.mjs']) {
      expect(isGateSelfPath(p)).toBe(false);
    }
  });
});

describe('scoreEscalation', () => {
  it('a small leaf change with no dismissals → NO escalation', () => {
    const r = scoreEscalation({ changedFiles: ['backlog/2171-x.md'], diffLines: 20 });
    expect(r.escalate).toBe(false);
    expect(r.reasons).toEqual([]);
  });
  it('a blast-radius file escalates', () => {
    const r = scoreEscalation({ changedFiles: ['scripts/pr-land.mjs'] });
    expect(r.escalate).toBe(true);
    expect(r.reasons.join(' ')).toMatch(/blast-radius/);
  });
  it('size threshold escalates (≥ default 400 changed lines)', () => {
    expect(scoreEscalation({ diffLines: 400 }).escalate).toBe(true);
    expect(scoreEscalation({ diffLines: 399 }).escalate).toBe(false);
  });
  it('a dismissed pre-PR review finding is the strongest signal — escalates on ≥1', () => {
    const r = scoreEscalation({ dismissedFindings: 1 });
    expect(r.escalate).toBe(true);
    expect(r.reasons.join(' ')).toMatch(/dismissed-findings/);
  });
  it('a cross-repo couple escalates', () => {
    expect(scoreEscalation({ crossRepo: true }).escalate).toBe(true);
  });
  it('#xlno40g — a clean PR NEVER escalates on PR number: there is no random/sampling floor', () => {
    // Every prNum used to matter (a 1-in-N floor parked every Nth PR for nothing). It is gone: a clean,
    // signal-free change never escalates, whatever its number would have been.
    for (const n of [7, 10, 20, 100, 1000]) {
      const r = scoreEscalation({ changedFiles: ['backlog/x.md'], diffLines: 20, prNum: n });
      expect(r.escalate).toBe(false);
      expect(r.reasons).toEqual([]);
      expect(r.signals.sampled).toBeUndefined();
    }
    // A stray sampleNth threshold is inert too — nothing reads it anymore.
    expect(scoreEscalation({ diffLines: 20, thresholds: { sampleNth: 5 } }).escalate).toBe(false);
  });
  it('collects EVERY firing reason (multiple signals compound)', () => {
    const r = scoreEscalation({ changedFiles: ['scripts/x.mjs'], diffLines: 500, dismissedFindings: 2, crossRepo: true });
    expect(r.reasons.length).toBe(4);
  });
  it('humanRequired for POLICY-CORE or STATUTE, but NOT for the ENGINE lander (#2445 two-tier flip)', () => {
    // a policy-core file → escalate AND humanRequired
    const policy = scoreEscalation({ changedFiles: ['scripts/lib/review-core.mjs'] });
    expect(policy.escalate).toBe(true);
    expect(policy.humanRequired).toBe(true);
    expect(policy.reasons.join(' ')).toMatch(/gate-self/);
    // the statute layer → escalate AND humanRequired (#2412)
    const statute = scoreEscalation({ changedFiles: ['docs/agent/platform-decisions.md'] });
    expect(statute.escalate).toBe(true);
    expect(statute.humanRequired).toBe(true);
    expect(statute.reasons.join(' ')).toMatch(/statute/);
    // the ENGINE lander → escalates but agent-reviewable (NOT humanRequired) — the flip
    const lander = scoreEscalation({ changedFiles: ['scripts/merge-ai-prs.mjs'] });
    expect(lander.escalate).toBe(true);
    expect(lander.humanRequired).toBe(false);
    // other blast-radius → escalates but agent-reviewable (NOT humanRequired)
    const other = scoreEscalation({ changedFiles: ['scripts/pr-land.mjs'] });
    expect(other.escalate).toBe(true);
    expect(other.humanRequired).toBe(false);
    // a plain leaf → neither
    expect(scoreEscalation({ changedFiles: ['backlog/x.md'] }).humanRequired).toBe(false);
  });
});

describe('coupleEscalation — the strictest member wins', () => {
  it('escalates if ANY member escalates (half a couple never merges alone)', () => {
    const r = coupleEscalation([{ escalate: false, reasons: [] }, { escalate: true, reasons: ['blast-radius (scripts/x)'] }]);
    expect(r.escalate).toBe(true);
    expect(r.reasons).toContain('blast-radius (scripts/x)');
  });
  it('no member escalates → couple does not', () => {
    expect(coupleEscalation([{ escalate: false }, { escalate: false }]).escalate).toBe(false);
  });
  it('humanRequired inherits too — one gate-self half makes the whole couple human (#2285 v1)', () => {
    const r = coupleEscalation([{ escalate: true, humanRequired: false }, { escalate: true, humanRequired: true }]);
    expect(r.humanRequired).toBe(true);
    expect(coupleEscalation([{ escalate: true, humanRequired: false }, { escalate: false }]).humanRequired).toBe(false);
  });
  it('de-dupes shared reasons across members', () => {
    const r = coupleEscalation([{ escalate: true, reasons: ['cross-repo impl+WE couple'] }, { escalate: true, reasons: ['cross-repo impl+WE couple'] }]);
    expect(r.reasons).toEqual(['cross-repo impl+WE couple']);
  });
});

describe('decideReviewGate — the non-blocking review gate', () => {
  it('not escalated → merge immediately', () => {
    expect(decideReviewGate({ escalate: false }).action).toBe('merge');
  });
  it('escalated + review:accepted → merge', () => {
    expect(decideReviewGate({ escalate: true, labels: [{ name: REVIEW_LABELS.accepted }] }).action).toBe('merge');
  });
  it('escalated + review:changes → wait for the author lane', () => {
    expect(decideReviewGate({ escalate: true, labels: [REVIEW_LABELS.changes] }).action).toBe('wait-author');
  });
  // #2365 follow-up: the wait-author branch precedes the human gate, so a gate-self PR that ALSO carries
  // review:changes must still report humanRequired:true — the caller (merge-ai-prs.mjs) keys the drain's
  // auto-review routing on gate.humanRequired; false here would let an agent panel clear a gate-self edit a
  // human bounced (the exact conflict-of-interest #2362 closes).
  it('wait-author still reports humanRequired for a gate-self PR carrying review:changes (#2365)', () => {
    // fresh gate-self score + review:changes
    expect(decideReviewGate({ escalate: true, humanRequired: true, labels: [REVIEW_LABELS.changes] }).humanRequired).toBe(true);
    // sticky review:human label + review:changes (fresh score narrowed to false on rebase)
    expect(decideReviewGate({ escalate: true, humanRequired: false, labels: [REVIEW_LABELS.changes, REVIEW_LABELS.human] }).humanRequired).toBe(true);
    // a plain (non-gate-self) review:changes stays agent-routable — humanRequired falsy
    expect(decideReviewGate({ escalate: true, humanRequired: false, labels: [REVIEW_LABELS.changes] }).humanRequired).toBeFalsy();
  });
  it('escalated, no verdict → park alive (apply review:pending), never block', () => {
    const g = decideReviewGate({ escalate: true });
    expect(g.action).toBe('park');
    expect(g.applyLabel).toBe(REVIEW_LABELS.pending);
  });
  // x30jq9n (resolving #2412 Gap 1) — the 30-min merge-anyway window is REMOVED: a park never times out to an
  // auto-merge, and stale park-age inputs (a caller still passing the retired params) must not resurrect it.
  it('a park NEVER times out — legacy park-age params are ignored, the action stays park', () => {
    const g = decideReviewGate({ escalate: true, parkedSinceMs: 0, nowMs: 999 * 60_000, windowMs: 60_000 });
    expect(g.action).toBe('park');
    expect(g.applyLabel).toBe(REVIEW_LABELS.pending);
  });

  // #2285 v1 — the human-required conflict-of-interest gate.
  it('humanRequired → parks under review:human (an agent may not clear a gate-self edit)', () => {
    const g = decideReviewGate({ escalate: true, humanRequired: true });
    expect(g.action).toBe('park');
    expect(g.applyLabel).toBe(REVIEW_LABELS.human);
    expect(g.humanRequired).toBe(true);
  });
  it('humanRequired + review:accepted → merge (a human verdict still wins)', () => {
    expect(decideReviewGate({ escalate: true, humanRequired: true, labels: [REVIEW_LABELS.accepted] }).action).toBe('merge');
  });

  // #2362 — the review:human LABEL is a STICKY veto: a PR ALREADY carrying it must never merge even when this
  // pass's fresh score no longer classifies it human-required (the #289 regression: a gate-self file dropped
  // out of the diff on rebase, so the re-score returned humanRequired:false and it rode the since-removed
  // merge-anyway window to land).
  it('review:human LABEL vetoes merge even when the fresh score is humanRequired:false', () => {
    const g = decideReviewGate({ escalate: true, humanRequired: false, labels: [REVIEW_LABELS.human] });
    expect(g.action).toBe('park');
    expect(g.applyLabel).toBe(REVIEW_LABELS.human);
    expect(g.humanRequired).toBe(true);
  });
  it('review:human LABEL vetoes even a DE-ESCALATED PR (escalate:false, no gate-self signal left)', () => {
    // diff narrowed so far it no longer escalates — the sticky label must still block the !escalate fast-merge.
    const g = decideReviewGate({ escalate: false, humanRequired: false, labels: [REVIEW_LABELS.human] });
    expect(g.action).toBe('park');
    expect(g.applyLabel).toBe(REVIEW_LABELS.human);
  });
  it('review:human LABEL + review:accepted → merge (a human explicitly cleared the gate, still wins first)', () => {
    expect(decideReviewGate({ escalate: true, humanRequired: false, labels: [REVIEW_LABELS.human, REVIEW_LABELS.accepted] }).action).toBe('merge');
  });
  it('review:human LABEL + review:changes → wait-author (a reviewer bounce still routes to the author lane)', () => {
    expect(decideReviewGate({ escalate: true, humanRequired: false, labels: [REVIEW_LABELS.human, REVIEW_LABELS.changes] }).action).toBe('wait-author');
  });
});

describe('hasReviewLabel + REVIEW_LABELS', () => {
  it('tolerates both string and {name} label shapes', () => {
    expect(hasReviewLabel(['review:accepted'], REVIEW_LABELS.accepted)).toBe(true);
    expect(hasReviewLabel([{ name: 'review:pending' }], REVIEW_LABELS.pending)).toBe(true);
    expect(hasReviewLabel([], REVIEW_LABELS.accepted)).toBe(false);
  });
  it('exposes the ratified verdict labels (+ the #2285 human gate, #2439 validator) + tuning knobs', () => {
    expect(REVIEW_LABELS).toEqual({ pending: 'review:pending', accepted: 'review:accepted', changes: 'review:changes', human: 'review:human', redteamAccepted: 'redteam:accepted' });
    expect(DEFAULT_THRESHOLDS.diffLines).toBeGreaterThan(0);
  });
});

describe('producerReviewLabel — #2307 the label the PRODUCER applies at PR-open (no prior park state)', () => {
  it('humanRequired → review:human (a gate-self edit always wins over a plain escalation)', () => {
    expect(producerReviewLabel({ escalate: true, humanRequired: true })).toBe(REVIEW_LABELS.human);
  });
  it('escalate but not humanRequired → review:pending', () => {
    expect(producerReviewLabel({ escalate: true, humanRequired: false })).toBe(REVIEW_LABELS.pending);
  });
  it('no escalation → null (ready-to-merge alone is enough, no review label to apply)', () => {
    expect(producerReviewLabel({ escalate: false })).toBe(null);
    expect(producerReviewLabel()).toBe(null);
  });
});

describe('shouldApplyReviewLabel — #2307 the shared no-double-apply gate (producer AND drain)', () => {
  it('no label implied → never apply', () => {
    expect(shouldApplyReviewLabel(null, [])).toBe(false);
    expect(shouldApplyReviewLabel(undefined, [REVIEW_LABELS.pending])).toBe(false);
  });
  it('a label implied but not yet on the PR → apply it (the producer at open, or the drain backstop for an older/human-pushed producer)', () => {
    expect(shouldApplyReviewLabel(REVIEW_LABELS.pending, [])).toBe(true);
    expect(shouldApplyReviewLabel(REVIEW_LABELS.human, ['some-other-label'])).toBe(true);
  });
  it('a label implied that the PR ALREADY carries → do not re-apply (no double-apply)', () => {
    expect(shouldApplyReviewLabel(REVIEW_LABELS.pending, [REVIEW_LABELS.pending])).toBe(false);
    expect(shouldApplyReviewLabel(REVIEW_LABELS.human, [{ name: REVIEW_LABELS.human }])).toBe(false);
  });
  it('a PRE-LABELLED PR is still treated as already-scored by decideReviewGate (the park is honoured, just not re-applied)', () => {
    // The producer already applied review:pending at open; a later drain pass re-scores fresh (the idempotent
    // backstop) and decideReviewGate STILL parks it (the verdict doesn't change just because it's labelled) —
    // but shouldApplyReviewLabel says there is nothing new to DO about it.
    const gate = decideReviewGate({ escalate: true, humanRequired: false, labels: [REVIEW_LABELS.pending] });
    expect(gate.action).toBe('park');
    expect(gate.applyLabel).toBe(REVIEW_LABELS.pending);
    expect(shouldApplyReviewLabel(gate.applyLabel, [REVIEW_LABELS.pending])).toBe(false);
  });
});

describe('REVIEW_LABEL_META — single source of truth for provisioning (#2279)', () => {
  it('carries valid color + description for EVERY REVIEW_LABELS value (no label mints with a placeholder)', () => {
    const names = Object.values(REVIEW_LABELS);
    // exact 1:1 coverage — no label missing (the review:human gap #2279 fixed) and no orphan meta key
    expect(new Set(Object.keys(REVIEW_LABEL_META))).toEqual(new Set(names));
    for (const name of names) {
      const meta = REVIEW_LABEL_META[name];
      expect(meta.color).toMatch(/^[0-9A-Fa-f]{6}$/); // GitHub 6-hex, no leading '#'
      expect(typeof meta.description).toBe('string');
      expect(meta.description.length).toBeGreaterThan(0);
    }
  });
});

describe('deriveCareLevel — the advisory care-level (#2567)', () => {
  it('no scored signal → none', () => {
    expect(deriveCareLevel({ signals: {} })).toBe(CARE_LEVELS.NONE);
    expect(deriveCareLevel({})).toBe(CARE_LEVELS.NONE);
  });
  it('size alone → low', () => {
    expect(deriveCareLevel({ signals: { size: 500 } })).toBe(CARE_LEVELS.LOW);
  });
  it('#xlno40g — a stray `sampled` signal contributes NOTHING (the weight is gone)', () => {
    // Random sampling is dropped: even if a caller passed a `sampled` key, it no longer moves the care score.
    expect(deriveCareLevel({ signals: { sampled: 10 } })).toBe(CARE_LEVELS.NONE);
  });
  it('blast-radius alone → elevated (system machinery)', () => {
    expect(deriveCareLevel({ signals: { blastRadius: ['scripts/x.mjs'] } })).toBe(CARE_LEVELS.ELEVATED);
  });
  it('one dismissed finding → elevated (the strongest scored signal)', () => {
    expect(deriveCareLevel({ signals: { dismissedFindings: 1 } })).toBe(CARE_LEVELS.ELEVATED);
  });
  it('MULTIPLE dismissed findings → high (a pattern, not a one-off)', () => {
    expect(deriveCareLevel({ signals: { dismissedFindings: 3 } })).toBe(CARE_LEVELS.HIGH);
  });
  it('stacked scored signals climb the bands → high', () => {
    expect(deriveCareLevel({ signals: { blastRadius: ['scripts/x.mjs'], size: 500 } })).toBe(CARE_LEVELS.HIGH);
  });
  it('cross-repo + size → elevated', () => {
    expect(deriveCareLevel({ signals: { crossRepo: true, size: 500 } })).toBe(CARE_LEVELS.ELEVATED);
  });
  it('humanRequired (gate-self / statute) is MAXIMUM care → high, regardless of scored signals', () => {
    expect(deriveCareLevel({ signals: {}, humanRequired: true })).toBe(CARE_LEVELS.HIGH);
    expect(deriveCareLevel({ signals: { size: 500 }, humanRequired: true })).toBe(CARE_LEVELS.HIGH);
  });
  it('is total — every output is a known ordered CARE_LEVELS value', () => {
    for (const sig of [{}, { crossRepo: true }, { size: 500 }, { blastRadius: ['a'] }, { dismissedFindings: 2 }]) {
      expect(CARE_LEVEL_ORDER).toContain(deriveCareLevel({ signals: sig }));
    }
  });
});

describe('scoreEscalation carries the advisory careLevel (#2567 — additive)', () => {
  it('a plain non-escalating PR → none', () => {
    expect(scoreEscalation({ changedFiles: ['backlog/x.md'], diffLines: 20 }).careLevel).toBe(CARE_LEVELS.NONE);
  });
  it('a blast-radius PR → elevated', () => {
    expect(scoreEscalation({ changedFiles: ['scripts/pr-land.mjs'] }).careLevel).toBe(CARE_LEVELS.ELEVATED);
  });
  it('a gate-self (humanRequired) PR → high', () => {
    expect(scoreEscalation({ changedFiles: ['scripts/lib/review-core.mjs'] }).careLevel).toBe(CARE_LEVELS.HIGH);
  });
  it('is ADDITIVE — the existing escalate/humanRequired/reasons/signals fields are unchanged', () => {
    const r = scoreEscalation({ changedFiles: ['scripts/pr-land.mjs'] });
    expect(r.escalate).toBe(true);
    expect(r.humanRequired).toBe(false);
    expect(Array.isArray(r.reasons)).toBe(true);
    expect(r.signals.blastRadius).toBeTruthy();
  });
});

describe('coupleEscalation inherits the STRICTEST care-level (#2567)', () => {
  it('the couple takes the highest member care-level', () => {
    const r = coupleEscalation([
      { escalate: true, careLevel: CARE_LEVELS.LOW, reasons: ['size (500 ≥ 400 changed lines)'] },
      { escalate: true, careLevel: CARE_LEVELS.HIGH, reasons: ['blast-radius (scripts/x)'] },
    ]);
    expect(r.careLevel).toBe(CARE_LEVELS.HIGH);
  });
  it('defaults a member with no careLevel to none', () => {
    expect(coupleEscalation([{ escalate: false }, { escalate: false }]).careLevel).toBe(CARE_LEVELS.NONE);
  });
});
