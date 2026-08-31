/**
 * @file scripts/lib/__tests__/rust-scan-bridge.test.mjs
 * @description Fast, cargo-free unit tests for the fallback contract runWeScan/createWeScanRunner promise
 *   check-standards.mjs's call sites: `null` on ANY failure (missing binary, STALE relative to a declared
 *   reference file, non-zero exit, unparseable output, non-array output), a parsed array on success — never
 *   a thrown error. Uses `createWeScanRunner`'s injection seam with tiny fixture scripts standing in for the
 *   real `we-scan` binary, so this needs no Rust toolchain and stays in the default fast suite (the real
 *   binary's own behavior is proven by scripts/__tests__/rust-scan-*-parity.test.mjs, which does need cargo).
 *
 * The shape-validation and staleness tests are the direct regression coverage for PR #1741's two review
 * findings — see rust-scan-bridge.mjs's own header for the full incident writeup.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, chmodSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWeScanRunner } from '../rust-scan-bridge.mjs';

let dir;
afterEach(() => {
  if (dir) { rmSync(dir, { recursive: true, force: true }); dir = undefined; }
});

function fixtureScript(body) {
  dir = mkdtempSync(join(tmpdir(), 'we-scan-bridge-test-'));
  const p = join(dir, 'fake-we-scan');
  writeFileSync(p, `#!/bin/sh\n${body}\n`);
  chmodSync(p, 0o755);
  return p;
}

/** Write `path` and set its mtime to `whenMs` (epoch ms) — deterministic staleness fixtures, no real
 *  clock/build timing to race against. */
function touchAt(path, whenMs) {
  writeFileSync(path, '// reference file fixture\n');
  const s = whenMs / 1000;
  utimesSync(path, s, s);
}

describe('createWeScanRunner — the fallback contract (#3417)', () => {
  it('returns null when the binary path does not exist', () => {
    const run = createWeScanRunner('/nonexistent/path/to/we-scan');
    expect(run('stdout-flush', ['--root=.'])).toBeNull();
  });

  it('returns the parsed JSON when the binary succeeds', () => {
    const bin = fixtureScript('echo \'[{"file":"a.mjs","line":1,"kind":"emit-then-exit","text":"x"}]\'');
    const run = createWeScanRunner(bin);
    expect(run('stdout-flush', ['--root=.'])).toEqual([{ file: 'a.mjs', line: 1, kind: 'emit-then-exit', text: 'x' }]);
  });

  it('returns null when the binary exits non-zero', () => {
    const bin = fixtureScript('echo "boom" >&2; exit 1');
    const run = createWeScanRunner(bin);
    expect(run('stdout-flush', ['--root=.'])).toBeNull();
  });

  it('returns null when the binary produces unparseable output (a stale/corrupt build)', () => {
    const bin = fixtureScript('echo "not json"');
    const run = createWeScanRunner(bin);
    expect(run('stdout-flush', ['--root=.'])).toBeNull();
  });

  it('never throws, across missing/failing/malformed cases', () => {
    const cases = [
      createWeScanRunner('/nonexistent/path'),
      createWeScanRunner(fixtureScript('exit 1')),
      createWeScanRunner(fixtureScript('echo "{"')),
    ];
    for (const run of cases) expect(() => run('secret-scrub', ['--root=.'])).not.toThrow();
  });

  // ── PR #1741 review finding 1 (correctness) — reject wrongly-shaped output, don't return it ──────────
  it('returns null when the binary emits valid JSON that is NOT an array (a build predating an output-contract change)', () => {
    const bin = fixtureScript('echo \'{"file":"a.mjs","line":1}\''); // an object, not the array contract
    const run = createWeScanRunner(bin);
    expect(run('stdout-flush', ['--root=.'])).toBeNull();
  });

  it('an array of any shape passes the array-only check (deep shape is the caller\'s own concern)', () => {
    const bin = fixtureScript('echo \'[]\'');
    const run = createWeScanRunner(bin);
    expect(run('stdout-flush', ['--root=.'])).toEqual([]);
  });

  it('the malformed-shape case never leaks the wrong-shaped value as a return', () => {
    const bin = fixtureScript('echo \'false\''); // valid JSON, not an array
    const run = createWeScanRunner(bin);
    const result = run('secret-scrub', ['--root=.']);
    expect(result).toBeNull();
    expect(result).not.toBe(false);
  });

  // ── PR #1741 review finding 2 (security) — refuse a binary staler than its JS reference ───────────────
  it('returns null when a referenceFile is NEWER than the binary (built once, JS edited afterward, no rebuild)', () => {
    const bin = fixtureScript('echo \'[{"file":"a.mjs"}]\'');
    utimesSync(bin, 1000, 1000); // binary "built" at t=1000s
    const ref = join(dir, 'reference.mjs');
    touchAt(ref, 2000_000); // reference file edited LATER, at t=2000s
    const run = createWeScanRunner(bin);
    expect(run('stdout-flush', ['--root=.'], { referenceFiles: [ref] })).toBeNull();
  });

  it('returns the parsed result when the binary is NEWER than every referenceFile (genuinely fresh)', () => {
    const bin = fixtureScript('echo \'[{"file":"a.mjs"}]\'');
    const ref = join(dir, 'reference.mjs');
    touchAt(ref, 1000_000); // reference file written FIRST, at t=1000s
    utimesSync(bin, 2000, 2000); // binary "built" AFTER, at t=2000s
    const run = createWeScanRunner(bin);
    expect(run('stdout-flush', ['--root=.'], { referenceFiles: [ref] })).toEqual([{ file: 'a.mjs' }]);
  });

  it('a missing referenceFile is not treated as staleness (nothing to compare against)', () => {
    const bin = fixtureScript('echo \'[{"file":"a.mjs"}]\'');
    const run = createWeScanRunner(bin);
    expect(run('stdout-flush', ['--root=.'], { referenceFiles: ['/nonexistent/reference.mjs'] })).toEqual([{ file: 'a.mjs' }]);
  });

  it('with MULTIPLE referenceFiles, staleness against ANY one of them is enough to fall back', () => {
    const bin = fixtureScript('echo \'[{"file":"a.mjs"}]\'');
    utimesSync(bin, 1000, 1000);
    const freshRef = join(dir, 'fresh.mjs');
    const staleRef = join(dir, 'stale-trigger.mjs');
    touchAt(freshRef, 500_000); // older than the binary — fine on its own
    touchAt(staleRef, 2000_000); // newer than the binary — this one alone must trigger the fallback
    const run = createWeScanRunner(bin);
    expect(run('stdout-flush', ['--root=.'], { referenceFiles: [freshRef, staleRef] })).toBeNull();
  });

  it('never throws on a staleness-triggering call', () => {
    const bin = fixtureScript('echo \'[{"file":"a.mjs"}]\'');
    utimesSync(bin, 1000, 1000);
    const ref = join(dir, 'reference.mjs');
    touchAt(ref, 2000_000);
    const run = createWeScanRunner(bin);
    expect(() => run('stdout-flush', ['--root=.'], { referenceFiles: [ref] })).not.toThrow();
  });
});
