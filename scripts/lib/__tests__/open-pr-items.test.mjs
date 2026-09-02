/**
 * @file open-pr-items.test.mjs — proof of the active-PR exclusion source. The `gh` call is the I/O boundary
 *   (injected `run`); the head-ref/title → item-number EXTRACTION and the fail-soft behaviour are decided here
 *   and unit-tested without a real `gh`.
 */
import { describe, it, expect } from 'vitest';
import { itemNumsFromPr, extractItemNums, openPrItemNums, deliveredItemNumsFromPr } from '../open-pr-items.mjs';

describe('itemNumsFromPr', () => {
  it('a batch lane ref → the item numbers, with the YYYY-MM-DD date prefix NOT read as items', () => {
    expect(itemNumsFromPr('lane/batch-2026-07-08-2245-2281', '')).toEqual(['2245', '2281']);
  });
  it('a batch ref whose first post-date item looks like a time (2336) still counts as an item', () => {
    expect(itemNumsFromPr('lane/batch-2026-07-08-2336-2245-2326', '')).toEqual(['2336', '2245', '2326']);
  });
  it('a /pr lane ref (leading lane/NNN-slug) → the item number', () => {
    expect(itemNumsFromPr('lane/2315-frontierui-ci-test-check', '')).toEqual(['2315']);
  });
  it('falls back to a #NNN in the title', () => {
    expect(itemNumsFromPr('some-feature-branch', 'Fix the drain (#2330)')).toEqual(['2330']);
  });
  it('a non-lane ref alone contributes nothing (no false positives from a random branch)', () => {
    expect(itemNumsFromPr('release-2026', '')).toEqual([]);
  });
  it('a hash-id (pre-number, born-active) ref matches nothing — it is not in the numbered surface yet', () => {
    expect(itemNumsFromPr('lane/x5gougw-selector-fetch-and-exclude', '')).toEqual([]);
  });
  it('dedupes ref + title naming the same item', () => {
    expect(itemNumsFromPr('lane/foo-2281', 'PR for #2281')).toEqual(['2281']);
  });
});

