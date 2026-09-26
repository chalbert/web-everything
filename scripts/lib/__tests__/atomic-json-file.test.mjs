/**
 * @file scripts/lib/__tests__/atomic-json-file.test.mjs
 * @description Unit proof of {@link writeJsonAtomic} (card #4188, bornAs `x5qketq`, epic #4075): a real temp
 *   directory only (never the operator's own files) — proves the write actually lands, the rename is genuinely
 *   atomic (no leftover `.tmp` survives success), and a validation failure never touches the real target path.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeJsonAtomic, withFileLock } from '../atomic-json-file.mjs';

describe('writeJsonAtomic', () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'we-atomic-json-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('writes valid, re-readable JSON to the target path', () => {
    const target = join(dir, 'out.json');
    writeJsonAtomic(target, { a: 1, b: ['x', 'y'] });
    expect(JSON.parse(readFileSync(target, 'utf8'))).toEqual({ a: 1, b: ['x', 'y'] });
  });

  it('overwrites an existing file completely', () => {
    const target = join(dir, 'out.json');
    writeFileSync(target, JSON.stringify({ old: true }));
    writeJsonAtomic(target, { fresh: true });
    expect(JSON.parse(readFileSync(target, 'utf8'))).toEqual({ fresh: true });
  });

  it('leaves NO leftover `.tmp` file after a successful write', () => {
    const target = join(dir, 'out.json');
    writeJsonAtomic(target, { a: 1 });
    const leftovers = readdirSync(dir).filter((f) => f.includes('.tmp'));
    expect(leftovers).toEqual([]);
  });

  it('throws on an unserializable value (e.g. a BigInt) and never touches the target path', () => {
    const target = join(dir, 'out.json');
    writeFileSync(target, JSON.stringify({ untouched: true }));
    expect(() => writeJsonAtomic(target, { bad: 10n })).toThrow();
    expect(JSON.parse(readFileSync(target, 'utf8'))).toEqual({ untouched: true });
    // No stray temp file left behind by the failed attempt either.
    expect(readdirSync(dir).filter((f) => f.includes('.tmp'))).toEqual([]);
  });

  it('throws when the destination directory does not exist, and never silently swallows the error', () => {
    expect(() => writeJsonAtomic(join(dir, 'no-such-dir', 'out.json'), { a: 1 })).toThrow();
  });

  it('pretty-prints with a trailing newline (matches this repo\'s own JSON-file convention)', () => {
    const target = join(dir, 'out.json');
    writeJsonAtomic(target, { a: 1 });
    const text = readFileSync(target, 'utf8');
    expect(text.endsWith('\n')).toBe(true);
    expect(text).toBe(`${JSON.stringify({ a: 1 }, null, 2)}\n`);
  });
});

// LIVE-CAUGHT (2026-09-26, card #4188): atomicity alone does not prevent a LOST UPDATE between two concurrent
// read-modify-write callers — see `dispatch-lane-io.mjs#grantDispatchTrust`/`#revokeDispatchTrust`'s own docs
// for the real incident this closed. These tests prove the mutex primitive directly.
describe('withFileLock', () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'we-file-lock-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('runs `fn` and returns its value when uncontended', () => {
    const lockPath = join(dir, 'trust.json.lock');
    const result = withFileLock(lockPath, () => 42);
    expect(result).toBe(42);
  });

  it('releases the lock file after `fn` returns — no leftover lock on success', () => {
    const lockPath = join(dir, 'trust.json.lock');
    withFileLock(lockPath, () => {});
    expect(existsSync(lockPath)).toBe(false);
  });

  it('releases the lock even when `fn` throws', () => {
    const lockPath = join(dir, 'trust.json.lock');
    expect(() => withFileLock(lockPath, () => { throw new Error('boom'); })).toThrow('boom');
    expect(existsSync(lockPath)).toBe(false);
  });

  it('a SECOND caller is genuinely excluded while the lock is held — proves mutual exclusion, not just a flag', () => {
    const lockPath = join(dir, 'trust.json.lock');
    const order = [];
    withFileLock(lockPath, () => {
      // A second acquire attempt while we still hold it must NOT succeed immediately — it has to wait
      // (and here, time out, since nothing ever releases from inside this nested call).
      order.push('first-acquired');
      expect(() => withFileLock(lockPath, () => { order.push('SHOULD NOT RUN'); }, { timeoutMs: 100, pollMs: 10 }))
        .toThrow(/timed out/);
      order.push('second-attempt-timed-out');
    });
    expect(order).toEqual(['first-acquired', 'second-attempt-timed-out']);
  });

  it('a STALE lock (older than `staleMs`) is stolen rather than honored forever', () => {
    const lockPath = join(dir, 'trust.json.lock');
    writeFileSync(lockPath, '99999'); // simulate a crashed holder's abandoned lock
    const past = new Date(Date.now() - 60_000);
    utimesSync(lockPath, past, past);
    const result = withFileLock(lockPath, () => 'acquired-after-steal', { staleMs: 1_000, timeoutMs: 2_000, pollMs: 10 });
    expect(result).toBe('acquired-after-steal');
    expect(existsSync(lockPath)).toBe(false); // released cleanly after the steal + run
  });

  it('a FRESH contended lock is NOT stolen — waits, then times out loudly rather than double-running', () => {
    const lockPath = join(dir, 'trust.json.lock');
    writeFileSync(lockPath, '99999'); // fresh — mtime is "now"
    expect(() => withFileLock(lockPath, () => 'should never run', { staleMs: 60_000, timeoutMs: 100, pollMs: 10 }))
      .toThrow(/timed out/);
  });
});
