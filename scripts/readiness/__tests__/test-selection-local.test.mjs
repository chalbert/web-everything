/**
 * @file scripts/readiness/__tests__/test-selection-local.test.mjs
 * @description xpnhz4o — the LOCAL agent-gate selection policy (`decideLocalSelection`), deliberately wider than
 *   the CI deny-by-default one (`decideSelection`, untouched): shrink by default, full suite only where the
 *   module graph is blind. Pure — no git, no vitest.
 */
import { describe, it, expect } from 'vitest';
import { decideLocalSelection, decideSelection, isLocalFullSuiteTrigger, referencedTestNeedles } from '../test-selection.mjs';

describe('decideLocalSelection (xpnhz4o)', () => {
  it('SHRINKS an ordinary scripts/ change — the case the CI policy sends to the full suite', () => {
    expect(decideSelection({ changedFiles: ['scripts/guard-bash.mjs'], flagEnabled: true }).mode).toBe('full');
    const d = decideLocalSelection({ changedFiles: ['scripts/guard-bash.mjs', 'skills-src/conveyor/fix-agent-brief.md'] });
    expect(d.mode).toBe('shrink');
    expect(d.relatedFiles).toEqual(['scripts/guard-bash.mjs', 'skills-src/conveyor/fix-agent-brief.md']);
  });

  it.each(['package.json', 'pnpm-lock.yaml', 'vitest.config.ts', 'vitest.setup.ts', 'vitest.integration.config.ts', 'tsconfig.plugs.json',
    'scripts/__tests__/helpers/fake.mjs', 'scripts/__tests__/fixtures/a.json', 'blocks/x/__mocks__/y.ts'])('falls back to FULL for %s', (f) => {
    expect(isLocalFullSuiteTrigger(f)).toBe(true);
    const d = decideLocalSelection({ changedFiles: ['scripts/a.mjs', f] });
    expect(d.mode).toBe('full');
    expect(d.triggerFiles).toEqual([f]);
  });

  it('a test file or snapshot is NOT a trigger; a snapshot maps to its test', () => {
    expect(isLocalFullSuiteTrigger('scripts/__tests__/a.test.mjs')).toBe(false);
    const d = decideLocalSelection({ changedFiles: ['blocks/x/__tests__/__snapshots__/x.test.ts.snap'] });
    expect(d.mode).toBe('shrink');
    expect(d.relatedFiles).toEqual(['blocks/x/__tests__/x.test.ts']);
  });

  it('a deleted source file forces FULL; deleted non-code files are just dropped', () => {
    expect(decideLocalSelection({ changedFiles: ['scripts/gone.mjs'], deletedFiles: ['scripts/gone.mjs'] }).mode).toBe('full');
    const d = decideLocalSelection({ changedFiles: ['docs/a.md', 'scripts/b.mjs'], deletedFiles: ['docs/a.md'] });
    expect(d.mode).toBe('shrink');
    expect(d.relatedFiles).toEqual(['scripts/b.mjs']);
  });

  it('null / empty diff and the explicit opt-out all fall back to FULL', () => {
    expect(decideLocalSelection({ changedFiles: null }).mode).toBe('full');
    expect(decideLocalSelection({ changedFiles: [] }).mode).toBe('full');
    expect(decideLocalSelection({ changedFiles: ['scripts/a.mjs'], optOut: true }).mode).toBe('full');
  });
});

describe('referencedTestNeedles (xpnhz4o)', () => {
  it('names each changed non-test file by basename, skips generic/short names and test files', () => {
    expect(referencedTestNeedles(['scripts/verify-lane.mjs', 'src/index.ts', 'a.js', 'scripts/__tests__/x.test.mjs']))
      .toEqual(['verify-lane.mjs']);
  });

  it('adds a glob-discovered root (never backlog/, which check:standards covers unscoped)', () => {
    expect(referencedTestNeedles(['demos/loan/app.ts'])).toEqual(['app.ts', 'demos']);
    expect(referencedTestNeedles(['backlog/100-example-card.md'])).toEqual(['100-example-card.md']);
  });
});
