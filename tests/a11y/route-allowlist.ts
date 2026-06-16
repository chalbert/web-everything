// Hand-maintained allowlist of WE-docs routes gated by the rendered-site a11y gate (#770, ratified #763
// Fork 3 = A — explicit, reviewed, mirrored per-repo; matches the §9 Vite-proxy-allowlist precedent in
// scripts/check-standards.mjs). A new page is gated only when its path is added here — a known, reviewable
// seam, NOT auto-derived from the 11ty collection (the #763 Fork-3 alternative, deferred to its own item).
//
// Ratchet (#763 Fork 2 = A — warn → enforce). Every route is warn-only by default: a violation is reported
// (console.warn + a test annotation) but does NOT fail the build. Flip a route to build-blocking by setting
// `enforce: true` once it is green, or flip the whole lane at once with A11Y_ENFORCE=1. The restriction is
// earned per-route as each goes clean, never imposed on day one (most-permissive default).

export interface GatedRoute {
  /** Path on the WE-docs site, hit via the Vite dev server (:3000, which proxies /…/ → 11ty :8080). */
  path: string;
  /** When true, axe violations on this route fail the build. Default false = warn-only. */
  enforce?: boolean;
}

/** WCAG tag set the gate asserts against (WCAG 2.0 + 2.1, levels A + AA). */
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const;

/** Curated set of stable WE-docs catalog index surfaces (the top-of-funnel entry pages).
 *
 * 9 of 10 routes cleaned and flipped to enforce in #793 (the warn→enforce ratchet's first big rung): the
 * site-wide color-contrast violations — slate-500 muted text, indigo-500 links/badges, the One-Dark
 * inline-code red, and slate-400 resolved-child text — were remediated at the theme-token level
 * (`src/css/style.css`, `src/css/prism-theme.css`), so these go build-blocking. `/backlog/` was the last
 * route held at warn-only (its remaining hard-coded-hex fixes lived in `src/backlog.njk`); #805 flipped it
 * once those slate-600 fixes landed and `/backlog/` measured clean under axe — all 10 routes now enforce.
 * A regression on any enforced route hard-fails. */
export const GATED_ROUTES: GatedRoute[] = [
  { path: '/', enforce: true },
  { path: '/intents/', enforce: true },
  { path: '/blocks/', enforce: true },
  { path: '/protocols/', enforce: true },
  { path: '/adapters/', enforce: true },
  { path: '/capabilities/', enforce: true },
  { path: '/demos/', enforce: true },
  { path: '/governance/', enforce: true },
  { path: '/research/', enforce: true },
  { path: '/backlog/', enforce: true }, // #805: backlog.njk slate-600 fixes landed + measures clean under axe
];
