// Auto-derived route set for the rendered-site a11y gate (#847, per #774 Fork-1=C + Fork-2=A).
//
// Replaces the hand-maintained route-allowlist.ts (#770): instead of a list someone edits when a
// surface ships, the gate reads /sitemap.xml (#846 — 11ty's complete page knowledge over
// collections.all) and filters it to **scope-C** — every index surface + one representative detail
// page per path-prefix group. One template per collection (`*-pages.njk`) means a detail-page
// violation is almost always a shared-template bug, so a single sample per group catches it at ~1%
// of the all-pages cost. Mechanism is pa11y-ci's `--sitemap` posture: consume the published sitemaps.org
// artifact, never reach into build internals or re-derive permalinks (#774 rejected globbing `_site`
// and reconstructing from `_data`).
//
// FORCED INVARIANT (#774, not a fork): the enforce posture #793/#805 earned is preserved by an explicit
// ENFORCED_ROUTES set, decoupled from the derived set. A newly-derived route enters **warn-only**
// (most-permissive default); it is promoted per-route as it goes green. Resetting every route to
// warn-only would silently un-earn the 10 build-blocking routes — the broken alternative.

import { execSync } from 'node:child_process';

/** WCAG tag set the gate asserts against (WCAG 2.0 + 2.1, levels A + AA). */
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const;

/**
 * The build-blocking route set — seeded with the 10 routes #793/#805 cleaned and flipped to enforce
 * (all 10 catalog index surfaces). A derived route is build-blocking iff it appears here; everything
 * else auto-derivation surfaces is warn-only until individually promoted. (#774 forced invariant.)
 */
export const ENFORCED_ROUTES: ReadonlySet<string> = new Set([
  '/',
  '/intents/',
  '/blocks/',
  '/protocols/',
  '/adapters/',
  '/capabilities/',
  '/demos/',
  '/governance/',
  '/research/',
  '/backlog/',
]);

const withSlash = (p: string): string => (p.endsWith('/') ? p : `${p}/`);
const segments = (p: string): string[] => p.replace(/^\/|\/$/g, '').split('/').filter(Boolean);

/**
 * Scope-C filter over a flat list of sitemap pathnames: keep **every index surface** (root + any
 * single-segment page) plus **the lexicographically-first detail page per path-prefix group** (one
 * representative sample per collection-template, keyed by first path segment). Pure + deterministic
 * (sorted output, stable "first" pick) so the gate's route set can't drift run-to-run.
 */
export function deriveScopeCRoutes(paths: string[]): string[] {
  const indexSurfaces = new Set<string>();
  const firstDetailByGroup = new Map<string, string>();

  for (const raw of paths) {
    if (!raw || !raw.startsWith('/')) continue;
    const path = withSlash(raw);
    const segs = segments(path);
    if (segs.length <= 1) {
      indexSurfaces.add(path); // '/', '/intents/', '/mission/', …
    } else {
      const group = segs[0];
      const current = firstDetailByGroup.get(group);
      if (current === undefined || path < current) firstDetailByGroup.set(group, path);
    }
  }

  return [...new Set([...indexSurfaces, ...firstDetailByGroup.values()])].sort();
}

/**
 * Fetch /sitemap.xml from the running dev origin and return its `<loc>` pathnames. Uses the same
 * HTTP origin the Playwright lane already hits (the dev server is up via playwright.config `webServer`).
 * Returns [] on any failure so the caller can fall back to the enforced seed rather than crash.
 */
export function fetchSitemapPaths(origin = 'http://localhost:8080'): string[] {
  try {
    const xml = execSync(`curl -fsS --max-time 10 ${origin}/sitemap.xml`, { encoding: 'utf8' });
    return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => {
      try {
        return new URL(m[1]).pathname;
      } catch {
        return m[1];
      }
    });
  } catch {
    return [];
  }
}

/**
 * The derived gate route set: scope-C over the live sitemap. If the sitemap can't be fetched (server
 * down at collection), fall back to the enforced seed so the gate still covers the known surfaces
 * rather than silently running zero routes.
 */
export function gatedRoutes(origin?: string): string[] {
  const derived = deriveScopeCRoutes(fetchSitemapPaths(origin));
  return derived.length ? derived : [...ENFORCED_ROUTES];
}
