/**
 * Default wiring for the source-resolution plane (#575). Builds the registry pre-loaded with the three
 * shipped resolvers in **precedence order** — `source-anchor` (the only cold-deployed-capable family) →
 * `framework-debug` (dev-only) → `source-map` (inert placeholder) — so a consumer gets a working,
 * degrading resolve chain with one call and can `define()` custom resolvers on top.
 *
 * The single input is the **opt-in** sidecar manifest: pass the `SourceAnchorManifest` a consumer
 * fetched (access-gated, off by default), or omit it — an absent manifest makes the anchor resolver a
 * clean `null`, so the chain degrades to framework-debug → inert. This is the entry point the Plateau
 * dev-browser (the consumer) calls; pairs with any IDE bridge from the bridge registry (#576).
 */
import {
  SourceAnchorResolver,
  FrameworkDebugResolver,
  SourceMapResolver,
  type SourceAnchorManifest,
  type SourceLocation,
} from './provider.js';
import { CustomSourceResolverRegistry } from './registry.js';

export * from './provider.js';
export * from './registry.js';

/**
 * A registry pre-loaded with the three shipped resolvers in precedence order. Pass the opt-in sidecar
 * manifest to power the cold-deployed anchor resolver; omit it for the deployed-without-anchors case
 * (the chain degrades to framework-debug → inert).
 */
export function createDefaultResolverRegistry(manifest?: SourceAnchorManifest | null): CustomSourceResolverRegistry {
  const registry = new CustomSourceResolverRegistry();
  registry.define(new SourceAnchorResolver(manifest)); // 1 — cold-deployed-capable
  registry.define(new FrameworkDebugResolver()); //        2 — dev-only
  registry.define(new SourceMapResolver()); //             3 — inert placeholder
  return registry;
}

/**
 * Resolve a node to its source location through a default-wired chain — the common one-call entry
 * point. Returns `null` when the plane is inert (no manifest, no framework metadata).
 */
export function resolveNodeSource(node: Element, manifest?: SourceAnchorManifest | null): SourceLocation | null {
  return createDefaultResolverRegistry(manifest).resolve(node);
}
