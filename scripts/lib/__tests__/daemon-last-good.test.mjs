/**
 * @file scripts/lib/__tests__/daemon-last-good.test.mjs
 * @description x5wbsbc (epic #4075) — `../daemon-last-good.mjs` (the ONE read both `main-staleness.mjs` and
 *   `daemon-rebuild.mjs` share for "is this managed clone running its last smoke-verified build?") plus the
 *   managed-clone last-good fallback branch of `../main-staleness.mjs#assertMainNotStale`. Real temp git fixtures
 *   for the `cloneKeyOf` cross-check and the `assertMainNotStale` behavioral tests; everything else is pure.
 */
import {
  describe, it, expect, beforeEach, afterEach,
} from 'vitest';
import {
  mkdtempSync, rmSync, mkdirSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  cloneKeyOf, decideLastGood, lastGoodMaxAgeMs, LAST_GOOD_MAX_AGE_ENV, DEFAULT_LAST_GOOD_MAX_AGE_MS,
} from '../daemon-last-good.mjs';
import { cloneKey } from '../daemon-overlays.mjs';
import { assertMainNotStale, STALE_MAIN_REFUSAL_MARKER } from '../main-staleness.mjs';

// ── fixture helpers ──────────────────────────────────────────────────────────────────────────────────────────

const tempDirs = [];

function mktemp(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function git(cwd, args) {
  return spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
    cwd, encoding: 'utf8', timeout: 20_000, killSignal: 'SIGKILL',
  });
}
function gitOk(cwd, args) {
  const r = git(cwd, args);
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} in ${cwd} failed: ${r.stderr || r.stdout}`);
  return r.stdout;
}

/** A real {origin (bare), clone} pair whose clone's HEAD is exactly `origin/main` (no divergence) — so
 *  `main-staleness.mjs#behindFiles` (which `assertMainNotStale` calls for every managed clone) returns an empty
 *  list rather than `null`, and the #4044 "behind in non-code files only" branch it feeds never fires and
 *  never overrides the injected `checkStaleness` this suite exercises. */
function makeRealRepoWithOrigin() {
  const base = mktemp('we-last-good-repo-');
  const originDir = join(base, 'origin.git');
  gitOk(base, ['init', '--bare', '-q', '-b', 'main', originDir]);
  const seedDir = join(base, 'seed');
  mkdirSync(seedDir, { recursive: true });
  gitOk(seedDir, ['init', '-q', '-b', 'main']);
  writeFileSync(join(seedDir, 'a.mjs'), 'export const x = 1;\n');
  gitOk(seedDir, ['add', '-A']);
  gitOk(seedDir, ['commit', '-q', '-m', 'seed']);
  gitOk(seedDir, ['remote', 'add', 'origin', originDir]);
  gitOk(seedDir, ['push', '-q', '-u', 'origin', 'main']);
  const cloneDir = join(base, 'clone');
  gitOk(base, ['clone', '-q', '-b', 'main', originDir, cloneDir]);
  return cloneDir;
}

beforeEach(() => {
  tempDirs.length = 0;
});

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

// ── a. cloneKeyOf matches daemon-overlays.mjs#cloneKey ─────────────────────────────────────────────────────

describe('cloneKeyOf matches daemon-overlays.mjs#cloneKey (the two per-clone state files must key identically)', () => {
  it('is identical for the same directory', () => {
    const dir = mktemp('we-last-good-clonekey-');
    expect(cloneKeyOf(dir)).toBe(cloneKey(dir));
  });

  it('is identical through a symlink to the same directory', () => {
    const real = mktemp('we-last-good-clonekey-real-');
    const parent = mktemp('we-last-good-clonekey-link-');
    const link = join(parent, 'link');
    symlinkSync(real, link, 'dir');
    expect(cloneKeyOf(link)).toBe(cloneKey(link));
    expect(cloneKeyOf(link)).toBe(cloneKeyOf(real));
    expect(cloneKey(link)).toBe(cloneKey(real));
  });
});

// ── b. decideLastGood — pure ─────────────────────────────────────────────────────────────────────────────────

