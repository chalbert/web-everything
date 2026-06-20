/**
 * Client-storage schema-versioning facet (#1295, ruling #1251). Proves the per-key `{v,data}` envelope,
 * version-stamp detection, and the migrate-or-discard mismatch policy over any inner CustomStorageStrategy.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { VersionedStorageStrategy, versioned, isVersionedEnvelope } from '../../VersionedStorageStrategy';
import type { CustomStorageStrategy } from '../../CustomStorageStrategy';

/** A tiny in-memory inner strategy, so the test asserts the versioning boundary, not an engine. */
function memStrategy(): CustomStorageStrategy<unknown> & { dump: Map<string, unknown> } {
  const dump = new Map<string, unknown>();
  const k = (s: string, id: string) => `${s}:${id}`;
  return {
    key: 'mem',
    dump,
    async get(s, id) { return dump.get(k(s, id)); },
    async set(s, id, v) { dump.set(k(s, id), v); },
    async delete(s, id) { dump.delete(k(s, id)); },
    async keys(s) { return [...dump.keys()].filter((x) => x.startsWith(`${s}:`)).map((x) => x.slice(s.length + 1)); },
  };
}

describe('VersionedStorageStrategy (#1295/#1251)', () => {
  let inner: ReturnType<typeof memStrategy>;
  beforeEach(() => { inner = memStrategy(); });

  it('writes a per-key {v,data} envelope and reads it back when the version matches', async () => {
    const s = versioned<{ n: number }>(inner, { version: 2 });
    await s.set('app', 'cfg', { n: 1 });
    expect(inner.dump.get('app:cfg')).toEqual({ v: 2, data: { n: 1 } }); // envelope on disk
    expect(await s.get('app', 'cfg')).toEqual({ n: 1 }); // unwrapped on read
  });

  it('discards to defaults (undefined) on a version mismatch with no migration (#1251 default)', async () => {
    await new VersionedStorageStrategy(inner, { version: 1 }).set('app', 'cfg', { n: 1 });
    const reader = versioned(inner, { version: 2 }); // schema moved on, no migrate
    expect(await reader.get('app', 'cfg')).toBeUndefined();
  });

  it('discards a legacy un-enveloped value (predates versioning)', async () => {
    await inner.set('app', 'cfg', { n: 1 }); // raw, no envelope
    expect(await versioned(inner, { version: 1 }).get('app', 'cfg')).toBeUndefined();
  });

  it('runs a registered migration and (by default) heals the store on read', async () => {
    await new VersionedStorageStrategy(inner, { version: 1 }).set('app', 'cfg', { old: 5 });
    const reader = versioned<{ n: number }>(inner, {
      version: 2,
      migrate: (stale, from) => (from === 1 ? { n: (stale as { old: number }).old } : undefined),
    });
    expect(await reader.get('app', 'cfg')).toEqual({ n: 5 });
    // Lazy heal: the store now holds the v2 envelope.
    expect(inner.dump.get('app:cfg')).toEqual({ v: 2, data: { n: 5 } });
  });

  it('persistMigrated:false migrates without a read side-effect', async () => {
    await new VersionedStorageStrategy(inner, { version: 1 }).set('app', 'cfg', 'x');
    const reader = versioned(inner, { version: 2, migrate: () => 'y', persistMigrated: false });
    expect(await reader.get('app', 'cfg')).toBe('y');
    expect(inner.dump.get('app:cfg')).toEqual({ v: 1, data: 'x' }); // unchanged
  });

  it('structural detect: a matching version but invalid payload is treated as a mismatch', async () => {
    await new VersionedStorageStrategy(inner, { version: 1 }).set('app', 'cfg', { n: 'not-a-number' });
    const reader = versioned<{ n: number }>(inner, {
      version: 1,
      detect: (d) => typeof (d as { n?: unknown }).n === 'number',
    });
    expect(await reader.get('app', 'cfg')).toBeUndefined(); // discarded despite v match
  });

  it('returns undefined for a missing key (no envelope work)', async () => {
    expect(await versioned(inner, { version: 1 }).get('app', 'missing')).toBeUndefined();
  });

  it('bulk + keys delegate through the envelope', async () => {
    const s = versioned<number>(inner, { version: 3 });
    await s.bulk('app', [{ op: 'set', id: 'a', value: 1 }, { op: 'set', id: 'b', value: 2 }]);
    expect(inner.dump.get('app:a')).toEqual({ v: 3, data: 1 });
    expect((await s.keys('app')).sort()).toEqual(['a', 'b']);
    await s.delete('app', 'a');
    expect(await s.get('app', 'a')).toBeUndefined();
  });

  it('isVersionedEnvelope distinguishes an envelope from a legacy value', () => {
    expect(isVersionedEnvelope({ v: 1, data: {} })).toBe(true);
    expect(isVersionedEnvelope({ n: 1 })).toBe(false);
    expect(isVersionedEnvelope(null)).toBe(false);
  });
});
