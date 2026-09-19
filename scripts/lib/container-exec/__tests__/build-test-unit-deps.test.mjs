/**
 * @file scripts/lib/container-exec/__tests__/build-test-unit-deps.test.mjs
 * @description Unit proof for the test:unit slice's image-build automation's pure helpers. The real build/seed
 *   I/O (container build, volume create, seed copy) is proven manually — see `container-exec.mjs`'s own
 *   "test:unit slice" header section and the PR that introduced this script for the measured evidence (this
 *   script's own `status`/`build` CLI modes were run for real against the actual repo lockfile and a real
 *   `container` instance while building this slice: build → idempotent no-op re-run → `status` reporting
 *   `stale:false`). This suite covers only the pure, no-IO logic — mirrors `container-exec.test.mjs`'s own
 *   split between pure unit coverage and a separately-run real integration proof.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lockfileHash, parseFlags, MARKER } from '../build-test-unit-deps.mjs';

describe('lockfileHash — a short, stable digest of package-lock.json content', () => {
  it('is deterministic for the same content', () => {
    const dir = mkdtempSync(join(tmpdir(), 'build-test-unit-deps-hash-test-'));
    try {
      writeFileSync(join(dir, 'package-lock.json'), '{"a":1}', 'utf8');
      expect(lockfileHash(dir)).toBe(lockfileHash(dir));
      expect(lockfileHash(dir)).toMatch(/^[0-9a-f]{16}$/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('changes when the lockfile content changes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'build-test-unit-deps-hash-test-'));
    try {
      writeFileSync(join(dir, 'package-lock.json'), '{"a":1}', 'utf8');
      const h1 = lockfileHash(dir);
      writeFileSync(join(dir, 'package-lock.json'), '{"a":2}', 'utf8');
      expect(lockfileHash(dir)).not.toBe(h1);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('parseFlags — mirrors heavy-admission.mjs\'s own local parser', () => {
  it('splits --key=value flags from positionals, bare --key is boolean true', () => {
    expect(parseFlags(['status', '--force', '--image=custom:tag'])).toEqual({
      flags: { force: true, image: 'custom:tag' },
      positionals: ['status'],
    });
  });
  it('defaults to an empty flags/positionals shape', () => {
    expect(parseFlags([])).toEqual({ flags: {}, positionals: [] });
  });
});

describe('MARKER — the seeded-lockfile-hash filename this script and its own status check agree on', () => {
  it('is a plain dotfile name, not a path', () => {
    expect(MARKER).toBe('.deps-lockfile-hash');
    expect(MARKER).not.toContain('/');
  });
});