describe('decideLastGood — pure', () => {
  it('onLastGood is true only when head===adopted.head AND the tree is clean', () => {
    const state = { adopted: { head: 'abc123' } };
    expect(decideLastGood({
      headSha: 'abc123', state, dirty: false, nowMs: 0, maxAgeMs: 1000,
    }).onLastGood).toBe(true);
    expect(decideLastGood({
      headSha: 'abc123', state, dirty: true, nowMs: 0, maxAgeMs: 1000,
    }).onLastGood).toBe(false); // dirty
    expect(decideLastGood({
      headSha: 'def456', state, dirty: false, nowMs: 0, maxAgeMs: 1000,
    }).onLastGood).toBe(false); // head mismatch
    expect(decideLastGood({
      headSha: null, state, dirty: false, nowMs: 0, maxAgeMs: 1000,
    }).onLastGood).toBe(false); // no head
    expect(decideLastGood({
      headSha: 'abc123', state: null, dirty: false, nowMs: 0, maxAgeMs: 1000,
    }).onLastGood).toBe(false); // no state at all
    expect(decideLastGood({
      headSha: 'abc123', state: { adopted: null }, dirty: false, nowMs: 0, maxAgeMs: 1000,
    }).onLastGood).toBe(false); // nothing ever adopted
  });

  it('lastGood echoes state.adopted.head, or null with no adopted record', () => {
    expect(decideLastGood({
      headSha: 'a', state: { adopted: { head: 'z' } }, nowMs: 0, maxAgeMs: 1000,
    }).lastGood).toBe('z');
    expect(decideLastGood({ headSha: 'a', state: null, nowMs: 0, maxAgeMs: 1000 }).lastGood).toBeNull();
  });

  it('ageMs is derived from held.since, and null with no held record', () => {
    const since = new Date(1_000_000).toISOString();
    const state = { adopted: { head: 'a' }, held: { since, reason: 'smoke-rejected' } };
    const held = decideLastGood({
      headSha: 'a', state, dirty: false, nowMs: 1_005_000, maxAgeMs: 999_999_999,
    });
    expect(held.heldSince).toBe(since);
    expect(held.ageMs).toBe(5000);

    const noHeld = decideLastGood({
      headSha: 'a', state: { adopted: { head: 'a' } }, dirty: false, nowMs: 1_005_000, maxAgeMs: 999,
    });
    expect(noHeld.ageMs).toBeNull();
    expect(noHeld.heldSince).toBeNull();
  });

  it('overAge is true only when onLastGood AND ageMs exceeds maxAgeMs', () => {
    const since = new Date(0).toISOString();
    const state = { adopted: { head: 'a' }, held: { since } };
    const under = decideLastGood({
      headSha: 'a', state, dirty: false, nowMs: 1000, maxAgeMs: 2000,
    });
    expect(under.overAge).toBe(false);
    const over = decideLastGood({
      headSha: 'a', state, dirty: false, nowMs: 3000, maxAgeMs: 2000,
    });
    expect(over.overAge).toBe(true);
    // Not onLastGood (dirty tree) — never overAge, however old `held.since` is.
    const dirtyOver = decideLastGood({
      headSha: 'a', state, dirty: true, nowMs: 3000, maxAgeMs: 2000,
    });
    expect(dirtyOver.overAge).toBe(false);
    // Not onLastGood (head mismatch) — same.
    const mismatchOver = decideLastGood({
      headSha: 'b', state, dirty: false, nowMs: 3000, maxAgeMs: 2000,
    });
    expect(mismatchOver.overAge).toBe(false);
  });
});

describe('lastGoodMaxAgeMs', () => {
  it('defaults to 24h with no env override', () => {
    expect(lastGoodMaxAgeMs({})).toBe(24 * 60 * 60_000);
    expect(lastGoodMaxAgeMs({})).toBe(DEFAULT_LAST_GOOD_MAX_AGE_MS);
  });

  it('honors a positive numeric env override', () => {
    expect(lastGoodMaxAgeMs({ [LAST_GOOD_MAX_AGE_ENV]: '1000' })).toBe(1000);
  });

  it('falls back to the default on a non-positive or non-numeric override', () => {
    expect(lastGoodMaxAgeMs({ [LAST_GOOD_MAX_AGE_ENV]: '0' })).toBe(DEFAULT_LAST_GOOD_MAX_AGE_MS);
    expect(lastGoodMaxAgeMs({ [LAST_GOOD_MAX_AGE_ENV]: '-5' })).toBe(DEFAULT_LAST_GOOD_MAX_AGE_MS);
    expect(lastGoodMaxAgeMs({ [LAST_GOOD_MAX_AGE_ENV]: 'not-a-number' })).toBe(DEFAULT_LAST_GOOD_MAX_AGE_MS);
  });
});

