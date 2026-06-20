/**
 * Web Theme token model + compile (backlog #404). Proves the primitive + component tiers, the platform
 * default set, the `extends` override mechanism, alias resolution (cycle/dangling-ref guarded), and the
 * DTCG→native-CSS compile (custom properties + @property for typed numerics; an alias → var(--ref)).
 */
import { describe, it, expect } from 'vitest';
import {
  flattenTokens,
  resolveTokens,
  extendTokens,
  isAlias,
  aliasTarget,
  isTemplated,
  templatedRefs,
  cssVarName,
  TokenResolutionError,
  type DtcgDocument,
} from '../tokens';
import { compileToCss } from '../compile';
import { defaultTokens } from '../defaultTokens';

describe('flattenTokens', () => {
  it('flattens nested groups and inherits $type from the nearest ancestor group', () => {
    const doc: DtcgDocument = {
      space: { $type: 'dimension', '4': { $value: '1rem' } },
      color: { $type: 'color', blue: { '9': { $value: 'oklch(0.55 0.18 256)' } } },
    };
    const flat = flattenTokens(doc);
    const space4 = flat.find((t) => t.path.join('.') === 'space.4')!;
    const blue9 = flat.find((t) => t.path.join('.') === 'color.blue.9')!;
    expect(space4.type).toBe('dimension');
    expect(blue9.type).toBe('color'); // inherited through the un-typed `blue` subgroup
    expect(blue9.value).toBe('oklch(0.55 0.18 256)');
  });

  it('lets a token override the inherited $type', () => {
    const doc: DtcgDocument = { type: { $type: 'dimension', lh: { $type: 'number', $value: 1.5 } } };
    expect(flattenTokens(doc)[0].type).toBe('number');
  });
});

describe('alias helpers + resolveTokens', () => {
  it('detects and unwraps {group.token} aliases', () => {
    expect(isAlias('{radius.md}')).toBe(true);
    expect(isAlias('0.5rem')).toBe(false);
    expect(aliasTarget('{radius.md}')).toBe('radius.md');
  });

  it('resolves an alias chain to its literal, keeping aliasOf for var() compilation', () => {
    const doc: DtcgDocument = {
      radius: { $type: 'dimension', md: { $value: '0.5rem' } },
      button: { $type: 'dimension', radius: { $value: '{radius.md}' } },
    };
    const resolved = resolveTokens(flattenTokens(doc));
    const btn = resolved.find((t) => t.path.join('.') === 'button.radius')!;
    expect(btn.aliasOf).toBe('radius.md');
    expect(btn.resolved).toBe('0.5rem');
  });

  it('throws on a dangling reference and on an alias cycle', () => {
    expect(() => resolveTokens(flattenTokens({ a: { $value: '{nope.gone}' } }))).toThrow(TokenResolutionError);
    const cyclic: DtcgDocument = { a: { $value: '{b}' }, b: { $value: '{a}' } };
    expect(() => resolveTokens(flattenTokens(cyclic))).toThrow(/cycle/);
  });
});

describe('calc-derived offset tokens (#1315 — templated values)', () => {
  it('distinguishes a templated value from a bare alias and a literal', () => {
    expect(isTemplated('calc({radius.base} - 2px)')).toBe(true);
    expect(isTemplated('{radius.md}')).toBe(false); // a bare alias, not templated
    expect(isTemplated('0.5rem')).toBe(false);
    expect(templatedRefs('calc({radius.base} - 2px)')).toEqual(['radius.base']);
  });

  it('resolves a calc-derived offset to a concrete-literal calc (for @property), aliasOf stays null', () => {
    const doc: DtcgDocument = {
      radius: {
        $type: 'dimension',
        base: { $value: '0.5rem' },
        sm: { $value: 'calc({radius.base} - 0.25rem)' },
      },
    };
    const sm = resolveTokens(flattenTokens(doc)).find((t) => t.path.join('.') === 'radius.sm')!;
    expect(sm.aliasOf).toBeNull();
    expect(sm.resolved).toBe('calc(0.5rem - 0.25rem)');
  });

  it('compiles a calc-derived offset to native calc() with var(--ref), tracking the base at runtime', () => {
    const doc: DtcgDocument = {
      radius: {
        $type: 'dimension',
        base: { $value: '0.5rem' },
        lg: { $value: 'calc({radius.base} + 0.5rem)' },
      },
    };
    const { css } = compileToCss(doc);
    expect(css).toContain('--radius-lg: calc(var(--radius-base) + 0.5rem);');
    // @property initial-value uses the resolved literal calc, not the var form.
    expect(css).toContain('initial-value: calc(0.5rem + 0.5rem);');
  });

  it('guards a templated value against a dangling ref and a cycle', () => {
    expect(() => resolveTokens(flattenTokens({ a: { $value: 'calc({nope.gone} - 1px)' } }))).toThrow(
      TokenResolutionError,
    );
    const cyclic: DtcgDocument = { a: { $value: 'calc({b} + 1px)' }, b: { $value: 'calc({a} - 1px)' } };
    expect(() => resolveTokens(flattenTokens(cyclic))).toThrow(/cycle/);
  });

  it('the default radius scale is now base-derived but preserves prior computed values', () => {
    const resolved = resolveTokens(flattenTokens(defaultTokens));
    const r = (k: string) => resolved.find((t) => t.path.join('.') === `radius.${k}`)!;
    expect(r('base').resolved).toBe('0.5rem');
    expect(r('sm').resolved).toBe('calc(0.5rem - 0.25rem)'); // = 0.25rem
    expect(r('md').aliasOf).toBe('radius.base'); // bare alias → 0.5rem
    expect(r('lg').resolved).toBe('calc(0.5rem + 0.5rem)'); // = 1rem
  });
});

