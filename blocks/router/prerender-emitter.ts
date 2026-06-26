/**
 * @file blocks/router/prerender-emitter.ts
 * @description The webrouting **prerender path-manifest emitter** (#1739, epic #1684) — a concrete
 * {@link RouteMapEmitter} that derives the list of routes to statically pre-render from the canonical
 * {@link RouteMap} projection (#1721). A facade over `routes[].path`.
 *
 * Faithful derivation (docs/agent/platform-decisions.md#faithful-derivation-exclude-not-fabricate, #1688
 * Fork 1a): a **parametric** route (`/users/:id`, a wildcard `/*`) has no concrete URL without an external
 * value source, so it is **EXCLUDED by default and never fabricated** — pre-rendering a literal `:id` or a
 * synthetic `/users/0` would emit a broken page. Excluded routes are **surfaced** in `skipped` plus a
 * human-readable build-time `notice` (the ergonomic affordance, #1737's pattern), not silently dropped.
 * Concrete dynamic paths arrive only via the opt-in author-supplied **param-source hook** (the sibling
 * slice #1741), or a crawl-discovery variant that consumes the pattern — neither is invented here.
 * Error-boundary routes are excluded too — a catch-all boundary is not a concrete pre-render target.
 *
 * Pure data (RouteMap → string[] manifest); WE owns the emitter + its conformance vectors. The build that
 * consumes the manifest rides downstream to FUI.
 */
import type { RouteMap } from './route-map';
import type { RouteMapEmitter } from './route-emitters';
import { isParametricPath } from './sitemap-emitter';

/** The prerender emitter's artifact — the static manifest, the surfaced exclusions, and the skip notice. */
export interface PrerenderManifest {
  /** The static route paths to statically pre-render, in route order. */
  readonly manifest: readonly string[];
  /** The parametric / error-boundary paths excluded by default — surfaced, never fabricated. */
  readonly skipped: readonly string[];
  /**
   * A human-readable build-time notice naming the skipped parametric routes and pointing at the param-source
   * hook (#1741) that would supply their concrete paths. Empty string when nothing was skipped.
   */
  readonly notice: string;
}

/**
 * Build the prerender manifest emitter. Emits one manifest entry per **static** route; excludes parametric +
 * error-boundary routes by default (surfaced in `skipped` + `notice`).
 */
export function createPrerenderEmitter(): RouteMapEmitter<PrerenderManifest> {
  return {
    id: 'prerender',
    emit(map: RouteMap): PrerenderManifest {
      const manifest: string[] = [];
      const skipped: string[] = [];
      for (const route of map.routes) {
        if (route.isErrorBoundary || isParametricPath(route.path)) skipped.push(route.path);
        else manifest.push(route.path);
      }
      const notice = skipped.length
        ? `prerender: ${skipped.length} parametric/boundary route(s) excluded (no concrete URL): ` +
          `${skipped.join(', ')}. Supply concrete paths via the param-source hook (#1741) to pre-render them.`
        : '';
      return { manifest, skipped, notice };
    },
  };
}
