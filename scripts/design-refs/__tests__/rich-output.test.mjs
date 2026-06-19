// Tests for the Tier-2 rich-output contract on the shared vision seam (backlog #1080, epic #1073).
// Proves the pure normalizer + the swappable `analyzeRich` method without a model or a browser — a
// mock provider injects the open output (description / tags / regions) a small VLM would return.

import { describe, it, expect } from 'vitest';
import {
  normalizeRichOutput, analyzeRich, getVisionProvider, resolveVisionProvider,
} from '../vision.mjs';

describe('normalizeRichOutput (pure)', () => {
  it('trims a description and nulls an empty/non-string one', () => {
    expect(normalizeRichOutput({ description: '  a toolbar over a table  ' }).description).toBe('a toolbar over a table');
    for (const bad of ['', '   ', null, undefined, 42]) {
      expect(normalizeRichOutput({ description: bad }).description).toBeNull();
    }
  });

  it('dedupes / trims / filters tags and defaults to []', () => {
    expect(normalizeRichOutput({ tags: [' nav ', 'nav', '', 'table', null, 7] }).tags).toEqual(['nav', 'table']);
    expect(normalizeRichOutput({}).tags).toEqual([]);
    expect(normalizeRichOutput({ tags: 'nav' }).tags).toEqual([]); // non-array
  });

  it('keeps a region label and an all-valid clamped box', () => {
    const { regions } = normalizeRichOutput({ regions: [{ label: ' sidebar ', box: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 } }] });
    expect(regions).toEqual([{ label: 'sidebar', box: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 } }]);
  });

  it('clamps out-of-range box coords into 0..1', () => {
    const { regions } = normalizeRichOutput({ regions: [{ label: 'x', box: { x: -1, y: 2, w: 0.5, h: 0.5 } }] });
    expect(regions[0].box).toEqual({ x: 0, y: 1, w: 0.5, h: 0.5 });
  });

  it('drops a region with no usable label', () => {
    const { regions } = normalizeRichOutput({ regions: [{ label: '   ' }, { box: { x: 0, y: 0, w: 1, h: 1 } }, { label: 'ok' }] });
    expect(regions).toEqual([{ label: 'ok', box: null }]);
  });

  it('nulls a partially-specified or non-numeric box but keeps the labelled region', () => {
    const { regions } = normalizeRichOutput({ regions: [
      { label: 'a', box: { x: 0.1, y: 0.1, w: 0.1 } },        // missing h
      { label: 'b', box: { x: 'nope', y: 0, w: 0, h: 0 } },   // non-number
      { label: 'c', box: null },
    ] });
    expect(regions).toEqual([{ label: 'a', box: null }, { label: 'b', box: null }, { label: 'c', box: null }]);
  });

  it('marks the ungated sentinel only when explicitly true', () => {
    expect(normalizeRichOutput({ ungated: true }).ungated).toBe(true);
    expect(normalizeRichOutput({}).ungated).toBe(false);
    expect(normalizeRichOutput({ ungated: 'yes' }).ungated).toBe(false);
  });
});

describe('analyzeRich (the swap point)', () => {
  it('returns the ungated envelope (stamped with the provider name) when the provider has no analyzeRich', async () => {
    const res = await analyzeRich({ name: 'verdict-only' }, { url: 'x' });
    expect(res).toEqual({ description: null, tags: [], regions: [], ungated: true, provider: 'verdict-only' });
  });

  it('falls back to `manual` as the provider name when none is given', async () => {
    expect((await analyzeRich(undefined, {})).provider).toBe('manual');
  });

  it('normalises a real provider response and stamps its name', async () => {
    const prov = {
      name: 'mock-vlm',
      async analyzeRich() {
        return {
          description: '  a settings page  ',
          tags: ['form', 'form', ' tabs '],
          regions: [{ label: ' save button ', box: { x: 0.8, y: 0.9, w: 0.1, h: 0.05 } }],
        };
      },
    };
    const res = await analyzeRich(prov, { url: 'x' });
    expect(res).toEqual({
      description: 'a settings page',
      tags: ['form', 'tabs'],
      regions: [{ label: 'save button', box: { x: 0.8, y: 0.9, w: 0.1, h: 0.05 } }],
      ungated: false,
      provider: 'mock-vlm',
    });
  });
});

describe('the built-in `manual` null provider', () => {
  it('emits the ungated rich envelope (no model, no network)', async () => {
    const res = await analyzeRich(getVisionProvider('manual'), { url: 'x' });
    expect(res.ungated).toBe(true);
    expect(res).toMatchObject({ description: null, tags: [], regions: [], provider: 'manual' });
  });

  it('is what resolveVisionProvider returns by default — the rich pass is a no-op offline', async () => {
    const prov = await resolveVisionProvider({});
    const res = await analyzeRich(prov, { url: 'x' });
    expect(res.ungated).toBe(true);
  });
});
