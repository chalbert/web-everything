/**
 * @file blocks/router/param-source.ts
 * @description The webrouting **dynamic-route param-source hook** (#1741, epic #1684) — the opt-in
 * enumeration contract from #1688 Fork 1(a). Concrete-URL emitters (sitemap #1737, prerender #1739) ship
 * **exclude-by-default**: a parametric route (`/users/:id`) has no concrete URL and is never fabricated.
 * This module layers the capability they opt into — an author-supplied, `generateStaticParams`-shaped
 * per-route hook that supplies the **real** values (`/users/:id` + `[{id:'1'},{id:'2'}]` → `/users/1`,
 * `/users/2`), so the values come from a real source, never invented.
 *
 * It is **additive and emitter-agnostic**: {@link expandRouteMap} returns a NEW {@link RouteMap} with each
 * sourced parametric route replaced by its concrete entries, which any concrete-URL emitter then consumes
 * unchanged (a now-static path passes the emitter's `isParametricPath` check and is included). A parametric
 * route with **no** source stays parametric in the returned map — so the emitter still excludes it — and is
 * surfaced in `skipped` + the build-time `notice` (ergonomic; it changes no artifact,
 * #faithful-derivation-exclude-not-fabricate).
 *
 * Pure data (RouteMap + sources → RouteMap); WE owns the contract + conformance vectors. The build that
 * actually invokes the author's hook rides downstream to FUI.
 */
import type { RouteMap, RouteMapEntry } from './route-map';
import { isParametricPath } from './sitemap-emitter';

/** One concrete parameter set for a parametric route — `generateStaticParams`-shaped (`{ id: '1' }`). */
export type RouteParams = Record<string, string>;

/**
 * The author-supplied param source for a single route — given the route's path **template**, returns the
 * concrete parameter sets to enumerate. `generateStaticParams`-shaped (Next.js/Remix prior art). An empty
 * array means "this route has a source but currently no values" — it enumerates to nothing, not a fabrication.
 */
export type ParamSource = (path: string) => RouteParams[];

/** A map of route path **template** → its param source. A route absent here has no source (excluded). */
export type ParamSourceMap = Record<string, ParamSource>;

/** The result of expanding a route map against its param sources. */
export interface ParamExpansion {
  /** The new route map — sourced parametric routes replaced by their concrete entries, in route order. */
  readonly map: RouteMap;
  /** Which parametric templates expanded to which concrete paths (the enumeration record). */
  readonly expanded: ReadonlyArray<{ readonly from: string; readonly to: readonly string[] }>;
  /** Parametric routes with no source — left parametric (still excluded by emitters), surfaced here. */
  readonly skipped: readonly string[];
  /** A human-readable build-time skip notice naming the un-sourced parametric routes. Empty when none. */
  readonly notice: string;
}

/**
 * Substitute a concrete parameter set into a URLPattern path **template**. Replaces `:name` named groups and
 * a `*` wildcard (keyed `'*'`). A param the set does not supply is left as the token — so the result stays
 * parametric and is never fabricated into a partial URL.
 */
export function substituteParams(template: string, params: RouteParams): string {
  let path = template.replace(/:([A-Za-z0-9_]+)/g, (whole, key: string) =>
    key in params ? encodeURIComponent(params[key]) : whole,
  );
  if ('*' in params) path = path.replace(/\*/g, params['*']);
  return path;
}

/**
 * Expand a {@link RouteMap} against its {@link ParamSourceMap}. Each parametric route **with** a source is
 * replaced by one concrete entry per supplied parameter set (other fields preserved); each parametric route
 * **without** a source is kept as-is and surfaced in `skipped` + `notice`. Static routes pass through.
 */
export function expandRouteMap(map: RouteMap, sources: ParamSourceMap = {}): ParamExpansion {
  const routes: RouteMapEntry[] = [];
  const expanded: { from: string; to: string[] }[] = [];
  const skipped: string[] = [];

  for (const route of map.routes) {
    if (!isParametricPath(route.path)) {
      routes.push(route);
      continue;
    }
    const source = sources[route.path];
    if (!source) {
      routes.push(route); // no source → stays parametric, emitters still exclude it
      skipped.push(route.path);
      continue;
    }
    const concrete: string[] = [];
    for (const params of source(route.path)) {
      const path = substituteParams(route.path, params);
      // Only accept a fully-resolved concrete path; a still-parametric result is not fabricated forward.
      if (!isParametricPath(path)) {
        routes.push({ ...route, path });
        concrete.push(path);
      }
    }
    if (concrete.length) expanded.push({ from: route.path, to: concrete });
    else skipped.push(route.path); // a source that yielded nothing concrete is still a skip
  }

  const notice = skipped.length
    ? `param-source: ${skipped.length} parametric route(s) without a concrete source: ${skipped.join(', ')}. ` +
      `Provide a generateStaticParams-shaped source to enumerate them.`
    : '';
  return { map: { ...map, routes }, expanded, skipped, notice };
}
