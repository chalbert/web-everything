/**
 * @file scripts/__tests__/learnings-harvest.test.mjs
 * @description Unit proof of the PERIODIC cross-session learnings harvest core (#x2j0l3t) — the successor to
 *   the single-session close sweep. Proves the properties the collect/adjudicate split depends on: entries
 *   from MANY session files pool together; recurrence across DISTINCT sessions outranks one session repeating
 *   itself; one malformed line never costs the rest of the pool; the write-seam scrub is re-applied; an empty
 *   pool is a clean no-op; the `minSessions` floor DEFERS one-offs (leaves them in the pool) rather than
 *   discarding them; and archiving is an explicit, collision-safe acknowledgement — never a side effect of
 *   reading.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  resolvePoolDir, poolFiles, readPool, ageStats, harvest, harvestPool, poolStatus, archivePool, ARCHIVE_DIR,
} from '../conveyor/learnings-harvest.mjs';

const e = (kind, area, summary, suggestion = 'fix it', ts = '2026-08-01T00:00:00.000Z') =>
  JSON.stringify({ kind, area, summary, suggestion, ts });

let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'we-harvest-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

/** Write one session's pool file. */
const session = (name, ...lines) => writeFileSync(join(dir, `${name}.jsonl`), lines.join('\n') + '\n', 'utf8');

describe('pool discovery', () => {
  it('reads every *.jsonl in the pool and ignores the harvested/ archive', () => {
    session('sess-a', e('friction', 'lane gating', 'lane gate reruns full suite for docs only diffs'));
    session('sess-b', e('doc-gap', 'memory docs', 'the memory doc omits the sub index budget rule'));
    mkdirSync(join(dir, ARCHIVE_DIR, '2026-07-01'), { recursive: true });
    writeFileSync(join(dir, ARCHIVE_DIR, '2026-07-01', 'old.jsonl'), e('friction', 'x', 'already harvested') + '\n');
    expect(poolFiles(dir).map((p) => p.split('/').pop())).toEqual(['sess-a.jsonl', 'sess-b.jsonl']);
  });

  it('an absent pool directory is the empty case, never an error', () => {
    expect(poolFiles(join(dir, 'nope'))).toEqual([]);
    const r = harvestPool({ dir: join(dir, 'nope') });
    expect(r.candidates).toEqual([]);
    expect(r.stats.received).toBe(0);
  });

  it('resolvePoolDir honours --dir, then $LEARNINGS_POOL, then the repo default', () => {
    expect(resolvePoolDir({ dir: '/abs/pool' })).toBe('/abs/pool');
    expect(resolvePoolDir({ env: { LEARNINGS_POOL: '/env/pool' } })).toBe('/env/pool');
    expect(resolvePoolDir({ env: {}, root: '/r' })).toBe('/r/.conveyor/learnings');
    // an explicit --dir wins over the env var
    expect(resolvePoolDir({ dir: '/abs/pool', env: { LEARNINGS_POOL: '/env/pool' } })).toBe('/abs/pool');
  });
});

describe('readPool — line tolerance + re-scrub + session tagging', () => {
  it('pools entries across session files and tags each with its source session', () => {
    session('sess-a', e('friction', 'lane gating', 'lane gate reruns full suite for docs only diffs'));
    session('sess-b', e('friction', 'lane gating', 'the lane gate reruns the full suite even for docs only diffs'));
    const { entries, stats } = readPool(poolFiles(dir));
    expect(stats.files).toBe(2);
    expect(stats.valid).toBe(2);
    expect(entries.map((x) => x.session).sort()).toEqual(['sess-a', 'sess-b']);
  });

  it('one malformed line never costs the rest of the pool', () => {
    writeFileSync(join(dir, 'sess-a.jsonl'),
      [e('friction', 'gating', 'the gate reruns everything'), '{"kind":"friction"', e('doc-gap', 'docs', 'the doc omits a rule')].join('\n') + '\n');
    const { entries, stats } = readPool(poolFiles(dir));
    expect(stats.malformed).toBe(1);
    expect(entries).toHaveLength(2);
  });

  it('re-applies the write-seam scrub — a leaked secret never reaches a candidate', () => {
    session('sess-a', e('friction', 'leak', 'saw the key ghp_ABCDEFabcdef0123456789ABCDEF01234567 in a log'));
    const { entries, stats } = readPool(poolFiles(dir));
    expect(stats.rejected).toBe(1);
    expect(entries).toHaveLength(0);
  });

  it('an unreadable pool file is counted, not thrown', () => {
    const { stats } = readPool(['/does/not/exist.jsonl'], { read: () => { throw new Error('ENOENT'); } });
    expect(stats.malformed).toBe(1);
    expect(stats.received).toBe(0);
  });
});