describe('deliveredItemNumsFromPr (#3441 — the STRICT extractor feeding an auto-committed resolve, not the readiness-ranking exclusion above)', () => {
  it('a plain lane/<NNN>-<slug> ref → the item number, same as the loose extractor', () => {
    expect(deliveredItemNumsFromPr('lane/3412-resolve-fix', '')).toEqual(['3412']);
  });

  it('a batch ref credits ONLY its trailing segment — every other segment just names a batch sibling, not this PR\'s own delivery', () => {
    expect(deliveredItemNumsFromPr('lane/batch-2026-07-08-2245-2281', '')).toEqual(['2281']);
  });

  it('a batch ref with more siblings — still only the last', () => {
    expect(deliveredItemNumsFromPr('lane/batch-2026-07-08-2336-2245-2326', '')).toEqual(['2326']);
  });

  it('a YYYY-MM-DD run in a NON-batch ref is a date, never an id', () => {
    expect(deliveredItemNumsFromPr('lane/calibrate-2026-08-02', '')).toEqual([]);
  });

  it('a bare #NNN in the title is a CITATION, not a delivery marker — NOT matched', () => {
    expect(deliveredItemNumsFromPr('some-feature-branch', 'Fix the drain (see #2330 for background)')).toEqual([]);
  });

  it('an explicit "<id>:" subject-line marker in the title IS matched', () => {
    expect(deliveredItemNumsFromPr('some-feature-branch', 'WE #2330: fix the drain')).toEqual(['2330']);
  });

  it('an explicit "resolve(s|d) #NNN" in the title IS matched', () => {
    expect(deliveredItemNumsFromPr('some-feature-branch', 'Fix the drain — resolves #2330')).toEqual(['2330']);
    expect(deliveredItemNumsFromPr('some-feature-branch', 'resolved #2330')).toEqual(['2330']);
  });

  it('ref match and a bare title citation together — only the ref-matched id, the citation stays uncredited', () => {
    expect(deliveredItemNumsFromPr('lane/3412-resolve-fix', 'WE #3412: resolve fix (root cause also affects #2330)')).toEqual(['3412']);
  });

  it('a non-lane ref alone contributes nothing', () => {
    expect(deliveredItemNumsFromPr('release-2026', '')).toEqual([]);
  });

  it('a hash-id (pre-number) ref matches nothing', () => {
    expect(deliveredItemNumsFromPr('lane/x5gougw-selector-fetch-and-exclude', '')).toEqual([]);
  });

  it('a scope-authoring PR (the #2613 dispatcher pass) is an ANNOTATION, not a delivery — never credited', () => {
    // #3441 round 2 — a scope-authoring PR is a real, merged, non-manifest WE PR naming the item in both
    // ref and title (prepare-scope-agent-brief.md's own convention), but it never builds the item.
    expect(deliveredItemNumsFromPr('lane/1234-scope', 'WE #1234: author scope: for #1234')).toEqual([]);
  });

  it('a prepare-decision PR is also an ANNOTATION — never credited', () => {
    expect(deliveredItemNumsFromPr('lane/1234-prepare-decision', 'WE #1234: prepare decision forks for #1234')).toEqual([]);
  });

  it('a retry ref (lane/<NNN><letter>-<slug>, #3110) still names its item', () => {
    expect(deliveredItemNumsFromPr('lane/3441b-fix-something', '')).toEqual(['3441']);
    expect(deliveredItemNumsFromPr('lane/3441c-fix-something', 'WE #3441: resolve-on-land fix')).toEqual(['3441']);
  });

  it('#3441 round 3 — the retry-letter tolerance is ANCHORED to the leading segment, not any segment: an ordinary tech-slug fragment (a decade, a scale multiplier, a size unit) is never misread as a second id', () => {
    expect(deliveredItemNumsFromPr('lane/2412-retro-80s-revival', '')).toEqual(['2412']);
    expect(deliveredItemNumsFromPr('lane/2412-css-1980s-retro-theme', '')).toEqual(['2412']);
    expect(deliveredItemNumsFromPr('lane/2412-add-90s-easter-egg', '')).toEqual(['2412']);
    expect(deliveredItemNumsFromPr('lane/2412-add-50k-users-milestone', '')).toEqual(['2412']);
    expect(deliveredItemNumsFromPr('lane/2412-support-100x-scale', '')).toEqual(['2412']);
  });

  it('#3441 round 3 — "batch" as an ordinary slug word (not the batch-chain convention) does not suppress the real leading id', () => {
    expect(deliveredItemNumsFromPr('lane/2415-batch-job-scheduler', '')).toEqual(['2415']);
    expect(deliveredItemNumsFromPr('lane/2415-nightly-batch', '')).toEqual(['2415']);
  });

  it('#3441 round 4 — a real verb-led, id-LAST ref convention this repo\'s own maintenance tooling mints (no leading id, no "batch") still names its item', () => {
    expect(deliveredItemNumsFromPr('lane/build-3067', '')).toEqual(['3067']);
    expect(deliveredItemNumsFromPr('lane/resolve-2712', '')).toEqual(['2712']);
    expect(deliveredItemNumsFromPr('lane/heal-stranded-2319', '')).toEqual(['2319']);
    expect(deliveredItemNumsFromPr('lane/fix-stranded-backlog-id-3392', '')).toEqual(['3392']);
  });

  it('#3441 round 4 — the trailing-fallback still excludes a date run (the regression round 4 caught: a plain date-suffixed ref must not credit its day-of-month as an id)', () => {
    expect(deliveredItemNumsFromPr('lane/calibrate-2026-08-02', '')).toEqual([]);
  });

  it('#3441 round 4 — "resolve: #NNN — subject" (colon right after "resolve", a real repeated commit-title shape) is matched, same as the colon-less form', () => {
    expect(deliveredItemNumsFromPr('some-feature-branch', 'resolve: #2712 — console board cross-lane span bars')).toEqual(['2712']);
    expect(deliveredItemNumsFromPr('some-feature-branch', 'resolved: #2554 — ratify all 8')).toEqual(['2554']);
  });

  it('#3441 round 4 — "unresolved #NNN" is NOT "resolve #NNN" (word-boundary check, not a substring match)', () => {
    expect(deliveredItemNumsFromPr('some-feature-branch', 'unresolved issue #2330 mentioned')).toEqual([]);
  });

  it('#3441 round 5 — a real verb-led ref with the id NOT last (id right after the verb, more words after it) is NOT guessed at via the trailing segment — a coincidental trailing number must never be credited', () => {
    // scripts/pr-land.mjs cites a real merged PR at exactly this ref shape: lane/fix-2165-ci-fui-checkout.
    expect(deliveredItemNumsFromPr('lane/fix-2165-ci-fui-checkout', '')).toEqual([]);
    expect(deliveredItemNumsFromPr('lane/fix-2165-legacy-24', '')).toEqual([]);
    expect(deliveredItemNumsFromPr('lane/deploy-3067-24', '')).toEqual([]);
  });

  it('#3441 round 5 — the id-last verb allowlist is closed: an unlisted verb phrase never triggers the trailing fallback, even with a trailing digit run', () => {
    expect(deliveredItemNumsFromPr('lane/deploy-3067', '')).toEqual([]);
  });

  it('#3441 round 5 — a date-only batch ref (no items named) must not credit its day-of-month either (the batch branch was missing round 4\'s date-span guard)', () => {
    expect(deliveredItemNumsFromPr('lane/batch-2026-08-02', '')).toEqual([]);
    expect(deliveredItemNumsFromPr('lane/batch-2026-08-02-02', '')).toEqual([]);
  });

  it('#3441 round 5 — a normal batch chain right after a date is unaffected by the date-span guard', () => {
    expect(deliveredItemNumsFromPr('lane/batch-2026-08-02-3067-3068', '')).toEqual(['3068']);
  });

  it('#3441 round 6 — a <id>-<verb>-<id> ref is AMBIGUOUS (real example: lane/3383-resolve-3412, this very item\'s own parent epic\'s git history) — emit neither id rather than guess the lead', () => {
    expect(deliveredItemNumsFromPr('lane/3383-resolve-3412', 'backlog/3412: resolve -- built and merged via PR #1765, the dispatched build agent never closed it out')).toEqual([]);
  });

  it('#3441 round 6 — a lead id with an UNLISTED mid-segment verb is not treated as ambiguous — the lead still counts', () => {
    expect(deliveredItemNumsFromPr('lane/3383-notaverb-3412', '')).toEqual(['3383']);
  });

  it('#3441 round 7 — the collision guard detects the SHAPE, not an exact segment count: an extra word anywhere around the embedded verb/id still triggers the ambiguity back-off', () => {
    expect(deliveredItemNumsFromPr('lane/3383-resolve-3412-cleanup', '')).toEqual([]);
    expect(deliveredItemNumsFromPr('lane/3383-resolve-cleanup-3412', '')).toEqual([]);
    expect(deliveredItemNumsFromPr('lane/3383-please-resolve-3412', '')).toEqual([]);
    expect(deliveredItemNumsFromPr('lane/3383-resolve-3412a', '')).toEqual([]);
  });

  it('#3441 round 7 — a date-adjacent lead (no full YYYY-MM-DD span, so not date-excluded) colliding with an embedded verb+id is still caught', () => {
    expect(deliveredItemNumsFromPr('lane/2026-08-resolve-3412', '')).toEqual([]);
  });
});

