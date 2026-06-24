/**
 * Tests for the `webeverything.config` author surface + per-dimension resolver (#1702 / #1662).
 *
 * Coverage: defineConfig validation · extendsFlavor descriptor shape · ordered nearest-wins resolution
 * (own-wins, first-extended-wins, multi-base order) · NO cross-dimension merge · the autoDefine
 * end-to-end demonstration over the real CustomAutoDefineRegistry · the string-pointer (extract) case.
 */
import { describe, it, expect } from 'vitest';
import {
  defineConfig,
  extendsFlavor,
  isExtendsFlavorDescriptor,
  isDimensionPointer,
  InvalidConfigEntryError,
} from '../defineConfig';
import {
  resolveDimension,
  resolveConfig,
  UnresolvableDimensionError,
  type DimensionResolver,
} from '../resolveDimension';
import {
  autoDefineResolver,
  createScalarFlavorResolver,
  PLATFORM_AUTO_DEFINE_FLAVOR,
} from '../platformFlavor';
import type CustomAutoDefineRegistry from '../../blocks/renderers/auto-define/CustomAutoDefineRegistry';

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

// A tiny scalar resolver used to assert the generic ordered nearest-wins contract in isolation.
const modeResolver = createScalarFlavorResolver('renderStrategy');

describe('resolveDimension — ordered nearest-wins (scalar realization)', () => {
  it('first-extended-wins: nearest (flavors[0]) is the winner with no override', () => {
    const resolved = resolveDimension(extendsFlavor(['eager-sync', 'lazy-async']), modeResolver);
    expect(resolved).toBe('eager-sync');
  });

  it('own-wins: a local override beats the whole flavor chain', () => {
    const resolved = resolveDimension(
      extendsFlavor(['eager-sync', 'lazy-async'], 'declarative'),
      modeResolver,
    );
    expect(resolved).toBe('declarative');
  });

  it('multi-base order: changing the order changes the nearest winner', () => {
    expect(resolveDimension(extendsFlavor(['a', 'b', 'c']), modeResolver)).toBe('a');
    expect(resolveDimension(extendsFlavor(['c', 'b', 'a']), modeResolver)).toBe('c');
  });

  it('accepts a plain inline (non-string) value via fromInline', () => {
    // A bare string is unambiguously a file pointer; an inline VALUE the project supplies directly is
    // an object/descriptor-less value, routed to fromInline (which stringifies it for this scalar dim).
    expect(resolveDimension({ toString: () => 'custom-mode' } as never, modeResolver)).toBe('custom-mode');
  });
});

describe('resolveDimension — error cases', () => {
  it('throws on an undefined entry', () => {
    expect(() => resolveDimension(undefined, modeResolver)).toThrow(UnresolvableDimensionError);
  });

  it('throws on an unresolved string pointer (loader is a follow-on, out of scope)', () => {
    // A bare string is treated as a file pointer; the resolver does not load files.
    expect(() => resolveDimension('./config/extracted.ts', autoDefineResolver)).toThrow(
      UnresolvableDimensionError,
    );
    expect(() => resolveDimension('./config/extracted.ts', autoDefineResolver)).toThrow(/file pointer/);
  });

  it('throws when an inline value is given but the resolver has no fromInline', () => {
    // autoDefineResolver intentionally omits fromInline (a registry has no plain-value form).
    const inlineOnlyForAutoDefine = { not: 'a descriptor' } as unknown;
    // Passing a plain object that is NOT a descriptor exercises the no-fromInline branch.
    expect(() =>
      resolveDimension(inlineOnlyForAutoDefine as never, autoDefineResolver),
    ).toThrow(UnresolvableDimensionError);
  });
});

