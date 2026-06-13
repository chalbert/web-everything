/**
 * Edge venue I/O + caching shell (#219) — productionizes #208's POC: derive the ClientHints profile from
 * real Sec-CH-UA* headers (never UA sniffing), advertise the hints, and emit honest cache directives.
 *   - parseBrandList drops GREASE and reads brand;v pairs from the structured header;
 *   - parseClientHints prefers the full-version-list, keeps the Baseline mapping injectable (never invents it);
 *   - negotiation response advertises Accept-CH/Critical-CH and Varies by the hints;
 *   - a served chunk is immutable (content-addressed by caps) with no hint Vary.
 */
import { describe, it, expect } from 'vitest';
import {
  parseBrandList,
  parseClientHints,
  negotiationHeaders,
  chunkCacheHeaders,
  ACCEPT_CH,
  type BaselineLookup,
} from '../edge-io.js';
import { clientHintsSupport } from '../edge.js';
import type { Capability } from '../provider.js';

describe('parseBrandList', () => {
  it('reads brand;v members and drops GREASE brands', () => {
    const value = '"Chromium";v="130.0.6723.58", "Not?A_Brand";v="99.0.0.0", "Google Chrome";v="130.0.6723.58"';
    const brands = parseBrandList(value);
    expect(brands.map((b) => b.brand)).toEqual(['Chromium', 'Google Chrome']);
    expect(brands[0]).toMatchObject({ version: '130.0.6723.58', major: 130 });
  });

  it('handles a major-only Sec-CH-UA value and an empty header', () => {
    expect(parseBrandList('"Chromium";v="130"')[0]).toMatchObject({ major: 130, version: '130' });
    expect(parseBrandList(undefined)).toEqual([]);
  });
});

describe('parseClientHints', () => {
  const headers = {
    'Sec-CH-UA-Full-Version-List': '"Chromium";v="130.0.6723.58", "Not?A_Brand";v="99.0.0.0"',
    'Sec-CH-UA-Platform': '"macOS"',
    'Sec-CH-UA-Mobile': '?0',
  };

  it('leaves baselineYear undefined with no injected lookup (never fabricates support)', () => {
    expect(parseClientHints(headers)).toEqual({});
  });

  it('derives baselineYear from an injected, platform-aware Baseline lookup', () => {
    const lookup: BaselineLookup = (brand, platform) => {
      expect(platform).toBe('macOS'); // platform passed through, quotes stripped
      return brand.brand === 'Chromium' && brand.major >= 130 ? 2024 : undefined;
    };
    expect(parseClientHints(headers, { baselineLookup: lookup })).toEqual({ baselineYear: 2024 });
  });

  it('falls back to Sec-CH-UA when the full-version-list is absent, and passes through overrides', () => {
    const hints = parseClientHints(
      { 'Sec-CH-UA': '"Chromium";v="120"' },
      { baselineLookup: (b) => (b.major >= 120 ? 2023 : undefined), supports: ['anchor-positioning'], lacks: ['customizable-select'] },
    );
    expect(hints).toEqual({ baselineYear: 2023, supports: ['anchor-positioning'], lacks: ['customizable-select'] });
  });

  it('works with a real Headers instance (case-insensitive)', () => {
    const h = new Headers({ 'sec-ch-ua-full-version-list': '"Chromium";v="130"' });
    expect(parseClientHints(h, { baselineLookup: () => 2024 })).toEqual({ baselineYear: 2024 });
  });

  it('the parsed profile drives clientHintsSupport end-to-end', () => {
    const vocab: Capability[] = [
      { id: 'popover', label: '', webFeaturesKey: 'popover', baseline: '2024', polyfill: 'polyfillable', summary: '' },
      { id: 'anchor-positioning', label: '', webFeaturesKey: 'anchor-positioning', baseline: false, polyfill: 'polyfillable', summary: '' },
    ];
    const hints = parseClientHints(headers, { baselineLookup: () => 2024 });
    const support = clientHintsSupport(hints, vocab);
    expect(support('popover')).toBe(true);            // baseline 2024 ≤ 2024
    expect(support('anchor-positioning')).toBe(false); // not-yet-Baseline, un-hinted → absent
  });
});

describe('cache directives', () => {
  it('negotiation response advertises hints and varies by them', () => {
    const h = negotiationHeaders();
    expect(h['Accept-CH']).toBe(ACCEPT_CH);
    expect(h['Critical-CH']).toBe(ACCEPT_CH);
    expect(h.Vary).toBe(ACCEPT_CH);
    expect(ACCEPT_CH).toContain('Sec-CH-UA-Full-Version-List');
  });

  it('a served chunk is immutable and public by default, with no hint Vary (URL is the cache key)', () => {
    const h = chunkCacheHeaders();
    expect(h['Cache-Control']).toBe('public, max-age=31536000, immutable');
    expect(h.Vary).toBeUndefined();
    expect(chunkCacheHeaders({ private: true, maxAge: 60 })['Cache-Control']).toBe('private, max-age=60, immutable');
  });
});
