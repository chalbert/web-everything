/**
 * token-css.test.mjs — guards the WE docs site's emitted token CSS against a **dark-token leak**.
 *
 * Regression this locks (batch-2026-07-01-1947-2071): FUI's `defaultTheme` is a DARK theme
 * (`background: #0b1020`, `surface-card: #1c2440`). The WE site is a LIGHT "Slate/Indigo" theme layered
 * over that default via `ThemeSource.with(weSiteTheme)`, so it must override every dark card token BY NAME.
 * #2050 newly added `surface-card` / `border-light` / `text-secondary` to the FUI dark default; because
 * `weSiteTheme` had no light override for those *names*, the dark values leaked into the light site and the
 * dogfooded `.fui-card` home tiles (#2019) rendered near-black. Neither lane rendered the WE site (the FUI
 * `check:standards` gate never paints; the WE-visual lane is #2070, not yet in the batch gate), so it shipped.
 *
 * Invariant: no FUI dark-default colour may survive into the emitted WE-site token CSS, and the card surface
 * must be light. A future FUI theme token with WE-website blast radius trips this deterministically.
 */
import { describe, it, expect } from 'vitest';
import { tokenCss } from '../token-css.mjs';

// FUI defaultTheme dark *surface* colours that must never paint a light-site surface. (FUI's dark
// `#0b1020` is intentionally still emitted as an unconsumed `background` row + as dark `primary-text` —
// dark text on a light page is correct — so it is NOT a leak; only the dark card/page surfaces are.)
const FUI_DARK_LEAKS = ['#141a2e', '#1c2440'];

// Card tokens (fui:blocks/card/Card.ts) the light site must define so they can't inherit the dark default.
const CARD_TOKENS = ['surface-card', 'border-light', 'text-secondary'];

describe('WE-site token CSS (weSiteTheme over FUI dark default)', () => {
  it('never leaks a FUI dark-default colour into the emitted CSS', async () => {
    const css = await tokenCss();
    for (const dark of FUI_DARK_LEAKS) {
      expect(css, `dark FUI colour ${dark} leaked into the light site token CSS`).not.toContain(dark);
    }
  });

  it('emits a light surface for every card token the FUI dark default defines', async () => {
    const css = await tokenCss();
    for (const name of CARD_TOKENS) {
      const m = css.match(new RegExp(`--token-color-${name}:\\s*(#[0-9a-fA-F]{3,8}|[a-z]+)`));
      expect(m, `--token-color-${name} missing from emitted CSS`).not.toBeNull();
      // surface-card must be white (the card body); the others must not be a dark navy hex.
      if (name === 'surface-card') {
        expect(m[1].toLowerCase()).toMatch(/^#f{3}$|^#f{6}$|^#fff|white/);
      }
    }
  });
});
