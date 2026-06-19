/**
 * Runtime `customTrackers` plug (#1012) — the live counterpart to the dependency-free `analytics/`
 * model shipped alongside, and the analytics-protocol sibling of `CustomGuardRegistry`.
 *
 * A `CustomRegistry<CustomTracker>` (the same base every Web Everything registry extends) so it
 * participates in the injector chain — a scope sets one on its injector and a subtree resolves it
 * nearest-scope-wins (#207 D6), exactly like `customGuards` / `customStores`. It reuses the tracker
 * contract and the native-first no-op default from the `analytics/` model verbatim, so the protocol has
 * one home and cannot drift.
 *
 * Unlike `CustomGuardRegistry.evaluateRegion` (which validates a trust-crossing answer via
 * `assertGuardDecision`), the routing helpers here just forward to the resolved backend — analytics is
 * fire-and-forget telemetry, there is no decision to assert. They exist so a consumer (or a conformance
 * vector) calls `registry.track(…)` once and the call is delivered to whichever backend the scope
 * resolved, never touching the concrete tracker.
 */
import CustomRegistry from '../core/CustomRegistry';
import {
  NoopTracker,
  type AnalyticsProperties,
  type AnalyticsTraits,
  type CustomAnalyticsOptions,
  type CustomTracker,
} from '../../analytics/provider.js';

/** A scope asked for a tracker that was never registered. */
export class UnknownTrackerError extends Error {
  constructor(key: string, known: string[]) {
    super(`Unknown analytics tracker "${key}" — registered trackers: ${known.join(', ') || 'none'}`);
    this.name = 'UnknownTrackerError';
  }
}

/**
 * The live registry of named analytics backends. Extends the core `CustomRegistry` (keyed by tracker
 * key) so it is injector-chain-resolvable and inheritable via `extends`; adds the
 * `define(tracker, asDefault?)` / `resolve(key?)` surface plus the four Segment routing helpers, deriving
 * the registration key from the tracker's own `key` rather than a hand-passed name.
 */
export default class CustomTrackerRegistry extends CustomRegistry<CustomTracker> {
  localName = 'customTrackers';
  #defaultKey: string | null = null;

  /**
   * Register a backend under its own `key`. The first registered — or one passed `asDefault` — becomes
   * the backend used when a scope names none (the native-first no-op default, by convention).
   * Re-registering a key overrides it.
   */
  define(tracker: CustomTracker, asDefault = false): void {
    this.set(tracker.key, tracker);
    if (asDefault || this.#defaultKey === null) this.#defaultKey = tracker.key;
  }

  /** The key of the backend `resolve()` returns when called with no argument. */
  get defaultKey(): string | null {
    return this.#defaultKey;
  }

  /**
   * Resolve a backend by name, falling back to the registered default when `key` is omitted. Throws
   * `UnknownTrackerError` when the named (or default) backend is absent — the registry never silently
   * substitutes a different backend.
   */
  resolve(key?: string): CustomTracker {
    const wanted = key ?? this.#defaultKey;
    if (wanted === null) throw new UnknownTrackerError('default', [...this.keys()]);
    const tracker = this.get(wanted as string);
    if (!tracker) throw new UnknownTrackerError(wanted, [...this.keys()]);
    return tracker;
  }

  /** *Who* — route `identify` through the resolved backend. */
  identify(userId: string, traits?: AnalyticsTraits, options?: CustomAnalyticsOptions, trackerKey?: string): void {
    this.resolve(trackerKey).identify(userId, traits, options);
  }

  /** *What* — route `track` through the resolved backend. */
  track(event: string, properties?: AnalyticsProperties, options?: CustomAnalyticsOptions, trackerKey?: string): void {
    this.resolve(trackerKey).track(event, properties, options);
  }

  /** *Where* — route `page` through the resolved backend (Segment arg order: `category` then `name`). */
  page(
    category?: string,
    name?: string,
    properties?: AnalyticsProperties,
    options?: CustomAnalyticsOptions,
    trackerKey?: string,
  ): void {
    this.resolve(trackerKey).page(category, name, properties, options);
  }

  /** B2B — route `group` through the resolved backend. */
  group(groupId: string, traits?: AnalyticsTraits, options?: CustomAnalyticsOptions, trackerKey?: string): void {
    this.resolve(trackerKey).group(groupId, traits, options);
  }
}

/** A registry pre-loaded with the native-first no-op default backend. */
export function createDefaultTrackerRegistry(): CustomTrackerRegistry {
  const registry = new CustomTrackerRegistry();
  registry.define(new NoopTracker(), true); // native-first no-op default
  return registry;
}
