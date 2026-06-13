/**
 * Version-migration planner (#491, slice (a) of #191). Proves the version-gated, intermediate-spanning
 * selection over changelog manifests: only entries in (installed, target] with a migration ref, ordered;
 * gaps stop short (reachedTarget false); downgrades and mixed-package sets throw.
 */
import { describe, it, expect } from 'vitest';
import {
  planVersionMigration,
  MigrationPlanError,
  type ChangelogManifest,
  type MigrationRef,
} from '../../../renderers/upgrader/versionMigrationPlanner';

const mig = (ref: string): MigrationRef => ({ ref, author: 'we', integrity: 'sha256-x', rewrites: 'renames attr' });

const manifest = (previous: string, release: string, entries: ChangelogManifest['entries']): ChangelogManifest => ({
  manifestVersion: '1', package: 'droplist', previous, release, entries,
});

// 1.0.0 -> 2.0.0 has one breaking migration; 2.0.0 -> 3.0.0 has one breaking + one non-breaking.
const chain: ChangelogManifest[] = [
  manifest('1.0.0', '2.0.0', [{ module: 'select', severity: 'major', type: 'changed', summary: 'value shape', migration: mig('m-select') }]),
  manifest('2.0.0', '3.0.0', [
    { module: 'menu', severity: 'major', type: 'removed', summary: 'drop legacy slot', migration: mig('m-menu') },
    { module: 'menu', severity: 'patch', type: 'fixed', summary: 'a11y label', /* no migration */ },
  ]),
];

describe('planVersionMigration (#491)', () => {
  it('spans intermediate versions in order, collecting only entries with a migration ref', () => {
    const plan = planVersionMigration('1.0.0', '3.0.0', chain);
    expect(plan.reachedTarget).toBe(true);
    expect(plan.spannedVersions).toEqual(['2.0.0', '3.0.0']);
    expect(plan.steps.map((s) => s.migration.ref)).toEqual(['m-select', 'm-menu']); // patch fix excluded
    expect(plan.steps[0]).toMatchObject({ fromVersion: '1.0.0', toVersion: '2.0.0', module: 'select' });
  });

  it('is version-gated — a target short of the chain stops at it', () => {
    const plan = planVersionMigration('1.0.0', '2.0.0', chain);
    expect(plan.spannedVersions).toEqual(['2.0.0']);
    expect(plan.steps.map((s) => s.migration.ref)).toEqual(['m-select']);
    expect(plan.reachedTarget).toBe(true);
  });

  it('skips manifests already below the installed version', () => {
    const plan = planVersionMigration('2.0.0', '3.0.0', chain);
    expect(plan.spannedVersions).toEqual(['3.0.0']);
    expect(plan.steps.map((s) => s.migration.ref)).toEqual(['m-menu']);
  });

  it('returns an empty, complete plan when installed === target', () => {
    const plan = planVersionMigration('3.0.0', '3.0.0', chain);
    expect(plan).toMatchObject({ steps: [], spannedVersions: [], reachedTarget: true });
  });

  it('reports reachedTarget=false with partial steps when the chain has a gap', () => {
    // No 2.0.0 -> 3.0.0 manifest, so 1.0.0 -> 4.0.0 can only span the first hop.
    const gapped = [chain[0]];
    const plan = planVersionMigration('1.0.0', '4.0.0', gapped);
    expect(plan.reachedTarget).toBe(false);
    expect(plan.spannedVersions).toEqual(['2.0.0']);
    expect(plan.steps).toHaveLength(1);
  });

  it('takes the smallest next release so a direct installed->target manifest never skips intermediates', () => {
    const withShortcut = [...chain, manifest('1.0.0', '3.0.0', [{ module: 'all', severity: 'major', type: 'changed', summary: 'mega', migration: mig('m-mega') }])];
    const plan = planVersionMigration('1.0.0', '3.0.0', withShortcut);
    // Must walk 1->2->3, not the 1->3 shortcut.
    expect(plan.spannedVersions).toEqual(['2.0.0', '3.0.0']);
    expect(plan.steps.map((s) => s.migration.ref)).toEqual(['m-select', 'm-menu']);
  });

  it('throws on a downgrade', () => {
    expect(() => planVersionMigration('3.0.0', '2.0.0', chain)).toThrow(MigrationPlanError);
  });

  it('throws on a mixed-package manifest set without a disambiguating package', () => {
    const mixed = [chain[0], { ...chain[1], package: 'other' }];
    expect(() => planVersionMigration('1.0.0', '3.0.0', mixed)).toThrow(/multiple packages/);
  });

  it('disambiguates a mixed set when a package is named', () => {
    const mixed = [chain[0], { ...chain[1], package: 'other' }];
    const plan = planVersionMigration('1.0.0', '2.0.0', mixed, 'droplist');
    expect(plan.steps.map((s) => s.migration.ref)).toEqual(['m-select']);
  });
});
