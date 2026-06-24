/**
 * @file blocks/router/route-emitters.ts
 * @description The route-map **emitter contract + a default-less pluggable registry** (#1736, epic #1684).
 *
 * An emitter projects the canonical serializable {@link RouteMap} (the #1721 derived projection, built by
 * `buildRouteMap` in `./route-map`) into a downstream artifact — a sitemap, a prerender manifest, a route
 * config. Per docs/agent/platform-decisions.md#faithful-derivation-exclude-not-fabricate the emitter set is
 * **support-all behind a default-less pluggable registry**: each emitter is a facade over the *one*
 * route-map kernel and cannot conflict, so new emitters join **without a decision**
 * (config-extends-platform-default). WE owns the contract + this registry; the concrete emitters (sitemap,
 * …) are separately-prioritized slices, and the build/runtime that drives them rides downstream to FUI.
 */
import type { RouteMap } from './route-map';

/**
 * One route-map emitter — projects the canonical {@link RouteMap} into this emitter's downstream artifact.
 * A pure facade over the kernel: it reads the map and returns an artifact, never mutating the map.
 *
 * @typeParam T the emitter's artifact type (e.g. an XML sitemap string, a prerender path list)
 */
export interface RouteMapEmitter<T = unknown> {
  /** Stable emitter id — the registry key and the config-extends member name. */
  readonly id: string;
  /** Project the canonical route map into this emitter's downstream artifact. */
  emit(map: RouteMap): T;
}

/** Thrown when an emitter id is requested that is not in the registry. */
export class UnknownRouteEmitterError extends Error {
  constructor(id: string, known: readonly string[]) {
    super(`Unknown route emitter "${id}" — registered emitters: ${known.join(', ') || 'none'}`);
    this.name = 'UnknownRouteEmitterError';
  }
}

/**
 * A **default-less, open set** of route-map emitters. No emitter is built in — the platform/project
 * registers the set it wants (config-extends-platform-default); a registry with nothing registered is
 * valid (it simply emits nothing). There is deliberately no first-registered-wins default — emitters are
 * support-all peers, never a defaulted choice.
 */
export class RouteEmitterRegistry {
  readonly #emitters = new Map<string, RouteMapEmitter>();

  /** Register (or replace) an emitter under its `id`. Returns `this` for chaining. */
  register(emitter: RouteMapEmitter): this {
    this.#emitters.set(emitter.id, emitter);
    return this;
  }

  /** Whether an emitter is registered under `id`. */
  has(id: string): boolean {
    return this.#emitters.has(id);
  }

  /** The emitter registered under `id`, or `undefined`. */
  get(id: string): RouteMapEmitter | undefined {
    return this.#emitters.get(id);
  }

  /** The registered emitter ids, in registration order. */
  ids(): string[] {
    return [...this.#emitters.keys()];
  }

  /** Run one registered emitter over `map`. Throws {@link UnknownRouteEmitterError} if `id` is unknown. */
  emit(id: string, map: RouteMap): unknown {
    const emitter = this.#emitters.get(id);
    if (!emitter) throw new UnknownRouteEmitterError(id, this.ids());
    return emitter.emit(map);
  }

  /** Run every registered emitter over `map` → `id → artifact` (the support-all fan-out). */
  emitAll(map: RouteMap): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [id, emitter] of this.#emitters) out[id] = emitter.emit(map);
    return out;
  }
}
