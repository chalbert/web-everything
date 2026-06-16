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

/** Curated set of stable WE-docs catalog index surfaces (the top-of-funnel entry pages). */
export const GATED_ROUTES: GatedRoute[] = [
  { path: '/' },
  { path: '/intents/' },
  { path: '/blocks/' },
  { path: '/protocols/' },
  { path: '/adapters/' },
  { path: '/capabilities/' },
  { path: '/demos/' },
  { path: '/governance/' },
  { path: '/research/' },
  { path: '/backlog/' },
];
