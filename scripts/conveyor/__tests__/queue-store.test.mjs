/**
 * @file scripts/conveyor/__tests__/queue-store.test.mjs
 * @description Unit proof of the SESSION-LOCAL conveyor queue store's PURE core (WE #2613). Drives
 *   parse/add/remove/has/serialize directly with plain values (no fs) and pins: add is idempotent, remove of
 *   an absent id is a no-op, list, malformed/missing text → empty, tolerant shapes, and padded/JIT-id
 *   normalization.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  normNum,
  parseQueue,
  queueHas,
  queueNums,
  addToQueue,
  removeFromQueue,
  serializeQueue,
  readQueueFile,
  writeQueueFile,
  pinnedStateRoot,
  queuePath,
  resolveQueuePath,
  QUEUE_ROOT,
  STATE_ROOT_ENV,
  queueStateRoot,
  legacyQueuePaths,
  resolveQueueSource,
  migrateLegacyQueue,
  legacyQueueDivergence,
  bornAsIndexFromItems,
  resolveBornAsRefs,
} from '../queue-store.mjs';
import { mkdirSync, writeFileSync, utimesSync, realpathSync } from 'node:fs';

describe('normNum — dedup/membership key', () => {
  it('strips leading zeros for numeric ids but preserves JIT hashes (lower-cased)', () => {
    expect(normNum('042')).toBe('42');
    expect(normNum('2613')).toBe('2613');
    expect(normNum(' 2613 ')).toBe('2613');
    expect(normNum('xQxPeac')).toBe('xqxpeac');
    expect(normNum('')).toBe('');
    expect(normNum(null)).toBe('');
    expect(normNum(undefined)).toBe('');
  });

  it('treats a `#`-prefixed id as the same id (UI sugar) — #2613 ≡ 2613, #xHASH ≡ xHASH (#2613 review req 1)', () => {
    expect(normNum('#2613')).toBe('2613');
    expect(normNum('#2613')).toBe(normNum(2613));
    expect(normNum(' #2613 ')).toBe('2613');
    expect(normNum('#042')).toBe('42');
    expect(normNum('#xQxPeac')).toBe('xqxpeac');
    expect(normNum('#')).toBe('');
  });
});

describe('parseQueue — tolerant read', () => {
  it('empty / whitespace / malformed / missing → []', () => {
    expect(parseQueue('')).toEqual([]);
    expect(parseQueue('   ')).toEqual([]);
    expect(parseQueue(null)).toEqual([]);
    expect(parseQueue(undefined)).toEqual([]);
    expect(parseQueue('not json {')).toEqual([]);
    expect(parseQueue('null')).toEqual([]);
  });

  it('parses a bare-number array and a {num, addedAt} array alike', () => {
    expect(parseQueue('["2613", 42]')).toEqual([
      { num: '2613', addedAt: null },
      { num: '42', addedAt: null },
    ]);
    expect(parseQueue('[{"num":"2613","addedAt":"2026-07-22T00:00:00Z"}]')).toEqual([
      { num: '2613', addedAt: '2026-07-22T00:00:00Z' },
    ]);
  });

  it('tolerates a {queue:[...]} wrapper and drops junk rows', () => {
    expect(parseQueue('{"queue":["7", {"num":8}, null, {"nope":1}]}')).toEqual([
      { num: '7', addedAt: null },
      { num: '8', addedAt: null },
    ]);
  });

  it('dedups by normalized id, keeping the first spelling', () => {
    expect(parseQueue('["042", "42", "0042"]')).toEqual([{ num: '042', addedAt: null }]);
  });
});

describe('addToQueue — idempotent add', () => {
  it('adds a new id with the injected stamp', () => {
    const q = addToQueue([], '2613', '2026-07-22T10:00:00Z');
    expect(q).toEqual([{ num: '2613', addedAt: '2026-07-22T10:00:00Z' }]);
  });

  it('re-adding an already-cleared id is a NO-OP (same array, first stamp retained)', () => {
    const q1 = addToQueue([], '2613', 'T1');
    const q2 = addToQueue(q1, '2613', 'T2');
    expect(q2).toBe(q1); // unchanged reference — no duplicate, no stamp refresh
    expect(q2).toEqual([{ num: '2613', addedAt: 'T1' }]);
  });

  it('treats a padded re-add as the same id (idempotent across padding)', () => {
    const q1 = addToQueue([], '42', 'T1');
    const q2 = addToQueue(q1, '042', 'T2');
    expect(q2).toBe(q1);
  });

  it('a blank/nullish id is a no-op; never mutates the input', () => {
    const base = [{ num: '1', addedAt: null }];
    expect(addToQueue(base, '', 'T')).toBe(base);
    expect(addToQueue(base, null, 'T')).toBe(base);
    const added = addToQueue(base, '2', 'T');
    expect(base).toEqual([{ num: '1', addedAt: null }]); // input untouched
    expect(added).toHaveLength(2);
  });
});

describe('removeFromQueue — no-op when absent', () => {
  it('removes a present id (padding-tolerant)', () => {
    const q = [{ num: '42', addedAt: null }, { num: 'xqxpeac', addedAt: null }];
    expect(removeFromQueue(q, '042')).toEqual([{ num: 'xqxpeac', addedAt: null }]);
  });

  it('removing an absent id returns the same contents (no-op)', () => {
    const q = [{ num: '42', addedAt: null }];
    expect(removeFromQueue(q, '99')).toEqual(q);
    expect(removeFromQueue(q, '')).toBe(q);
  });
});

describe('queueHas / queueNums — reads', () => {
  it('membership is padding-tolerant', () => {
    const q = [{ num: '42', addedAt: null }];
    expect(queueHas(q, '042')).toBe(true);
    expect(queueHas(q, '43')).toBe(false);
    expect(queueHas(q, '')).toBe(false);
  });
  it('queueNums lists the stored spellings', () => {
    expect(queueNums([{ num: '42' }, { num: 'xq' }])).toEqual(['42', 'xq']);
  });
});

describe('serializeQueue — round-trips through parseQueue', () => {
  it('emits a bare newline-terminated JSON array that parses back equal', () => {
    const q = addToQueue(addToQueue([], '2613', 'T1'), 'xqxpeac', 'T2');
    const text = serializeQueue(q);
    expect(text.endsWith('\n')).toBe(true);
    expect(JSON.parse(text)).toEqual(q); // bare array on disk
    expect(parseQueue(text)).toEqual(q);
  });
});

describe('writeQueueFile / readQueueFile — atomic fs roundtrip (#2613 review nit 3)', () => {
  let dir;
  afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

  it('writes .conveyor/queue.json (creating the dir) and reads it back; no leftover temp file', () => {
    dir = mkdtempSync(join(tmpdir(), 'qs-fs-'));
    const path = join(dir, '.conveyor', 'queue.json');
    const q = addToQueue([], '2613', 'T1');
    writeQueueFile(q, path);
    expect(existsSync(path)).toBe(true);
    expect(readQueueFile(path)).toEqual(q);
    // final content is complete JSON (the atomic rename means a reader never sees a partial write)
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(q);
    // no *.tmp sibling left behind after the rename
    expect(readdirSync(join(dir, '.conveyor')).some((f) => f.endsWith('.tmp'))).toBe(false);
  });

  it('readQueueFile on a missing path → []', () => {
    dir = mkdtempSync(join(tmpdir(), 'qs-fs-'));
    expect(readQueueFile(join(dir, 'nope', 'queue.json'))).toEqual([]);
  });
});

describe('pinnedStateRoot / queuePath / resolveQueuePath — CONVEYOR_STATE_ROOT (#4052)', () => {
  const savedEnv = { ...process.env };
  afterEach(() => {
    for (const k of ['CONVEYOR_STATE_ROOT', 'CONVEYOR_QUEUE_FILE']) {
      if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k];
    }
  });

  it('pinnedStateRoot is null when unset, whitespace-only, or absent from an injected env', () => {
    expect(pinnedStateRoot({})).toBeNull();
    expect(pinnedStateRoot({ [STATE_ROOT_ENV]: '' })).toBeNull();
    expect(pinnedStateRoot({ [STATE_ROOT_ENV]: '   ' })).toBeNull();
  });

  it('pinnedStateRoot resolves + trims a set value', () => {
    expect(pinnedStateRoot({ [STATE_ROOT_ENV]: '  /tmp/pinned-root  ' })).toBe(join('/tmp/pinned-root'));
  });

  it('decouple-primary-checkout: with nothing pinned, queuePath defaults to the automation STATE HOME — never this checkout', () => {
    delete process.env.CONVEYOR_STATE_ROOT;
    expect(queuePath()).toBe(join(process.env.WE_DAEMON_STATE_DIR, 'conveyor-state', '.conveyor', 'queue.json'));
    expect(queuePath()).not.toBe(join(QUEUE_ROOT, '.conveyor', 'queue.json'));
    expect(queueStateRoot({})).toMatch(/\.claude[\\/]daemon-self-sync-state[\\/]conveyor-state$/);
  });

  it('queuePath nests under the pinned root once CONVEYOR_STATE_ROOT is set', () => {
    process.env.CONVEYOR_STATE_ROOT = '/tmp/some-pinned-root';
    expect(queuePath()).toBe(join('/tmp/some-pinned-root', '.conveyor', 'queue.json'));
  });

  it('resolveQueuePath honors the pinned root when CONVEYOR_QUEUE_FILE is not set', () => {
    delete process.env.CONVEYOR_QUEUE_FILE;
    process.env.CONVEYOR_STATE_ROOT = '/tmp/operator-primary';
    expect(resolveQueuePath()).toBe(join('/tmp/operator-primary', '.conveyor', 'queue.json'));
  });

  it('CONVEYOR_QUEUE_FILE (an explicit full-path override) still wins over a pinned root', () => {
    process.env.CONVEYOR_STATE_ROOT = '/tmp/operator-primary';
    process.env.CONVEYOR_QUEUE_FILE = '/tmp/explicit/queue.json';
    expect(resolveQueuePath()).toBe('/tmp/explicit/queue.json');
  });
});

describe('decouple-primary-checkout — one-release legacy read + one-time migration (epic #4075)', () => {
  let dir;
  afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); dir = null; });

  /** A fixture world: a state home, and an OLD checkout (`<ws>/webeverything`) holding the old sidecar. */
  function world({ legacy = [{ num: '3604', addedAt: 'T1' }, { num: '42', addedAt: 'T2' }] } = {}) {
    dir = realpathSync(mkdtempSync(join(tmpdir(), 'qs-legacy-'))); // legacy roots are realpath'd (macOS /var → /private/var)
    const ws = join(dir, 'workspace');
    const primary = join(ws, 'webeverything');
    const lane = join(ws, '.lanes', 'web-everything', 'lane-3');
    mkdirSync(join(primary, '.conveyor'), { recursive: true });
    mkdirSync(lane, { recursive: true });
    const legacyPath = join(primary, '.conveyor', 'queue.json');
    if (legacy) writeFileSync(legacyPath, JSON.stringify(legacy));
    const env = { WE_DAEMON_STATE_DIR: join(dir, 'state') };
    return { env, primary, lane, legacyPath, canonical: join(dir, 'state', 'conveyor-state', '.conveyor', 'queue.json') };
  }

  it('the legacy candidate is the workspace primary — found from a LANE too, never the lane\'s own sidecar', () => {
    const w = world();
    // Live 2026-09-27: lane-1 carried a stale 7-entry sidecar of its own — it must never be merged in.
    mkdirSync(join(w.lane, '.conveyor'), { recursive: true });
    writeFileSync(join(w.lane, '.conveyor', 'queue.json'), JSON.stringify([{ num: '999' }]));
    expect(legacyQueuePaths({ env: w.env, root: w.lane })).toEqual([w.legacyPath]);
    expect(migrateLegacyQueue({ env: w.env, root: w.lane, dryRun: true }).queue.map((e) => e.num)).toEqual(['3604', '42']);
  });

  it('a pinned root, an explicit queue file, or the opt-out switch disables the legacy read', () => {
    const w = world();
    expect(legacyQueuePaths({ env: { ...w.env, CONVEYOR_STATE_ROOT: join(dir, 'pin') }, root: w.lane })).toEqual([]);
    expect(legacyQueuePaths({ env: { ...w.env, CONVEYOR_QUEUE_FILE: join(dir, 'q.json') }, root: w.lane })).toEqual([]);
    expect(legacyQueuePaths({ env: { ...w.env, CONVEYOR_NO_LEGACY_QUEUE: '1' }, root: w.lane })).toEqual([]);
  });

  it('no file in the state home yet → a read of the canonical path comes from the OLD location', () => {
    const w = world();
    const src = resolveQueueSource(w.canonical, { env: w.env, root: w.lane });
    expect(src).toEqual({ path: w.legacyPath, source: 'legacy', legacyPath: w.legacyPath });
  });

  it('once the state home has a file, it is authoritative — the legacy file is never read again', () => {
    const w = world();
    writeQueueFile([{ num: '7', addedAt: null }], w.canonical);
    expect(resolveQueueSource(w.canonical, { env: w.env, root: w.lane }).source).toBe('canonical');
  });

  it('an explicit non-canonical path is read as-is (no fallback)', () => {
    const w = world();
    const other = join(dir, 'elsewhere.json');
    expect(resolveQueueSource(other, { env: w.env, root: w.lane })).toEqual({ path: other, source: 'explicit', legacyPath: null });
  });

  it('migrate copies every legacy entry into the state home and leaves the legacy file untouched', () => {
    const w = world();
    const before = readFileSync(w.legacyPath, 'utf8');
    const dry = migrateLegacyQueue({ env: w.env, root: w.lane, dryRun: true });
    expect(dry).toMatchObject({ migrated: false, reason: 'dry-run', count: 2, from: [w.legacyPath] });
    expect(existsSync(w.canonical)).toBe(false);
    const r = migrateLegacyQueue({ env: w.env, root: w.lane });
    expect(r).toMatchObject({ migrated: true, reason: 'migrated', count: 2, path: w.canonical });
    expect(readQueueFile(w.canonical).map((e) => e.num)).toEqual(['3604', '42']);
    expect(readFileSync(w.legacyPath, 'utf8')).toBe(before);
    // Idempotent, and never resurrects: after an entry is removed from the new home, re-running changes nothing.
    writeQueueFile(removeFromQueue(readQueueFile(w.canonical), '42'), w.canonical);
    expect(migrateLegacyQueue({ env: w.env, root: w.lane })).toMatchObject({ migrated: false, reason: 'canonical-exists', count: 1 });
    expect(readQueueFile(w.canonical).map((e) => e.num)).toEqual(['3604']);
  });

  it('migrate with no legacy file is a no-op', () => {
    const w = world({ legacy: null });
    expect(migrateLegacyQueue({ env: w.env, root: w.lane })).toMatchObject({ migrated: false, reason: 'no-legacy' });
    expect(existsSync(w.canonical)).toBe(false);
  });

  it('divergence: a legacy file written AFTER the state-home file is flagged (an old-code writer)', () => {
    const w = world();
    migrateLegacyQueue({ env: w.env, root: w.lane });
    const old = new Date(Date.now() - 60_000);
    utimesSync(w.canonical, old, old);
    expect(legacyQueueDivergence({ env: w.env, root: w.lane })).toEqual({ diverged: true, legacyPath: w.legacyPath });
    const older = new Date(Date.now() - 120_000);
    utimesSync(w.legacyPath, older, older);
    expect(legacyQueueDivergence({ env: w.env, root: w.lane })).toEqual({ diverged: false, legacyPath: null });
  });
});

