import { describe, it, expect } from 'vitest';
import { see, normalize } from '../index.mjs';
import * as eslint from '../adapters/eslint.mjs';
import * as oxlint from '../adapters/oxlint.mjs';

describe('adapters normalise severity', () => {
  it('eslint: error/warn/off across shorthand + array forms', () => {
    const rules = eslint.ingest({
      rules: { a: 'error', b: 'warn', c: 'off', d: 2, e: 1, f: 0, g: ['error', {}] },
    });
    const by = Object.fromEntries(rules.map((r) => [r.rule, r]));
    expect(by.a.severity).toBe('error');
    expect(by.b.severity).toBe('warn');
    expect(by.c.enabled).toBe(false);
    expect(by.d.severity).toBe('error');
    expect(by.e.severity).toBe('warn');
    expect(by.f.enabled).toBe(false);
    expect(by.g.severity).toBe('error'); // array form reads [0]
  });

  it('oxlint: deny/allow map onto error/off', () => {
    const rules = oxlint.ingest({ rules: { a: 'deny', b: 'allow' } });
    const by = Object.fromEntries(rules.map((r) => [r.rule, r]));
    expect(by.a.severity).toBe('error');
    expect(by.b.enabled).toBe(false);
  });

  it('accepts a bare rules object (no wrapper)', () => {
    expect(eslint.ingest({ 'no-console': 'warn' })[0]).toMatchObject({
      rule: 'no-console',
      severity: 'warn',
      enabled: true,
    });
  });
});

describe('normalize — comparative model', () => {
  const fixture = () =>
    see({
      eslint: { rules: { 'no-unused-vars': 'error', 'no-console': 'warn', 'import/no-restricted-paths': 'error' } },
      oxlint: { rules: { 'no-unused-vars': 'error', 'no-console': 'off' } },
    });

  it('marks a concern active only when a tool actually enables it', () => {
    const { model } = fixture();
    const console_ = model.find((m) => m.id === 'console-statements');
    const eslintCell = console_.cells.find((c) => c.tool === 'eslint');
    const oxlintCell = console_.cells.find((c) => c.tool === 'oxlint');
    expect(eslintCell.active).toBe(true); // warn → enabled
    expect(oxlintCell.active).toBe(false); // off
    expect(console_.activeInProject).toBe(true);
  });

  it('renders a no-equivalent cell where a tool lacks the concern entirely', () => {
    const { model } = fixture();
    const boundaries = model.find((m) => m.id === 'import-boundaries');
    const oxlintCell = boundaries.cells.find((c) => c.tool === 'oxlint');
    expect(oxlintCell.covered).toBe(false); // the valuable shopping cell
    expect(oxlintCell.confidence).toBe('none');
    expect(boundaries.divergence).toBe(true);
  });

  it('flags partial-confidence cells as divergent even when both tools cover it', () => {
    const { model } = fixture();
    const hooks = model.find((m) => m.id === 'hook-deps');
    expect(hooks.cells.find((c) => c.tool === 'oxlint').confidence).toBe('partial');
    expect(hooks.divergence).toBe(true);
  });

  it('an exact-match concern enabled in both tools is not divergent', () => {
    const { model } = fixture();
    const unused = model.find((m) => m.id === 'unused-variables');
    expect(unused.divergence).toBe(false);
    expect(unused.cells.every((c) => c.confidence === 'exact')).toBe(true);
  });

  it('summary counts concerns, active, divergences, and no-equivalent cells', () => {
    const { summary } = fixture();
    expect(summary.concerns).toBe(6);
    expect(summary.noEquivalentCells).toBeGreaterThanOrEqual(1);
    expect(summary.divergences).toBeGreaterThanOrEqual(2);
  });

  it('normalize() is callable directly on pre-ingested rule-sets', () => {
    const model = normalize({ eslint: [{ rule: 'eqeqeq', enabled: true, severity: 'error' }] });
    const eq = model.find((m) => m.id === 'strict-equality');
    expect(eq.cells.find((c) => c.tool === 'eslint').active).toBe(true);
  });
});