// ── c. assertMainNotStale — the x5wbsbc last-good fallback for a managed clone ──────────────────────────────

describe('assertMainNotStale — the x5wbsbc last-good fallback (managed clone)', () => {
  const saved = {};
  beforeEach(() => {
    saved.had = Object.prototype.hasOwnProperty.call(process.env, 'WE_DAEMON_MANAGED_CLONE');
    saved.value = process.env.WE_DAEMON_MANAGED_CLONE;
    process.env.WE_DAEMON_MANAGED_CLONE = '1';
  });
  afterEach(() => {
    if (saved.had) process.env.WE_DAEMON_MANAGED_CLONE = saved.value;
    else delete process.env.WE_DAEMON_MANAGED_CLONE;
  });

  const warnCheck = () => () => ({
    action: 'warn', reason: 'diverged', behind: 3, ahead: 2, dirty: false,
  });

  it('onLastGood true: returns fresh/onLastGood, does NOT throw, writes a LAST-KNOWN-GOOD line (no ALERT)', () => {
    const root = makeRealRepoWithOrigin();
    const writes = [];
    const lastGood = () => ({
      onLastGood: true,
      lastGood: 'a'.repeat(40),
      held: { since: new Date().toISOString(), reason: 'smoke-rejected' },
      heldSince: new Date().toISOString(),
      ageMs: 1000,
      overAge: false,
    });

    const result = assertMainNotStale(root, warnCheck(), { lastGood, write: (s) => writes.push(s) });

    expect(result.fresh).toBe(true);
    expect(result.onLastGood).toBe(true);
    expect(result.lastGood).toBe('a'.repeat(40));
    expect(writes.some((s) => s.includes('LAST-KNOWN-GOOD'))).toBe(true);
    expect(writes.some((s) => s.includes('ALERT'))).toBe(false);
  });

  it('overAge true: ALSO writes an ALERT line, and still returns without throwing', () => {
    const root = makeRealRepoWithOrigin();
    const writes = [];
    const lastGood = () => ({
      onLastGood: true,
      lastGood: 'b'.repeat(40),
      held: { since: new Date(0).toISOString(), reason: 'smoke-rejected' },
      heldSince: new Date(0).toISOString(),
      ageMs: 30 * 3_600_000, // 30h
      overAge: true,
    });

    const result = assertMainNotStale(root, warnCheck(), { lastGood, write: (s) => writes.push(s) });

    expect(result.fresh).toBe(true);
    expect(result.overAge).toBe(true);
    expect(writes.some((s) => s.includes('LAST-KNOWN-GOOD'))).toBe(true);
    expect(writes.some((s) => s.includes('ALERT'))).toBe(true);
  });

  it('onLastGood false: still throws with the STALE code marker', () => {
    const root = makeRealRepoWithOrigin();
    const lastGood = () => ({
      onLastGood: false, lastGood: null, held: null, heldSince: null, ageMs: null, overAge: false,
    });

    expect(() => assertMainNotStale(root, warnCheck(), { lastGood, write: () => {} }))
      .toThrow(STALE_MAIN_REFUSAL_MARKER);
  });

  it('a lastGood that throws is treated the same as onLastGood:false (fail closed) — still throws the STALE marker', () => {
    const root = makeRealRepoWithOrigin();
    const lastGood = () => { throw new Error('boom'); };

    expect(() => assertMainNotStale(root, warnCheck(), { lastGood, write: () => {} }))
      .toThrow(STALE_MAIN_REFUSAL_MARKER);
  });

  it('a non-warn check (fresh/synced) never calls lastGood at all', () => {
    const root = makeRealRepoWithOrigin();
    let called = false;
    const lastGood = () => { called = true; return { onLastGood: true }; };
    const freshCheck = () => ({ fresh: true, behind: 0 });

    const result = assertMainNotStale(root, freshCheck, { lastGood, write: () => {} });

    expect(result.fresh).toBe(true);
    expect(called).toBe(false);
  });
});
