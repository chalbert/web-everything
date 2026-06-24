/**
 * @file blocks/router/route-map.ts
 * @description The webrouting **serializable route-map projection** — the internal WE schema ratified in
 * #1685 (codified at docs/agent/platform-decisions.md#single-authoring-sot-derived-projection).
 *
 * The declarative `<template route>` DOM is the canonical authoring source-of-truth; this is its
 * *derived* serializable projection for non-DOM consumers (sitemap, prerender, config tooling) that
 * cannot read the route table without a running DOM. The projection is a 1:1 drop of the two
 * non-serializable fields on {@link RouteDefinition} — `pattern: URLPattern` + `template:
 * HTMLTemplateElement` — keeping exactly the fields #1685 enumerated: `path`, `guard`, `guardLeave`,
 * `loader`, `outlet`, `isErrorBoundary`.
 *
 * Scope (slice B, #1721): the **schema** (these types) + a structural **validator** + conformance
 * **vectors** (statically-authored route maps in `__fixtures__/route-map-cases.ts`). The derived-map
 * *builder* (DOM `RouteDefinition[]` → `RouteMap`) is intentionally NOT here — per the
 * build-only-when-a-consumer-exists rule it folds into the first consuming slice (#1688 sitemap).
 *
 * `path` is the URLPattern pathname *template* (e.g. `/users/:id`), never a concrete URL, and URLPattern
 * (Baseline 2025) stays the grammar (#1685 forced invariant). One conforming router exists today
 * (`@frontierui/blocks/router`), so this is an internal schema + vectors — a `CustomRouteMap` protocol
 * is minted only on a second independent impl (protocol temporal rule).
 */

/**
 * One entry in the serializable route-map projection — the derived, non-DOM form of a single
 * {@link RouteDefinition}. Carries only the serializable fields (drops `pattern` + `template`).
 */
export interface RouteMapEntry {
  /** The URLPattern pathname *template* (e.g. `/users/:id`), never a concrete URL. */
  path: string;
  /** canActivate guard name (from `route:guard`), resolved from the `@routeGuard` context. */
  guard?: string;
  /** canDeactivate guard name (from `route:guard:leave`), resolved from the `@routeGuard` context. */
  guardLeave?: string;
  /** Loader function name (from `route:loader`), resolved from the `@routeLoader` context. */
  loader?: string;
  /** Target outlet name (from `route:outlet`); omitted = the primary (in-place) outlet. */
  outlet?: string;
  /** Whether this entry is the error boundary (`route:error`). Omitted is equivalent to `false`. */
  isErrorBoundary?: boolean;
}

/**
 * The serializable route map — an ordered projection of a `<we-route-view>`'s route table. Order is
 * significant (first match wins), exactly as `parseRouteDefinitions` returns it. A `base` mirrors the
 * router's optional base-path prefix; when present, each entry's `path` is the already-normalized full
 * path (the projection is post-normalization, so consumers read final paths).
 */
export interface RouteMap {
  /** Optional base path the route table was parsed under (informational; paths are pre-resolved). */
  base?: string;
  /** Ordered route entries — first-match-wins, mirroring the authoring `<template route>` order. */
  routes: RouteMapEntry[];
}

/** The serializable fields the builder projects off a parsed route definition (drops `pattern`/`template`). */
type SerializableRouteFields = Pick<
  RouteMapEntry,
  'path' | 'guard' | 'guardLeave' | 'loader' | 'outlet' | 'isErrorBoundary'
>;

/**
 * The DOM→map **builder** (#1736) — the faithful derivation #1721 parked for the first consuming slice.
 * Projects a parsed `RouteDefinition[]` (from `parseRouteDefinitions`, `./types`) into the serializable
 * {@link RouteMap}: it **drops** the two non-serializable fields (`pattern: URLPattern`, `template:
 * HTMLTemplateElement`) and keeps exactly the #1685 serializable fields, in source order.
 *
 * It is a **faithful derivation** (docs/agent/platform-decisions.md#faithful-derivation-exclude-not-fabricate):
 * it excludes what it cannot serialize and never fabricates a missing value. The DOM-walking parse that
 * *produces* the `RouteDefinition[]` is the browser-runtime impl (FUI); this projection is pure data — it
 * reads only the already-parsed serializable fields, so it needs no DOM and is the WE-owned contract every
 * emitter reads.
 *
 * @param definitions parsed route definitions (the serializable subset is read; `pattern`/`template` ignored)
 * @param base        optional base path the definitions were parsed under (recorded; paths are pre-resolved)
 */
