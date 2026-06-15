// Tests for the design-ref codification pass (backlog #481, ruling #396).
// Proves the provider's SECOND method seam + the pure per-shot/cross-shot logic without a browser or a
// network/model call — a mock provider injects the facets + pattern observations a real VLM would return.

import { describe, it, expect } from 'vitest';
import {
  CODIFICATION_FACETS, normalizeCodification, analyzeForCodification,
  resolveVisionProvider, getVisionProvider,
} from '../vision.mjs';
import {
  applyCodificationToMeta, harvestCandidates, candidateToScaffold, renderCodificationReport,
} from '../codification.mjs';

// A mock codification provider — the facets/patterns a real model would return for a shot.
const mockProvider = {
  name: 'mock',
  async classifyCandidate() { return { verdict: 'app' }; },
  async analyzeForCodification(input) {
    return {
      facets: { surface: 'dashboard', productRegister: 'enterprise', visualStyle: 'dense', theme: 'light', layout: 'sidebar-nav', bogus: 'dropped' },
      patterns: ['  command-palette ', 'command-palette', 'inline-edit', ''],
      _echo: input?.id,
    };
  },
};

describe('normalizeCodification', () => {
  it('keeps only the reliable facet keys, trims, nulls the rest', () => {
    const r = normalizeCodification({ facets: { surface: ' Dashboard ', bogus: 'x', theme: '' }, patterns: ['a', 'a', ' b '] });
    expect(Object.keys(r.facets)).toEqual([...CODIFICATION_FACETS]);
    expect(r.facets.surface).toBe('Dashboard');
    expect(r.facets.theme).toBeNull();
    expect(r.facets).not.toHaveProperty('bogus');
    expect(r.patterns).toEqual(['a', 'b']); // trimmed + deduped
    expect(r.ungated).toBe(false);
  });

  it('marks ungated when the provider flags it', () => {
    expect(normalizeCodification({ ungated: true }).ungated).toBe(true);
  });
});

describe('analyzeForCodification (the provider seam, F2)', () => {
  it('normalises a real provider response (drops unknown facet keys, dedups patterns)', async () => {
    const r = await analyzeForCodification(mockProvider, { id: 'shot-1' });
    expect(r.provider).toBe('mock');
    expect(r.facets.surface).toBe('dashboard');
    expect(r.facets.layout).toBe('sidebar-nav');
    expect(r.facets).not.toHaveProperty('bogus');
    expect(r.patterns).toEqual(['command-palette', 'inline-edit']);
    expect(r.ungated).toBe(false);
  });

  it('returns the ungated envelope for a provider without the method (offline/CI no-op)', async () => {
    const r = await analyzeForCodification({ name: 'classify-only', classifyCandidate() {} }, {});
    expect(r.ungated).toBe(true);
    expect(r.patterns).toEqual([]);
    expect(Object.values(r.facets).every((v) => v === null)).toBe(true);
  });

  it('the built-in `manual` provider is a no-op (ungated)', async () => {
    const manual = getVisionProvider('manual');
    const r = await analyzeForCodification(manual, {});
    expect(r.ungated).toBe(true);
    expect(r.provider).toBe('manual');
  });

  it('the default resolved provider (no env) codifies to ungated', async () => {
    const provider = await resolveVisionProvider({});
    const r = await analyzeForCodification(provider, {});
    expect(r.ungated).toBe(true);
  });
});

describe('applyCodificationToMeta (F1 — per shot)', () => {
  it('folds the reliable facets + pattern notes into meta, idempotently', async () => {
    const result = { ...(await analyzeForCodification(mockProvider, { id: 's' })), at: '2026-06-15T00:00:00Z' };
    const meta = { id: 's', surface: null, productRegister: null, theme: null };

    const first = applyCodificationToMeta(meta, result);
    expect(first.changed).toBe(true);
    expect(first.meta.surface).toBe('dashboard');
    expect(first.meta.layout).toBe('sidebar-nav');
    expect(first.meta.patternObservations).toEqual(['command-palette', 'inline-edit']);
    expect(first.meta.codification).toEqual({ provider: 'mock', ungated: false, at: '2026-06-15T00:00:00Z' });

    const second = applyCodificationToMeta(first.meta, result);
    expect(second.changed).toBe(false); // idempotent — re-applying the same result is a no-op
  });

  it('never clobbers an authored facet with a null', () => {
    const meta = { surface: 'authored', codification: { provider: 'mock', ungated: true, at: 't' } };
    const ungated = { facets: Object.fromEntries(CODIFICATION_FACETS.map((k) => [k, null])), patterns: [], ungated: true, provider: 'mock', at: 't' };
    const { meta: out, changed } = applyCodificationToMeta(meta, ungated);
    expect(changed).toBe(false);
    expect(out.surface).toBe('authored');
  });
});

describe('harvestCandidates (F3 — cross shot)', () => {
  const perShot = [
    { id: 'a', patterns: ['command-palette', 'inline-edit'] },
    { id: 'b', patterns: ['command-palette', 'kanban'] },
    { id: 'c', patterns: ['command-palette'] },
    { id: 'd', patterns: ['inline-edit'] },
  ];

  it('clusters by support and ranks; honours the support floor', () => {
    const c = harvestCandidates(perShot, { minSupport: 3 });
    expect(c).toEqual([{ pattern: 'command-palette', support: 3, items: ['a', 'b', 'c'] }]);
  });

  it('lowering the floor surfaces more candidates', () => {
    const c = harvestCandidates(perShot, { minSupport: 2 });
    expect(c.map((x) => x.pattern)).toEqual(['command-palette', 'inline-edit']);
  });

  it('counts distinct shots, not repeat observations', () => {
    const dupes = [{ id: 'a', patterns: ['x', 'x'] }, { id: 'a', patterns: ['x'] }];
    expect(harvestCandidates(dupes, { minSupport: 1 })).toEqual([{ pattern: 'x', support: 1, items: ['a'] }]);
  });
});

describe('reporting / scaffolding', () => {
  it('renders a session report with the candidate table', () => {
    const candidates = [{ pattern: 'command-palette', support: 3, items: ['a', 'b', 'c'] }];
    const md = renderCodificationReport({
      runId: 'codify-test', provider: 'mock', generatedAt: '2026-06-15T00:00:00Z',
      codified: [{ id: 'a', ungated: false, facets: { surface: 'dashboard' } }], candidates, minSupport: 3,
    });
    expect(md).toContain('# Design-ref codification run — codify-test');
    expect(md).toContain('| command-palette | 3 | a, b, c |');
    expect(md).toContain('model-analysed: **1**');
  });

  it('emits a type:idea scaffold descriptor citing the supporting shots', () => {
    const { title, body } = candidateToScaffold({ pattern: 'command-palette', support: 3, items: ['a', 'b', 'c'] });
    expect(title).toContain('command-palette');
    expect(body).toContain('3 shot(s)');
    expect(body).toContain('a, b, c');
  });
});
