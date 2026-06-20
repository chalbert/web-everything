/**
 * Palette-source ingest boundary (#1252, ruling #1274). Proves the default-less open registry (Fork 1 → A),
 * the shared value-type normalization, and the first two built-in parsers (DTCG passthrough + Tailwind),
 * each feeding the existing extends → derive → compile path.
 */
import { describe, it, expect } from 'vitest';
import {
  CustomPaletteSourceRegistry,
  PaletteSourceError,
  parseDtcgPalette,
  parseTailwindPalette,
  normalizeColorValue,
  argbIntToHex,
  floatRgbToHex,
} from '../paletteSource';
import { flattenTokens, resolveTokens, extendTokens } from '../tokens';
import { compileToCss } from '../compile';
import { defaultTokens } from '../defaultTokens';

describe('value-type normalization', () => {
  it('passes a CSS string through (hex / oklch), trimming', () => {
    expect(normalizeColorValue('#3b82f6')).toBe('#3b82f6');
    expect(normalizeColorValue('  oklch(0.6 0.2 256)  ')).toBe('oklch(0.6 0.2 256)');
  });

  it('converts an ARGB int (Material MCU) to hex', () => {
    expect(argbIntToHex(0xff3b82f6)).toBe('#3b82f6'); // opaque → no alpha pair
    expect(argbIntToHex(0x803b82f6)).toBe('#3b82f680'); // 0x80 alpha preserved
    expect(normalizeColorValue(0xff000000)).toBe('#000000');
  });

  it('converts Figma 0–1 floats to hex', () => {
    expect(floatRgbToHex({ r: 0, g: 0, b: 0 })).toBe('#000000');
    expect(floatRgbToHex({ r: 1, g: 1, b: 1 })).toBe('#ffffff');
    expect(normalizeColorValue({ r: 1, g: 0, b: 0, a: 0.5 })).toBe('#ff000080');
  });

  it('throws on an unrecognized value', () => {
    expect(() => normalizeColorValue(['nope'])).toThrow(PaletteSourceError);
  });
});

describe('CustomPaletteSourceRegistry (default-less open registry, #1274 Fork 1 → A)', () => {
  it('ships empty and mandates no fixed source', () => {
    const reg = new CustomPaletteSourceRegistry();
    expect(reg.sources()).toEqual([]);
    expect(reg.has('tailwind')).toBe(false);
    expect(() => reg.parse('tailwind', {})).toThrow(PaletteSourceError);
  });

  it('lets a project register the parsers it wants and parse through them', () => {
    const reg = new CustomPaletteSourceRegistry()
      .register('dtcg', parseDtcgPalette)
      .register('tailwind', parseTailwindPalette);
    expect(reg.sources()).toEqual(['dtcg', 'tailwind']);
    const group = reg.parse('tailwind', { blue: { '500': '#3b82f6' } });
    expect(group.blue).toEqual({ $type: 'color', '500': { $value: '#3b82f6' } });
  });
});

describe('parseTailwindPalette', () => {
  it('normalizes family→{shade:value} into a DTCG color group, matching on name', () => {
    const group = parseTailwindPalette({
      blue: { '100': '#dbeafe', '500': '#3b82f6' },
      red: { '500': { r: 1, g: 0, b: 0 } }, // Figma-float value normalized
    });
    expect(group.blue).toEqual({ $type: 'color', '100': { $value: '#dbeafe' }, '500': { $value: '#3b82f6' } });
    expect(group.red).toEqual({ $type: 'color', '500': { $value: '#ff0000' } });
  });

  it('throws on a malformed shape', () => {
    expect(() => parseTailwindPalette('nope')).toThrow(PaletteSourceError);
    expect(() => parseTailwindPalette({ blue: '#fff' })).toThrow(PaletteSourceError);
  });

  it('the normalized palette feeds extends → resolve → compile (the ingest goal)', () => {
    const ingested = parseTailwindPalette({ brand: { '500': '#3b82f6' } });
    // A project extends the platform default with the ingested palette + an accent aliasing into it.
    const themed = extendTokens(defaultTokens, {
      color: { ...ingested, accent: { $value: '{color.brand.500}' } },
    } as any);
    const resolved = resolveTokens(flattenTokens(themed));
    const accent = resolved.find((t) => t.path.join('.') === 'color.accent')!;
    expect(accent.aliasOf).toBe('color.brand.500');
    expect(accent.resolved).toBe('#3b82f6');
    const { css } = compileToCss(themed);
    expect(css).toContain('--color-brand-500: #3b82f6;');
    expect(css).toContain('--color-accent: var(--color-brand-500);');
  });
});

describe('parseDtcgPalette (passthrough — the source already is the pivot)', () => {
  it('returns a valid DTCG color group untouched', () => {
    const doc = { blue: { $type: 'color', '500': { $value: '#3b82f6' } } };
    expect(parseDtcgPalette(doc)).toBe(doc);
  });
  it('throws on a non-object', () => {
    expect(() => parseDtcgPalette('nope')).toThrow(PaletteSourceError);
  });
});
