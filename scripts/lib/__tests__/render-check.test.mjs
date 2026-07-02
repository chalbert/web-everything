/**
 * render-check.test.mjs — off-server unit floor for the #2000 render check's pure core
 * (`scripts/lib/render-check.mjs`): the color math that decides "is this `.fui-card` a regression?"
 * and the repo-qualified visual-touch predicate that decides "does this lane warrant the render check?".
 *
 * The browser spec (`tests/visual/fui-card-cross-origin-render.spec.ts`) proves the check against a REAL
 * rendered tile; this proves the decision logic deterministically without a browser, so a threshold or
 * predicate regression is caught in `check:standards`, not only in the heavier visual lane.
 */
import { describe, it, expect } from 'vitest';
import {
  parseColor,
  relativeLuminance,
  classifyCardSurface,
  isVisualTouch,
  FUI_DARK_CARD,
  LIGHT_THRESHOLD,
} from '../render-check.mjs';

describe('parseColor', () => {
  it('parses rgb / rgba forms a browser returns', () => {
    expect(parseColor('rgb(255, 255, 255)')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('rgba(28, 36, 64, 0.5)')).toEqual({ r: 28, g: 36, b: 64, a: 0.5 });
    expect(parseColor('rgba(0, 0, 0, 0)')).toEqual({ r: 0, g: 0, b: 0, a: 0 }); // transparent
  });
  it('parses #hex (3/6/8 digit) so raw theme values classify too', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('#1c2440')).toEqual({ r: 28, g: 36, b: 64, a: 1 });
    expect(parseColor('#1c244080')).toMatchObject({ r: 28, g: 36, b: 64 });
  });
  it('returns null on garbage', () => {
    expect(parseColor('not-a-color')).toBeNull();
    expect(parseColor(undefined)).toBeNull();
  });
});

describe('relativeLuminance', () => {
  it('is 1 for white and ~0 for FUI dark card', () => {
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
    expect(relativeLuminance(parseColor(FUI_DARK_CARD['surface-card']))).toBeLessThan(0.05);
  });
});

describe('classifyCardSurface', () => {
  it('passes the WE light card surface', () => {
    const v = classifyCardSurface('rgb(255, 255, 255)');
    expect(v.ok).toBe(true);
    expect(v.luminance).toBeGreaterThanOrEqual(LIGHT_THRESHOLD);
  });
  it('flags the FUI dark card leak (the #2050/#2019 regression)', () => {
    const v = classifyCardSurface(`rgb(28, 36, 64)`); // #1c2440
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/dark surface/);
  });
  it('flags a transparent surface as a lost frame (#1895 class)', () => {
    const v = classifyCardSurface('rgba(0, 0, 0, 0)');
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/transparent/);
  });
  it('flags an unparseable value rather than passing it', () => {
    expect(classifyCardSurface('inherit').ok).toBe(false);
  });
});

describe('isVisualTouch (repo-qualified predicate, #2078 folded into #2000)', () => {
  it('fires on WE presentation surfaces', () => {
    expect(isVisualTouch(['src/index.njk'])).toBe(true);
    expect(isVisualTouch(['src/css/style.css'])).toBe(true);
    expect(isVisualTouch(['src/_includes/product-components.njk'])).toBe(true);
  });
  it('fires on a FUI theme/token source (cross-origin consumer rule #96)', () => {
    expect(isVisualTouch([{ repo: 'frontierui', path: 'plugs/webtheme/defaultTheme.ts' }])).toBe(true);
    expect(isVisualTouch([{ repo: 'frontierui', path: 'plugs/webtheme/legacyAliases.ts' }])).toBe(true);
  });
  it('does NOT fire on non-visual edits', () => {
    expect(isVisualTouch(['scripts/backlog.mjs', 'src/_data/backlog.js'])).toBe(false);
    expect(isVisualTouch([{ repo: 'frontierui', path: 'blocks/card/Card.ts' }])).toBe(false);
    expect(isVisualTouch([{ repo: 'plateau-app', path: 'src/main.ts' }])).toBe(false);
  });
  it('handles empty / malformed input safely', () => {
    expect(isVisualTouch([])).toBe(false);
    expect(isVisualTouch(null)).toBe(false);
    expect(isVisualTouch([{ repo: 'we' }])).toBe(false);
  });
});
