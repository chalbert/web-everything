/**
 * Contract vectors for the `webeverything.config` author surface (#1702 / #1662; carved #1780).
 *
 * WE-resident half: the author surface + schema guards only — `defineConfig` validation/identity,
 * `extendsFlavor` descriptor shape, and the two entry guards. The **resolver runtime** tests
 * (nearest-wins, error cases, the autoDefine end-to-end demo, the discovery view) live with the impl in
 * **FUI** (`config/__tests__/config-resolve.test.ts` there), since the runtime is standard impl (#1282).
 */
import { describe, it, expect } from 'vitest';
import {
  defineConfig,
  extendsFlavor,
  isExtendsFlavorDescriptor,
  isDimensionPointer,
  InvalidConfigEntryError,
} from '../defineConfig';

describe('defineConfig — validation + identity', () => {
  it('returns the config unchanged (identity) for inference', () => {
    const cfg = { autoDefine: extendsFlavor('strict-explicit') };
    expect(defineConfig(cfg)).toBe(cfg);
  });

  it('accepts inline objects and string pointers per dimension', () => {
    expect(() =>
      defineConfig({
        autoDefine: extendsFlavor('lazy-dom'),
        theme: './config/theme.config.ts', // string pointer (extract-to-own-file)
        renderStrategy: { mode: 'eager-sync' }, // inline value
      }),
    ).not.toThrow();
  });

  it('ignores omitted/undefined dimensions', () => {
    expect(() => defineConfig({ autoDefine: undefined })).not.toThrow();
  });

  it('throws InvalidConfigEntryError when a dimension is neither object nor string', () => {
    // @ts-expect-error — a number is not a valid entry
    expect(() => defineConfig({ autoDefine: 42 })).toThrow(InvalidConfigEntryError);
    // @ts-expect-error — null is not a valid entry
    expect(() => defineConfig({ theme: null })).toThrow(InvalidConfigEntryError);
  });

  it('throws when the root is not an object', () => {
    // @ts-expect-error — not a config object
    expect(() => defineConfig(null)).toThrow(InvalidConfigEntryError);
  });
});

describe('extendsFlavor — descriptor shape', () => {
  it('wraps a single flavor id into a one-element ordered list', () => {
    const d = extendsFlavor('strict-explicit');
    expect(d.kind).toBe('extends-flavor');
    expect(d.flavors).toEqual(['strict-explicit']);
    expect(d.overrides).toBeUndefined();
    expect(isExtendsFlavorDescriptor(d)).toBe(true);
  });

  it('preserves multi-base order (nearest-first) and overrides', () => {
    const d = extendsFlavor(['lazy-dom', 'strict-explicit'], { defaultKey: 'explicit' });
    expect(d.flavors).toEqual(['lazy-dom', 'strict-explicit']);
    expect(d.overrides).toEqual({ defaultKey: 'explicit' });
  });

  it('throws on an empty flavor chain', () => {
    expect(() => extendsFlavor([] as string[])).toThrow();
  });

  it('the two guards distinguish descriptor / pointer / plain', () => {
    expect(isExtendsFlavorDescriptor(extendsFlavor('x'))).toBe(true);
    expect(isExtendsFlavorDescriptor({ foo: 1 })).toBe(false);
    expect(isDimensionPointer('./a.ts')).toBe(true);
    expect(isDimensionPointer({})).toBe(false);
  });
});
