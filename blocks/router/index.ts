/**
 * @file blocks/router/index.ts
 * @description Public API for the Router block.
 */

// Elements
export { default as RouteViewElement } from './elements/RouteViewElement';
export { default as RouteOutletElement } from './elements/RouteOutletElement';

// Behaviors
export { default as RouteLinkBehavior } from './behaviors/RouteLinkBehavior';
export { default as RoutePrefetchBehavior } from './behaviors/RoutePrefetchBehavior';

// Registration
export { registerRouter } from './registerRouter';

// Types
export type {
  RouteContext,
  RouteNavigationTarget,
  RouteGuardFn,
  RouteGuardResult,
  RouteLoaderFn,
  RouteLoaderParams,
  RouteDefinition,
  MatchedRoute,
  NavigationResult,
} from './types';

// Helpers (for advanced use)
export {
  parseRouteDefinitions,
  matchRoute,
  matchAllRoutes,
  findErrorBoundary,
  buildNavigationTarget,
  buildRouteContext,
} from './types';
