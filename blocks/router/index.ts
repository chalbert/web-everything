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

// Serializable route-map projection (the #1685 derived schema — types + validator + the #1736 builder)
export type { RouteMapEntry, RouteMap } from './route-map';
export { validateRouteMap, isRouteMap, buildRouteMap } from './route-map';

// Default-less pluggable route-map emitter registry (#1736)
export type { RouteMapEmitter } from './route-emitters';
export { RouteEmitterRegistry, UnknownRouteEmitterError } from './route-emitters';

// URL-as-state declaration + coordinator seam contract (#1728, type-only)
export type {
  UrlStatePersistence,
  UrlCodec,
  UrlStateSlice,
  UrlStateCoordinator,
} from './url-state';

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

// Sitemap.xml emitter — a concrete RouteMapEmitter over the route-map projection (#1737)
export { createSitemapEmitter, isParametricPath } from './sitemap-emitter';
export type { SitemapEmitterOptions, SitemapResult } from './sitemap-emitter';

// IA nav-tree emitter — realizes the navigation-intent structure axis from the route-map (#1738)
export { createNavTreeEmitter } from './nav-tree-emitter';
export type { NavStructure, NavTreeNode, NavTreeResult, NavTreeEmitterOptions } from './nav-tree-emitter';

// Prerender manifest emitter — the static-route pre-render list over the route-map projection (#1739)
export { createPrerenderEmitter } from './prerender-emitter';
export type { PrerenderManifest } from './prerender-emitter';

// Speculation Rules emitter — native prefetch/prerender rules over the route-map projection (#1740)
export { createSpeculationRulesEmitter } from './speculation-rules-emitter';
export type {
  SpeculationAction,
  SpeculationEagerness,
  SpeculationRule,
  SpeculationRules,
  SpeculationRulesResult,
  SpeculationRulesEmitterOptions,
} from './speculation-rules-emitter';
