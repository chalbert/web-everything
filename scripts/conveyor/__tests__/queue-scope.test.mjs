/**
 * @file queue-scope.test.mjs — epic #3383. The OPT-IN queue scoping for the conveyor's repo-wide mechanical
 * passes: the pure marker parse/serialize, the pure PR/branch matcher, and the `scopePrsToQueue` boundary the
 * four repo-wide passes call. No `gh`, no subprocess, no real lane pool — every reader injected, mirroring
 * `we:scripts/conveyor/__tests__/duplicate-pr-watch.test.mjs`'s own shape.
 *
 * THE REGRESSION HALF IS THE POINT. Half of this file exists to prove that with NO marker and NO env override
 * the filters are the IDENTITY function, because the whole design rests on a production checkout keeping
 * today's repo-wide behavior byte for byte.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  QUEUE_SCOPE_ENV,
  emptyScopeState,
  parseScopeState,
  setScope,
  clearScope,
  serializeScopeState,
  envScopeOverride,
  isItemId,
  normalizeQueueIds,
  refScopeTokens,
  prMatchesQueueIds,
  branchMatchesQueueIds,
  filterPrsToQueueIds,
  scopePrsToQueue,
  readScopeState,
  isQueueScopeEnabled,
  scopeStorePath,
} from '../queue-scope.mjs';

const silent = () => {};

describe('the marker — parse / set / clear / serialize (pure)', () => {
  it('an absent marker is NOT scoped — the production default', () => {
    expect(emptyScopeState()).toEqual({ scopeMechanicalPassesToQueue: false, reason: null, by: null, at: null });
  });

  it('parses a real marker', () => {
    const s = parseScopeState('{"scopeMechanicalPassesToQueue":true,"reason":"dogfooding","by":"nic","at":"2026-09-12T00:00:00.000Z"}');
    expect(s.scopeMechanicalPassesToQueue).toBe(true);
    expect(s.reason).toBe('dogfooding');
    expect(s.by).toBe('nic');
  });

  it.each([
    ['empty text', ''],
    ['whitespace', '   \n '],
    ['unparseable JSON', '{not json'],
    ['a bare array (Array.isArray guard)', '[1,2,3]'],
    ['null', 'null'],
    ['a string', '"true"'],
  ])('FAILS OPEN (not scoped) on %s — a corrupt marker must never narrow a production conveyor to nothing', (_label, text) => {
    expect(parseScopeState(text).scopeMechanicalPassesToQueue).toBe(false);
  });

  it('only a literal `true` scopes — a truthy string does not', () => {
    expect(parseScopeState('{"scopeMechanicalPassesToQueue":"yes"}').scopeMechanicalPassesToQueue).toBe(false);
    expect(parseScopeState('{"scopeMechanicalPassesToQueue":1}').scopeMechanicalPassesToQueue).toBe(false);
  });

  it('set is idempotent and stamps an injected clock; clear is total', () => {
    const a = setScope({ reason: 'scratch run', by: 'nic' }, Date.parse('2026-09-12T10:00:00Z'));
    expect(a).toEqual({
      scopeMechanicalPassesToQueue: true, reason: 'scratch run', by: 'nic', at: '2026-09-12T10:00:00.000Z',
    });
    expect(clearScope()).toEqual(emptyScopeState());
  });

  it('round-trips through serialize → parse', () => {
    const s = setScope({ reason: 'r', by: 'b' }, 0);
    expect(parseScopeState(serializeScopeState(s))).toEqual(s);
  });
});

describe('the env override — three-valued, and unrecognized values fail open', () => {
  it.each([['1'], ['true'], ['on'], ['yes'], ['TRUE']])('%s ⇒ on', (v) => {
    expect(envScopeOverride({ [QUEUE_SCOPE_ENV]: v })).toBe(true);
  });
  it.each([['0'], ['false'], ['off'], ['no']])('%s ⇒ off', (v) => {
    expect(envScopeOverride({ [QUEUE_SCOPE_ENV]: v })).toBe(false);
  });
  it('absent ⇒ null (defer to the marker), not false — so a marker the operator set still wins', () => {
    expect(envScopeOverride({})).toBe(null);
    expect(envScopeOverride({ [QUEUE_SCOPE_ENV]: '' })).toBe(null);
  });
  it('garbage ⇒ off, never a guessed on', () => {
    expect(envScopeOverride({ [QUEUE_SCOPE_ENV]: 'maybe' })).toBe(false);
  });
});

describe('id shapes and queue normalization (pure)', () => {
  it('accepts the two real id shapes and nothing else', () => {
    expect(isItemId('3639')).toBe(true);
    expect(isItemId('xe6nenk')).toBe(true);
    expect(isItemId('lane')).toBe(false);
    expect(isItemId('mechanical')).toBe(false);
    expect(isItemId('')).toBe(false);
  });

  it('normalizes the queue the way queue-store does — `#NNN` sugar, zero padding, case, dedup', () => {
    expect(normalizeQueueIds(['#3639', '042', '42', 'XE6NENK', 'xe6nenk', 'not-an-id', null, '']))
      .toEqual(['3639', '42', 'xe6nenk']);
  });
});

describe('the ref matcher — segment-exact, never substring', () => {
  it('extracts the item id from a normal lane ref', () => {
    expect(refScopeTokens('lane/3631-throttle-review-set-label-net-diff-exec')).toEqual(['3631']);
    expect(refScopeTokens('lane/xe6nenk-prototype-shaped-dispatch-brief')).toEqual(['xe6nenk']);
  });

  it('extracts EVERY id of a batch ref — a scoped instance owns every item it queued, unlike the strict `prDeliveredItem` delivery-credit rule', () => {
    expect(refScopeTokens('lane/batch-2026-09-01-3210-3211-3212')).toEqual(['3210', '3211', '3212']);
  });

  it('drops a YYYY-MM-DD run so `lane/calibrate-2026-08-02` never reads as item 2026 (the #2899 jury finding)', () => {
    expect(refScopeTokens('lane/calibrate-2026-08-02')).toEqual([]);
  });

  it('accepts a retry-lettered NUMERIC ref (`lane/3230f-…`, the #3110 convention) but not a hash+letter', () => {
    expect(refScopeTokens('lane/3230f-verify-staged-write')).toEqual(['3230']);
    expect(refScopeTokens('lane/xe6nenkq-something')).toEqual([]);
  });

  it('contributes NO id for a slug-only branch — this is what keeps an unrelated PR out', () => {
    expect(refScopeTokens('lane/mechanical-dispatcher')).toEqual([]);
    expect(refScopeTokens('main')).toEqual([]);
    expect(refScopeTokens(null)).toEqual([]);
  });

  it('is segment-exact: a queue id that is a PREFIX of the ref id does not match', () => {
    expect(prMatchesQueueIds({ headRefName: 'lane/3631-throttle' }, ['363'])).toBe(false);
    expect(prMatchesQueueIds({ headRefName: 'lane/3631-throttle' }, ['3631'])).toBe(true);
  });
});

describe('prMatchesQueueIds — ref and title only', () => {
  it('matches on the title marker when the ref is slug-only', () => {
    expect(prMatchesQueueIds({ headRefName: 'lane/some-slug', title: 'WE #3639: the thing' }, ['3639'])).toBe(true);
  });

  it('is bounded in the title too — 13631 and 36310 are not 3631', () => {
    expect(prMatchesQueueIds({ headRefName: 'x', title: 'WE #13631: nope' }, ['3631'])).toBe(false);
    expect(prMatchesQueueIds({ headRefName: 'x', title: 'WE #36310: nope' }, ['3631'])).toBe(false);
  });

  it('never reads the PR BODY — a prose citation of a queued item must not pull an unrelated PR into scope', () => {
    const pr = { headRefName: 'lane/unrelated-slug', title: 'WE: something else', body: 'see #3639 for background' };
    expect(prMatchesQueueIds(pr, ['3639'])).toBe(false);
  });

  it('an EMPTY id list matches nothing — scoping to an empty queue narrows to zero, never back to everything', () => {
    expect(prMatchesQueueIds({ headRefName: 'lane/3639-x' }, [])).toBe(false);
  });
});

describe('branchMatchesQueueIds — the verify-dispatch (lane-pool) twin', () => {
  it('matches a lane on a queued item and rejects one on another instance"s work', () => {
    expect(branchMatchesQueueIds('lane/3639-changeset-scope', ['3639'])).toBe(true);
    expect(branchMatchesQueueIds('lane/2900-unrelated', ['3639'])).toBe(false);
    expect(branchMatchesQueueIds(null, ['3639'])).toBe(false);
  });
});

// ── THE REGRESSION HALF — default/unscoped behavior must be byte-identical to today ────────────────────────

const REPO_WIDE_PRS = [
  { number: 2113, headRefName: 'lane/3639-changeset-scoped-instances', title: 'WE #3639: changeset scope' },
  { number: 2127, headRefName: 'lane/3371-native-deny-history-strip', title: 'WE #3371: deny history strip' },
  { number: 2131, headRefName: 'lane/3631-throttle-review-set-label', title: 'WE #3631: throttle' },
  { number: 2140, headRefName: 'lane/mechanical-dispatcher', title: 'chore: long-lived dispatch branch' },
  { number: 2141, headRefName: 'lane/xe6nenk-prototype-shaped-dispatch-brief', title: 'WE #xe6nenk: prototype' },
];

describe('scopePrsToQueue — DEFAULT OFF is the identity function (regression guard)', () => {
  it('returns the input list unchanged, same objects, same order, when scoping is off', () => {
    const out = scopePrsToQueue(REPO_WIDE_PRS, { enabled: false, ids: ['3639'], log: silent });
    expect(out).toBe(REPO_WIDE_PRS);
  });

  it('does not even consult the id list when off — an off switch cannot be narrowed by a stale queue', () => {
    expect(scopePrsToQueue(REPO_WIDE_PRS, { enabled: false, ids: [], log: silent })).toHaveLength(5);
  });

  it('logs NOTHING when off — an unscoped production tick gains no new stderr noise', () => {
    const lines = [];
    scopePrsToQueue(REPO_WIDE_PRS, { enabled: false, ids: ['3639'], log: (m) => lines.push(m) });
    expect(lines).toEqual([]);
  });

  it('a non-array input degrades to [] rather than throwing', () => {
    expect(scopePrsToQueue(null, { enabled: false, log: silent })).toEqual([]);
  });
});

describe('scopePrsToQueue — ON narrows to queue membership, and announces it', () => {
  it('keeps only the PRs the queue names', () => {
    const out = scopePrsToQueue(REPO_WIDE_PRS, { enabled: true, ids: ['3639', 'xe6nenk'], log: silent });
    expect(out.map((p) => p.number)).toEqual([2113, 2141]);
  });

  it('normalizes the ids it is handed (`#3639`, padding, case)', () => {
    const out = scopePrsToQueue(REPO_WIDE_PRS, { enabled: true, ids: ['#3639', 'XE6NENK'], log: silent });
    expect(out.map((p) => p.number)).toEqual([2113, 2141]);
  });

  it('an EMPTY queue narrows to nothing — never silently back to repo-wide', () => {
    expect(scopePrsToQueue(REPO_WIDE_PRS, { enabled: true, ids: [], log: silent })).toEqual([]);
  });

  it('announces the narrowing on stderr — a scoped pass that says nothing looks broken', () => {
    const lines = [];
    scopePrsToQueue(REPO_WIDE_PRS, { enabled: true, ids: ['3639'], label: 'reconcile-pass', log: (m) => lines.push(m) });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('reconcile-pass');
    expect(lines[0]).toContain('5 open PR(s) → 1');
  });
});

describe('THE LIVE BUG, reproduced as a shape: N queued items, M unrelated open PRs', () => {
  // 2026-09-12: a scratch checkout seeded with 5 items ran one bounded tick. Its repo-wide passes found two
  // unrelated `review:pending` PRs, reviewed them, and the drain landed both.
  const QUEUE = ['3617', '3618', '3619', '3620', '3621'];
  const MINE = [
    { number: 3001, headRefName: 'lane/3617-a', title: 'WE #3617: a' },
    { number: 3002, headRefName: 'lane/3620-b', title: 'WE #3620: b' },
  ];
  const THE_TWO_THAT_GOT_LANDED = [
    { number: 2127, headRefName: 'lane/3371-native-deny-history-strip-isolation', title: 'WE #3371: native deny history strip', labels: [{ name: 'review:pending' }] },
    { number: 2131, headRefName: 'lane/3631-throttle-review-set-label-net-diff-exec', title: 'WE #3631: throttle review-set-label', labels: [{ name: 'review:pending' }] },
  ];
  const OPEN = [...MINE, ...THE_TWO_THAT_GOT_LANDED,
    { number: 2140, headRefName: 'lane/mechanical-dispatcher', title: 'chore: dispatch branch' }];

  it('UNSCOPED (today): every one of the M unrelated PRs is a candidate — the bug, pinned', () => {
    const out = scopePrsToQueue(OPEN, { enabled: false, ids: QUEUE, log: silent });
    expect(out.map((p) => p.number)).toEqual([3001, 3002, 2127, 2131, 2140]);
  });

  it('SCOPED: only the N queued items survive; neither PR that actually got landed is reachable', () => {
    const out = scopePrsToQueue(OPEN, { enabled: true, ids: QUEUE, log: silent });
    expect(out.map((p) => p.number)).toEqual([3001, 3002]);
    for (const leaked of THE_TWO_THAT_GOT_LANDED) {
      expect(out.some((p) => p.number === leaked.number)).toBe(false);
    }
  });

  it('filterPrsToQueueIds is the same narrowing, reachable without the IO boundary', () => {
    expect(filterPrsToQueueIds(OPEN, QUEUE).map((p) => p.number)).toEqual([3001, 3002]);
  });
});

describe('the fs boundary — marker path, read, and the enabled predicate', () => {
  it('resolves the sidecar next to its siblings under .conveyor/', () => {
    expect(scopeStorePath('/repo')).toBe(join('/repo', '.conveyor', 'queue-scope.json'));
  });

  it('a missing file reads as NOT scoped', () => {
    expect(readScopeState(join(tmpdir(), 'definitely-not-here-queue-scope.json')).scopeMechanicalPassesToQueue).toBe(false);
  });

  it('reads a real marker off disk, and the env override beats it in BOTH directions', () => {
    const dir = mkdtempSync(join(tmpdir(), 'we-queue-scope-'));
    const path = join(dir, 'queue-scope.json');
    try {
      writeFileSync(path, serializeScopeState(setScope({ reason: 'scratch' }, 0)));
      expect(readScopeState(path).scopeMechanicalPassesToQueue).toBe(true);
      expect(isQueueScopeEnabled({ env: {}, path })).toBe(true);
      // An explicit `0` beats a marker someone forgot to clear…
      expect(isQueueScopeEnabled({ env: { [QUEUE_SCOPE_ENV]: '0' }, path })).toBe(false);
      // …and an explicit `1` (what `runner.mjs --scope-to-queue` sets) works with no marker at all.
      expect(isQueueScopeEnabled({ env: { [QUEUE_SCOPE_ENV]: '1' }, path: join(dir, 'absent.json') })).toBe(true);
      expect(isQueueScopeEnabled({ env: {}, path: join(dir, 'absent.json') })).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