describe('harvest — recurrence is the ranking signal', () => {
  it('three DISTINCT sessions outrank one session repeating itself', () => {
    const spread = ['s1', 's2', 's3'].map((s) => ({ kind: 'friction', area: 'lane gating', summary: 'the lane gate reruns the full suite for docs only diffs', suggestion: 'scope the gate', session: s, ts: '2026-08-01T00:00:00.000Z' }));
    const repeated = [1, 2, 3, 4].map(() => ({ kind: 'doc-gap', area: 'memory docs', summary: 'the memory doc omits the sub index budget rule', suggestion: 'document it', session: 's9', ts: '2026-08-01T00:00:00.000Z' }));
    const { candidates } = harvest([...repeated, ...spread]);
    expect(candidates[0].kind).toBe('friction');       // 3 sessions beats…
    expect(candidates[0].sessions).toBe(3);
    expect(candidates[1].kind).toBe('doc-gap');        // …4 entries from 1 session
    expect(candidates[1].count).toBe(4);
    expect(candidates[1].sessions).toBe(1);
  });

  it('the minSessions floor DEFERS one-offs rather than discarding them', () => {
    const entries = [
      { kind: 'friction', area: 'gating', summary: 'the lane gate reruns the full suite for docs only diffs', suggestion: 'scope it', session: 's1' },
      { kind: 'friction', area: 'gating', summary: 'the lane gate reruns the full suite on docs only diffs', suggestion: 'scope it', session: 's2' },
      { kind: 'improvement', area: 'naming', summary: 'a one off idea nobody else hit', suggestion: 'maybe', session: 's1' },
    ];
    const { candidates, stats } = harvest(entries, { minSessions: 2 });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].kind).toBe('friction');
    expect(stats.belowFloor).toBe(1);   // counted, still in the pool — the next harvest sees it again
    expect(stats.minSessions).toBe(2);
  });

  it('collapses near-dupes across sessions into one candidate carrying both suggestions', () => {
    session('sess-a', e('friction', 'lane gating', 'lane gate reruns full suite for docs only diffs', 'scope the gate'));
    session('sess-b', e('friction', 'lane gating', 'the lane gate reruns the full suite even for docs only diffs', 'skip on docs only'));
    const { candidates } = harvestPool({ dir });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].count).toBe(2);
    expect(candidates[0].sessions).toBe(2);
    expect(candidates[0].suggestions.sort()).toEqual(['scope the gate', 'skip on docs only']);
  });
});

describe('ageStats / poolStatus — depth and age are DATA, not judgment', () => {
  it('reports how long the oldest unharvested observation has waited', () => {
    const entries = [{ ts: '2026-08-01T00:00:00.000Z' }, { ts: '2026-08-05T00:00:00.000Z' }];
    const { oldest, newest, ageDays } = ageStats(entries, { now: '2026-08-06T00:00:00.000Z' });
    expect(oldest).toBe('2026-08-01T00:00:00.000Z');
    expect(newest).toBe('2026-08-05T00:00:00.000Z');
    expect(ageDays).toBe(5);
  });

  it('is null-safe when nothing carries a stamp', () => {
    expect(ageStats([{ summary: 'x' }])).toEqual({ oldest: null, newest: null, ageDays: null });
  });

  it('poolStatus counts entries + session files without consuming anything', () => {
    session('sess-a', e('friction', 'gating', 'the gate reruns everything every time'));
    session('sess-b', e('doc-gap', 'docs', 'the doc omits a rule about budgets'));
    const s = poolStatus({ dir, now: '2026-08-06T00:00:00.000Z' });
    expect(s.entries).toBe(2);
    expect(s.sessions).toBe(2);
    expect(s.ageDays).toBe(5);
    expect(poolFiles(dir)).toHaveLength(2);   // reading is NOT consuming
  });

  it('an empty pool reports zero rather than failing', () => {
    expect(poolStatus({ dir })).toMatchObject({ entries: 0, sessions: 0, ageDays: null });
  });
});

describe('archivePool — an explicit acknowledgement', () => {
  it('moves consumed pool files under harvested/<stamp>/ and leaves the pool empty', () => {
    session('sess-a', e('friction', 'gating', 'the gate reruns everything every time'));
    session('sess-b', e('doc-gap', 'docs', 'the doc omits a rule about budgets'));
    const { moved, to } = archivePool({ dir, stamp: '2026-08-06' });
    expect(moved).toHaveLength(2);
    expect(to).toBe(join(dir, ARCHIVE_DIR, '2026-08-06'));
    expect(poolFiles(dir)).toEqual([]);
    expect(readdirSync(to).sort()).toEqual(['sess-a.jsonl', 'sess-b.jsonl']);
  });

  it('a second archive under the same stamp suffixes instead of clobbering', () => {
    session('sess-a', e('friction', 'gating', 'first round of observations here'));
    archivePool({ dir, stamp: '2026-08-06' });
    session('sess-a', e('friction', 'gating', 'second round of observations here'));
    const { moved } = archivePool({ dir, stamp: '2026-08-06' });
    expect(moved[0].endsWith('sess-a.1.jsonl')).toBe(true);
    expect(readdirSync(join(dir, ARCHIVE_DIR, '2026-08-06')).sort()).toEqual(['sess-a.1.jsonl', 'sess-a.jsonl']);
  });

  it('archiving an empty pool is a no-op', () => {
    expect(archivePool({ dir, stamp: 'x' })).toEqual({ moved: [], to: null });
    expect(existsSync(join(dir, ARCHIVE_DIR))).toBe(false);
  });

  it('a harvest read alone never archives — only an explicit archive does', () => {
    session('sess-a', e('friction', 'gating', 'the gate reruns everything every time'));
    harvestPool({ dir });
    expect(poolFiles(dir)).toHaveLength(1);
  });
});
