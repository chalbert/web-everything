/**
 * Module-resolution axis model (#274). The config value space is { default | URL }; the platform
 * default carries no overrides; a project extends it; materialisation emits ONLY URL overrides as
 * importmap entries (default specifiers stay absent — left to native node-resolution).
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_RESOLUTION,
  PLATFORM_DEFAULT_MODULE_RESOLUTION,
  ModuleResolutionError,
  isResolutionUrl,
  extendModuleResolution,
  assertModuleResolution,
  resolveSpecifier,
  materializeModuleResolution,
} from '../provider.js';

describe('value space', () => {
  it('isResolutionUrl accepts http(s) URLs only', () => {
    expect(isResolutionUrl('https://esm.sh/x')).toBe(true);
    expect(isResolutionUrl('http://localhost/x')).toBe(true);
    expect(isResolutionUrl('/plugs/x')).toBe(false);
    expect(isResolutionUrl('default')).toBe(false);
  });

  it('platform default carries no overrides', () => {
    expect(PLATFORM_DEFAULT_MODULE_RESOLUTION.overrides).toEqual({});
  });
});

describe('extend + assert', () => {
  it('a project config extends the platform default (project wins)', () => {
    const merged = extendModuleResolution({ overrides: { '@frontierui/jsx-runtime': 'https://esm.sh/x' } });
    expect(merged.overrides['@frontierui/jsx-runtime']).toBe('https://esm.sh/x');
  });

  it('accepts default + URL values', () => {
    expect(() =>
      assertModuleResolution({ overrides: { a: DEFAULT_RESOLUTION, b: 'https://esm.sh/b' } }),
    ).not.toThrow();
  });

  it('rejects a non-URL, non-default value', () => {
    expect(() => assertModuleResolution({ overrides: { a: '/plugs/raw' } })).toThrow(ModuleResolutionError);
    expect(() => assertModuleResolution({ overrides: { a: '../frontierui/src/x' } })).toThrow(ModuleResolutionError);
  });
});

describe('resolveSpecifier', () => {
  const config = { overrides: { '@frontierui/jsx-runtime': 'https://esm.sh/jsx', '@a/b': DEFAULT_RESOLUTION } };

  it('default for an absent specifier', () => {
    expect(resolveSpecifier(config, '@nope/x')).toEqual({ mode: 'default' });
  });
  it('default for an explicit "default" value', () => {
    expect(resolveSpecifier(config, '@a/b')).toEqual({ mode: 'default' });
  });
  it('url for a URL override', () => {
    expect(resolveSpecifier(config, '@frontierui/jsx-runtime')).toEqual({ mode: 'url', url: 'https://esm.sh/jsx' });
  });
});

describe('materializeModuleResolution (generator hint)', () => {
  it('emits only URL overrides as importmap entries; default specifiers stay absent', () => {
    const { imports } = materializeModuleResolution({
      overrides: {
        '@frontierui/jsx-runtime': 'https://esm.sh/jsx',
        '@a/b': DEFAULT_RESOLUTION,
      },
    });
    expect(imports).toEqual({ '@frontierui/jsx-runtime': 'https://esm.sh/jsx' });
  });

  it('an empty (all-default) config materialises to an empty importmap', () => {
    expect(materializeModuleResolution(PLATFORM_DEFAULT_MODULE_RESOLUTION)).toEqual({ imports: {} });
  });

  it('throws on a malformed override before emitting', () => {
    expect(() => materializeModuleResolution({ overrides: { a: 'not-a-url' } })).toThrow(ModuleResolutionError);
  });
});
