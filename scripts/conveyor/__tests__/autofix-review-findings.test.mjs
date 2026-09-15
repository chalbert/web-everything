/**
 * @file scripts/conveyor/__tests__/autofix-review-findings.test.mjs
 * @description Unit proof of the Part-3 auto-fix router — resolves the PR's tier off its OWN base ref (never
 *   `deliveryTarget:` frontmatter), classifies each already-posted advisory finding, and dispatches a
 *   narrowly-scoped `fix` for every one that clears the gate. `dispatchFixFn`/`run` are injected throughout —
 *   no real `gh`, no real lane/agent spawn.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  autoFixAfterReview, renderScopedFindingBrief, resolveBaseRefName,
  summarizeAutoFixDecline, renderAutoFixDeclineNote,
} from '../autofix-review-findings.mjs';

const REGISTRY = { branches: [{ branch: 'lane/mechanical-dispatcher', target: 'main' }] };

describe('renderScopedFindingBrief', () => {
  it('renders a narrow brief anchored to ONE finding, never the whole panel', () => {
    const brief = renderScopedFindingBrief({
      file: 'src/foo.mjs', line: 12, summary: 'off-by-one', failure_scenario: 'x then y', category: 'correctness',
    });
    expect(brief).toContain('src/foo.mjs:12');
    expect(brief).toContain('off-by-one');
    expect(brief).toContain('x then y');
    expect(brief).toContain('correctness');
    expect(brief).toMatch(/ONE finding/);
  });
  it('tolerates a finding with only a summary', () => {
    const brief = renderScopedFindingBrief({ summary: 'bare finding' });
    expect(brief).toContain('bare finding');
    expect(brief).toContain('no file anchor');
  });
});

describe('resolveBaseRefName', () => {
  it('shells `gh pr view --json baseRefName` and returns it', () => {
    const run = vi.fn(() => JSON.stringify({ baseRefName: 'main' }));
    const base = resolveBaseRefName({ pr: 42, repo: 'o/r' }, { run });
    expect(base).toBe('main');
    expect(run).toHaveBeenCalledWith('gh', ['pr', 'view', '42', '--json', 'baseRefName', '--repo', 'o/r']);
  });
});

describe('autoFixAfterReview — the router', () => {
  const cleanFinding = { file: 'src/components/Button.tsx', summary: 'unused import' };
  const statuteFinding = { file: 'docs/agent/platform-decisions.md', summary: 'wording nit' };
  const blockerFinding = { file: 'src/components/Header.tsx', summary: 'real bug', disposition: 'blocker' };
  const noFileFinding = { summary: 'a finding with no file anchor at all' };

  function runGh(baseRefName) {
    return vi.fn(() => JSON.stringify({ baseRefName }));
  }

  it('dispatches a scoped fix for a clean finding on main (strict tier)', async () => {
    const dispatchFixFn = vi.fn(async () => ({ result: 'PR #1 (re-armed review:pending)' }));
    const out = await autoFixAfterReview(
      { pr: 1, repo: 'o/r', findings: [cleanFinding] },
      { dispatchFixFn, registry: REGISTRY, run: runGh('main') },
    );
    expect(out.tier).toBe('strict');
    expect(out.results).toHaveLength(1);
    expect(out.results[0]).toMatchObject({ dispatched: true, risk: { selfClears: true } });
    expect(dispatchFixFn).toHaveBeenCalledTimes(1);
    const [args] = dispatchFixFn.mock.calls[0];
    expect(args.pr).toBe(1);
    expect(args.repo).toBe('o/r');
    expect(args.findingOverride).toContain('unused import');
  });

  it('leaves a statute-layer finding untouched — never dispatched, in either tier', async () => {
    const dispatchFixFn = vi.fn(async () => ({}));
    const out = await autoFixAfterReview(
      { pr: 1, repo: 'o/r', findings: [statuteFinding] },
      { dispatchFixFn, registry: REGISTRY, run: runGh('lane/mechanical-dispatcher') },
    );
    expect(out.tier).toBe('lenient');
    expect(out.results[0]).toMatchObject({ dispatched: false, risk: { escalate: true, reason: 'path-blacklisted' } });
    expect(dispatchFixFn).not.toHaveBeenCalled();
  });

  it('a blocker finding is auto-fixed on the lenient (POC-branch) tier but left alone on the strict tier', async () => {
    const strictDispatch = vi.fn(async () => ({}));
    const strictOut = await autoFixAfterReview(
      { pr: 1, repo: 'o/r', findings: [blockerFinding] },
      { dispatchFixFn: strictDispatch, registry: REGISTRY, run: runGh('main') },
    );
    expect(strictOut.results[0].dispatched).toBe(false);
    expect(strictDispatch).not.toHaveBeenCalled();

    const lenientDispatch = vi.fn(async () => ({}));
    const lenientOut = await autoFixAfterReview(
      { pr: 1, repo: 'o/r', findings: [blockerFinding] },
      { dispatchFixFn: lenientDispatch, registry: REGISTRY, run: runGh('lane/mechanical-dispatcher') },
    );
    expect(lenientOut.results[0].dispatched).toBe(true);
    expect(lenientDispatch).toHaveBeenCalledTimes(1);
  });

  it('a finding with no file anchor is never dispatched, regardless of tier', async () => {
    const dispatchFixFn = vi.fn(async () => ({}));
    const out = await autoFixAfterReview(
      { pr: 1, repo: 'o/r', findings: [noFileFinding] },
      { dispatchFixFn, registry: REGISTRY, run: runGh('main') },
    );
    expect(out.results[0]).toMatchObject({ dispatched: false, risk: { reason: 'no-file-anchor' } });
    expect(dispatchFixFn).not.toHaveBeenCalled();
  });

  it('mixed findings: only the ones that clear the gate get dispatched, each with its own scoped brief', async () => {
    const dispatchFixFn = vi.fn(async ({ findingOverride }) => ({ findingOverride }));
    const out = await autoFixAfterReview(
      { pr: 9, repo: 'o/r', findings: [cleanFinding, statuteFinding, blockerFinding] },
      { dispatchFixFn, registry: REGISTRY, run: runGh('main') },
    );
    expect(out.results.map((r) => r.dispatched)).toEqual([true, false, false]);
    expect(dispatchFixFn).toHaveBeenCalledTimes(1);
  });

  it('a dispatch failure for one finding is recorded, never thrown — sibling findings are unaffected', async () => {
    const dispatchFixFn = vi.fn(async () => { throw new Error('lane pool exhausted'); });
    const out = await autoFixAfterReview(
      { pr: 1, repo: 'o/r', findings: [cleanFinding] },
      { dispatchFixFn, registry: REGISTRY, run: runGh('main') },
    );
    expect(out.results[0].dispatched).toBe(true);
    expect(out.results[0].outcome.error).toMatch(/lane pool exhausted/);
  });

  it('never invents its own findings — an empty/absent list dispatches nothing', async () => {
    const dispatchFixFn = vi.fn(async () => ({}));
    const out = await autoFixAfterReview(
      { pr: 1, repo: 'o/r', findings: [] },
      { dispatchFixFn, registry: REGISTRY, run: runGh('main') },
    );
    expect(out.results).toEqual([]);
    expect(dispatchFixFn).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// #3383 — summarizeAutoFixDecline / renderAutoFixDeclineNote: THE VISIBILITY GAP. Before this, a clean "0 of N
// auto-fixable" outcome (e.g. every finding path-blacklisted) posted NOTHING to the PR — only a `writeErr` on an
// actual thrown error, and a decline is not an error. These pin the pure classifier and its note.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('summarizeAutoFixDecline (#3383)', () => {
  it('is null when there is nothing to consider — zero findings is not a decline', () => {
    expect(summarizeAutoFixDecline({ tier: 'strict', results: [] })).toBeNull();
    expect(summarizeAutoFixDecline({})).toBeNull();
    expect(summarizeAutoFixDecline(null)).toBeNull();
  });

  it('is null when at least one finding WAS dispatched — not "all declined"', () => {
    const results = [
      { finding: {}, dispatched: true, risk: { reason: 'clean' } },
      { finding: {}, dispatched: false, risk: { reason: 'path-blacklisted' } },
    ];
    expect(summarizeAutoFixDecline({ results })).toBeNull();
  });

  it('summarizes an all-declined outcome, grouping by reason', async () => {
    const dispatchFixFn = vi.fn(async () => ({}));
    const out = await autoFixAfterReview(
      {
        pr: 1,
        repo: 'o/r',
        findings: [
          { file: 'docs/agent/platform-decisions.md', summary: 'wording nit' }, // statute-layer → path-blacklisted
          { summary: 'a finding with no file anchor at all' }, // no-file-anchor
        ],
      },
      { dispatchFixFn, registry: REGISTRY, run: vi.fn(() => JSON.stringify({ baseRefName: 'main' })) },
    );
    const decline = summarizeAutoFixDecline(out);
    expect(decline).toEqual({ count: 2, reasonCounts: { 'path-blacklisted': 1, 'no-file-anchor': 1 } });
  });

  it('the exact PR #2117-shaped case: every finding path-blacklisted, nothing dispatched', () => {
    const results = [
      { finding: { file: 'docs/agent/platform-decisions.md' }, dispatched: false, risk: { reason: 'path-blacklisted' } },
      { finding: { file: 'scripts/guard-lane.mjs' }, dispatched: false, risk: { reason: 'path-blacklisted' } },
    ];
    expect(summarizeAutoFixDecline({ results })).toEqual({ count: 2, reasonCounts: { 'path-blacklisted': 2 } });
  });
});

describe('renderAutoFixDeclineNote (#3383)', () => {
  it('names the count and the reason(s) — the operator-facing footnote', () => {
    const note = renderAutoFixDeclineNote({ count: 2, reasonCounts: { 'path-blacklisted': 2 } });
    expect(note).toMatch(/2 finding\(s\)/);
    expect(note).toMatch(/fixed 0/);
    expect(note).toMatch(/2 path-blacklisted/);
    expect(note).toMatch(/No fix was dispatched/);
  });

  it('renders multiple reasons, one count each', () => {
    const note = renderAutoFixDeclineNote({ count: 2, reasonCounts: { 'path-blacklisted': 1, 'no-file-anchor': 1 } });
    expect(note).toMatch(/1 path-blacklisted/);
    expect(note).toMatch(/1 no-file-anchor/);
  });
});
