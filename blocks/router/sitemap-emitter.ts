/**
 * @file blocks/router/sitemap-emitter.ts
 * @description The webrouting **sitemap.xml emitter** (#1737, epic #1684) — a concrete
 * {@link RouteMapEmitter} that derives a crawler sitemap (sitemaps.org/0.9 XML) from the canonical
 * {@link RouteMap} projection (#1721). A facade over `routes[].path`: one `<url>` per **static** route.
 *
 * Faithful derivation (docs/agent/platform-decisions.md#faithful-derivation-exclude-not-fabricate, #1688
 * Fork 1a): a **parametric** route (`/users/:id`, a wildcard `/*`) has no concrete URL without an external
 * value source, so it is **EXCLUDED by default and never fabricated** — emitting a literal `:id` or a
 * synthetic `/users/0` is sitemap-invalid + SEO-poisoning. Excluded routes are **surfaced** in `skipped` (the
 * build-time notice), not silently dropped; the notice changes no artifact, so it is an ergonomic affordance,
 * not a third branch. Concrete URLs for parametric routes arrive only via an opt-in author-supplied
 * param-source hook (a sibling slice). Error-boundary routes are excluded too — they are not crawlable URLs.
 *
 * Pure data (RouteMap → XML string); WE owns the emitter + its conformance vectors.
 */
import type { RouteMap } from './route-map';
import type { RouteMapEmitter } from './route-emitters';

export interface SitemapEmitterOptions {
  /** The site origin prepended to each static path, e.g. `https://example.com` (no trailing slash needed). */
  baseUrl: string;
}

/** The sitemap emitter's artifact — the XML plus the included/skipped split (the build-time notice). */
export interface SitemapResult {
  /** The sitemaps.org/0.9 XML document. */
  readonly xml: string;
  /** The static paths emitted as `<url>` entries, in route order. */
  readonly included: readonly string[];
  /** The parametric / error-boundary paths excluded by default — surfaced, never fabricated. */
  readonly skipped: readonly string[];
}

/** A path with no concrete URL — a URLPattern parameter (`:id`), a wildcard (`*`), or a group (`{…}`). */
export function isParametricPath(path: string): boolean {
  return path.includes(':') || path.includes('*') || path.includes('{') || path.includes('(');
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Join an origin + a path with exactly one slash between them. */
function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/**
 * Build the sitemap emitter. Excludes parametric + error-boundary routes by default (surfaced in
 * `skipped`), emits one `<url><loc>` per static route under `baseUrl`.
 */
export function createSitemapEmitter(options: SitemapEmitterOptions): RouteMapEmitter<SitemapResult> {
  const { baseUrl } = options;
  return {
    id: 'sitemap',
    emit(map: RouteMap): SitemapResult {
      const included: string[] = [];
      const skipped: string[] = [];
      for (const route of map.routes) {
        if (route.isErrorBoundary || isParametricPath(route.path)) skipped.push(route.path);
        else included.push(route.path);
      }
      const urls = included
        .map((path) => `  <url><loc>${escapeXml(joinUrl(baseUrl, path))}</loc></url>`)
        .join('\n');
      const body = urls ? `\n${urls}\n` : '\n';
      const xml =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>\n`;
      return { xml, included, skipped };
    },
  };
}