export function buildRouteMap(definitions: readonly SerializableRouteFields[], base?: string): RouteMap {
  const routes: RouteMapEntry[] = definitions.map((d) => {
    const entry: RouteMapEntry = { path: d.path };
    if (d.guard !== undefined) entry.guard = d.guard;
    if (d.guardLeave !== undefined) entry.guardLeave = d.guardLeave;
    if (d.loader !== undefined) entry.loader = d.loader;
    if (d.outlet !== undefined) entry.outlet = d.outlet;
    if (d.isErrorBoundary) entry.isErrorBoundary = true;
    return entry;
  });
  return base !== undefined ? { base, routes } : { routes };
}

/** The fields a {@link RouteMapEntry} may carry — used to reject unknown keys (e.g. a leaked `pattern`). */
const ENTRY_KEYS = new Set([
  'path',
  'guard',
  'guardLeave',
  'loader',
  'outlet',
  'isErrorBoundary',
]);

const OPTIONAL_STRING_KEYS = ['guard', 'guardLeave', 'loader', 'outlet'] as const;

/**
 * Structural validator for the route-map projection — an author/validate script (no runtime build).
 * Returns the list of conformance violations; an empty list means the value conforms to {@link RouteMap}.
 *
 * Enforces the #1685 invariants a serializable projection must hold:
 *  - it is a `{ routes: RouteMapEntry[] }` object (with an optional string `base`);
 *  - every entry has a non-empty string `path` that is a *template*, not a concrete URL
 *    (no scheme/authority — a `://` or a leading `http` is a leaked absolute URL);
 *  - the optional `guard` / `guardLeave` / `loader` / `outlet` are strings when present;
 *  - `isErrorBoundary` is a boolean when present;
 *  - no entry carries a non-serializable field (a leaked `pattern` / `template`) or any unknown key.
 */
export function validateRouteMap(value: unknown): string[] {
  const errors: string[] = [];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return ['route map must be an object of shape { base?: string, routes: RouteMapEntry[] }'];
  }
  const map = value as Record<string, unknown>;
  if ('base' in map && typeof map.base !== 'string') {
    errors.push('`base` must be a string when present');
  }
  if (!Array.isArray(map.routes)) {
    errors.push('`routes` must be an array');
    return errors;
  }
  map.routes.forEach((raw, i) => {
    const at = `routes[${i}]`;
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      errors.push(`${at} must be a RouteMapEntry object`);
      return;
    }
    const entry = raw as Record<string, unknown>;
    for (const key of Object.keys(entry)) {
      if (!ENTRY_KEYS.has(key)) {
        // A leaked non-serializable field is the headline failure mode the projection exists to prevent.
        const leak =
          key === 'pattern' || key === 'template'
            ? ` (non-serializable field dropped by the projection)`
            : '';
        errors.push(`${at} has unknown key \`${key}\`${leak}`);
      }
    }
    if (typeof entry.path !== 'string' || entry.path.length === 0) {
      errors.push(`${at}.path must be a non-empty string`);
    } else if (/:\/\/|^https?:/i.test(entry.path)) {
      errors.push(`${at}.path must be a URLPattern template, not a concrete URL (got "${entry.path}")`);
    }
    for (const key of OPTIONAL_STRING_KEYS) {
      if (key in entry && typeof entry[key] !== 'string') {
        errors.push(`${at}.${key} must be a string when present`);
      }
    }
    if ('isErrorBoundary' in entry && typeof entry.isErrorBoundary !== 'boolean') {
      errors.push(`${at}.isErrorBoundary must be a boolean when present`);
    }
  });
  return errors;
}

/** Convenience boolean form of {@link validateRouteMap}. */
export function isRouteMap(value: unknown): value is RouteMap {
  return validateRouteMap(value).length === 0;
}
