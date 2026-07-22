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
} from '../queue-store.mjs';

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
