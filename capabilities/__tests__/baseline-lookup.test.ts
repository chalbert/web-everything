import { describe, it, expect } from 'vitest';
import { createBaselineLookup, baselineLookup } from '../baseline-lookup.js';
import { parseClientHints, type UaBrand } from '../edge-io.js';

const mk = (brand: string, version: string): UaBrand => ({
  brand,
  version,
  major: Number.parseInt(version, 10),
});

describe('createBaselineLookup (web-features-backed)', () => {
  const lookup = createBaselineLookup();

  it('maps a recent Chromium version to a recent Baseline epoch', () => {
    const year = lookup(mk('Chromium', '130'));
    expect(year).toBeTypeOf('number');
    // The data moves, so assert a plausible range rather than a brittle exact year.
    expect(year!).toBeGreaterThanOrEqual(2020);
    expect(year!).toBeLessThanOrEqual(2027);
  });

  it('is monotonic in version — a newer browser meets an epoch no earlier than an older one', () => {
    const old = lookup(mk('Chromium', '60'))!;
    const recent = lookup(mk('Chromium', '130'))!;
    expect(old).toBeLessThanOrEqual(recent);
  });

  it('returns undefined for a version too old to meet even the earliest Baseline year', () => {
    expect(lookup(mk('Chromium', '1'))).toBeUndefined();
  });

  it('returns undefined for an unrecognised brand (never fabricates)', () => {
    expect(lookup(mk('Brave', '130'))).toBeUndefined();
  });

  it('resolves Microsoft Edge onto the edge dataset', () => {
    expect(lookup(mk('Microsoft Edge', '130'))).toBeTypeOf('number');
  });

  it('is platform-aware — Android resolves the mobile variant key', () => {
    expect(lookup(mk('Chromium', '130'), 'Android')).toBeTypeOf('number');
  });

  it('exposes a ready default instance', () => {
    expect(baselineLookup(mk('Chromium', '130'))).toBeTypeOf('number');
  });
});

describe('the web-features lookup through the parseClientHints injection seam', () => {
  const headers = {
    'Sec-CH-UA-Full-Version-List': '"Chromium";v="130.0.6723.58", "Not?A_Brand";v="99.0.0.0"',
    'Sec-CH-UA-Platform': '"macOS"',
    'Sec-CH-UA-Mobile': '?0',
  };

  it('derives a numeric baselineYear from real Baseline data', () => {
    const hints = parseClientHints(headers, { baselineLookup: createBaselineLookup() });
    expect(hints.baselineYear).toBeTypeOf('number');
    expect(hints.baselineYear!).toBeGreaterThanOrEqual(2020);
  });

  it('leaves baselineYear unset for an ancient client (honest absence)', () => {
    const old = {
      'Sec-CH-UA-Full-Version-List': '"Chromium";v="1.0.0.0"',
      'Sec-CH-UA-Platform': '"Windows"',
    };
    expect(parseClientHints(old, { baselineLookup: createBaselineLookup() })).toEqual({});
  });
});
