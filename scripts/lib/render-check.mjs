/**
 * render-check.mjs — the pure, engine-agnostic core of the #2000 per-lane cross-origin visual
 * render check. No browser, no server, no Playwright here: just the color math + the repo-qualified
 * visual-touch predicate that both the CLI harness (`scripts/dev/render-check.mjs`) and the committed
 * browser spec (`tests/visual/fui-card-cross-origin-render.spec.ts`) import, so the "is this frame a
 * regression?" decision lives in ONE place and can be unit-tested off-server.
 *
 * ## What class of bug this catches (#1895 / #2050 / #2019)
 * The WE docs site dogfoods FUI's `.fui-card` surface (#2019) and derives its `--token-*` values from
 * FUI's webtheme source cross-repo at build time (#96 / `scripts/lib/token-css.mjs`). FUI's default
 * theme defines the card tokens DARK (`surface-card: #1c2440`, …, #2050). If the WE light project
 * theme (`src/_data/weSiteTheme.js`) fails to override them by name, FUI's dark values flow through and
 * the home-grid `.fui-card` tiles paint near-black — the exact regression that shipped to `main` in the
 * batch-2026-07-01 run (a WE-visual lane carried one lane away from the FUI-token lane that broke it).
 * The unit test `scripts/lib/__tests__/token-css.test.mjs` guards the emitted token STRING; this guards
 * the rendered PIXEL — the emergent, multi-item visual interaction a per-file gate can't see.
 *
 * Direction of the check: a `.fui-card` surface must render LIGHT. A dark computed background means a
 * FUI dark-default token leaked into the WE consumer.
 *
 * @module render-check
 */

/** FUI's dark default card tokens (fui:plugs/webtheme/defaultTheme.ts) — the exact bytes that leak
 * into the WE consumer when the light override is missing. Used by the harness's `--simulate-regression`
 * mode and the spec's negative fixture to reproduce the known-bad state through the REAL `.fui-card`
 * CSS rule. Kept in sync with defaultTheme.ts (asserted by the token-css unit test). */
export const FUI_DARK_CARD = Object.freeze({
  'surface-card': '#1c2440',
  'border-light': '#222a44',
  'text-secondary': '#b8c0d4',
});

/**
 * Parse a CSS color string into `{ r, g, b, a }` 0–255 (a 0–1). Handles the two forms a browser's
 * `getComputedStyle().backgroundColor` ever returns — `rgb(r, g, b)` / `rgba(r, g, b, a)` — plus `#hex`
 * (3/6/8 digit) so the same helper works on raw theme values in the unit test. Returns null on anything
 * it can't parse (e.g. `transparent` resolves to `rgba(0, 0, 0, 0)`, which parses fine → a=0).
 * @param {string} input
 * @returns {{r:number,g:number,b:number,a:number}|null}
 */
export function parseColor(input) {
  if (typeof input !== 'string') return null;
  const s = input.trim().toLowerCase();
  const rgb = s.match(/^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/);
  if (rgb) {
    const a = rgb[4] == null ? 1 : rgb[4].endsWith('%') ? parseFloat(rgb[4]) / 100 : parseFloat(rgb[4]);
    return { r: +rgb[1], g: +rgb[2], b: +rgb[3], a };
  }
  const hex = s.match(/^#([0-9a-f]{3,8})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    if (h.length === 6 || h.length === 8) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
      };
    }
  }
  return null;
}

/**
 * WCAG relative luminance (0 = black, 1 = white) of a parsed color, ignoring alpha.
 * @param {{r:number,g:number,b:number}} c
 * @returns {number}
 */
export function relativeLuminance({ r, g, b }) {
  const lin = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Above this luminance a surface is "light" (a card that should read as paper, not navy). White is
 * 1.0, FUI's dark `#1c2440` is ~0.017, the light `#ffffff` override is 1.0 — 0.5 separates cleanly with
 * wide margin on both sides. */
export const LIGHT_THRESHOLD = 0.5;

/**
 * Classify a computed `.fui-card` background color. A fully-transparent background (`a === 0`) is
 * ALSO a regression here: the accepted `.fui-card` frame is an opaque light surface, and the #1895
 * class is exactly a card that lost its surface (transparent) or went dark. So: light + opaque = ok.
 * @param {string} cssColor a `getComputedStyle` background-color (or a raw hex, for the unit test)
 * @returns {{ ok: boolean, luminance: number|null, color: string, reason: string }}
 */
export function classifyCardSurface(cssColor) {
  const c = parseColor(cssColor);
  if (!c) return { ok: false, luminance: null, color: String(cssColor), reason: 'unparseable background-color' };
  if (c.a === 0) return { ok: false, luminance: 0, color: String(cssColor), reason: 'transparent surface (frame lost)' };
  const lum = relativeLuminance(c);
  const ok = lum >= LIGHT_THRESHOLD;
  return {
    ok,
    luminance: lum,
    color: String(cssColor),
    reason: ok ? 'light surface' : `dark surface (luminance ${lum.toFixed(3)} < ${LIGHT_THRESHOLD}) — FUI dark card token leaked`,
  };
}

/**
 * Repo-qualified visual-touch predicate (#2078, folded into #2000). Decides whether a batch lane's
 * changed-file set warrants the render check on the **WE** consumer. Two triggers:
 *   1. The lane edits a WE presentation surface — `*.njk`, `*.css`, or `src/_includes/**` templates.
 *   2. The lane edits a FUI theme/token source — `plugs/webtheme/**` (`defaultTheme`, `legacyAliases`,
 *      `LEGACY_ALIASES`) — because WE consumes FUI theming cross-origin (#96) and the FUI lane's own
 *      `check:standards` never paints. A FUI theme edit ⇒ render the WE consumer, not (only) FUI.
 * Repo-qualify by passing each file with its repo, e.g. `{ repo: 'frontierui', path: 'plugs/webtheme/defaultTheme.ts' }`
 * or a bare WE-relative string (repo defaults to 'we').
 * @param {Array<string | {repo?: string, path: string}>} files
 * @returns {boolean}
 */
export function isVisualTouch(files) {
  if (!Array.isArray(files)) return false;
  return files.some((f) => {
    const repo = typeof f === 'string' ? 'we' : (f.repo || 'we');
    const path = typeof f === 'string' ? f : f.path;
    if (typeof path !== 'string') return false;
    if (repo === 'we') {
      return /\.njk$/.test(path) || /\.css$/.test(path) || /^src\/_includes\//.test(path);
    }
    if (repo === 'frontierui' || repo === 'fui') {
      return /(^|\/)plugs\/webtheme\//.test(path);
    }
    return false;
  });
}
