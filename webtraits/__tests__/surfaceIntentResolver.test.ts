// Surface-intent → CSS resolver (#1911). Proves the realize-a-declared-axis path #1884 ruled: a chosen
// surface profile (texture/interaction/elevation/variant) resolves to deterministic, token-backed CSS, so a
// consumer (the hovercard preset) composes its surface from the intent instead of a raw-CSS blob.
import { describe, it, expect } from 'vitest';
import {
  resolveSurface,
  surfaceCss,
  declarationsToCss,
  type SurfaceProfile,
} from '../surfaceIntentResolver';

const props = (decls: { property: string; value: string }[]) => decls.map((d) => d.property);
const valueOf = (decls: { property: string; value: string }[], prop: string) =>
  decls.find((d) => d.property === prop)?.value;

describe('resolveSurface — native-first defaults', () => {
  it('an empty profile resolves to the solid/static/elevation-0/default surface (no shadow, no hover)', () => {
    const r = resolveSurface();
    expect(valueOf(r.base, 'background')).toBe('var(--surface-bg, #fff)');
    expect(props(r.base)).not.toContain('box-shadow');
    expect(r.hover).toEqual([]);
    expect(r.animated).toBe(false);
  });

  it('an omitted dimension falls back to its default (partial profile)', () => {
    const r = resolveSurface({ elevation: 2 });
    expect(valueOf(r.base, 'background')).toBe('var(--surface-bg, #fff)'); // texture defaulted to solid
    expect(props(r.base)).toContain('box-shadow');
  });
});

describe('resolveSurface — texture', () => {
  it('glass adds a blur + prefixed backdrop-filter and a translucent background', () => {
    const r = resolveSurface({ texture: 'glass' });
    expect(props(r.base)).toContain('backdrop-filter');
    expect(props(r.base)).toContain('-webkit-backdrop-filter');
    expect(valueOf(r.base, 'background')).toContain('rgba');
  });
  it('transparent fills nothing and carries no border', () => {
    const r = resolveSurface({ texture: 'transparent' });
    expect(valueOf(r.base, 'background')).toBe('transparent');
    expect(props(r.base)).not.toContain('border');
  });
});

describe('resolveSurface — elevation', () => {
  it('0 emits no box-shadow; 1–5 emit a token-backed shadow', () => {
    expect(props(resolveSurface({ elevation: 0 }).base)).not.toContain('box-shadow');
    for (const e of [1, 2, 3, 4, 5] as const) {
      const v = valueOf(resolveSurface({ elevation: e }).base, 'box-shadow');
      expect(v).toContain(`var(--surface-shadow-${e}`);
    }
  });
});

describe('resolveSurface — interaction', () => {
  it('static is inert — no transition, no hover declarations', () => {
    const r = resolveSurface({ interaction: 'static' });
    expect(props(r.base)).not.toContain('transition');
    expect(r.hover).toEqual([]);
    expect(r.animated).toBe(false);
  });
  it('lift adds a transition + a hover translateY (and deepens the shadow on hover)', () => {
    const r = resolveSurface({ interaction: 'lift', elevation: 3 });
    expect(props(r.base)).toContain('transition');
    expect(valueOf(r.hover, 'transform')).toBe('translateY(-2px)');
    expect(valueOf(r.hover, 'box-shadow')).toContain('var(--surface-shadow-4'); // bumped one step
    expect(r.animated).toBe(true);
  });
  it('lift at max elevation does not bump past 5', () => {
    const r = resolveSurface({ interaction: 'lift', elevation: 5 });
    expect(valueOf(r.hover, 'box-shadow')).toContain('var(--surface-shadow-5');
  });
  it('scale adds a hover scale transform', () => {
    const r = resolveSurface({ interaction: 'scale' });
    expect(valueOf(r.hover, 'transform')).toBe('scale(1.02)');
    expect(r.animated).toBe(true);
  });
});

describe('resolveSurface — variant', () => {
  it('alt swaps in high-contrast border + text tokens', () => {
    const r = resolveSurface({ variant: 'alt' });
    expect(valueOf(r.base, 'border')).toContain('--surface-border-alt');
    expect(valueOf(r.base, 'color')).toContain('--surface-text-alt');
  });
});

describe('resolveSurface — deterministic', () => {
  it('the same profile always resolves to the same declarations', () => {
    const profile: SurfaceProfile = { texture: 'solid', elevation: 3, interaction: 'lift', variant: 'default' };
    expect(resolveSurface(profile)).toEqual(resolveSurface(profile));
  });
});

describe('surfaceCss — full ruleset emit', () => {
  it('a static surface emits only a base block', () => {
    const css = surfaceCss('.card', { texture: 'solid', elevation: 2 });
    expect(css).toContain('.card {');
    expect(css).not.toContain(':hover');
  });
  it('an animated surface emits a hover block and a reduced-motion guard', () => {
    const css = surfaceCss('.card', { interaction: 'lift', elevation: 3 });
    expect(css).toContain('.card:hover, .card:focus-visible {');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });
});

describe('declarationsToCss', () => {
  it('serializes declarations into prop: value; lines', () => {
    expect(declarationsToCss([{ property: 'color', value: 'red' }, { property: 'gap', value: '1rem' }])).toBe(
      'color: red; gap: 1rem;',
    );
  });
});

// The hovercard card profile (#1911): the raw-CSS blob it replaces was a solid, elevation-3, lift surface.
describe('hovercard surface profile (the #1911 dogfood)', () => {
  it("composes the card's surface from surface{texture:solid, elevation:3, interaction:lift}", () => {
    const css = surfaceCss('.hovercard-card', { texture: 'solid', elevation: 3, interaction: 'lift' });
    expect(css).toContain('box-shadow');
    expect(css).toContain('background');
    expect(css).toContain(':focus-visible');
  });
});
