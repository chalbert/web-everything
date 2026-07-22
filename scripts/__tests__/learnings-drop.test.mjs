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
  KINDS, ALLOWED_KEYS, FIELD_CAPS, scrubReasons, isHighEntropyToken, validateEntry, appendEntry, resolveDropboxPath,
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

// ── review-round red-team fixtures: every confirmed bypass must now be REJECTED ──────────────────
describe('scrub — closes the audited bypasses (must reject)', () => {
  const reject = (v) => expect(scrubReasons(v).length, `should reject: ${v}`).toBeGreaterThan(0);
  it('1. Google API key class (AIza…, no known prefix rule caught it)', () => {
    reject('leaked AIzaSyD1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT today');
  });
  it('2. URL with inline credentials (glued // dodged the path rule)', () => {
    reject('connect via https://admin:hunter2Trombone@db.internal');
  });
  it('3. repo-identifying relative + repo-relative source paths', () => {
    reject('see ../../webeverything/src/lane-board.ts for the bug');
    reject('the file src/backlog-view/lane-board.ts is wrong');
  });
  it('4. single-line code and one-liner SQL', () => {
    reject("const x = fetch('/api/users')");
    reject('SELECT * FROM users WHERE id = 1');
  });
  it('5. bare high-entropy token (unknown format, no prefix)', () => {
    reject('the value was abcdEFGH1234abcdEFGH somewhere');
  });
  it('6. email and IPs (PII for the downstream telemetry seam)', () => {
    reject('ping nic.g.gilbert@gmail.com about it');
    reject('the host at 10.0.0.5 was unreachable');
    reject('bind fe80:0:0:0:0:0:0:1 failed');
  });
  it('labeled credential with a secret-shaped value', () => {
    reject('password: hunter2Trombone was committed');
  });
});

// ── critical balance: domain vocabulary of THIS web-standards repo must PASS ───────────────────────
describe('scrub — domain vocabulary must NOT be rejected (must pass)', () => {
  const pass = (v) => expect(scrubReasons(v), `should pass: ${v}`).toEqual([]);
  it('7a. a bare web-component element name', () => pass('the <select> element needs an aria-label default'));
  it('7b. bare <dialog>/<slot> element names', () => pass('a <dialog> should trap focus and a <slot> should forward it'));
  it('7c. "token:" as prose, not a credential', () => pass('the session token: often expires mid long run'));
  it('7d. scope: [] and check:standards vocabulary', () => {
    pass('an empty scope: [] should still acquire the whole lane');
    pass('the check:standards gate must stay green before landing');
  });
  it('a bare AGENTS.md mention (name, not a path) passes', () => pass('the AGENTS.md router omits the conveyor pointer'));
});

// ── round-3 review: three MORE single-value bypasses (each a complete secret/path in one field) ──────
describe('scrub — round-3 audited bypasses (must reject)', () => {
  const reject = (v) => expect(scrubReasons(v).length, `should reject: ${v}`).toBeGreaterThan(0);
  it('1. GitHub fine-grained PAT (internal _ defeated the base64 \\b; >40 chars skipped entropy)', () => {
    reject('rotate github_pat_11ABCDEFG0aZ1bY2cX3dW4eV5fU6gT7hS8iR9jQ0kP1lO2mN3');
  });
  it('2. absolute/home paths glued to a non-space char (=, quote, paren)', () => {
    reject('path=/Users/nic/workspace/foo');
    reject('the value "/Users/nic/workspace/foo" here');
    reject('see (/Users/nic/workspace/foo) now');
    reject('home=~/workspace/webeverything/scripts');
  });
  it('3. two-class opaque tokens 16–31 chars (base32 TOTP + 20-char hex session id)', () => {
    reject('the secret jbswy3dpehpk3pxpjbswy3dp leaked');   // base32 TOTP, low vowel ratio
    reject('session a3f9c1e8b7d2f6a0c4e1 expired');          // 20-char lowercase hex
    reject('code JBSWY3DPEHPK3PXP now');                     // 16-char base32 upper
  });
});

describe('scrub — round-3 false-positive-risk cases (must pass)', () => {
  const pass = (v) => expect(scrubReasons(v), `should pass: ${v}`).toEqual([]);
  it('git SHORT shas in prose (≤12 hex) pass; only long/opaque runs reject', () => {
    pass('landed in abc1234 yesterday');
    pass('landed in a3f9c1e8b7d2 today'); // 12-char hex short sha
  });
  it('a hex color passes', () => pass('use #a3f9c1 for the border'));
  it('word-concatenation identifiers pass despite mixed 2-class shape', () => {
    pass('see item2614dropbox for the fixture');       // 2-class, vowel ratio ~0.36
    pass('lane5poolacquire is the helper');            // 2-class, vowel ratio ~0.53
    pass('tag webeverything2024 release');             // 2-class + repo name, but not a path
    pass('workflowprogress2 heartbeat block');
    pass('the backlogworkflowworkflow module split');  // single-case long identifier
  });
  it('a 20-char kebab slug passes', () => pass('the my-cool-feature-slug branch'));
});

describe('isHighEntropyToken — catches opaque keys, spares identifiers', () => {
  it('rejects a mixed-class medium blob (shape a)', () => {
    expect(isHighEntropyToken('abcdEFGH1234abcdEFGH')).toBe(true);
  });
  it('rejects a non-pronounceable low-vowel token (shape b) and a long PAT (>40)', () => {
    expect(isHighEntropyToken('jbswy3dpehpk3pxpjbswy3dp')).toBe(true);  // base32 TOTP
    expect(isHighEntropyToken('github_pat_11ABCDEFG0aZ1bY2cX3dW4eV5fU6gT7hS8iR9jQ0kP1lO2mN3')).toBe(true);
  });
  it('passes ordinary single-case identifiers and short tokens', () => {
    expect(isHighEntropyToken('batch-backlog-items')).toBe(false); // single case / hyphen, pronounceable
    expect(isHighEntropyToken('closingSession')).toBe(false);      // too short (<16)
    expect(isHighEntropyToken('check')).toBe(false);               // too short
    expect(isHighEntropyToken('lane5poolacquire')).toBe(false);    // 16 chars, 2-class, but pronounceable (vowel ratio spares it)
  });
});

describe('field length caps — structural leak-class kill (review fix A)', () => {
  it('rejects an over-length summary / area / suggestion', () => {
    expect(validateEntry({ ...good, summary: 'x '.repeat(FIELD_CAPS.summary) }).ok).toBe(false);
    expect(validateEntry({ ...good, area: 'a '.repeat(FIELD_CAPS.area) }).ok).toBe(false);
    expect(validateEntry({ ...good, suggestion: 's '.repeat(FIELD_CAPS.suggestion) }).ok).toBe(false);
  });
  it('caps are summary 240 / area 60 / suggestion 400', () => {
    expect(FIELD_CAPS).toEqual({ summary: 240, area: 60, suggestion: 400 });
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
