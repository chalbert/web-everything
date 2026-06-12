// Live-config discovery (#284) — the discovery + reading layer that swaps fixtures for a project's
// OWN ESLint/Oxlint configs. The normalization engine is covered by normalize.test.mjs; here we pin
// discovery precedence, the readers (flat-config / eslintrc-JSON / oxlintrc), and that a discovered
// config flows through `see()` into an active comparative model — all read-only.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  discoverConfigs,
  flattenFlatConfigRules,
  readEslintConfigFile,
  readOxlintConfigFile,
  seeLiveConfigs,
  ESLINT_CANDIDATES,
} from '../live-config.mjs';

describe('flattenFlatConfigRules', () => {
  it('merges rules across a flat-config array (later wins)', () => {
    const merged = flattenFlatConfigRules([
      { rules: { 'no-unused-vars': 'error', 'no-console': 'off' } },
      { files: ['**/*.ts'], rules: { 'no-console': 'warn' } },
    ]);
    expect(merged.rules['no-unused-vars']).toBe('error');
    expect(merged.rules['no-console']).toBe('warn');
  });

  it('accepts a single config object', () => {
    expect(flattenFlatConfigRules({ rules: { a: 'error' } }).rules.a).toBe('error');
  });
});

describe('config readers', () => {
  const fixtures = join(process.cwd(), 'scripts/validation-normalize/fixtures');

  it('reads the eslintrc JSON fixture into a rules-bearing config', async () => {
    const { config, error } = await readEslintConfigFile(join(fixtures, 'eslintrc.json'));
    expect(error).toBeUndefined();
    expect(config && typeof config).toBe('object');
  });

  it('reads the oxlintrc JSON fixture', () => {
    const { config, error } = readOxlintConfigFile(join(fixtures, 'oxlintrc.json'));
    expect(error).toBeUndefined();
    expect(config && typeof config).toBe('object');
  });

  it('returns an error (not a throw) for a missing/garbage file', () => {
    expect(readOxlintConfigFile(join(fixtures, 'does-not-exist.json')).error).toBeTruthy();
  });
});

describe('discoverConfigs — precedence + flow into see()', () => {
  let dir;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'live-config-'));
    writeFileSync(
      join(dir, '.eslintrc.json'),
      JSON.stringify({ rules: { 'no-unused-vars': 'error', 'no-console': 'warn' } }),
    );
    writeFileSync(join(dir, '.oxlintrc.json'), JSON.stringify({ rules: { 'no-debugger': 'deny' } }));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('discovers both tools and records their sources', async () => {
    const { configsByTool, sources } = await discoverConfigs(dir);
    expect(sources.eslint).toBe(join(dir, '.eslintrc.json'));
    expect(sources.oxlint).toBe(join(dir, '.oxlintrc.json'));
    expect(configsByTool.eslint.rules['no-unused-vars']).toBe('error');
  });

  it('selects flat config over eslintrc when both exist (precedence)', async () => {
    // Own dir so the shared `dir` stays eslintrc-only for the other cases.
    const d = mkdtempSync(join(tmpdir(), 'live-config-prec-'));
    try {
      writeFileSync(join(d, '.eslintrc.json'), JSON.stringify({ rules: { 'no-console': 'warn' } }));
      writeFileSync(join(d, 'eslint.config.mjs'), 'export default [{ rules: { "no-eval": "error" } }];');
      // Candidate order encodes the precedence; discovery must never fall back to the eslintrc when a
      // flat config is present (whether or not this runner can dynamic-import the external .mjs).
      expect(ESLINT_CANDIDATES.indexOf('eslint.config.mjs')).toBeLessThan(
        ESLINT_CANDIDATES.indexOf('.eslintrc.json'),
      );
      const { sources, notes } = await discoverConfigs(d);
      expect(sources.eslint).not.toBe(join(d, '.eslintrc.json'));
      const flat = join(d, 'eslint.config.mjs');
      expect(sources.eslint === flat || notes.some((n) => n.includes(flat))).toBe(true);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  it('produces an active comparative model through seeLiveConfigs', async () => {
    const { model, summary } = await seeLiveConfigs(dir);
    expect(model.length).toBeGreaterThan(0);
    expect(summary.concerns).toBe(model.length);
  });
});

describe('discoverConfigs — empty project', () => {
  it('finds nothing and reports no sources (read-only, no error)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'live-config-empty-'));
    try {
      const { configsByTool, sources } = await discoverConfigs(dir);
      expect(Object.keys(sources)).toHaveLength(0);
      expect(Object.keys(configsByTool)).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
