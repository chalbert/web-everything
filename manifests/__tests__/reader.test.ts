/**
 * Changelog-manifest reader runtime (#1021/#1058): the `ChangelogReader` over a {@link ChangelogManifest}
 * — per-module entry queries, the *derived* strictest-wins release severity, the breaking/migration view,
 * and the migration integrity gate. Pins the contract the reader must not drift from; mirrors
 * `intl/__tests__/registry.test.ts` / `reliability/__tests__/registry.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import {
  ChangelogReader,
  readManifest,
  type ChangelogManifest,
} from '../index.js';

/** A sample release manifest exercising every entry shape (mirrors the #1059 demo fixture). */
const MANIFEST: ChangelogManifest = {
  manifestVersion: '1',
  package: '@frontierui/blocks',
  release: '2.0.0',
  previous: '1.4.0',
  entries: [
    {
      module: 'CustomStore',
      severity: 'major',
      type: 'changed',
      summary: 'rename the `filter` prop to `predicate`',
      migration: {
        ref: 'migrations/2.0.0/rename-filter-prop.codemod.ts',
        author: 'frontierui-core',
        integrity: 'sha256-abc123',
        rewrites: 'CustomStore call sites using the `filter` prop',
      },
    },
    {
      module: 'CustomStore',
      severity: 'major',
      type: 'removed',
      summary: 'drop the deprecated `legacyMode` flag',
    },
    {
      module: 'CustomList',
      severity: 'minor',
      type: 'added',
      summary: 'add a `virtualized` option',
    },
    {
      module: 'CustomList',
      severity: 'patch',
      type: 'fixed',
      summary: 'fix off-by-one in the windowing math',
    },
  ],
};

describe('ChangelogReader', () => {
  const reader = readManifest(MANIFEST);

  it('readManifest returns a ChangelogReader over the manifest', () => {
    expect(reader).toBeInstanceOf(ChangelogReader);
    expect(reader.manifest).toBe(MANIFEST);
    expect(reader.release).toBe('2.0.0');
    expect(reader.previous).toBe('1.4.0');
  });

  it('entries() returns all entries in manifest order', () => {
    expect(reader.entries()).toHaveLength(4);
    expect(reader.entries()[0].module).toBe('CustomStore');
  });

  it('entriesFor(module) returns only that module’s entries (the unit is the module, not the package)', () => {
    const entries = reader.entriesFor('CustomStore');
    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.module === 'CustomStore')).toBe(true);
    expect(reader.entriesFor('Nonexistent')).toEqual([]);
  });

  it('bySeverity filters per the major/minor/patch vocabulary', () => {
    expect(reader.bySeverity('major')).toHaveLength(2);
    expect(reader.bySeverity('minor')).toHaveLength(1);
    expect(reader.bySeverity('patch')).toHaveLength(1);
  });

  it('breaking() is exactly the major-severity entries', () => {
    const breaking = reader.breaking();
    expect(breaking).toHaveLength(2);
    expect(breaking.every((e) => e.severity === 'major')).toBe(true);
  });

  it('withMigration() returns entries carrying a migration (breaking + mechanically applicable)', () => {
    const withMig = reader.withMigration();
    expect(withMig).toHaveLength(1);
    expect(withMig[0].migration?.ref).toContain('rename-filter-prop');
    // the breaking `removed` entry is breaking but has no mechanical migration
    expect(reader.breaking().some((e) => e.migration === undefined)).toBe(true);
  });
});

describe('releaseSeverity — strictest-wins derivation', () => {
  it('any major entry ⇒ major', () => {
    expect(readManifest(MANIFEST).releaseSeverity()).toBe('major');
  });

  it('no major but a minor ⇒ minor', () => {
    const m: ChangelogManifest = {
      ...MANIFEST,
      entries: [
        { module: 'A', severity: 'minor', type: 'added', summary: 'x' },
        { module: 'B', severity: 'patch', type: 'fixed', summary: 'y' },
      ],
    };
    expect(readManifest(m).releaseSeverity()).toBe('minor');
  });

  it('only patches ⇒ patch', () => {
    const m: ChangelogManifest = {
      ...MANIFEST,
      entries: [{ module: 'A', severity: 'patch', type: 'fixed', summary: 'y' }],
    };
    expect(readManifest(m).releaseSeverity()).toBe('patch');
  });

  it('an empty manifest derives patch (the gentlest band)', () => {
    const m: ChangelogManifest = { ...MANIFEST, entries: [] };
    expect(readManifest(m).releaseSeverity()).toBe('patch');
  });
});

describe('verifyMigration — the integrity gate', () => {
  const reader = readManifest(MANIFEST);
  const migration = reader.withMigration()[0].migration!;

  it('verifies when the supplied content hash equals the declared integrity', () => {
    const result = reader.verifyMigration(migration, 'sha256-abc123');
    expect(result.ok).toBe(true);
    expect(result.expected).toBe('sha256-abc123');
    expect(result.actual).toBe('sha256-abc123');
  });

  it('rejects a content-hash mismatch (the codemod was tampered with)', () => {
    const result = reader.verifyMigration(migration, 'sha256-tampered');
    expect(result.ok).toBe(false);
    expect(result.expected).toBe('sha256-abc123');
    expect(result.actual).toBe('sha256-tampered');
  });

  it('never verifies a migration that declares an empty integrity hash', () => {
    const noHash = { ...migration, integrity: '' };
    expect(reader.verifyMigration(noHash, '').ok).toBe(false);
  });
});
