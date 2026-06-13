/**
 * Version-migration transform interpreter (#492, slice (b) of #191). Proves the declarative-first
 * vocabulary (rename-attr / move-dimension / retire-provider / re-namespace) each apply natively, that
 * the imperative escape hatch runs ONLY a trust-verified codemod (integrity-gated), and that a whole
 * plan's steps thread output in order with a clean applied/deferred tally.
 */
import { describe, it, expect } from 'vitest';
import {
  interpretMigration,
  applyMigrationPlan,
  CustomCodemodRegistry,
  type RegisteredCodemod,
} from '../../../renderers/upgrader/transformInterpreter';
import type {
  DeclarativeTransform,
  MigrationPlan,
  MigrationStep,
} from '../../../renderers/upgrader/versionMigrationPlanner';

const declarative = (transform: DeclarativeTransform) => ({ mode: 'declarative' as const, transform });

describe('interpretMigration — declarative vocabulary', () => {
  it('rename-attr renames the attribute on the scoped element, value preserved', () => {
    const r = interpretMigration(
      '<we-select disabled="true"></we-select><we-menu disabled="true"></we-menu>',
      declarative({ kind: 'rename-attr', element: 'we-select', from: 'disabled', to: 'inert' }),
    );
    expect(r.applied).toBe(true);
    expect(r.output).toContain('<we-select inert="true">');
    expect(r.output).toContain('<we-menu disabled="true">'); // out of scope, untouched
    expect(r.mode).toBe('declarative');
  });

  it('rename-attr with no element scope hits every bearer; no match ⇒ applied false', () => {
    const hit = interpretMigration('<a-x f="1"></a-x><b-y f="2"></b-y>', declarative({ kind: 'rename-attr', from: 'f', to: 'g' }));
    expect(hit.applied).toBe(true);
    expect(hit.output).toContain('g="1"');
    expect(hit.output).toContain('g="2"');

    const miss = interpretMigration('<a-x z="1"></a-x>', declarative({ kind: 'rename-attr', from: 'f', to: 'g' }));
    expect(miss.applied).toBe(false);
    expect(miss.output).toContain('z="1"');
  });

  it('move-dimension remaps the value through valueMap, flagging an unmapped value', () => {
    const mapped = interpretMigration(
      '<we-box size="lg"></we-box>',
      declarative({ kind: 'move-dimension', element: 'we-box', from: 'size', to: 'density', valueMap: { lg: 'loose' } }),
    );
    expect(mapped.applied).toBe(true);
    expect(mapped.output).toContain('density="loose"');
    expect(mapped.output).not.toContain('size=');
    expect(mapped.diagnostics).toHaveLength(0);

    const unmapped = interpretMigration(
      '<we-box size="xl"></we-box>',
      declarative({ kind: 'move-dimension', element: 'we-box', from: 'size', to: 'density', valueMap: { lg: 'loose' } }),
    );
    expect(unmapped.output).toContain('density="xl"'); // moved verbatim
    expect(unmapped.diagnostics.join(' ')).toMatch(/no entry in valueMap/);
  });

  it('retire-provider rewrites to the replacement, or flags when there is none', () => {
    const replaced = interpretMigration(
      '<we-list renderer="legacy-rows"></we-list>',
      declarative({ kind: 'retire-provider', element: 'we-list', attribute: 'renderer', retired: 'legacy-rows', replacement: 'virtual-rows' }),
    );
    expect(replaced.applied).toBe(true);
    expect(replaced.output).toContain('renderer="virtual-rows"');

    const flagged = interpretMigration(
      '<we-list renderer="legacy-rows"></we-list>',
      declarative({ kind: 'retire-provider', element: 'we-list', attribute: 'renderer', retired: 'legacy-rows' }),
    );
    expect(flagged.applied).toBe(false);
    expect(flagged.output).toContain('renderer="legacy-rows"'); // not silently dropped
    expect(flagged.diagnostics.join(' ')).toMatch(/manual intervention required/);
  });

  it('re-namespace rewrites the tag prefix, nested-safe', () => {
    const r = interpretMigration(
      '<we-card><we-title>Hi</we-title></we-card><other-x></other-x>',
      declarative({ kind: 're-namespace', from: 'we-', to: 'fui-' }),
    );
    expect(r.applied).toBe(true);
    expect(r.output).toContain('<fui-card>');
    expect(r.output).toContain('<fui-title>Hi</fui-title>');
    expect(r.output).toContain('<other-x>'); // untouched
  });
});

describe('interpretMigration — imperative escape hatch (trust-gated)', () => {
  const codemod = (over: Partial<RegisteredCodemod> = {}): RegisteredCodemod => ({
    ref: 'm-complex',
    integrity: 'sha256-trusted',
    apply: (s) => s.replace('old', 'new'),
    ...over,
  });
  const imperative = (over = {}) => ({ mode: 'imperative' as const, ref: 'm-complex', author: 'we', integrity: 'sha256-trusted', rewrites: 'complex', ...over });

  it('runs a codemod whose integrity matches the manifest', () => {
    const registry = new CustomCodemodRegistry().register(codemod());
    const r = interpretMigration('<x>old</x>', imperative(), { codemods: registry });
    expect(r.mode).toBe('imperative');
    expect(r.applied).toBe(true);
    expect(r.output).toBe('<x>new</x>');
    expect(r.notes.join(' ')).toMatch(/trusted codemod/);
  });

  it('refuses an integrity mismatch instead of running untrusted code', () => {
    const registry = new CustomCodemodRegistry().register(codemod({ integrity: 'sha256-TAMPERED' }));
    const r = interpretMigration('<x>old</x>', imperative(), { codemods: registry });
    expect(r.mode).toBe('deferred');
    expect(r.applied).toBe(false);
    expect(r.output).toBe('<x>old</x>'); // unchanged — never ran
    expect(r.diagnostics.join(' ')).toMatch(/integrity mismatch/);
  });

  it('defers when the codemod is missing, or no registry was provided at all', () => {
    const empty = new CustomCodemodRegistry();
    const missing = interpretMigration('<x>old</x>', imperative(), { codemods: empty });
    expect(missing.diagnostics.join(' ')).toMatch(/no codemod registered/);

    const noRegistry = interpretMigration('<x>old</x>', imperative());
    expect(noRegistry.diagnostics.join(' ')).toMatch(/needs a codemod registry/);
  });
});

describe('applyMigrationPlan — ordered run loop', () => {
  const step = (migration: MigrationStep['migration']): MigrationStep => ({
    package: 'droplist', fromVersion: '1.0.0', toVersion: '2.0.0', module: 'select', summary: 's', migration,
  });
  const plan = (steps: MigrationStep[]): MigrationPlan => ({
    package: 'droplist', installed: '1.0.0', target: '3.0.0', steps, spannedVersions: ['2.0.0', '3.0.0'], reachedTarget: true,
  });

  it('threads each step output into the next and tallies applied vs deferred', () => {
    const p = plan([
      step(declarative({ kind: 'rename-attr', from: 'a', to: 'b' })),
      step(declarative({ kind: 'rename-attr', from: 'b', to: 'c' })),
      step({ mode: 'imperative', ref: 'missing', author: 'we', integrity: 'x', rewrites: 'r' }), // defers (no registry)
    ]);
    const r = applyMigrationPlan('<we-x a="1"></we-x>', p);
    expect(r.output).toContain('c="1"'); // a→b→c chained across steps
    expect(r.applied).toBe(2);
    expect(r.deferred).toBe(1);
    expect(r.diagnostics.join(' ')).toMatch(/needs a codemod registry/);
  });
});
