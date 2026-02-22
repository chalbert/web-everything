/**
 * @file blocks/router/types.ts
 * @description Shared types and helpers for the Router block.
 *
 * All interfaces mirror the design doc in router.njk.
 * Helpers parse <template route="..."> elements and match URLs.
 */

// ---------------------------------------------------------------------------
// Context types
// ---------------------------------------------------------------------------

/**
 * Route context provided to matched route content.
 * Available as @route in expressions.
 * Injector key: customContexts:route
 */
export interface RouteContext {
  /** Matched URL pattern parameters (e.g., { id: "123" }) */
  params: Record<string, string>;
  /** Loader result data (undefined until loader resolves) */
  data: unknown;
  /** Loader error (null unless loader throws) */
  error: Error | null;
  /** Matched pathname */
  path: string;
  /** Parsed search parameters */
  query: URLSearchParams;
  /** URL hash without # */
  hash: string;
  /** Navigation state passed via navigate() options */
  state: unknown;
}

/**
 * Navigation target passed to guard and loader functions.
 * Represents one side of a navigation (the "from" or "to").
 */
export interface RouteNavigationTarget {
  /** Full destination URL */
  url: URL;
  /** Matched pathname */
  path: string;
  /** Extracted URL pattern parameters */
  params: Record<string, string>;
  /** Parsed search parameters */
  query: URLSearchParams;
  /** URL hash without # */
  hash: string;
  /** Navigation type from Navigation API */
  navigationType: 'push' | 'replace' | 'traverse' | 'reload';
}

// ---------------------------------------------------------------------------
// Guard types
// ---------------------------------------------------------------------------

/**
 * Guard function result.
 * - true: allow navigation
 * - false: cancel navigation
 * - string: redirect to this path
 */
export type RouteGuardResult = boolean | string;

/**
 * Guard function signature. Provided via customContexts:routeGuard.
 * Used for both canActivate (route:guard) and canDeactivate (route:guard:leave).
 *
 * @param to - The route being navigated to
 * @param from - The route being navigated from (null on initial load)
 * @returns Decision to allow, cancel, or redirect. May be async.
 *
 * @example
 * ```typescript
 * const requireAuth: RouteGuardFn = (to, from) => {
 *   if (!auth.isLoggedIn) return '/login';
 *   return true;
 * };
 * ```
 */
export type RouteGuardFn = (
  to: RouteNavigationTarget,
  from: RouteNavigationTarget | null,
) => RouteGuardResult | Promise<RouteGuardResult>;

// ---------------------------------------------------------------------------
// Loader types
// ---------------------------------------------------------------------------

/**
 * Parameters passed to a loader function.
 */
export interface RouteLoaderParams {
  /** Matched URL pattern parameters */
  params: Record<string, string>;
  /** Parsed search parameters */
  query: URLSearchParams;
  /**
   * AbortSignal from the Navigation API.
   * Aborted automatically if a new navigation supersedes this one.
   * Pass to fetch() and other abortable APIs.
   */
  signal: AbortSignal;
}

/**
 * Loader function signature. Provided via customContexts:routeLoader.
 * Called before route content is stamped. Result is available as @route.data.
 * If the loader throws, the error is available as @route.error.
 *
 * @example
 * ```typescript
 * const loadUser: RouteLoaderFn = async ({ params, signal }) => {
 *   const res = await fetch(`/api/users/${params.id}`, { signal });
 *   if (!res.ok) throw new Error('User not found');
 *   return res.json();
 * };
 * ```
 */
export type RouteLoaderFn = (params: RouteLoaderParams) => Promise<unknown>;

// ---------------------------------------------------------------------------
// Route definition
// ---------------------------------------------------------------------------

/**
 * Parsed route definition. Built by <route-view> from its child
 * <template> elements and their plain HTML attributes.
 */
export interface RouteDefinition {
  /** Compiled URLPattern from the route attribute value */
  pattern: URLPattern;
  /** The raw route pattern string (e.g. "/users/:id") */
  path: string;
  /** Source <template> element */
  template: HTMLTemplateElement;
  /** canActivate guard name (from route:guard attr), resolved from @routeGuard context */
  guard?: string;
  /** canDeactivate guard name (from route:guard:leave attr), resolved from @routeGuard context */
  guardLeave?: string;
  /** Loader function name (from route:loader attr), resolved from @routeLoader context */
  loader?: string;
  /** Target outlet name (from route:outlet attr). undefined = primary (in-place) */
  outlet?: string;
  /** Whether this template is an error boundary (has route:error attr) */
  isErrorBoundary: boolean;
}

/**
 * A matched route at runtime: a definition plus the extracted
 * parameters from the current URL.
 */
export interface MatchedRoute {
  definition: RouteDefinition;
  params: Record<string, string>;
  url: URL;
}

// ---------------------------------------------------------------------------
// Navigation result
// ---------------------------------------------------------------------------

/**
 * Result of programmatic navigation via RouteViewElement.navigate().
 * Wraps the Navigation API's NavigationResult.
 */
