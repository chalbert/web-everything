/**
 * @file review-escalation.test.mjs — proof of the #2171 deterministic drain review-escalation rubric: the
 *   SCORER (which signals escalate), the COUPLE rule (strictest member wins), and the non-blocking WATCH-WINDOW
 *   gate (park / merge / merge-anyway). All pure — the drain supplies signals + observed labels + park age.
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
});

describe('isGateSelfPath — the auto-review trust chain (#2285 v1)', () => {
  it('flags ONLY the gate rubric + the lander (the code that decides the gate)', () => {
    expect(isGateSelfPath('scripts/lib/review-escalation.mjs')).toBe(true);
    expect(isGateSelfPath('scripts/merge-ai-prs.mjs')).toBe(true);
    // a repo-prefixed / nested clone path still matches (the drain reads paths off head refs)
    expect(isGateSelfPath('frontierui/scripts/merge-ai-prs.mjs')).toBe(true);
  });
  it('does NOT flag other blast-radius code — those stay agent-reviewable', () => {
    for (const p of ['scripts/pr-land.mjs', 'scripts/lane-pool.mjs', '.claude/skills/drain/SKILL.md',
                     'docs/agent/platform-decisions.md', 'src/_data/blocks.json', 'scripts/lib/rebase-drop-manifest.mjs']) {
      expect(isGateSelfPath(p)).toBe(false);
    }
  });
});

describe('scoreEscalation', () => {
  it('a small leaf change with no dismissals → NO escalation', () => {
    const r = scoreEscalation({ changedFiles: ['backlog/2171-x.md'], diffLines: 20, prNum: 3 });
    expect(r.escalate).toBe(false);
    expect(r.reasons).toEqual([]);
  });
  it('a blast-radius file escalates', () => {
    const r = scoreEscalation({ changedFiles: ['scripts/pr-land.mjs'], prNum: 3 });
    expect(r.escalate).toBe(true);
    expect(r.reasons.join(' ')).toMatch(/blast-radius/);
  });
  it('size threshold escalates (≥ default 400 changed lines)', () => {
    expect(scoreEscalation({ diffLines: 400, prNum: 3 }).escalate).toBe(true);
    expect(scoreEscalation({ diffLines: 399, prNum: 3 }).escalate).toBe(false);
  });
  it('a dismissed pre-PR review finding is the strongest signal — escalates on ≥1', () => {
    const r = scoreEscalation({ dismissedFindings: 1, prNum: 3 });
    expect(r.escalate).toBe(true);
    expect(r.reasons.join(' ')).toMatch(/dismissed-findings/);
  });
  it('a cross-repo couple escalates', () => {
    expect(scoreEscalation({ crossRepo: true, prNum: 3 }).escalate).toBe(true);
  });
  it('the 1-in-N sampling floor escalates deterministically by PR number', () => {
    expect(scoreEscalation({ prNum: 10 }).escalate).toBe(true);   // 10 % 10 === 0
    expect(scoreEscalation({ prNum: 20 }).escalate).toBe(true);
    expect(scoreEscalation({ prNum: 7 }).escalate).toBe(false);
    // custom N
    expect(scoreEscalation({ prNum: 5, thresholds: { sampleNth: 5 } }).escalate).toBe(true);
  });
  it('collects EVERY firing reason (multiple signals compound)', () => {
    const r = scoreEscalation({ changedFiles: ['scripts/x.mjs'], diffLines: 500, dismissedFindings: 2, crossRepo: true, prNum: 10 });
    expect(r.reasons.length).toBe(5);
  });
  it('humanRequired only when the diff edits the gate\'s own code (#2285 v1)', () => {
    // a gate-self file → escalate AND humanRequired
    const gate = scoreEscalation({ changedFiles: ['scripts/merge-ai-prs.mjs'], prNum: 3 });
    expect(gate.escalate).toBe(true);
    expect(gate.humanRequired).toBe(true);
    expect(gate.reasons.join(' ')).toMatch(/gate-self/);
    // other blast-radius → escalates but agent-reviewable (NOT humanRequired)
    const other = scoreEscalation({ changedFiles: ['scripts/pr-land.mjs'], prNum: 3 });
    expect(other.escalate).toBe(true);
    expect(other.humanRequired).toBe(false);
    // a plain leaf → neither
    expect(scoreEscalation({ changedFiles: ['backlog/x.md'], prNum: 3 }).humanRequired).toBe(false);
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

describe('decideReviewGate — the non-blocking watch window', () => {
  it('not escalated → merge immediately', () => {
    expect(decideReviewGate({ escalate: false }).action).toBe('merge');
  });
  it('escalated + review:accepted → merge', () => {
    expect(decideReviewGate({ escalate: true, labels: [{ name: REVIEW_LABELS.accepted }] }).action).toBe('merge');
  });
  it('escalated + review:changes → wait for the author lane', () => {
    expect(decideReviewGate({ escalate: true, labels: [REVIEW_LABELS.changes] }).action).toBe('wait-author');
  });
  it('escalated, no verdict, window not expired → park alive (apply review:pending), never block', () => {
    const g = decideReviewGate({ escalate: true, parkedSinceMs: 1000, nowMs: 1000 + 60_000, windowMs: 30 * 60_000 });
    expect(g.action).toBe('park');
    expect(g.applyLabel).toBe(REVIEW_LABELS.pending);
  });
  it('escalated, no verdict, window EXPIRED → merge-anyway + auto-file (never hang on a dead reviewer)', () => {
    const g = decideReviewGate({ escalate: true, parkedSinceMs: 0, nowMs: 31 * 60_000, windowMs: 30 * 60_000 });
    expect(g.action).toBe('merge-anyway');
    expect(g.autoFile).toBe(true);
  });
  it('a just-escalated PR with no park timestamp parks (does not instantly time out)', () => {
    expect(decideReviewGate({ escalate: true, parkedSinceMs: null }).action).toBe('park');
  });

  // #2285 v1 — the human-required conflict-of-interest gate.
  it('humanRequired → parks under review:human (an agent may not clear a gate-self edit)', () => {
    const g = decideReviewGate({ escalate: true, humanRequired: true, parkedSinceMs: null });
    expect(g.action).toBe('park');
    expect(g.applyLabel).toBe(REVIEW_LABELS.human);
    expect(g.humanRequired).toBe(true);
  });
  it('humanRequired NEVER times out to merge-anyway — even past the window (the essential safety property)', () => {
    const g = decideReviewGate({ escalate: true, humanRequired: true, parkedSinceMs: 0, nowMs: 999 * 60_000, windowMs: 30 * 60_000 });
    expect(g.action).toBe('park');
    expect(g.applyLabel).toBe(REVIEW_LABELS.human);
  });
  it('humanRequired + review:accepted → merge (a human verdict still wins)', () => {
    expect(decideReviewGate({ escalate: true, humanRequired: true, labels: [REVIEW_LABELS.accepted] }).action).toBe('merge');
  });
});

describe('hasReviewLabel + REVIEW_LABELS', () => {
  it('tolerates both string and {name} label shapes', () => {
    expect(hasReviewLabel(['review:accepted'], REVIEW_LABELS.accepted)).toBe(true);
    expect(hasReviewLabel([{ name: 'review:pending' }], REVIEW_LABELS.pending)).toBe(true);
    expect(hasReviewLabel([], REVIEW_LABELS.accepted)).toBe(false);
  });
  it('exposes the ratified verdict labels (+ the #2285 human gate) + tuning knobs', () => {
    expect(REVIEW_LABELS).toEqual({ pending: 'review:pending', accepted: 'review:accepted', changes: 'review:changes', human: 'review:human' });
    expect(DEFAULT_THRESHOLDS.diffLines).toBeGreaterThan(0);
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
