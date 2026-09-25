/**
 * @file open-pr-items.test.mjs — proof of the active-PR exclusion source. The `gh` call is the I/O boundary
 *   (injected `run`); the head-ref/title → item-number EXTRACTION and the fail-soft behaviour are decided here
 *   and unit-tested without a real `gh`.
 */
import { describe, it, expect } from 'vitest';
import { itemNumsFromPr, extractItemNums, openPrItemNums, openPrsByItem, deliveredItemNumsFromPr, deliveredHashFromPr } from '../open-pr-items.mjs';

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

  it('PR #1851 review round 1 (human) — a mid-title "NNN:" that is NOT the leading subject marker is a citation, not a second delivery — the marker regex is anchored to the subject position', () => {
    expect(deliveredItemNumsFromPr('lane/3441-fix-parser', 'WE #3441: cap batch size at 500: avoid OOM')).toEqual(['3441']);
    expect(deliveredItemNumsFromPr('lane/3441-fix-parser', 'WE #3441: fix parser (design mirrors 2787: the config loader shape)')).toEqual(['3441']);
  });

  it('PR #1851 review round 1 (human) — an ordinary mundane "NNN:" title with no lane-id lead is never mistaken for a subject marker (HTTP codes, ports, rate limits)', () => {
    expect(deliveredItemNumsFromPr('some-feature-branch', 'Handle HTTP 404: return friendly error page')).toEqual([]);
    expect(deliveredItemNumsFromPr('some-feature-branch', 'Add rate limiting (max 100: requests per min)')).toEqual([]);
  });

  it('PR #1851 review round 1 (human) — a real multi-id verb-led ref (lane/reconcile-<id>-<id>-<id>, the actually-merged lane/reconcile-3147-3096-3239, PR #1599) credits ONLY the trailing/final item, the same as a batch chain', () => {
    expect(deliveredItemNumsFromPr('lane/reconcile-3147-3096-3239', '')).toEqual(['3239']);
    expect(deliveredItemNumsFromPr('lane/reconcile-2716', '')).toEqual(['2716']);
  });

  it('#3473 — a multi-PR/graduation-tracked item\'s title-anchor vector (PR #1866\'s exact ref/title) is NOT credited when the PR body discloses it does not resolve the item', () => {
    expect(deliveredItemNumsFromPr(
      'lane/3443-computefreeslots-excludes-dirty-lanes',
      'WE #3443: readiness/computeFreeSlots excludes dirty (orphaned) unleased lanes',
      { body: 'Graduates origin/lane/mechanical-dispatcher onto main, as one small piece of the ongoing graduation tracked by #3443 — this PR does not resolve #3443, it lands one increment of it.' },
    )).toEqual([]);
  });

  it('#3473 — the ref-lead-segment vector (the reopen PR\'s exact ref/title) is NOT credited when the PR\'s changed files are all markdown (pure backlog housekeeping)', () => {
    expect(deliveredItemNumsFromPr(
      'lane/3443-reopen-and-3441-gap-followup',
      'backlog/3443: reopen (false auto-resolve) + file the extractor gap it exposed',
      { changedFiles: ['backlog/3443-graduate-origin-lane-mechanical-dispatcher-to-main-in-small.md', 'backlog/3473-resolve-on-land-extractor-mis-credited-3443-a-multi-pr-gradu.md'] },
    )).toEqual([]);
  });

  it('#3473 guard 7 regression proof — a real single-PR delivery whose changed-file list is NOT all-.md (a genuine code PR that happens to also touch one doc file) is still credited normally', () => {
    expect(deliveredItemNumsFromPr(
      'lane/3412-resolve-fix',
      'WE #3412: resolve fix',
      { changedFiles: ['scripts/lib/open-pr-items.mjs', 'backlog/3412-resolve-fix.md'] },
    )).toEqual(['3412']);
  });

  it('#3473 guard 6 is SCOPED to the specific disclaimed id — an unrelated #NNN mention plus a "does not resolve #MMM" disclaimer for a DIFFERENT id still credits NNN', () => {
    expect(deliveredItemNumsFromPr(
      'lane/3412-resolve-fix',
      'WE #3412: resolve fix (root cause also affects #2330)',
      { body: 'this PR does not resolve #2330, that is tracked separately' },
    )).toEqual(['3412']);
  });

  it('#3473 — PR #1599\'s exact ref/title/files reproduced directly against deliveredItemNumsFromPr: WITHOUT guard 7 this ref/title combination would wrongly credit BOTH #3096 (title-anchor) and #3239 (ref trailing-segment) — worse than the single false credit dispatch-lane-io\'s sibling checker hit live; guard 7\'s all-.md short-circuit (the real merge diff is 4 files, all .md/one comment-marker repoint — actually all .md per PR #1599\'s own body: "No code behaviour changes") suppresses both', () => {
    expect(deliveredItemNumsFromPr(
      'lane/reconcile-3147-3096-3239',
      '#3096: reconcile the three-way dispatch duplicate — #3096 survives, #3147 + #3239 collapse',
      {},
    )).toEqual(['3239', '3096']); // confirms the UNGUARDED read: both ids wrongly credited from ref+title alone (ref-derived id first, then title-derived)
    expect(deliveredItemNumsFromPr(
      'lane/reconcile-3147-3096-3239',
      '#3096: reconcile the three-way dispatch duplicate — #3096 survives, #3147 + #3239 collapse',
      { changedFiles: ['backlog/3096-route-the-conveyor-s-build-dispatch-through-the-declared-dis.md', 'backlog/3147-x.md', 'backlog/3239-x.md', 'skills-src/conveyor/SKILL.md'] },
    )).toEqual([]); // guard 7 (all-.md diff) suppresses both once the real changed-file shape is supplied
  });

  it('#3473 guard 8 — PR #1599\'s REAL (stale) gh changedFiles list (17 files, 3 real .mjs) defeats guard 7, but the blanket "no code changes" body disclaimer (guard 8) still excludes it', () => {
    // Live-verified 2026-09-04: `gh pr view 1599 --json files` returns 17 files including
    // scripts/lib/jury-core.mjs, scripts/lib/jury-ledger.mjs, scripts/workflows/review-parked-prs.mjs — NOT
    // all-.md — even though the PR's true merge-commit diff (`git show 90fe066f6 --stat`) is 4 files, all
    // markdown. Guard 7 alone cannot exclude this PR from that real (stale) gh data; guard 8 (the PR's own
    // "No code behaviour changes" opening line) does.
    expect(deliveredItemNumsFromPr(
      'lane/reconcile-3147-3096-3239',
      '#3096: reconcile the three-way dispatch duplicate — #3096 survives, #3147 + #3239 collapse',
      {
        body: 'No code behaviour changes — this is a backlog reconciliation plus one in-code comment repoint.',
        changedFiles: [
          'backlog/3096-route-the-conveyor-s-build-dispatch-through-the-declared-dis.md',
          'backlog/3147-wire-the-conveyor-s-build-prepare-dispatch-onto-the-dispatch.md',
          'backlog/3239-the-conveyor-tick-executes-spawnbuilds-by-hand-instead-of-th.md',
          'backlog/3314-should-claim-accuracy-be-a-mandatory-lens.md',
          'docs/agent/platform-decisions.md',
          'scripts/lib/jury-core.mjs',
          'scripts/lib/jury-ledger.mjs',
          'scripts/workflows/review-parked-prs.mjs',
          'skills-src/conveyor/SKILL.md',
        ],
      },
    )).toEqual([]);
  });

  it('#3473 guard 8 — PR #1613\'s real body ("No code changes — two backlog files.") also matches the blanket disclaimer', () => {
    expect(deliveredItemNumsFromPr(
      'lane/split-3096',
      'WE #3096: split along its two scope entries — skill rewiring vs liveness hardening',
      { body: 'Splits #3096 along its two scope: entries. No code changes — two backlog files.' },
    )).toEqual([]);
  });

  it('#3473 guard 8 does not over-fire on a real delivery body that happens to mention "no code" in an unrelated sense', () => {
    expect(deliveredItemNumsFromPr(
      'lane/3412-resolve-fix',
      'WE #3412: resolve fix',
      { body: 'This fix requires no code review sign-off beyond CI, and lands the feature end to end.' },
    )).toEqual(['3412']);
  });

  it('#3916 (live case) — guard 8 must not fire on a QUOTED citation of another item\'s "no code change" precedent; PR #2594 was a real, large multi-.mjs-file port whose body cited #3894/#3482\'s own already-landed characterization of a DIFFERENT, narrower deviation, and the unguarded quote match wiped its credited id entirely — the exact silent skip resolve-on-land\'s totality report (#2899 J2/J3) cannot see, because it never reaches `landedThisPass` in the first place', () => {
    const body = 'matching the `#3894`/`#3482` "already landed, no code change" precedent in #3443\'s own Progress log. Likewise the branch\'s test coverage is already superseded.';
    expect(deliveredItemNumsFromPr(
      'lane/3916-graduate-test-setup-heavy-command-admission-and-file-locks-c',
      'Graduate test setup, heavy-command admission and file-locks from lane/mechanical-dispatcher (#3916)',
      { body },
    )).toEqual(['3916']);
  });

  it('#3916 — guard 8 still fires when the SAME phrase describes THIS PR unquoted, even alongside an unrelated quoted mention', () => {
    expect(deliveredItemNumsFromPr(
      'lane/split-3096',
      'WE #3096: split along its two scope entries — skill rewiring vs liveness hardening',
      { body: 'Splits #3096 along its two scope: entries. No code changes — two backlog files. (cf. "some other quoted note")' },
    )).toEqual([]);
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

describe('openPrItemNums (multi-repo)', () => {
  it('reads every constellation repo with an explicit --repo and unions the item numbers', () => {
    const calls = [];
    const byRepo = {
      'chalbert/web-everything': [{ headRefName: 'lane/2100-spec', title: '' }],
      'chalbert/frontierui': [],
      'chalbert/plateau-app': [{ headRefName: 'lane/2072-impl', title: '' }],
    };
    const run = (args) => { calls.push(args); return { status: 0, stdout: JSON.stringify(byRepo[args[args.indexOf('--repo') + 1]]) }; };
    const r = openPrItemNums({ run });
    expect(calls.map((a) => a[a.indexOf('--repo') + 1])).toEqual(['chalbert/web-everything', 'chalbert/frontierui', 'chalbert/plateau-app']);
    expect(new Set(r.nums)).toEqual(new Set(['2100', '2072']));
    expect(r.partial).toBeUndefined();
  });
  it('a failing SIBLING repo keeps the other numbers and is reported under partial', () => {
    const run = (args) => (args.includes('chalbert/plateau-app')
      ? { status: 1, stdout: '', stderr: 'HTTP 404\n' }
      : { status: 0, stdout: JSON.stringify([{ headRefName: 'lane/2100-x', title: '' }]) });
    const r = openPrItemNums({ run });
    expect(r.nums).toEqual(['2100']);
    expect(r.partial).toEqual([{ repo: 'chalbert/plateau-app', reason: 'HTTP 404' }]);
    expect(r.unavailable).toBeUndefined();
  });
  it('the WE read failing is unavailable, as before', () => {
    const run = (args) => (args.includes('chalbert/web-everything') ? { status: 1, stdout: '', stderr: 'boom' } : { status: 0, stdout: '[]' });
    expect(openPrItemNums({ run })).toEqual({ nums: [], unavailable: true, reason: 'boom' });
  });
});

describe('openPrsByItem (the PR identity the Decision Docket lists under each item)', () => {
  const prs = [
    { number: 2376, headRefName: 'lane/ratify-3375', title: 'ratify #3375: proof', url: 'https://github.com/o/we/pull/2376' },
    { number: 12, headRefName: 'lane/3375-impl', title: 'impl', url: 'https://github.com/o/fui/pull/12' },
  ];

  it('keeps every PR under each item it lands, with its repo, number, title and url — from ONE gh call per repo', () => {
    const calls = [];
    const run = (args) => { calls.push(args); const repo = args[args.indexOf('--repo') + 1]; return { status: 0, stdout: JSON.stringify(repo === 'o/we' ? [prs[0]] : [prs[1]]) }; };
    const r = openPrsByItem({ run, repos: ['o/we', 'o/fui'] });
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('headRefName,title,number,url');
    expect(r.nums).toEqual(['3375']);
    expect(r.byItem['3375']).toEqual([
      { repo: 'o/we', number: 2376, title: 'ratify #3375: proof', url: 'https://github.com/o/we/pull/2376', headRefName: 'lane/ratify-3375' },
      { repo: 'o/fui', number: 12, title: 'impl', url: 'https://github.com/o/fui/pull/12', headRefName: 'lane/3375-impl' },
    ]);
  });

  it('fails soft like openPrItemNums: a failing primary repo is unavailable, and openPrItemNums drops byItem', () => {
    expect(openPrsByItem({ run: () => ({ status: 1, stdout: '', stderr: 'no gh\n' }), repos: ['o/we'] })).toEqual({ nums: [], byItem: {}, unavailable: true, reason: 'no gh' });
    const r = openPrItemNums({ run: () => ({ status: 0, stdout: JSON.stringify([prs[0]]) }), repos: ['o/we'] });
    expect(r).toEqual({ nums: ['3375'] });
  });
});

describe('deliveredHashFromPr (#3914 — a card filed AND delivered in the same hash-led lane PR)', () => {
  it('credits the lane-ref LEAD hash (the real #3459/#3492/#3638 refs)', () => {
    expect(deliveredHashFromPr('lane/xaa7r2n-itemnumfromref-attempt-tag', '')).toBe('xaa7r2n');
    expect(deliveredHashFromPr('lane/x3jmao3-review-dispatch-wait-ms', 'WE #x3jmao3: bounded retry')).toBe('x3jmao3');
  });

  it('a hash NOT in the lead position (a spin-off named later in the slug) is never credited', () => {
    expect(deliveredHashFromPr('lane/3412-fix-and-file-xspin01', '')).toBeNull();
    expect(deliveredHashFromPr('lane/fix-xspin01', '')).toBeNull();
  });

  it('non-lane refs and numeric leads return null (the numeric path is deliveredItemNumsFromPr)', () => {
    expect(deliveredHashFromPr('xaa7r2n-feature', '')).toBeNull();
    expect(deliveredHashFromPr('lane/3412-resolve-fix', '')).toBeNull();
  });

  it('requires the PR to have FILED the card when the changed-file list is known', () => {
    expect(deliveredHashFromPr('lane/xaa7r2n-x', '', { changedFiles: ['backlog/xaa7r2n-card.md', 'scripts/a.mjs'] })).toBe('xaa7r2n');
    expect(deliveredHashFromPr('lane/xaa7r2n-x', '', { changedFiles: ['backlog/xother1-card.md', 'scripts/a.mjs'] })).toBeNull();
  });

  it('shares the whole-PR guards: annotation, all-.md housekeeping, "no code changes"', () => {
    expect(deliveredHashFromPr('lane/xaa7r2n-scope', 'WE #xaa7r2n: author scope: for #xaa7r2n')).toBeNull();
    expect(deliveredHashFromPr('lane/xaa7r2n-x', '', { changedFiles: ['backlog/xaa7r2n-card.md'] })).toBeNull();
    expect(deliveredHashFromPr('lane/xaa7r2n-x', '', { body: 'No code changes — backlog only.' })).toBeNull();
  });
});
