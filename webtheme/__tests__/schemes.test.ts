/**
 * Web Theme scheme + accent runtime (backlog #405). Proves color parsing (hex/rgb/oklch→sRGB), the WCAG
 * + APCA contrast gates against known anchors, native scheme derivation (light-dark / color-scheme /
 * prefers-contrast), native accent-scale derivation (relative-color, seed-tracking), the per-step
 * accessibility validation, and the curated override (brand precision, still gated).
 */
import { describe, it, expect } from 'vitest';
import {
  parseColor,
  relativeLuminance,
  wcagContrast,
  apcaLc,
  deriveSchemeRuntime,
  compileSchemeCss,
  ColorParseError,
  type DeriveOptions,
} from '../schemes';
import { defaultTokens } from '../defaultTokens';
import { extendTokens, type DtcgDocument } from '../tokens';

describe('parseColor', () => {
  it('parses hex (short + long) to sRGB', () => {
    expect(parseColor('#fff')).toEqual({ r: 1, g: 1, b: 1 });
    expect(parseColor('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    const red = parseColor('#ff0000');
    expect(red.r).toBe(1);
    expect(red.g).toBe(0);
  });

  it('parses rgb()', () => {
    expect(parseColor('rgb(255, 255, 255)')).toEqual({ r: 1, g: 1, b: 1 });
  });

  it('parses oklch() white/black to the sRGB extremes (within tolerance)', () => {
    const white = parseColor('oklch(1 0 0)');
    expect(white.r).toBeCloseTo(1, 2);
    expect(white.g).toBeCloseTo(1, 2);
    expect(white.b).toBeCloseTo(1, 2);
    const black = parseColor('oklch(0 0 0)');
    expect(black.r).toBeCloseTo(0, 2);
  });

  it('throws ColorParseError on an unsupported value', () => {
    expect(() => parseColor('rebeccapurple')).toThrow(ColorParseError);
  });
});

describe('contrast gates', () => {
  it('WCAG: black on white is the 21:1 maximum, white on white is 1:1', () => {
    const w = { r: 1, g: 1, b: 1 };
    const k = { r: 0, g: 0, b: 0 };
    expect(wcagContrast(k, w)).toBeCloseTo(21, 0);
    expect(wcagContrast(w, w)).toBeCloseTo(1, 5);
  });

  it('WCAG is order-independent', () => {
    const w = { r: 1, g: 1, b: 1 };
    const k = { r: 0, g: 0, b: 0 };
    expect(wcagContrast(k, w)).toBeCloseTo(wcagContrast(w, k), 6);
  });

  it('relative luminance: white ≈ 1, black = 0', () => {
    expect(relativeLuminance({ r: 1, g: 1, b: 1 })).toBeCloseTo(1, 5);
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
  });

  it('APCA: dark text on light bg is strongly positive; near-equal is ~0', () => {
    const k = { r: 0, g: 0, b: 0 };
    const w = { r: 1, g: 1, b: 1 };
    expect(apcaLc(k, w)).toBeGreaterThan(90); // black on white ≈ +106
    expect(Math.abs(apcaLc(w, w))).toBeLessThan(1); // no contrast
  });

  it('APCA polarity flips sign for light text on dark bg', () => {
    const k = { r: 0, g: 0, b: 0 };
    const w = { r: 1, g: 1, b: 1 };
    expect(apcaLc(w, k)).toBeLessThan(0);
  });
});

describe('deriveSchemeRuntime', () => {
  const runtime = deriveSchemeRuntime(defaultTokens);

  it('derives scheme roles as light-dark() pairings under color-scheme', () => {
    expect(runtime.scheme.bg).toMatch(/^light-dark\(.+,.+\)$/);
    expect(runtime.scheme.fg).toMatch(/^light-dark\(/);
  });

  it('derives the accent scale natively via relative-color, tracking the seed token', () => {
    const step9 = runtime.accent.find((s) => s.id === 'accent-9');
    expect(step9).toBeDefined();
    expect(step9!.css).toBe('oklch(from var(--color-accent) 0.55 c h)');
  });

  it('validates every step against both scheme backgrounds with WCAG + APCA', () => {
    // one verdict per (step × {bg-light, bg-dark})
    expect(runtime.validation.length).toBe(runtime.accent.length * 2);
    for (const v of runtime.validation) {
      expect(v.wcag).toBeGreaterThanOrEqual(1);
      expect(['ok', 'wcag-below-min', 'apca-below-min']).toContain(v.reason);
    }
  });

  it('a dark accent step reads on the light background (passes there)', () => {
    const onLight = runtime.validation.filter((v) => v.against === 'bg-light' && v.passes);
    expect(onLight.length).toBeGreaterThan(0);
  });

  it('reports an inaccessible scale rather than silently shipping it', () => {
    // A ramp of only near-white steps cannot read on a white bg — accessible must be false.
    const opts: DeriveOptions = { ramp: { 'accent-1': 0.99, 'accent-2': 0.98 } };
    const bad = deriveSchemeRuntime(defaultTokens, opts);
    const lightStepsOnLight = bad.validation.filter((v) => v.against === 'bg-light');
    expect(lightStepsOnLight.every((v) => !v.passes)).toBe(true);
  });
});

describe('curated override (brand precision, still gated)', () => {
  it('emits the curated literal verbatim instead of a derived expression', () => {
    const runtime = deriveSchemeRuntime(defaultTokens, { curated: { 'accent-9': '#0b5cad' } });
    const step9 = runtime.accent.find((s) => s.id === 'accent-9')!;
    expect(step9.css).toBe('#0b5cad');
  });

  it('still validates a curated step — an inaccessible brand value is flagged', () => {
    // A pale brand value curated as a body step won't clear AA on a white bg.
    const runtime = deriveSchemeRuntime(defaultTokens, { curated: { 'accent-9': '#fafafa' } });
    const onLight = runtime.validation.find((v) => v.step === 'accent-9' && v.against === 'bg-light')!;
    expect(onLight.passes).toBe(false);
  });
});

describe('respects extends + compiles native CSS', () => {
  it('re-tints from an extended accent seed', () => {
    const project: DtcgDocument = { color: { $type: 'color', accent: { $value: 'oklch(0.55 0.2 30)' } } };
    const merged = extendTokens(defaultTokens, project);
    const runtime = deriveSchemeRuntime(merged);
    // The derived literal should now sit on a warm (reddish) hue, not the default blue.
    const step9 = runtime.accent.find((s) => s.id === 'accent-9')!;
    expect(step9.value.r).toBeGreaterThan(step9.value.b); // red channel dominates
  });

  it('compileSchemeCss emits color-scheme, light-dark vars, and a prefers-contrast block', () => {
    const css = compileSchemeCss(deriveSchemeRuntime(defaultTokens));
    expect(css).toContain('color-scheme: light dark;');
    expect(css).toContain('--color-bg: light-dark(');
    expect(css).toContain('--color-accent-9: oklch(from var(--color-accent)');
    expect(css).toContain('@media (prefers-contrast: more)');
  });
});