describe('autoDefine end-to-end — nearest-wins over the REAL CustomAutoDefineRegistry', () => {
  it('platform flavor alone (strict-explicit) resolves a registry whose defaultKey is explicit', () => {
    const reg = resolveDimension(
      extendsFlavor(PLATFORM_AUTO_DEFINE_FLAVOR),
      autoDefineResolver,
    ) as CustomAutoDefineRegistry;
    expect(reg.defaultKey).toBe('explicit');
    expect(reg.has('explicit')).toBe(true);
  });

  it('project override flavor (lazy-dom) extends platform (strict-explicit) → defaultKey = lazy-dom', () => {
    // Nearest-first: lazy-dom is the nearer base, so its declared default (lazy-dom) wins; the
    // strict-explicit baseline still contributes its `explicit` strategy to the table.
    const reg = resolveDimension(
      extendsFlavor(['lazy-dom', 'strict-explicit']),
      autoDefineResolver,
    ) as CustomAutoDefineRegistry;
    expect(reg.defaultKey).toBe('lazy-dom');
    // Both strategies are reachable through the extends chain (no blob materialized).
    expect(reg.has('lazy-dom')).toBe(true);
    expect(reg.has('explicit')).toBe(true);
    // The resolved strategy for the default is the lazy-dom strategy.
    expect(reg.resolve().key).toBe('lazy-dom');
  });

  it('reversing the order flips the nearest winner (strict-explicit nearest → explicit default)', () => {
    const reg = resolveDimension(
      extendsFlavor(['strict-explicit', 'lazy-dom']),
      autoDefineResolver,
    ) as CustomAutoDefineRegistry;
    expect(reg.defaultKey).toBe('explicit');
  });

  it('a local override (overrides.defaultKey) beats every flavor default (absolute nearest top)', () => {
    const reg = resolveDimension(
      // chain would yield lazy-dom; override forces explicit.
      extendsFlavor(['lazy-dom', 'strict-explicit'], { defaultKey: 'explicit' }),
      autoDefineResolver,
    ) as CustomAutoDefineRegistry;
    expect(reg.defaultKey).toBe('explicit');
  });

  it('an unknown flavor id throws a clear error', () => {
    expect(() =>
      resolveDimension(extendsFlavor('no-such-flavor' as never), autoDefineResolver),
    ).toThrow(/Unknown autoDefine flavor/);
  });
});

describe('resolveConfig — discovery view with NO cross-dimension merge (#1662 Fork 1)', () => {
  const resolvers: Record<string, DimensionResolver<string, unknown>> = {
    autoDefine: autoDefineResolver as DimensionResolver<string, unknown>,
    renderStrategy: createScalarFlavorResolver('renderStrategy'),
    codegenSoT: createScalarFlavorResolver('codegenSoT'),
  };

  it('resolves each declared dimension independently, side by side', () => {
    const config = defineConfig({
      autoDefine: extendsFlavor(['lazy-dom', 'strict-explicit']),
      renderStrategy: extendsFlavor('eager-sync'),
      codegenSoT: extendsFlavor('standard-form'),
    });
    const view = resolveConfig(config, resolvers);

    expect((view.autoDefine as CustomAutoDefineRegistry).defaultKey).toBe('lazy-dom');
    expect(view.renderStrategy).toBe('eager-sync');
    expect(view.codegenSoT).toBe('standard-form');
  });

  it('resolving autoDefine does NOT read or touch theme (no cross-dimension merge)', () => {
    // theme is configured but has NO resolver registered → it must be ABSENT from the view, and the
    // autoDefine resolution must be unaffected by theme's presence.
    const config = defineConfig({
      autoDefine: extendsFlavor('strict-explicit'),
      theme: extendsFlavor('some-theme-flavor'),
    });
    const view = resolveConfig(config, { autoDefine: autoDefineResolver as DimensionResolver<string, unknown> });

    expect((view.autoDefine as CustomAutoDefineRegistry).defaultKey).toBe('explicit');
    expect('theme' in view).toBe(false); // no resolver → not in the discovery view.
    // The autoDefine registry carries ONLY autoDefine strategies — nothing leaked from theme.
    expect([...(view.autoDefine as CustomAutoDefineRegistry).keys()].sort()).toEqual(['explicit']);
  });

  it('leaves unconfigured dimensions absent (lazy)', () => {
    const config = defineConfig({ autoDefine: extendsFlavor('strict-explicit') });
    const view = resolveConfig(config, resolvers);
    expect('renderStrategy' in view).toBe(false);
    expect('codegenSoT' in view).toBe(false);
  });
});