describe('bornAsIndexFromItems — hash → landed-NNN lookup', () => {
  it('maps each item\'s bornAs hash to its normalized num', () => {
    const idx = bornAsIndexFromItems([
      { num: '4290', bornAs: 'x34h6a2' },
      { num: '042', bornAs: 'xQxPeac' }, // padded num + mixed-case hash both normalize
    ]);
    expect(idx.get('x34h6a2')).toBe('4290');
    expect(idx.get('xqxpeac')).toBe('42');
    expect(idx.size).toBe(2);
  });

  it('skips items with no bornAs, an empty bornAs, or no resolvable num', () => {
    const idx = bornAsIndexFromItems([
      { num: '1', bornAs: null },
      { num: '2', bornAs: '' },
      { num: '3' },
      { bornAs: 'xabcdef' }, // no num — can't be a landed target
    ]);
    expect(idx.size).toBe(0);
  });

  it('first item wins a duplicate bornAs hash (tolerates the data bug rather than throwing)', () => {
    const idx = bornAsIndexFromItems([
      { num: '100', bornAs: 'xdupe01' },
      { num: '200', bornAs: 'xdupe01' },
    ]);
    expect(idx.get('xdupe01')).toBe('100');
  });

  it('non-array input → empty map', () => {
    expect(bornAsIndexFromItems(null).size).toBe(0);
    expect(bornAsIndexFromItems(undefined).size).toBe(0);
  });
});