export interface NavigationResult {
  /** Resolves when the URL has committed (updated in the address bar) */
  committed: Promise<void>;
  /** Resolves when the navigation handler has completed (loaders done, content stamped) */
  finished: Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse child <template route="..."> elements into RouteDefinition[].
 *
 * Reads plain HTML attributes on each template:
 *   route            — URLPattern path (required)
 *   route:guard      — canActivate guard name
 *   route:guard:leave — canDeactivate guard name
 *   route:loader     — loader function name
 *   route:error      — marks template as error boundary (boolean attr)
 *   route:outlet     — target outlet name
 *
 * @param container - The element whose child templates are parsed
 * @param base - Optional base path prepended to all patterns
 * @returns Ordered array of route definitions
 */
export function parseRouteDefinitions(
  container: HTMLElement,
  base: string = '',
): RouteDefinition[] {
  const templates = container.querySelectorAll<HTMLTemplateElement>(
    'template[route]',
  );
  const definitions: RouteDefinition[] = [];

  for (const template of templates) {
    const routeAttr = template.getAttribute('route');
    if (!routeAttr) continue;

    const fullPath = normalizePath(base + routeAttr);

    let pattern: URLPattern;
    try {
      pattern = new URLPattern({ pathname: fullPath });
    } catch {
      console.error(
        `[Router] Invalid route pattern: "${routeAttr}" (resolved: "${fullPath}")`,
      );
      continue;
    }

    definitions.push({
      pattern,
      path: fullPath,
      template,
      guard: template.getAttribute('route:guard') ?? undefined,
      guardLeave: template.getAttribute('route:guard:leave') ?? undefined,
      loader: template.getAttribute('route:loader') ?? undefined,
      outlet: template.getAttribute('route:outlet') ?? undefined,
      isErrorBoundary: template.hasAttribute('route:error'),
    });
  }

  return definitions;
}

/**
 * Match a URL against an ordered list of route definitions.
 * Returns the first match with extracted params, skipping error-boundary
 * templates (those are resolved separately).
 *
 * @param url - The URL to match
 * @param routes - Route definitions to test (in order)
 * @returns The first matching route with params, or null
 */
export function matchRoute(
  url: URL,
  routes: RouteDefinition[],
): MatchedRoute | null {
  for (const definition of routes) {
    // Skip error boundary templates — they match the same pattern
    // but are used only when the loader throws.
    if (definition.isErrorBoundary) continue;

    const result = definition.pattern.exec({ pathname: url.pathname });
    if (result) {
      const groups = result.pathname.groups as Record<string, string>;
      // Filter out undefined values from optional params
      const params: Record<string, string> = {};
      for (const [key, value] of Object.entries(groups)) {
        if (value !== undefined) {
          params[key] = value;
        }
      }
      return { definition, params, url };
    }
  }
  return null;
}

/**
 * Find ALL matching route definitions for a URL, including
 * outlet-specific templates. Returns the primary match plus any
 * additional templates targeting named outlets.
 *
 * @param url - The URL to match
 * @param routes - Route definitions to test
 * @returns Array of matched routes (primary first, then outlet-specific)
 */
export function matchAllRoutes(
  url: URL,
  routes: RouteDefinition[],
): MatchedRoute[] {
  const matches: MatchedRoute[] = [];

  for (const definition of routes) {
    if (definition.isErrorBoundary) continue;

    const result = definition.pattern.exec({ pathname: url.pathname });
    if (result) {
      const groups = result.pathname.groups as Record<string, string>;
      const params: Record<string, string> = {};
      for (const [key, value] of Object.entries(groups)) {
        if (value !== undefined) {
          params[key] = value;
        }
      }
      matches.push({ definition, params, url });
    }
  }

  return matches;
}

/**
 * Find the error boundary template for a given route pattern.
 * An error boundary is a <template> with the same route pattern
 * AND the route:error attribute.
 *
 * @param path - The route pattern to find the error boundary for
 * @param routes - All route definitions
 * @returns The error boundary definition, or undefined
 */
export function findErrorBoundary(
  path: string,
  routes: RouteDefinition[],
): RouteDefinition | undefined {
  return routes.find(
    (def) => def.isErrorBoundary && def.path === path,
  );
}

/**
 * Build a RouteNavigationTarget from a MatchedRoute and navigation type.
 */
export function buildNavigationTarget(
  matched: MatchedRoute,
  navigationType: RouteNavigationTarget['navigationType'],
): RouteNavigationTarget {
  return {
    url: matched.url,
    path: matched.url.pathname,
    params: matched.params,
    query: new URLSearchParams(matched.url.search),
    hash: matched.url.hash.slice(1),
    navigationType,
  };
}

/**
 * Build a RouteContext from a MatchedRoute, loader data, and error.
 */
export function buildRouteContext(
  matched: MatchedRoute,
  data: unknown = undefined,
  error: Error | null = null,
  state: unknown = null,
): RouteContext {
  return {
    params: matched.params,
    data,
    error,
    path: matched.url.pathname,
    query: new URLSearchParams(matched.url.search),
    hash: matched.url.hash.slice(1),
    state,
  };
}

// ---------------------------------------------------------------------------
// Internal utilities
// ---------------------------------------------------------------------------

/**
 * Normalize a path: collapse double slashes, ensure leading slash.
 */
function normalizePath(path: string): string {
  // Collapse double slashes
  let normalized = path.replace(/\/+/g, '/');
  // Ensure leading slash
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  // Remove trailing slash (except for root)
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}
