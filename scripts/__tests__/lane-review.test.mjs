/**
 * @file scripts/__tests__/lane-review.test.mjs
 * @description Unit proof of the pure helpers in `scripts/lane-review.mjs` — the pre-PR independent-review
 *   seam (#2170): the review-diff range construction and the dismissed-findings → PR-body rendering that
 *   makes "record dismissals in the PR body" a fixed, #2171-parseable format. The git/fs driver is the I/O
 *   boundary. Also a source-level contract guard: the script never calls a model (judgement is the session's).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { diffRange, diffArgs, renderDismissalsBlock, composeBody, parseDismissals } from '../lane-review.mjs';

describe('lane-review pure helpers (#2170)', () => {
  it('builds a three-dot review range (base…HEAD), defaulting to origin/main', () => {
    expect(diffRange('origin/main')).toBe('origin/main...HEAD');
    expect(diffRange('origin/lane/_base-batch-x')).toBe('origin/lane/_base-batch-x...HEAD');
    expect(diffRange('')).toBe('origin/main...HEAD');       // solo-lane default
    expect(diffRange(undefined)).toBe('origin/main...HEAD');
    expect(diffRange('  main  ')).toBe('main...HEAD');       // trims
  });

  it('builds git diff argv, with --stat only when asked', () => {
    expect(diffArgs({ base: 'main' })).toEqual(['diff', 'main...HEAD']);
    expect(diffArgs({ base: 'main', stat: true })).toEqual(['diff', 'main...HEAD', '--stat']);
    expect(diffArgs()).toEqual(['diff', 'origin/main...HEAD']);
  });

  it('renders NOTHING for an empty/absent dismissal list (a clean review leaves the body untouched)', () => {
    expect(renderDismissalsBlock([])).toBe('');
    expect(renderDismissalsBlock(undefined)).toBe('');
    expect(renderDismissalsBlock([{}, { foo: 'bar' }])).toBe(''); // rows with neither finding nor reason are dropped
  });

  it('renders a stable, parseable dismissals block (fixed H2 + one bullet per finding)', () => {
    const block = renderDismissalsBlock([
      { finding: 'unbounded loop retries', reason: 'transient, capped elsewhere', severity: 'low', location: 'x.mjs:12' },
      { finding: 'naming nit', reason: 'matches house style' },
    ]);
    expect(block).toMatch(/^## Dismissed review findings$/m);      // fixed heading the #2171 rubric keys on
    expect(block).toContain('**[low]** unbounded loop retries _(x.mjs:12)_ — **dismissed:** transient, capped elsewhere');
    expect(block).toContain('- naming nit — **dismissed:** matches house style'); // no severity/location → clean bullet
    expect(block.endsWith('\n')).toBe(true);
  });

  it('composeBody passes a base body through UNTOUCHED when there are no dismissals (trailing ws preserved)', () => {
    expect(composeBody({ baseBody: 'land #2170\n\ndoes the thing', dismissals: [] })).toBe('land #2170\n\ndoes the thing');
    expect(composeBody({ baseBody: 'trailing\n\n', dismissals: [] })).toBe('trailing\n\n'); // truly untouched
    expect(composeBody({ baseBody: '', dismissals: [] })).toBe('');
  });

  it('composeBody appends the block after the base body (one blank-line separator)', () => {
    const out = composeBody({ baseBody: 'land #2170', dismissals: [{ finding: 'f', reason: 'r' }] });
    expect(out).toBe('land #2170\n\n## Dismissed review findings\n\n_Independent pre-PR review (#2170) surfaced these; the lane reviewed and chose not to fix them, with the reason. Recorded here as the audit trail + an input to the drain escalation rubric (#2171)._\n\n- f — **dismissed:** r\n');
  });

  it('composeBody with no base body lets the block stand alone', () => {
    const out = composeBody({ dismissals: [{ finding: 'f', reason: 'r' }] });
    expect(out).toMatch(/^## Dismissed review findings/);
  });

  it('parseDismissals is tolerant: bad JSON / non-array → [], accepts bare array or {dismissed:[]}', () => {
    expect(parseDismissals('')).toEqual([]);
    expect(parseDismissals('not json')).toEqual([]);
    expect(parseDismissals('{"queued":[]}')).toEqual([]);                 // wrong shape → empty, never throws
    expect(parseDismissals('[{"finding":"f","reason":"r","severity":"low","extra":1}]'))
      .toEqual([{ finding: 'f', reason: 'r', severity: 'low' }]);          // drops unknown fields, keeps known
    expect(parseDismissals('{"dismissed":[{"finding":"f","reason":"r"}]}'))
      .toEqual([{ finding: 'f', reason: 'r' }]);
    expect(parseDismissals('[{"nope":1}]')).toEqual([]);                   // no finding & no reason → dropped
  });
});

describe('lane-review contract guard (source-level)', () => {
  const src = readFileSync(resolve(process.cwd(), 'scripts/lane-review.mjs'), 'utf8');
  it('never calls a model — the judgement half (spawn reviewer / accept-vs-dismiss) is the session\'s', () => {
    expect(src).not.toMatch(/anthropic|claude\s+-p|\bAgent\(|openai/i);
  });
  it('only ever runs read-only git diff at its boundary (never mutates the tree)', () => {
    expect(src).toMatch(/execFileSync\('git'/);
    expect(src).not.toMatch(/'commit'|'push'|'reset'|'checkout'|'merge'/);
  });
});