describe('resolveBornAsRefs — self-heal stale JIT-hash rows (#4291 area)', () => {
  it('rewrites a resolvable hash row to its landed NNN, keeping the original addedAt', () => {
    const idx = bornAsIndexFromItems([{ num: '4290', bornAs: 'x34h6a2' }]);
    const out = resolveBornAsRefs([{ num: 'x34h6a2', addedAt: '2026-01-01T00:00:00.000Z' }], idx);
    expect(out).toEqual([{ num: '4290', addedAt: '2026-01-01T00:00:00.000Z' }]);
  });

  it('leaves an unresolvable id (not yet landed, or a typo) byte-identical', () => {
    const idx = bornAsIndexFromItems([{ num: '4290', bornAs: 'x34h6a2' }]);
    const entries = [{ num: 'xnotyet1', addedAt: null }, { num: '2613', addedAt: 'ts' }];
    expect(resolveBornAsRefs(entries, idx)).toEqual(entries);
  });

  it('collapses a queue holding BOTH the stale hash and an independently-cleared NNN into ONE entry, keeping the first addedAt', () => {
    const idx = bornAsIndexFromItems([{ num: '4290', bornAs: 'x34h6a2' }]);
    const out = resolveBornAsRefs(
      [{ num: 'x34h6a2', addedAt: 'first' }, { num: '4290', addedAt: 'second' }],
      idx,
    );
    expect(out).toEqual([{ num: '4290', addedAt: 'first' }]);
  });

  it('accepts a plain-object index (not just a Map)', () => {
    const out = resolveBornAsRefs([{ num: 'xhash01', addedAt: null }], { xhash01: '99' });
    expect(out).toEqual([{ num: '99', addedAt: null }]);
  });

  it('non-array queue → empty array; never mutates the input array', () => {
    const idx = bornAsIndexFromItems([{ num: '1', bornAs: 'xabc' }]);
    expect(resolveBornAsRefs(null, idx)).toEqual([]);
    const input = [{ num: 'xabc', addedAt: null }];
    const out = resolveBornAsRefs(input, idx);
    expect(input).toEqual([{ num: 'xabc', addedAt: null }]); // input untouched
    expect(out).toEqual([{ num: '1', addedAt: null }]);
  });
});
