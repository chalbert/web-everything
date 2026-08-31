/**
 * @file scripts/lib/__tests__/rust-scan-bridge.test.mjs
 * @description Fast, cargo-free unit tests for the fallback contract runWeScan/createWeScanRunner promise
 *   check-standards.mjs's call sites: `null` on ANY failure (missing binary, non-zero exit, unparseable
 *   output), a parsed value on success — never a thrown error. Uses `createWeScanRunner`'s injection seam
 *   with tiny fixture scripts standing in for the real `we-scan` binary, so this needs no Rust toolchain and
 *   stays in the default fast suite (the real binary's own behavior is proven by
 *   scripts/__tests__/rust-scan-*-parity.test.mjs, which does need cargo).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
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
});
