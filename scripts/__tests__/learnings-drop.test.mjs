/**
 * @file scripts/__tests__/learnings-drop.test.mjs
 * @description Unit proof of the delivery-agent learnings drop-box (#2614): the schema is TENANT-READY —
 *   generalized-lesson fields only — and the write is GATED (#883 write-time-gate precedent). A valid entry
 *   passes; an entry carrying an absolute path, a token-shaped string, or a code block is REJECTED and never
 *   appended. Also pins the allow-list (an out-of-schema field can't smuggle a leak) and the append round-trip.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  KINDS, ALLOWED_KEYS, scrubReasons, validateEntry, appendEntry, resolveDropboxPath,
} from '../conveyor/learnings-drop.mjs';

const good = {
  kind: 'friction',
  summary: 'the lane gate re-runs the whole suite even for a docs-only diff',
  area: 'lane gating / check:standards',
  suggestion: 'scope the lane gate to the touched file-families',
};

describe('validateEntry — happy path', () => {
  it('accepts a well-formed generalized-lesson entry', () => {
    const r = validateEntry(good);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.clean).toEqual(good);
  });
  it('accepts every declared kind', () => {
    for (const kind of KINDS) expect(validateEntry({ ...good, kind }).ok).toBe(true);
  });
});

describe('validateEntry — the scrub gate rejects leaks', () => {
  it('rejects an entry carrying an ABSOLUTE path', () => {
    const r = validateEntry({ ...good, area: 'the file /Users/nic/workspace/webeverything/scripts/foo.mjs' });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/absolute/i);
  });
  it('rejects an entry carrying a TOKEN-shaped string', () => {
    const r = validateEntry({ ...good, suggestion: 'rotate the leaked key ghp_ABCDEFabcdef0123456789ABCDEF01234567' });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/token|github/i);
  });
  it('rejects an entry carrying a CODE block', () => {
    const r = validateEntry({ ...good, summary: 'saw this ```js\nconst x = 1;\n``` fail' });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/code/i);
  });
  it('rejects a home-relative (~/) absolute path', () => {
    expect(validateEntry({ ...good, area: 'lives under ~/workspace/webeverything/scripts' }).ok).toBe(false);
  });
  it('rejects a long base64/hex secret blob', () => {
    expect(validateEntry({ ...good, suggestion: 'value was deadbeefdeadbeefdeadbeefdeadbeefdeadbeef' }).ok).toBe(false);
  });
  it('rejects a source-code snippet (import/function)', () => {
    expect(validateEntry({ ...good, summary: 'import { x } from "./y" was missing' }).ok).toBe(false);
  });
});

describe('validateEntry — schema is the privacy boundary', () => {
  it('rejects a key outside the allow-list (no smuggling a `path`/`code` field)', () => {
    const r = validateEntry({ ...good, path: '/Users/nic/secret', code: 'const s = process.env.SECRET' });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/disallowed field/i);
  });
  it('exposes exactly the generalized-lesson keys', () => {
    expect(ALLOWED_KEYS).toEqual(['kind', 'summary', 'area', 'suggestion']);
  });
  it('rejects an unknown kind, a missing field, and a non-object', () => {
    expect(validateEntry({ ...good, kind: 'bug' }).ok).toBe(false);
    expect(validateEntry({ ...good, summary: '' }).ok).toBe(false);
    expect(validateEntry(null).ok).toBe(false);
    expect(validateEntry([good]).ok).toBe(false);
  });
});

describe('scrubReasons — clean text passes', () => {
  it('returns no reasons for a plain generalized sentence', () => {
    expect(scrubReasons('the lane gate is too coarse for docs-only diffs')).toEqual([]);
  });
  it('flags an absolute path and a code fence', () => {
    expect(scrubReasons('/etc/passwd was read').length).toBeGreaterThan(0);
    expect(scrubReasons('```bash\nrm -rf\n```').length).toBeGreaterThan(0);
  });
});

describe('appendEntry — write round-trip', () => {
  let root;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'learnings-drop-')); });
  afterEach(() => { try { rmSync(root, { recursive: true, force: true }); } catch { /* best-effort */ } });

  it('appends a validated entry as one JSONL line with a ts stamp, and stays append-only', () => {
    const file = join(root, 'box.jsonl');
    const a = appendEntry(good, { file, root, now: '2026-07-22T10:00:00Z' });
    expect(a.path).toBe(file);
    expect(a.record.ts).toBe('2026-07-22T10:00:00.000Z');
    appendEntry({ ...good, kind: 'doc-gap' }, { file, root });
    const lines = readFileSync(file, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0]);
    expect(first).toMatchObject(good);
    expect(Object.keys(first).sort()).toEqual(['area', 'kind', 'suggestion', 'summary', 'ts']);
  });

  it('THROWS and does NOT create the file when the entry is rejected', () => {
    const file = join(root, 'never.jsonl');
    expect(() => appendEntry({ ...good, area: '/abs/path/leak/here' }, { file, root })).toThrow(/rejected/);
    expect(existsSync(file)).toBe(false);
  });
});

describe('resolveDropboxPath — precedence', () => {
  it('prefers --file, then env, then the gitignored session default', () => {
    expect(resolveDropboxPath({ file: '/x/y.jsonl' })).toBe('/x/y.jsonl');
    expect(resolveDropboxPath({ env: { LEARNINGS_DROPBOX: '/e/box.jsonl' } })).toBe('/e/box.jsonl');
    const p = resolveDropboxPath({ session: 'sess/weird id', env: {}, root: '/repo' });
    expect(p).toBe('/repo/.conveyor/learnings/sess-weird-id.jsonl');
  });
});
