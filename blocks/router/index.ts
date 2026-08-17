/**
 * @file blocks/router/index.ts
 * @description The WE-side **webrouting spec surface** — the serializable schemas, the emitter contract +
 * its concrete emitters, and their conformance vectors. Pure data: every export here reads or projects a
 * {@link ./route-map RouteMap}; none of it touches the DOM.
 *
 * There is deliberately **no router runtime here**. Per the #1246 ruling (*WE holds zero implementation*,
 * codified `docs/agent/platform-decisions.md#constellation-placement`) the browser runtime — the
 * `we-route-view` / `we-route-outlet` elements, the `route:link` / `route:prefetch` behaviors, the
 * `<template route>` parse + URLPattern match helpers, and the `registerRouter` entry point — is homed
 * solely in Frontier UI (`@frontierui/blocks/router`, the `implementedBy` this block declares in
 * `we:src/_data/blocks/router.json`). The duplicate WE copy this file used to re-export was sliced out in
 * #3154, closing the #1245 drift surface: with one home there is nothing left to desync.
 */

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

// Dynamic-route param-source hook — opt-in enumeration of parametric routes for concrete-URL emitters (#1741)
export { expandRouteMap, substituteParams } from './param-source';
export type { RouteParams, ParamSource, ParamSourceMap, ParamExpansion } from './param-source';