describe('extractItemNums', () => {
  it('dedupes across many PRs', () => {
    const prs = [
      { headRefName: 'lane/a-2281', title: '' },
      { headRefName: 'lane/b-2315', title: 'thing #2281' },
      { headRefName: 'main', title: '' },
    ];
    expect(new Set(extractItemNums(prs))).toEqual(new Set(['2281', '2315']));
  });
  it('empty / nullish input → []', () => {
    expect(extractItemNums(null)).toEqual([]);
    expect(extractItemNums([])).toEqual([]);
  });
});

describe('openPrItemNums (fail-soft IO)', () => {
  it('gh missing / non-zero → unavailable, never throws, nums empty', () => {
    const run = () => ({ status: 1, stdout: '', stderr: 'command not found: gh\n' });
    const r = openPrItemNums({ run });
    expect(r.nums).toEqual([]);
    expect(r.unavailable).toBe(true);
  });
  it('unparseable gh output → unavailable', () => {
    const run = () => ({ status: 0, stdout: 'not json' });
    expect(openPrItemNums({ run }).unavailable).toBe(true);
  });
  it('valid gh output → extracted item numbers', () => {
    const run = () => ({ status: 0, stdout: JSON.stringify([
      { headRefName: 'lane/batch-2245-2281', title: '' },
      { headRefName: 'feature', title: 'Land #2330' },
    ]) });
    expect(new Set(openPrItemNums({ run }).nums)).toEqual(new Set(['2245', '2281', '2330']));
  });
});
