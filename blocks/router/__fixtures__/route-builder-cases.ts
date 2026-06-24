/**
 * webrouting route-map BUILDER — foundational conformance vectors (#1736).
 *
 * Each case pairs a parsed-route-definition input (the serializable subset `parseRouteDefinitions` produces;
 * the non-serializable `pattern`/`template` are intentionally absent — the builder never reads them) with
 * the expected derived {@link RouteMap}. These pin the faithful-derivation rules
 * (docs/agent/platform-decisions.md#faithful-derivation-exclude-not-fabricate): drop the non-serializable
 * fields, keep source order, never fabricate a missing optional, normalize `isErrorBoundary` to `true`-only.
 */
import type { RouteMap } from '../route-map';

/** The serializable input fields the builder reads (a structural subset of `RouteDefinition`). */
export interface BuilderInputEntry {
  path: string;
  guard?: string;
  guardLeave?: string;
  loader?: string;
  outlet?: string;
  isErrorBoundary?: boolean;
}

export interface RouteBuilderCase {
  id: string;
  title: string;
  base?: string;
  input: BuilderInputEntry[];
  expected: RouteMap;
}

export const routeBuilderCases: RouteBuilderCase[] = [
  {
    id: 'flat-order-preserved',
    title: '1 · Flat table — source order preserved, all fields projected',
    input: [
      { path: '/', loader: 'home' },
      { path: '/users/:id', guard: 'auth', loader: 'user', outlet: 'detail' },
      { path: '/*', isErrorBoundary: true },
    ],
    expected: {
      routes: [
        { path: '/', loader: 'home' },
        { path: '/users/:id', guard: 'auth', loader: 'user', outlet: 'detail' },
        { path: '/*', isErrorBoundary: true },
      ],
    },
  },
  {
    id: 'optional-absent-not-fabricated',
    title: '2 · A bare path projects to a bare entry — optionals are never fabricated',
    input: [{ path: '/about' }],
    expected: { routes: [{ path: '/about' }] },
  },
  {
    id: 'error-boundary-normalized',
    title: '3 · isErrorBoundary:false is dropped (normalized to true-only)',
    input: [{ path: '/x', isErrorBoundary: false }],
    expected: { routes: [{ path: '/x' }] },
  },
  {
    id: 'base-recorded',
    title: '4 · A base path is recorded on the map',
    base: '/app',
    input: [{ path: '/app/orders/:orderId', guardLeave: 'confirmExit' }],
    expected: { base: '/app', routes: [{ path: '/app/orders/:orderId', guardLeave: 'confirmExit' }] },
  },
  {
    id: 'empty',
    title: '5 · An empty definition list yields an empty (valid) map',
    input: [],
    expected: { routes: [] },
  },
];
