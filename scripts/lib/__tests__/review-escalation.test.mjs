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
  reconcileRoster,
  ROSTER_TIMING,
  buildReviewedShaMarker,
  parseReviewedSha,
  acceptanceCoversHead,
  normalizeDiffFingerprint,
  buildReviewedDiffMarker,
  parseReviewedDiff,
  isDeclarativeLeashPath,
  isPolicyDerivationPath,
} from '../review-escalation.mjs';
import { deriveReviewDisposition, REVIEW_DISPOSITIONS } from '../review-core.mjs';

describe('isBlastRadiusPath', () => {
  // The agent-behaviour trees (skills + agent memory) are NOT re-asserted here: every spelling of both has one
  // canonical home, the `#2909` describe block below. Adding a second fixture set here would mean a future
  // narrowing fails in two places with two narratives, and the copies drift.
  it('flags tooling / hooks / CI / statute / standards-defs', () => {
    for (const p of [
      'scripts/merge-ai-prs.mjs',
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

  // #2909 — #2266 relocated both agent-behaviour trees out of `.claude/` and left a symlink behind. Git tracks a
  // symlink as a leaf blob and never DESCENDS it, so a WE diff of a rule's CONTENT always carries the source
  // spelling. But git does emit the LINK NODE itself when the link is created / repointed / deleted, and the
  // link spelling is a real tracked directory one repo over — so all three spellings must score.
  describe('#2909 — all four spellings of the agent-behaviour trees score', () => {
    it('flags the source spelling of both relocated trees', () => {
      for (const p of [
        'skills-src/drain/SKILL.md',
        'skills-src/jury/subject-jury.workflow.js',
        'agent-memory-src/index-meta.md',
        'agent-memory-src/106-backlog_is_the_tracker.md',
      ]) expect(isBlastRadiusPath(p)).toBe(true);
    });
    // The finding the first cut of this fix missed: every pattern REQUIRED a trailing slash, so a bare tree LEAF
    // — the diff path git emits for `.claude/skills -> ../somewhere-else`, or for replacing the real `skills-src`
    // directory with a link, each a one-line commit that swaps the whole operating-procedure tree — scored
    // nothing at all. The trailing separator is now optional on BOTH anchors, so all four leaves match.
    it('flags the bare tree LEAF itself — creating/repointing/deleting a link is a diff path git really emits', () => {
      for (const p of ['.claude/skills', '.claude/agent-memory',
                       'plateau-app/.claude/skills', 'plateau-app/.claude/agent-memory',
                       'skills-src', 'agent-memory-src',
                       'plateau-app/skills-src', 'frontierui/agent-memory-src']) {
        expect(isBlastRadiusPath(p)).toBe(true);
      }
      // …and end-to-end: a 2-line commit repointing the link can no longer merge with no review label.
      const r = scoreEscalation({ changedFiles: ['.claude/skills'], diffLines: 2 });
      expect(r.escalate).toBe(true);
      expect(r.reasons.join(' ')).toMatch(/blast-radius/);
    });
    // The SYMMETRY finding: `.claude/skills/` was registered while `.claude/agent-memory/` was not, so a sibling
    // repo keeping agent memory as a REAL directory had zero coverage — the PR #1040 / PR #1043 / PR #1045 hole, relocated
    // one repo over. Both trees now share one `.claude/(skills|agent-memory)` anchor, so neither can be
    // registered without the other.
    it('flags the link spelling as a REAL directory for BOTH trees, at a repo root and cross-repo', () => {
      for (const p of ['.claude/skills/drain/SKILL.md', '.claude/agent-memory/1-rule.md',
                       'plateau-app/.claude/skills/stress-test/SKILL.md',
                       'plateau-app/.claude/agent-memory/1-rule.md']) {
        expect(isBlastRadiusPath(p)).toBe(true);
      }
    });
    it('the source trees escalate, so a skill/memory edit can never merge unreviewed (the PR #1040 hole)', () => {
      for (const p of ['skills-src/drain/SKILL.md', 'agent-memory-src/index-meta.md']) {
        const r = scoreEscalation({ changedFiles: [p], diffLines: 40 });
        expect(r.escalate).toBe(true);
        expect(r.reasons.join(' ')).toMatch(/blast-radius/);
      }
    });
    // The exact file that regressed in PR #1040 / PR #1043 / PR #1045 — the rule that defines the land bar itself.
    // All three merged with no `review:*` label; this case is the regression guard for that specific path.
    it('the land-bar memory rule that regressed in PR #1040/PR #1043/PR #1045 no longer scores {escalate:false}', () => {
      const p = 'agent-memory-src/land-on-no-regression-not-perfection.md';
      const r = scoreEscalation({ changedFiles: [p], diffLines: 12 });
      expect(r.escalate).toBe(true);
      expect(r.signals.blastRadius).toContain(p);
      expect(producerReviewLabel(r)).toBe(REVIEW_LABELS.pending); // a label at PR-open, not a silent merge
    });
    // SCOPE-NEUTRAL fixtures only. This case proves the REGEX is scoped — that the optional trailing separator
    // cannot swallow a sibling name, and that the `.claude/` anchor does not sweep the whole directory. It
    // deliberately does NOT assert anything about `.claude/settings.json`: that path registers the
    // `PreToolUse(Edit|Write)` write-gate hooks and its `false` is a KNOWN FAIL-OPEN. How wide the `.claude/`
    // net should be is a separately-filed OPEN design call, not a ratified scoping decision. Pinning it green
    // here would turn an open gap into an expectation a later reader reads as settled — and building the item
    // that widens the net would then look like deleting a passing test.
    it('stays narrow — a prose doc ABOUT memory, or a backlog item naming it, is still a leaf', () => {
      for (const p of ['docs/agent/memory-management.md', 'backlog/1234-agent-memory-thing.md',
                       'src/_data/agent-memory-notes.json',
                       '.claude/skills-notes.md',     // the optional separator must not swallow a SIBLING name…
                       '.claude/agent-memory-notes',  // …at either the file or the extension-less spelling…
                       'skills-src-notes.md',         // …and the same on the SOURCE anchor, whose separator is
                       'agent-memory-src-notes.md',   //    now optional too
                       '.claude/README.md']) {        // …and the .claude/ anchor stays scoped to the two trees:
                                                      //    an inert doc beside them is a leaf (a scope-neutral
                                                      //    fixture on purpose — see the note above)
        expect(isBlastRadiusPath(p)).toBe(false);
      }
    });
    it('both trees travel cross-repo via the (^|/) anchor, like the other agent surfaces', () => {
      for (const p of ['plateau-app/skills-src/x/SKILL.md', 'frontierui/agent-memory-src/1-rule.md']) {
        expect(isBlastRadiusPath(p)).toBe(true);
      }
    });
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
  it('flags the POLICY-CORE files (rubric, router, roster, invariants) — the tier, no longer the human trigger (#2785)', () => {
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
    for (const p of ['scripts/pr-land.mjs', 'scripts/lane-pool.mjs', 'skills-src/drain/SKILL.md',
                     'agent-memory-src/index-meta.md',
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
  it('humanRequired for the DECLARATIVE LEASH or STATUTE, but NOT for the ENGINE lander (#2445 two-tier flip)', () => {
    // a declarative-leash file (the roster) → escalate AND humanRequired (#2771/#2785)
    const policy = scoreEscalation({ changedFiles: ['scripts/lib/gate-config.mjs'] });
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

  // #2409 — the reviewed-commit gate: a review:accepted verdict only covers the tree the reviewer looked at.
  describe('#2409 — review:accepted is honoured only when the head still matches the reviewed commit', () => {
    const accepted = [{ name: REVIEW_LABELS.accepted }];
    it('accepted + head STILL matches the reviewed SHA → merge', () => {
      const g = decideReviewGate({ escalate: true, labels: accepted, acceptedSha: 'abc1234def', headSha: 'abc1234def' });
      expect(g.action).toBe('merge');
    });
    it('accepted + head ADVANCED past the reviewed SHA → park (re-park, NEVER merge)', () => {
      const g = decideReviewGate({ escalate: true, labels: accepted, acceptedSha: 'aaaaaaa', headSha: 'bbbbbbb' });
      expect(g.action).toBe('park');
      expect(g.staleAcceptance).toBe(true);
      expect(g.applyLabel).toBe(REVIEW_LABELS.pending);
      expect(g.reason).toMatch(/stale/i);
    });
    it('a stale acceptance on a gate-self/human PR re-parks review:human, not pending', () => {
      const g = decideReviewGate({ escalate: true, humanRequired: true, labels: accepted, acceptedSha: 'aaaaaaa', headSha: 'bbbbbbb' });
      expect(g.action).toBe('park');
      expect(g.applyLabel).toBe(REVIEW_LABELS.human);
      expect(g.humanRequired).toBe(true);
      // a sticky review:human label reaches the same outcome even with a fresh humanRequired:false score
      const g2 = decideReviewGate({ escalate: true, humanRequired: false, labels: [...accepted, { name: REVIEW_LABELS.human }], acceptedSha: 'aaaaaaa', headSha: 'bbbbbbb' });
      expect(g2.applyLabel).toBe(REVIEW_LABELS.human);
    });
    it('FAILS OPEN — no recorded reviewed SHA (accept predates the gate / applied out-of-band) → merge', () => {
      expect(decideReviewGate({ escalate: true, labels: accepted }).action).toBe('merge');
      expect(decideReviewGate({ escalate: true, labels: accepted, headSha: 'abc1234' }).action).toBe('merge');
    });
    it('FAILS OPEN — head SHA unreadable (fetch miss) → merge', () => {
      expect(decideReviewGate({ escalate: true, labels: accepted, acceptedSha: 'abc1234', headSha: null }).action).toBe('merge');
    });
  });
});

describe('#2409 — reviewed-SHA marker helpers', () => {
  it('buildReviewedShaMarker round-trips through parseReviewedSha', () => {
    const marker = buildReviewedShaMarker('ABC123def456');
    expect(marker).toBe('<!-- reviewed-sha: abc123def456 -->');
    expect(parseReviewedSha([{ body: `✅ accepted\n\n${marker}` }])).toBe('abc123def456');
  });
  it('buildReviewedShaMarker rejects a non-hex / empty SHA (→ empty, gate then fails open)', () => {
    expect(buildReviewedShaMarker('')).toBe('');
    expect(buildReviewedShaMarker('not-a-sha')).toBe('');
    expect(buildReviewedShaMarker('abc')).toBe(''); // too short (< 7)
  });
  it('parseReviewedSha returns the LATEST marker (a re-accept after a fix stamps a fresh SHA)', () => {
    const comments = [
      { body: `first\n${buildReviewedShaMarker('1111111')}` },
      { body: 'a plain comment, no marker' },
      { body: `re-accept\n${buildReviewedShaMarker('2222222')}` },
    ];
    expect(parseReviewedSha(comments)).toBe('2222222');
  });
  it('parseReviewedSha tolerates a missing/odd comments shape → null', () => {
    expect(parseReviewedSha(undefined)).toBe(null);
    expect(parseReviewedSha([])).toBe(null);
    expect(parseReviewedSha([{ body: 'no marker here' }, {}, null])).toBe(null);
  });
});

describe('#2409 — acceptanceCoversHead', () => {
  it('equal SHAs cover the head', () => {
    expect(acceptanceCoversHead({ acceptedSha: 'deadbeef', headSha: 'deadbeef' }).covers).toBe(true);
  });
  it('prefix match (abbreviated vs full) still covers', () => {
    expect(acceptanceCoversHead({ acceptedSha: 'deadbee', headSha: 'deadbeefcafe0123' }).covers).toBe(true);
  });
  it('a different head is NOT covered (stale), with a reason naming both', () => {
    const r = acceptanceCoversHead({ acceptedSha: 'aaaaaaa', headSha: 'bbbbbbb' });
    expect(r.covers).toBe(false);
    expect(r.reason).toMatch(/advanced/i);
  });
  it('either SHA missing → fails OPEN (covers:true)', () => {
    expect(acceptanceCoversHead({ acceptedSha: null, headSha: 'abc1234' }).covers).toBe(true);
    expect(acceptanceCoversHead({ acceptedSha: 'abc1234', headSha: '' }).covers).toBe(true);
    expect(acceptanceCoversHead({}).covers).toBe(true);
  });
});

describe('#x169fqe — an accept survives a CONTENT-PRESERVING rebase', () => {
  // The exact shapes the drain produces: the same reviewed change, replayed onto a newer base (git rewrites the
  // `index <old>..<new>` blob headers) with the transient lane manifest dropped.
  const REVIEWED = [
    'diff --git a/scripts/thing.mjs b/scripts/thing.mjs',
    'index 1111111..2222222 100644',
    '--- a/scripts/thing.mjs',
    '+++ b/scripts/thing.mjs',
    '@@ -1,2 +1,2 @@',
    ' const a = 1;',
    '-const b = 2;',
    '+const b = 3;',
    '',
    'diff --git a/.lane-manifest.json b/.lane-manifest.json',
    'index 5555555..6666666 100644',
    '--- a/.lane-manifest.json',
    '+++ b/.lane-manifest.json',
    '@@ -1 +1 @@',
    '-{"lane":9}',
    '+{"lane":9,"base":"old"}',
  ].join('\n');
  const REBASED = [
    'diff --git a/scripts/thing.mjs b/scripts/thing.mjs',
    'index 9999999..8888888 100644',            // ← different blob headers, same content
    '--- a/scripts/thing.mjs',
    '+++ b/scripts/thing.mjs',
    '@@ -1,2 +1,2 @@',
    ' const a = 1;',
    '-const b = 2;',
    '+const b = 3;',
  ].join('\n');                                  // ← manifest dropped entirely by the rebase pass
  const RIDE_IN = [
    REBASED,
    '',
    'diff --git a/scripts/other.mjs b/scripts/other.mjs',
    'index aaaaaaa..bbbbbbb 100644',
    '--- a/scripts/other.mjs',
    '+++ b/scripts/other.mjs',
    '@@ -1 +1 @@',
    '-safe();',
    '+rm_rf();',
  ].join('\n');

  it('the fingerprint ignores blob headers and the transient lane manifest', () => {
    expect(normalizeDiffFingerprint(REVIEWED)).toBe(normalizeDiffFingerprint(REBASED));
  });

  it('…but NOT a real content change — the PR #368 ride-in hole stays shut', () => {
    expect(normalizeDiffFingerprint(REBASED)).not.toBe(normalizeDiffFingerprint(RIDE_IN));
    const r = acceptanceCoversHead({
      acceptedSha: 'aaaaaaa', headSha: 'bbbbbbb', acceptedDiff: REVIEWED, headDiff: RIDE_IN,
    });
    expect(r.covers).toBe(false);
    expect(r.reason).toMatch(/advanced/i);
  });

  it('a moved head with an identical reviewed diff STILL covers, and says why', () => {
    const r = acceptanceCoversHead({
      acceptedSha: 'aaaaaaa', headSha: 'bbbbbbb', acceptedDiff: REVIEWED, headDiff: REBASED,
    });
    expect(r.covers).toBe(true);
    expect(r.reason).toMatch(/content-preserving rebase/);
  });

  it('FAILS CLOSED whenever the pair is incomplete — a missing side can never honour an accept', () => {
    for (const args of [
      { acceptedDiff: REVIEWED },                       // only the accept side recorded one
      { headDiff: REBASED },                            // only the live side could be read
      { acceptedDiff: REVIEWED, headDiff: '' },         // live read returned empty
      { acceptedDiff: '', headDiff: REBASED },
      { acceptedDiff: null, headDiff: null },           // every pre-#x169fqe accept
    ]) {
      expect(acceptanceCoversHead({ acceptedSha: 'aaaaaaa', headSha: 'bbbbbbb', ...args }).covers).toBe(false);
    }
  });

  it('a hunk-header move is NOT equivalence — the reviewer\'s reading of the surroundings may not hold', () => {
    const moved = REBASED.replace('@@ -1,2 +1,2 @@', '@@ -40,2 +40,2 @@');
    expect(normalizeDiffFingerprint(REBASED)).not.toBe(normalizeDiffFingerprint(moved));
  });

  // ── The two collisions the PR #1086 review found and reproduced. Each let a ride-in commit hash identically
  //    to the reviewed diff, i.e. be honoured under an accept that never saw it. Both are pinned here.
  it('#1086 blocker 1 — a NESTED manifest-lookalike is content, not transient bookkeeping', () => {
    const smuggled = [
      REBASED,
      '',
      'diff --git a/some/dir/.lane-manifest.json b/some/dir/.lane-manifest.json',
      'new file mode 100644',
      'index 0000000..deadbee',
      '--- /dev/null',
      '+++ b/some/dir/.lane-manifest.json',
      '@@ -0,0 +1 @@',
      '+{"malicious":true}',
    ].join('\n');
    // The substring match dropped this whole section on both sides; only the ROOT file may ever be skipped.
    expect(normalizeDiffFingerprint(smuggled)).not.toBe(normalizeDiffFingerprint(REBASED));
    expect(acceptanceCoversHead({
      acceptedSha: 'aaaaaaa', headSha: 'bbbbbbb', acceptedDiff: REBASED, headDiff: smuggled,
    }).covers).toBe(false);
  });

  it('#1086 blocker 1 — only git\'s EXACT root header is skipped, not a crafted spelling', () => {
    const root = ['diff --git a/.lane-manifest.json b/.lane-manifest.json', 'index 1..2 100644', '@@ -1 +1 @@', '-{}', '+{"a":1}'].join('\n');
    const nestedDeep = root.replace(/a\/\.lane-manifest\.json b\/\.lane-manifest\.json/, 'a/x/.lane-manifest.json b/x/.lane-manifest.json');
    // the root file vanishes entirely (nothing left → null); the nested one survives as real content
    expect(normalizeDiffFingerprint(root)).toBe(null);
    expect(normalizeDiffFingerprint(nestedDeep)).not.toBe(null);
  });

  it('#1086 blocker 2 — trailing whitespace is CONTENT (a markdown hard break, a fixture, a .patch)', () => {
    const withSpaces = ['diff --git a/n.md b/n.md', 'index 1..2 100644', '@@ -1 +1 @@', '-old line', '+new line  '].join('\n');
    const without = withSpaces.replace('+new line  ', '+new line');
    expect(normalizeDiffFingerprint(withSpaces)).not.toBe(normalizeDiffFingerprint(without));
    expect(acceptanceCoversHead({
      acceptedSha: 'aaaaaaa', headSha: 'bbbbbbb', acceptedDiff: withSpaces, headDiff: without,
    }).covers).toBe(false);
  });

  it('#2979 — sibling-lane content that already landed on main must not move the fingerprint', () => {
    // THE DEFECT THIS PINS, measured on PR #1080. Both sides were fingerprinted from `gh pr diff`, whose
    // THREE-DOT output still lists a file another lane has since landed on main as if THIS PR added it (#2450).
    // So the fingerprint changed every time ANY OTHER LANE LANDED, and the accept went stale for reasons having
    // nothing to do with this PR — #1080's diff had grown to include four backlog items and three script files
    // belonging to other PRs. The fix is upstream of this function: both sides now feed it `computeNetDiffText`
    // (the two-tree `git diff <forkpoint> <head>`), which never contains sibling content. This test pins the
    // PROPERTY that makes that fix work — a diff carrying extra already-landed files is NOT the same content.
    const own = [
      'diff --git a/scripts/mine.mjs b/scripts/mine.mjs',
      'index 1111111..2222222 100644',
      '@@ -1 +1 @@',
      '-const a = 1;',
      '+const a = 2;',
    ].join('\n');
    const inflated = [
      own,
      'diff --git a/backlog/2977-a-sibling-item.md b/backlog/2977-a-sibling-item.md',
      'new file mode 100644',
      'index 0000000..3333333',
      '@@ -0,0 +1 @@',
      '+a sibling lane landed this on main',
    ].join('\n');
    // If these ever compared EQUAL, the fingerprint would be blind to real added files — the opposite failure.
    expect(normalizeDiffFingerprint(own)).not.toBe(normalizeDiffFingerprint(inflated));
    expect(acceptanceCoversHead({
      acceptedSha: 'aaaaaaa', headSha: 'bbbbbbb', acceptedDiff: own, headDiff: inflated,
    }).covers).toBe(false);
  });

  it('a mode-only change and a rename both change the fingerprint', () => {
    const modeOnly = ['diff --git a/s.sh b/s.sh', 'old mode 100644', 'new mode 100755'].join('\n');
    const other = ['diff --git a/s.sh b/s.sh', 'old mode 100755', 'new mode 100644'].join('\n');
    expect(normalizeDiffFingerprint(modeOnly)).not.toBe(normalizeDiffFingerprint(other));
    const rename = ['diff --git a/a.js b/b.js', 'similarity index 100%', 'rename from a.js', 'rename to b.js'].join('\n');
    const rename2 = rename.replace('rename to b.js', 'rename to c.js');
    expect(normalizeDiffFingerprint(rename)).not.toBe(normalizeDiffFingerprint(rename2));
  });

  it('the marker round-trips through parse, and latest wins (mirroring reviewed-sha)', () => {
    const marker = buildReviewedDiffMarker(REVIEWED);
    expect(marker).toMatch(/^<!-- reviewed-diff: [0-9a-f]{64} -->$/);
    expect(parseReviewedDiff([{ body: `✅ accepted\n\n${marker}` }])).toBe(normalizeDiffFingerprint(REVIEWED));
    const second = buildReviewedDiffMarker(RIDE_IN);
    expect(parseReviewedDiff([{ body: marker }, { body: second }])).toBe(normalizeDiffFingerprint(RIDE_IN));
    expect(parseReviewedDiff([{ body: 'no marker' }, {}, null])).toBe(null);
    expect(buildReviewedDiffMarker('')).toBe('');
  });

  it('a parsed fingerprint feeds straight back into the gate (idempotent normalization)', () => {
    // The drain reads a STORED fingerprint for the accept side and a RAW diff for the live side; both must land
    // on the same value or the gate would never match in production.
    const stored = parseReviewedDiff([{ body: buildReviewedDiffMarker(REVIEWED) }]);
    expect(acceptanceCoversHead({
      acceptedSha: 'aaaaaaa', headSha: 'bbbbbbb', acceptedDiff: stored, headDiff: REBASED,
    }).covers).toBe(true);
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
  it('a declarative-leash (humanRequired) PR → high', () => {
    expect(scoreEscalation({ changedFiles: ['scripts/lib/gate-config.mjs'] }).careLevel).toBe(CARE_LEVELS.HIGH);
  });
  it('#2771/#2785 — a derivation-CODE PR drops from high to elevated (committee rigor, not a human)', () => {
    const r = scoreEscalation({ changedFiles: ['scripts/lib/review-core.mjs'] });
    expect(r.humanRequired).toBe(false);
    expect(r.careLevel).toBe(CARE_LEVELS.ELEVATED);
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

describe('reconcileRoster — #2635 bind + reconcile the jury roster at PR-open against the real diff', () => {
  it('no pre-registered roster → a pure BIND: effective = recomputed, no expansion, no re-alignment', () => {
    const r = reconcileRoster({ preRegistered: null, recomputed: ['correctness', 'security', 'a11y'] });
    expect(r.effective).toEqual(['correctness', 'security', 'a11y']);
    expect(r.expanded).toBe(false);
    expect(r.humanAlignmentRequired).toBe(false);
    expect(r.added).toEqual([]);
    expect(r.reasons).toEqual([]);
  });

  it('real diff earns a lens the charter did not pre-register → UNION, expansion, human re-alignment (up-front default)', () => {
    // The spec case: a "script fix" pre-registered only the static lenses, but the real diff moved a UI file →
    // the recompute earns a11y + visual-vs-target that nobody picked.
    const r = reconcileRoster({
      preRegistered: ['correctness', 'security'],
      recomputed: ['correctness', 'security', 'a11y', 'visual-vs-target'],
    });
    expect(r.effective).toEqual(['correctness', 'security', 'a11y', 'visual-vs-target']); // pre-registered first, then added
    expect(r.added).toEqual(['a11y', 'visual-vs-target']);
    expect(r.expanded).toBe(true);
    expect(r.humanAlignmentRequired).toBe(true);
    expect(r.reasons.join(' ')).toMatch(/expanded past pre-registration.*a11y.*re-triggering human alignment/);
  });

  it('recompute inside the pre-registered set → union is a no-op, no expansion, no re-alignment', () => {
    const r = reconcileRoster({
      preRegistered: ['correctness', 'security', 'a11y', 'visual-vs-target'],
      recomputed: ['correctness', 'security'],
    });
    expect(r.effective).toEqual(['correctness', 'security', 'a11y', 'visual-vs-target']);
    expect(r.added).toEqual([]);
    expect(r.removed).toEqual(['a11y', 'visual-vs-target']); // reported, but the seats STAY in effective (never silently dropped)
    expect(r.expanded).toBe(false);
    expect(r.humanAlignmentRequired).toBe(false);
  });

  it('incremental timing binds an expansion SILENTLY — expanded true, but no human re-alignment', () => {
    const r = reconcileRoster({
      preRegistered: ['correctness'],
      recomputed: ['correctness', 'a11y'],
      mode: ROSTER_TIMING.INCREMENTAL,
    });
    expect(r.expanded).toBe(true);
    expect(r.humanAlignmentRequired).toBe(false);
    expect(r.mode).toBe(ROSTER_TIMING.INCREMENTAL);
    expect(r.reasons.join(' ')).toMatch(/bound incrementally without re-alignment/);
  });

  it('normalizes lens lists — dedups, trims, drops non-strings/empties, preserves first-seen order', () => {
    const r = reconcileRoster({
      preRegistered: ['correctness', ' correctness ', '', 42, 'security'],
      recomputed: ['security', ' a11y ', 'a11y', null],
    });
    expect(r.effective).toEqual(['correctness', 'security', 'a11y']);
    expect(r.added).toEqual(['a11y']);
    expect(r.humanAlignmentRequired).toBe(true);
  });

  it('an unknown mode falls back to the strict up-front default', () => {
    const r = reconcileRoster({ preRegistered: ['correctness'], recomputed: ['correctness', 'a11y'], mode: 'nonsense' });
    expect(r.mode).toBe(ROSTER_TIMING.UP_FRONT);
    expect(r.humanAlignmentRequired).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// THE TIER TABLE (#2771/#2785) — every row is a REAL path in this repo, pinned to the route it must get. This
// is the one place to read "what does a human still see?" end to end: path → humanRequired → producer label.
// The rows were chosen to cover each class the ruling distinguishes, INCLUDING the mixed row (a PR touching
// both halves must stay human — the strictest half wins) and the ordinary leaf (no review at all).
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('the #2771/#2785 tier table — real repo paths, pinned route', () => {
  const TABLE = [
    // [what it is, changedFiles, expected humanRequired, expected producer label]
    ['derivation code — the rubric itself', ['scripts/lib/review-escalation.mjs'], false, REVIEW_LABELS.pending],
    ['derivation code — the disposition router', ['scripts/lib/review-core.mjs'], false, REVIEW_LABELS.pending],
    ['derivation code — the contract loader', ['scripts/lib/review-policy.mjs'], false, REVIEW_LABELS.pending],
    ['derivation code — the two land seams', ['scripts/lib/disposition-land-seam.mjs', 'scripts/lib/auto-land-seam.mjs'], false, REVIEW_LABELS.pending],
    ['THRESHOLD constant — the contract owns the numbers', ['scripts/lib/review-policy.contract.json'], true, REVIEW_LABELS.human],
    ['PATH PATTERN / roster — who is in the chain, at what tier', ['scripts/lib/gate-config.mjs'], true, REVIEW_LABELS.human],
    ['the invariant tripwires', ['scripts/lib/__tests__/gate-invariants.test.mjs'], true, REVIEW_LABELS.human],
    ['the impl↔contract conformance bridge', ['scripts/lib/__tests__/review-policy.conformance.test.mjs'], true, REVIEW_LABELS.human],
    ['the check:standards definition-of-green contract', ['scripts/check-standards.contract.json'], true, REVIEW_LABELS.human],
    ['MIXED — derivation code AND the contract in one PR', ['scripts/lib/review-escalation.mjs', 'scripts/lib/review-policy.contract.json'], true, REVIEW_LABELS.human],
    ['MIXED — derivation code AND the roster in one PR', ['scripts/lib/review-core.mjs', 'scripts/lib/gate-config.mjs'], true, REVIEW_LABELS.human],
    ['a statute doc (a NEW rule, no codify shape proven)', ['docs/agent/platform-decisions.md'], true, REVIEW_LABELS.human],
    ['the ENGINE tier — the lander (unchanged, #2445)', ['scripts/merge-ai-prs.mjs'], false, REVIEW_LABELS.pending],
    ['the check:standards rules impl (engine tier)', ['scripts/check-standards-rules.mjs'], false, REVIEW_LABELS.pending],
    ['an ordinary blast-radius script', ['scripts/pr-land.mjs'], false, REVIEW_LABELS.pending],
    ['an ordinary LEAF file — no review owed at all', ['demos/spa.html'], false, null],
    ['a backlog item (ordinary leaf)', ['backlog/2785-implement-the-narrowed-review-human-rubric.md'], false, null],
  ];
  for (const [what, changedFiles, humanRequired, label] of TABLE) {
    it(`${what} ⇒ humanRequired=${humanRequired}, label=${label}`, () => {
      const r = scoreEscalation({ changedFiles });
      expect(r.humanRequired).toBe(humanRequired);
      expect(producerReviewLabel(r)).toBe(label);
    });
  }

  it('an 800-line ORDINARY PR is still not a human problem — size never routes (#2563/#2567)', () => {
    const r = scoreEscalation({ changedFiles: ['demos/spa.html', 'src/app.ts'], diffLines: 800 });
    expect(r.humanRequired).toBe(false);
    expect(producerReviewLabel(r)).toBe(REVIEW_LABELS.pending);   // escalates on size, but to the committee
    expect(r.careLevel).toBe(CARE_LEVELS.LOW);                    // …as advisory care, per #2567
  });
  it('a 5-line THRESHOLD change is a human problem, however small (#2771 — the spec has no small edit)', () => {
    const r = scoreEscalation({ changedFiles: ['scripts/lib/review-policy.contract.json'], diffLines: 5 });
    expect(r.humanRequired).toBe(true);
    expect(producerReviewLabel(r)).toBe(REVIEW_LABELS.human);
  });

  it('the split PARTITIONS the policy tier: every gate-self path is exactly one of leash / derivation', () => {
    for (const [, files] of TABLE) {
      for (const f of files) {
        if (!isGateSelfPath(f)) { expect(isDeclarativeLeashPath(f) || isPolicyDerivationPath(f)).toBe(false); continue; }
        expect(isDeclarativeLeashPath(f) !== isPolicyDerivationPath(f)).toBe(true);
      }
    }
  });

  it('EVERY emitted reason string canonicalizes — the drain can never choke on a new token', () => {
    // deriveReviewDisposition THROWS on an unrecognized reason, and the drain hands it `reasons` verbatim. So
    // every decorated string the rubric can emit must round-trip, and land on the clearance the ruling intends.
    const humanRows = [['scripts/lib/gate-config.mjs'], ['docs/agent/platform-decisions.md']];
    const agentRows = [['scripts/lib/review-escalation.mjs'], ['scripts/merge-ai-prs.mjs'], ['scripts/pr-land.mjs']];
    for (const changedFiles of [...humanRows, ...agentRows]) {
      const { reasons } = scoreEscalation({ changedFiles, diffLines: 900, dismissedFindings: 2, crossRepo: true });
      expect(reasons.length).toBeGreaterThan(0);
      for (const reason of reasons) expect(() => deriveReviewDisposition({ reason })).not.toThrow();
    }
    // A derivation-code-only PR converges AND auto-lands (the narrowing, at the disposition layer too)…
    expect(deriveReviewDisposition({ reasons: scoreEscalation({ changedFiles: ['scripts/lib/review-core.mjs'] }).reasons }))
      .toEqual({ mode: REVIEW_DISPOSITIONS.CONVERGE, autoLand: true });
    // …while the leash converges but a human still gates the merge.
    expect(deriveReviewDisposition({ reasons: scoreEscalation({ changedFiles: ['scripts/lib/gate-config.mjs'] }).reasons }))
      .toEqual({ mode: REVIEW_DISPOSITIONS.CONVERGE, autoLand: false });
  });

  it('a legacy `gate-self` reason parked BEFORE this shipped still means human (no retroactive loosening)', () => {
    expect(deriveReviewDisposition({ reason: 'gate-self (scripts/lib/review-core.mjs) — human review required' }))
      .toEqual({ mode: REVIEW_DISPOSITIONS.CONVERGE, autoLand: false });
  });

  it('#2771 Fork A — the STATUTE term of `humanRequired` is UNCHANGED: every statute touch still forces a human', () => {
    // The narrowing moved ONLY the first term (whole policy tier → its declarative-leash half). The statute term
    // is `statuteFiles.length > 0`, exactly as on main, so this row must match main's behaviour byte for byte.
    for (const s of ['docs/agent/platform-decisions.md', 'docs/agent/2026-06-example-statute.md']) {
      const r = scoreEscalation({ changedFiles: [s] });
      expect(r.humanRequired).toBe(true);
      expect(producerReviewLabel(r)).toBe(REVIEW_LABELS.human);
      expect(r.reasons.join(' ')).toMatch(/statute \(/);
      // …and it survives every other signal, including a derivation-code file riding along.
      expect(scoreEscalation({ changedFiles: [s, 'scripts/lib/review-escalation.mjs'], diffLines: 900 }).humanRequired).toBe(true);
      // …and on the cumulative human basis (#2390), where the own-delta hides it.
      expect(scoreEscalation({ changedFiles: ['demos/spa.html'], humanBasisFiles: ['demos/spa.html', s] }).humanRequired).toBe(true);
    }
  });
});
