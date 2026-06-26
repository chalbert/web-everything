/**
 * @file blocks/router/nav-tree-emitter.ts
 * @description The webrouting **IA nav-tree emitter** (#1738, epic #1684) — a concrete
 * {@link RouteMapEmitter} that derives a hierarchical information-architecture nav-tree (nested menu /
 * breadcrumb structure, mirroring `@11ty/eleventy-navigation`) from the canonical {@link RouteMap}
 * projection (#1721). A facade over `routes[].path`.
 *
 * Per #1688 Fork 2(a) it **realizes the Navigation Intent `structure` axis** (we:src/_data/blocks/router.json
 * `intentDimensions.structure`) rather than re-deriving an independent tree — one composed home, no second
 * source of truth for the nav hierarchy. The structure axis vocabulary is the navigation intent's
 * (`we:src/_data/intents/navigation.json`): `hierarchical` (nested tree), `lateral` (flat peers), `linear`
 * (ordered sequence). When a `structure` is supplied the emitter realizes it (`derivedFrom:
 * 'navigation-intent'`); when **none** is declared it falls back to pure path-nesting
 * (`derivedFrom: 'path-nesting-fallback'`, which is the `hierarchical` shape).
 *
 * Faithful derivation (docs/agent/platform-decisions.md#faithful-derivation-exclude-not-fabricate): nesting
 * uses only the **declared** routes as parents — a route nests under the longest declared route whose path
 * segments are a proper prefix of its own; a missing intermediate level is **never fabricated** (the route
 * surfaces as a root instead). Unlike the sitemap emitter, this is **pattern-preserving**: a parametric
 * route (`/users/:id`) is kept in the tree in its URLPattern **template** form — nav menus need no concrete
 * URLs. Only **error-boundary** routes are excluded (a 404 boundary is not a navigable destination); they
 * are surfaced in `skipped`, never silently dropped.
 *
 * Pure data (RouteMap → tree); WE owns the emitter + its conformance vectors. The build/runtime that renders
 * the menu rides downstream to FUI.
 */
import type { RouteMap } from './route-map';
import type { RouteMapEmitter } from './route-emitters';

/** The information-architecture model (the navigation intent's `structure` axis vocabulary). */
export type NavStructure = 'hierarchical' | 'lateral' | 'linear';

/** One node in the derived nav-tree — a navigable route in its template form, plus its nested children. */
export interface NavTreeNode {
  /** The URLPattern pathname *template* (e.g. `/users/:id`), pattern-preserving — never a concrete URL. */
  readonly path: string;
  /** The node's own last path segment, the natural menu label seed (e.g. `:id` for `/users/:id`). */
  readonly segment: string;
  /** Nested child nodes (always empty for the `lateral` / `linear` structures — those are flat). */
  readonly children: NavTreeNode[];
}

/** The nav-tree emitter's artifact — the realized structure, its provenance, the roots, and the exclusions. */
export interface NavTreeResult {
  /** The IA structure this tree realizes. */
  readonly structure: NavStructure;
  /** Whether the structure came from a declared navigation intent or the path-nesting fallback. */
  readonly derivedFrom: 'navigation-intent' | 'path-nesting-fallback';
  /** The root nodes — the top of the menu (for `lateral`/`linear`, every navigable route, in route order). */
  readonly tree: NavTreeNode[];
  /** Routes excluded from the IA — the error-boundary routes (not navigable destinations). */
  readonly skipped: readonly string[];
}

export interface NavTreeEmitterOptions {
  /**
   * The declared navigation-intent `structure` axis value. When supplied, the emitter REALIZES it (no second
   * source of truth). Omit it to fall back to pure path-nesting (the `hierarchical` shape, flagged as a
   * fallback derivation).
   */
  readonly structure?: NavStructure;
}

/** Split a path into its non-empty segments (`/a/b/` → `['a','b']`); the root `/` is `[]`. */
function segmentsOf(path: string): string[] {
  return path.split('/').filter(Boolean);
}

/** Whether `prefix` is a proper segment-prefix of `segs` (strictly shorter, every segment equal). */
function isProperPrefix(prefix: string[], segs: string[]): boolean {
  if (prefix.length === 0 || prefix.length >= segs.length) return false;
  return prefix.every((s, i) => s === segs[i]);
}

/**
 * Build the IA nav-tree emitter. Realizes the supplied `structure` (or path-nests when none is declared),
 * keeps parametric routes in template form, and excludes error-boundary routes (surfaced in `skipped`).
 */
export function createNavTreeEmitter(options: NavTreeEmitterOptions = {}): RouteMapEmitter<NavTreeResult> {
  const structure: NavStructure = options.structure ?? 'hierarchical';
  const derivedFrom = options.structure ? 'navigation-intent' : 'path-nesting-fallback';
  return {
    id: 'nav-tree',
    emit(map: RouteMap): NavTreeResult {
      const skipped: string[] = [];
      const navigable = map.routes.filter((r) => {
        if (r.isErrorBoundary) {
          skipped.push(r.path);
          return false;
        }
        return true;
      });

      // `lateral` (peers) and `linear` (ordered sequence) are flat — every navigable route is a root, in
      // route order; the semantic difference is carried by `structure`, not the shape.
      if (structure !== 'hierarchical') {
        const tree = navigable.map((r) => {
          const segs = segmentsOf(r.path);
          return { path: r.path, segment: segs[segs.length - 1] ?? '/', children: [] as NavTreeNode[] };
        });
        return { structure, derivedFrom, tree, skipped };
      }

      // `hierarchical`: nest each route under the longest DECLARED route that is a proper path-prefix of it
      // (≥1 segment, so the home `/` stays a sibling root rather than a universal parent). A missing
      // intermediate level is never fabricated — such a route surfaces as a root.
      const nodes = navigable.map((r) => {
        const segs = segmentsOf(r.path);
        return { route: r, segs, node: { path: r.path, segment: segs[segs.length - 1] ?? '/', children: [] as NavTreeNode[] } };
      });
      const roots: NavTreeNode[] = [];
      for (const entry of nodes) {
        let parent: (typeof nodes)[number] | undefined;
        for (const candidate of nodes) {
          if (candidate === entry) continue;
          if (!isProperPrefix(candidate.segs, entry.segs)) continue;
          if (!parent || candidate.segs.length > parent.segs.length) parent = candidate;
        }
        if (parent) parent.node.children.push(entry.node);
        else roots.push(entry.node);
      }
      return { structure, derivedFrom, tree: roots, skipped };
    },
  };
}
