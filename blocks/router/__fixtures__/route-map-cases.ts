/**
 * webrouting route-map projection — conformance vectors (slice B, #1721).
 *
 * Statically-authored route maps, each paired with the schema invariant it proves. These are the
 * canonical examples a derived-map builder (#1688 sitemap) and any future `CustomRouteMap` adapter
 * must reproduce. They are authored directly in the serializable projection form (NOT derived from a
 * DOM here — the builder is out of scope for this slice), and every `path` is a URLPattern *template*,
 * never a concrete URL.
 *
 * `valid: true` cases must pass `validateRouteMap`; `valid: false` cases must each surface at least one
 * violation (negative vectors that pin the schema's rejections — a leaked non-serializable field, a
 * concrete URL where a template is required, a wrong field type).
 */
import type { RouteMap } from '../route-map';

export interface RouteMapCase {
  id: string;
  title: string;
  /** Whether the map is expected to conform to the schema. */
  valid: boolean;
  /** The route map under test (typed loosely on negative cases so they can carry malformed shapes). */
  map: RouteMap | Record<string, unknown>;
  /** For `valid: false`, a substring expected in at least one reported violation. */
  expectViolation?: string;
}

export const routeMapCases: RouteMapCase[] = [
  {
    id: 'flat-basic',
    title: '1 · Flat route table — the parseRouteDefinitions order is preserved',
    valid: true,
    map: {
      routes: [
        { path: '/', loader: 'home' },
        { path: '/users/:id', guard: 'auth', loader: 'user' },
        { path: '/users/:id/settings', outlet: 'detail' },
        { path: '/*', isErrorBoundary: true },
      ],
    },
  },
  {
    id: 'all-fields',
    title: '2 · Every serializable field present (the full #1685 projection surface)',
    valid: true,
    map: {
      base: '/app',
      routes: [
        {
          path: '/app/orders/:orderId',
          guard: 'auth',
          guardLeave: 'confirmExit',
          loader: 'order',
          outlet: 'main',
          isErrorBoundary: false,
        },
      ],
    },
  },
  {
    id: 'empty-table',
    title: '3 · Empty route table — a view with no routes is a conformant (degenerate) map',
    valid: true,
    map: { routes: [] },
  },
  {
    id: 'leaked-pattern',
    title: '4 · REJECT — a leaked non-serializable `pattern` field (the projection must drop it)',
    valid: false,
    expectViolation: 'pattern',
    map: {
      routes: [{ path: '/users/:id', pattern: '[object URLPattern]' } as unknown as Record<string, unknown>],
    },
  },
  {
    id: 'leaked-template',
    title: '5 · REJECT — a leaked non-serializable `template` field',
    valid: false,
    expectViolation: 'template',
    map: {
      routes: [{ path: '/', template: '<template>' } as unknown as Record<string, unknown>],
    },
  },
  {
    id: 'concrete-url',
    title: '6 · REJECT — a concrete URL where a URLPattern template is required',
    valid: false,
    expectViolation: 'concrete URL',
    map: {
      routes: [{ path: 'https://example.com/users/42' }],
    },
  },
  {
    id: 'missing-path',
    title: '7 · REJECT — an entry with no `path`',
    valid: false,
    expectViolation: 'path must be a non-empty string',
    map: {
      routes: [{ guard: 'auth' } as unknown as Record<string, unknown>],
    },
  },
  {
    id: 'wrong-type',
    title: '8 · REJECT — `isErrorBoundary` carrying a non-boolean',
    valid: false,
    expectViolation: 'isErrorBoundary must be a boolean',
    map: {
      routes: [{ path: '/', isErrorBoundary: 'yes' } as unknown as Record<string, unknown>],
    },
  },
  {
    id: 'routes-not-array',
    title: '9 · REJECT — `routes` is not an array',
    valid: false,
    expectViolation: '`routes` must be an array',
    map: { routes: { '0': { path: '/' } } } as unknown as Record<string, unknown>,
  },
];
