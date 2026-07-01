/**
 * component-render-build-hook — the WE Eleventy build orchestration for the SSR component-render harness
 * (#2016, keystone of #777). Proves the render-from-data arc on a build fixture: compose declarative
 * card/badge/tag specs, SHELL the keyed-batch to a (here injected) FUI CLI, and ASSEMBLE the intents grid
 * — with per-entry isolation and the producer-pin / missing-artifact hard errors. The injected runner
 * stands in for the pinned `../frontierui/dist/tools/component-render/cli.mjs` so the test needs no sibling
 * FUI checkout.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import {
  runBuildBatch,
  renderComponents,
  renderIntentGrid,
  statusTone,
  EXPECTED_PRODUCER,
  PINNED_CLI_RELATIVE,
} from '../component-render-build-hook.cjs';

// A throwaway "repo root" whose sibling ../frontierui/dist/tools/component-render/cli.mjs exists, so the
// hard missing-artifact gate passes and the injected runner (not the real artifact) does the rendering.
let stubRoot;
beforeAll(() => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'we-cr-hook-'));
  stubRoot = path.join(base, 'webeverything');
  fs.mkdirSync(stubRoot, { recursive: true });
  const cli = path.resolve(stubRoot, PINNED_CLI_RELATIVE);
  fs.mkdirSync(path.dirname(cli), { recursive: true });
  fs.writeFileSync(cli, '// stub pinned artifact for tests\n');
});
afterAll(() => { try { fs.rmSync(stubRoot, { recursive: true, force: true }); } catch { /* noop */ } });

// A fake CLI runner: echoes a keyed-batch envelope, rendering each spec to a trivial deterministic marker
// that embeds its key + component — enough to assert the batch is real, per-key, and dispatched.
function fakeRunner(_cmd, _args, opts) {
  const entries = JSON.parse(opts.input);
  return JSON.stringify({
    producer: EXPECTED_PRODUCER,
    results: entries.map((e) => ({ key: e.key, html: `<span data-c="${e.component}" data-k="${e.key}"></span>` })),
  });
}

const INTENTS = [
  { id: 'motion', name: 'Motion', status: 'active', summary: 'Animation preference vocabulary.',
    dimensions: { intensity: {}, easing: {} } },
  { id: 'density', name: 'Density', status: 'draft', summary: 'Spacing scale.', dimensions: {} },
];

describe('statusTone — intent status → badge tone', () => {
  it('maps the four buckets', () => {
    expect(statusTone('active')).toBe('success');
    expect(statusTone('draft')).toBe('info');
    expect(statusTone('concept')).toBe('warning');
    expect(statusTone('experimental')).toBe('warning');
    expect(statusTone('anything-else')).toBe('neutral');
  });
});

describe('runBuildBatch — producer pin + missing-artifact hard error', () => {
  it('throws a hard build error when the pinned artifact is absent', () => {
    expect(() => runBuildBatch([], '/nonexistent-repo-root-xyz', fakeRunner)).toThrow(/pinned FUI artifact missing/);
  });
  it('throws on a producer-pin mismatch', () => {
    const wrong = () => JSON.stringify({ producer: 'someone-else/9', results: [] });
    expect(() => runBuildBatch([{ key: 'k', component: 'badge', config: {} }], stubRoot, wrong))
      .toThrow(/producer pin mismatch/);
  });
});

describe('renderComponents — keyed map, per-entry isolation', () => {
  it('returns a key→html map from one subprocess batch', () => {
    const map = renderComponents(
      [{ key: 'a', component: 'badge', config: {} }, { key: 'b', component: 'tag', config: {} }],
      stubRoot, fakeRunner,
    );
    expect(map.get('a')).toContain('data-c="badge"');
    expect(map.get('b')).toContain('data-c="tag"');
  });
  it('omits a failed entry and keeps the rest', () => {
    const oneFails = (_c, _a, opts) => {
      const entries = JSON.parse(opts.input);
      return JSON.stringify({
        producer: EXPECTED_PRODUCER,
        results: entries.map((e, i) => (i === 0 ? { key: e.key, error: 'boom' } : { key: e.key, html: '<i></i>' })),
      });
    };
    const map = renderComponents(
      [{ key: 'x', component: 'badge', config: {} }, { key: 'y', component: 'tag', config: {} }],
      stubRoot, oneFails,
    );
    expect(map.has('x')).toBe(false);
    expect(map.get('y')).toBe('<i></i>');
  });
  it('is a no-op for an empty spec list (no subprocess)', () => {
    expect(renderComponents([], stubRoot, fakeRunner).size).toBe(0);
  });
});

describe('renderIntentGrid — full render-from-data arc on a fixture', () => {
  it('emits one linking anchor per intent wrapping its SSR card, with search/filter data-*', () => {
    const html = renderIntentGrid(INTENTS, stubRoot, fakeRunner);
    expect(html).toMatch(/^<div class="project-grid" id="intent-grid">/);
    // One anchor per intent, keyed to its id + status, with the haystack for the client filter.
    expect(html).toContain('href="/intents/motion/"');
    expect(html).toContain('data-status="active"');
    expect(html).toContain('data-haystack="motion motion animation preference vocabulary. intensity easing"');
    expect((html.match(/class="project-card intent-tile"/g) || []).length).toBe(2);
    // Each anchor carries its rendered card (the fake runner marks it by key).
    expect(html).toContain('data-k="intent-0-card"');
    expect(html).toContain('data-k="intent-1-card"');
  });
  it('renders a status badge + one tag per dimension key per tile', () => {
    // Assert the spec batch dispatched the right components: motion has 2 dims → 2 tags + 1 badge + 1 card.
    const seen = [];
    const spyRunner = (_c, _a, opts) => {
      const entries = JSON.parse(opts.input);
      entries.forEach((e) => seen.push(`${e.component}:${e.key}`));
      return fakeRunner(_c, _a, opts);
    };
    renderIntentGrid(INTENTS, stubRoot, spyRunner);
    expect(seen).toContain('badge:intent-0-badge');
    expect(seen).toContain('tag:intent-0-tag-0');
    expect(seen).toContain('tag:intent-0-tag-1');
    expect(seen).toContain('card:intent-0-card');
    // density has zero dimensions → no tags.
    expect(seen).not.toContain('tag:intent-1-tag-0');
  });
  it('is empty-safe (no intents → empty grid, no subprocess crash)', () => {
    expect(renderIntentGrid([], stubRoot, fakeRunner)).toBe('<div class="project-grid" id="intent-grid"></div>');
  });
});
