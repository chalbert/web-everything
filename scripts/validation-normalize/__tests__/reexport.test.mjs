// Re-export leg (#282): given a project's config in one tool, emit an equivalent config for a DIFFERENT
// tool with an honest per-concern round-trip loss report. Proves: exact concerns re-export 1:1, partial
// mappings re-export but are flagged lossy, a concern with no target equivalent is DROPPED (not faked),
// the emitted config carries only the expressible rules with their severities, and adapter emit ⟂ ingest.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { see, shop, reExport } from '../index.mjs';
import * as eslint from '../adapters/eslint.mjs';
import * as oxlint from '../adapters/oxlint.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const eslintrc = JSON.parse(readFileSync(join(here, '../fixtures/eslintrc.json'), 'utf8'));

describe('adapter emit is the inverse of ingest', () => {
  it('eslint: emit serializes resolved rules back to a { rules } config ingest re-reads', () => {
    const cfg = eslint.emit([{ rule: 'no-console', severity: 'warn' }, { rule: 'eqeqeq', severity: 'error' }]);
    expect(cfg).toEqual({ rules: { 'no-console': 'warn', eqeqeq: 'error' } });
    const round = Object.fromEntries(eslint.ingest(cfg).map((r) => [r.rule, r.severity]));
    expect(round).toEqual({ 'no-console': 'warn', eqeqeq: 'error' });
  });

  it('oxlint: emit defaults a missing severity to error', () => {
    expect(oxlint.emit([{ rule: 'no-debugger' }])).toEqual({ rules: { 'no-debugger': 'error' } });
  });
});

describe('reExport — eslint project → oxlint config, honest loss', () => {
  const { model } = see({ eslint: eslintrc });
  const result = reExport(model, 'oxlint');

  it('grades every enforced concern: exact / lossy / dropped', () => {
    expect(result.summary).toEqual({ exact: 4, lossy: 1, dropped: 1 });
    const byConcern = Object.fromEntries(result.loss.map((l) => [l.concernId, l]));
    // exact 1:1 swaps
    expect(byConcern['unused-variables'].status).toBe('exact');
    expect(byConcern['strict-equality'].status).toBe('exact');
    // partial mapping → re-exported but flagged lossy, with the divergence note
    expect(byConcern['hook-deps'].status).toBe('lossy');
    expect(byConcern['hook-deps'].confidence).toBe('partial');
    expect(byConcern['hook-deps'].note).toMatch(/subset|differ/i);
    // no oxlint equivalent → dropped, never faked
    expect(byConcern['import-boundaries'].status).toBe('dropped');
  });

  it('emits only the expressible rules, under oxlint rule names, carrying source severities', () => {
    const rules = result.config.rules;
    expect(rules['no-unused-vars']).toBe('error');
    expect(rules['no-console']).toBe('warn');
    expect(rules['react/exhaustive-deps']).toBe('warn'); // oxlint namespace, not eslint's react-hooks/
    // the dropped concern's eslint rule is NOT smuggled into the oxlint config
    expect(rules['import/no-restricted-paths']).toBeUndefined();
    expect(Object.keys(rules)).toHaveLength(5);
  });

  it('never promises lossless: the dropped concern is reported, not emitted', () => {
    const dropped = result.loss.filter((l) => l.status === 'dropped');
    expect(dropped.map((l) => l.concernId)).toEqual(['import-boundaries']);
  });
});

describe('shop — one-call source→target with report', () => {
  it('ingests the source and re-exports to the target in one step', () => {
    const result = shop({ eslint: eslintrc }, 'oxlint');
    expect(result.tool).toBe('oxlint');
    expect(result.summary.dropped).toBe(1);
  });

  it('rejects an unknown target tool', () => {
    expect(() => shop({ eslint: eslintrc }, 'biome')).toThrow(/unknown target tool/i);
  });
});