describe('extendTokens (config-extends-platform-default)', () => {
  it('deep-merges an override over the base, replacing token leaves and keeping the rest', () => {
    const base: DtcgDocument = {
      radius: { $type: 'dimension', sm: { $value: '0.25rem' }, md: { $value: '0.5rem' } },
      color: { $type: 'color', accent: { $value: 'oklch(0.55 0.18 256)' } },
    };
    const override: DtcgDocument = { radius: { md: { $value: '0.75rem' } } };
    const merged = extendTokens(base, override);

    const flat = Object.fromEntries(flattenTokens(merged).map((t) => [t.path.join('.'), t.value]));
    expect(flat['radius.md']).toBe('0.75rem'); // overridden
    expect(flat['radius.sm']).toBe('0.25rem'); // inherited from the default
    expect(flat['color.accent']).toBe('oklch(0.55 0.18 256)'); // untouched group preserved
  });

  it('does not mutate either input', () => {
    const base: DtcgDocument = { radius: { $type: 'dimension', md: { $value: '0.5rem' } } };
    const override: DtcgDocument = { radius: { md: { $value: '1rem' } } };
    extendTokens(base, override);
    expect((base.radius as any).md.$value).toBe('0.5rem');
  });
});

describe('compileToCss', () => {
  it('emits one custom property per token, an alias as var(--ref), and @property for typed numerics', () => {
    const doc: DtcgDocument = {
      radius: { $type: 'dimension', md: { $value: '0.5rem' } },
      button: { $type: 'dimension', radius: { $value: '{radius.md}' } },
    };
    const { css } = compileToCss(doc);
    expect(css).toContain('--radius-md: 0.5rem;');
    expect(css).toContain('--button-radius: var(--radius-md);'); // alias → var, matching #403's example
    expect(css).toContain('@property --button-radius {');
    expect(css).toContain('syntax: "<length>"; inherits: true; initial-value: 0.5rem;'); // literal, not var
  });

  it('maps each $type to its @property syntax and reports types with no syntax', () => {
    const doc: DtcgDocument = {
      c: { $type: 'color', a: { $value: 'oklch(0.5 0 0)' } },
      n: { $type: 'number', a: { $value: 2 } },
      s: { $type: 'shadow', a: { $value: '0 1px 2px #0001' } },
    };
    const { css, diagnostics } = compileToCss(doc);
    expect(css).toContain('syntax: "<color>"');
    expect(css).toContain('syntax: "<number>"');
    expect(css).not.toContain('shadow'); // shadow has no registrable syntax → plain var only
    expect(diagnostics.join('\n')).toMatch(/\$type shadow\) has no @property syntax/);
  });

  it('honours a custom selector and can skip @property registration', () => {
    const doc: DtcgDocument = { radius: { $type: 'dimension', md: { $value: '0.5rem' } } };
    const { css } = compileToCss(doc, { selector: '.theme-dark', registerProperties: false });
    expect(css).toContain('.theme-dark {');
    expect(css).not.toContain('@property');
  });
});

describe('the platform default token set', () => {
  it('compiles cleanly and resolves every component-tier alias to a primitive', () => {
    const { css } = compileToCss(defaultTokens);
    // Primitive tier present.
    expect(css).toContain('--space-4: 1rem;');
    // Radius is now base-derived (#1315): base is the literal, md aliases it (= 0.5rem).
    expect(css).toContain('--radius-base: 0.5rem;');
    expect(css).toContain('--radius-md: var(--radius-base);');
    // Component tier aliases a primitive.
    expect(css).toContain('--button-radius: var(--radius-md);');
    expect(css).toContain('--card-elevation: var(--elevation-1);');
    // The accent seed is itself an alias into the blue scale.
    expect(css).toContain('--color-accent: var(--color-blue-9);');
    // Focus-ring role (#1316): color tracks the accent; offset is a literal dimension.
    expect(css).toContain('--ring-color: var(--color-accent);');
    expect(css).toContain('--ring-offset: 2px;');
  });

  it('a project extends the default and recompiles with only its overrides changed', () => {
    const brand: DtcgDocument = {
      color: { accent: { $value: '{color.gray.12}' } },
      radius: { md: { $value: '0.375rem' } },
    };
    const themed = extendTokens(defaultTokens, brand);
    const { css } = compileToCss(themed);
    expect(css).toContain('--color-accent: var(--color-gray-12);'); // re-pointed accent
    expect(css).toContain('--radius-md: 0.375rem;'); // overridden primitive
    expect(css).toContain('--space-4: 1rem;'); // everything else inherited from the default
  });

  it('cssVarName composes the dotted path', () => {
    expect(cssVarName(['color', 'blue', '9'])).toBe('--color-blue-9');
  });
});
