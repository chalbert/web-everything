/**
 * @file skills-src/conveyor/__tests__/daemon-manifest.test.mjs
 * @description Unit proof of #3871's closed allowlist — the one gate standing between a `--pass=<name>` flag
 *   and a real spawn. The REAL {@link DAEMON_MANIFEST} starts empty by design (see that file's header); every
 *   test here supplies its OWN fixture manifest rather than mutating the shared one.
 */
import { describe, it, expect } from 'vitest';
import {
  DAEMON_MANIFEST, isSafeManifestScriptPath, assertValidManifestEntry, resolveManifestEntry,
} from '../daemon-manifest.mjs';

describe('DAEMON_MANIFEST — starts empty by design', () => {
  it('has no entries yet (populated by later daemon-launcher slices, not this one)', () => {
    expect(Object.keys(DAEMON_MANIFEST)).toEqual([]);
  });
});

describe('isSafeManifestScriptPath', () => {
  it('accepts a plain repo-relative path', () => {
    expect(isSafeManifestScriptPath('scripts/conveyor/branch-drift.mjs')).toBe(true);
  });
  it('refuses an absolute path, a .. traversal, a NUL byte, or a non-string', () => {
    expect(isSafeManifestScriptPath('/etc/passwd')).toBe(false);
    expect(isSafeManifestScriptPath('../../etc/passwd')).toBe(false);
    expect(isSafeManifestScriptPath('scripts/../../../etc/passwd')).toBe(false);
    expect(isSafeManifestScriptPath('scripts/x\0.mjs')).toBe(false);
    expect(isSafeManifestScriptPath('')).toBe(false);
    expect(isSafeManifestScriptPath(undefined)).toBe(false);
    expect(isSafeManifestScriptPath(42)).toBe(false);
  });
});

describe('assertValidManifestEntry', () => {
  it('accepts a well-formed entry and returns it unchanged', () => {
    const entry = { script: 'scripts/conveyor/branch-drift.mjs', args: ['sweep'], intervalMs: 120_000 };
    expect(assertValidManifestEntry('branch-drift', entry)).toBe(entry);
  });
  it('accepts an entry with no args (optional)', () => {
    const entry = { script: 'scripts/conveyor/x.mjs', intervalMs: 1000 };
    expect(assertValidManifestEntry('x', entry)).toBe(entry);
  });
  it('rejects a missing/unsafe script path', () => {
    expect(() => assertValidManifestEntry('bad', { script: '/etc/passwd', intervalMs: 1000 })).toThrow(/script must be a repo-relative path/);
    expect(() => assertValidManifestEntry('bad', { intervalMs: 1000 })).toThrow(/script must be a repo-relative path/);
  });
  it('rejects non-array or non-string args', () => {
    expect(() => assertValidManifestEntry('bad', { script: 'x.mjs', args: 'sweep', intervalMs: 1000 })).toThrow(/args must be an array of strings/);
    expect(() => assertValidManifestEntry('bad', { script: 'x.mjs', args: [1, 2], intervalMs: 1000 })).toThrow(/args must be an array of strings/);
  });
  it('rejects a non-positive or non-numeric intervalMs', () => {
    expect(() => assertValidManifestEntry('bad', { script: 'x.mjs', intervalMs: 0 })).toThrow(/intervalMs must be a positive number/);
    expect(() => assertValidManifestEntry('bad', { script: 'x.mjs', intervalMs: -5 })).toThrow(/intervalMs must be a positive number/);
    expect(() => assertValidManifestEntry('bad', { script: 'x.mjs', intervalMs: 'soon' })).toThrow(/intervalMs must be a positive number/);
  });
  it('rejects a non-object entry entirely', () => {
    expect(() => assertValidManifestEntry('bad', null)).toThrow(/is not an object/);
    expect(() => assertValidManifestEntry('bad', 'x.mjs')).toThrow(/is not an object/);
  });
});

describe('resolveManifestEntry — the closed-allowlist lookup itself', () => {
  const fixture = { 'ci-queue-watch': { script: 'scripts/conveyor/ci-queue-watch.mjs', args: ['sweep'], intervalMs: 60_000 } };

  it('resolves a known name from a supplied manifest', () => {
    expect(resolveManifestEntry('ci-queue-watch', fixture)).toEqual(fixture['ci-queue-watch']);
  });
  it('refuses an unknown name and names every currently-known entry', () => {
    expect(() => resolveManifestEntry('totally-made-up', fixture)).toThrow(/"totally-made-up" is not in the daemon manifest/);
    expect(() => resolveManifestEntry('totally-made-up', fixture)).toThrow(/Known entries: ci-queue-watch/);
  });
  it('never takes a raw path as the name — a path-shaped name is just another unknown name', () => {
    expect(() => resolveManifestEntry('/etc/passwd', fixture)).toThrow(/is not in the daemon manifest/);
    expect(() => resolveManifestEntry('../../etc/passwd', fixture)).toThrow(/is not in the daemon manifest/);
  });
  it('says so plainly when nothing is registered at all', () => {
    expect(() => resolveManifestEntry('anything', {})).toThrow(/No entries are registered yet/);
  });
  it('re-validates on every lookup — a corrupted on-disk entry still fails closed', () => {
    expect(() => resolveManifestEntry('bad', { bad: { script: '/etc/passwd', intervalMs: 1000 } })).toThrow(/script must be a repo-relative path/);
  });
  it('defaults to the real DAEMON_MANIFEST when none is supplied', () => {
    expect(() => resolveManifestEntry('anything')).toThrow(/No entries are registered yet/);
  });
});
