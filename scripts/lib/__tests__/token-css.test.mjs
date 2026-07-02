/**
 * token-css.test.mjs — guards the WE docs site's emitted token CSS against a **dark-token leak**.
 *
 * Regression this locks (batch-2026-07-01-1947-2071): FUI's `defaultTheme` is a DARK theme
 * (`background: #0b1020`, `surface-card: #1c2440`). The WE site is a LIGHT "Slate/Indigo" theme layered
 * over that default via `ThemeSource.with(weSiteTheme)`, so it must own every colour token its rendered
 * components read — else a FUI dark default leaks through. #2050 newly added `surface-card` /
 * `border-light` / `text-secondary` to the FUI dark default; because `weSiteTheme` had no light override
 * for those *names*, the dark values leaked and the dogfooded `.fui-card` home tiles (#2019) rendered
 * near-black. Neither lane rendered the WE site (FUI `check:standards` never paints; the WE-visual render
 * gate is #2000/#2070, not yet in the batch gate), so it shipped.
 *
 * Two layers here, both cheap (no browser):
 *   1. value guard — no FUI dark *surface* colour survives into the emitted WE token CSS.
 *   2. contract guard (auto-derived) — the WE light theme (`weSiteTheme.color`) must define every
 *      `--color-*` token the WE-SSR'd FUI components actually read, so a NEW FUI colour token can never
 *      silently leak dark. Derived from the component source + the theme object — no hardcoded token list,
 *      no hardcoded values (the exact thing that bit us: the list was assumed, not enforced).
 *
 * The render layer above this (#2000) catches emergent multi-item *visual* interactions a unit test can't;
 * this is the deterministic floor that runs in `check:standards`.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { tokenCss } from '../token-css.mjs';
import weSiteTheme from '../../../src/_data/weSiteTheme.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const FUI_BLOCKS = join(ROOT, '..', 'frontierui', 'blocks');

// The FUI presentational blocks the WE site server-renders today (the #2018/#2019/#2020 dogfood set). The
// contract widens automatically as these components read more tokens; add a dir here when a new component
// is dogfooded onto the site.
const SSR_COMPONENTS = ['card', 'badge', 'tag'];

// FUI defaultTheme dark *surface* colours that must never paint a light-site surface. (FUI's dark
// `#0b1020` is intentionally still emitted as an unconsumed `background` row + as dark `primary-text` —
// dark text on a light page is correct — so it is NOT a leak; only the dark card/page surfaces are.)
const FUI_DARK_LEAKS = ['#141a2e', '#1c2440'];

/** Every `--color-<name>` a WE-SSR'd FUI component reads (deduped). Empty ⇒ FUI not checked out. */
function consumedColorTokens() {
  if (!existsSync(FUI_BLOCKS)) return [];
  const names = new Set();
  for (const comp of SSR_COMPONENTS) {
    const dir = join(FUI_BLOCKS, comp);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.ts')) continue;
      const src = readFileSync(join(dir, file), 'utf8');
      for (const m of src.matchAll(/var\(--color-([a-z-]+)/g)) names.add(m[1]);
    }
  }
  return [...names];
}

describe('WE-site token CSS (weSiteTheme over FUI dark default)', () => {
  it('never leaks a FUI dark-default surface colour into the emitted CSS', async () => {
    const css = await tokenCss();
    for (const dark of FUI_DARK_LEAKS) {
      expect(css, `dark FUI colour ${dark} leaked into the light site token CSS`).not.toContain(dark);
    }
  });

  it('light theme owns every --color-* token the SSR components read (auto-derived contract)', () => {
    const consumed = consumedColorTokens();
    if (consumed.length === 0) return; // FUI sibling not checked out — detect-or-skip (matches token-css.mjs)
    const owned = new Set(Object.keys(weSiteTheme.color || {}));
    const missing = consumed.filter((name) => !owned.has(name));
    expect(
      missing,
      `weSiteTheme.color must define every colour token the SSR'd FUI components read, else FUI's dark ` +
        `default leaks. Missing light override(s): ${missing.map((n) => `--color-${n}`).join(', ')}. ` +
        `Add ${missing.map((n) => `'${n}'`).join(', ')} to we:src/_data/weSiteTheme.js.`,
    ).toEqual([]);
  });
});
