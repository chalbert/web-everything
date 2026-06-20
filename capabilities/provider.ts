/**
 * Capability provider — the resolution layer's oracle (#204, foundation of epic #203).
 *
 * Answers one question: "can implementation X serve required capability Y, and at what tier?"
 * The vocabulary is a *separate lower capability layer* (D3′): capability ids borrow Baseline /
 * `web-features` keys (`popover`, `anchor-positioning`, `customizable-select`, …), so they are
 * bounded, stable, compact and URL-serializable — the edge venue carries them in the component URL
 * (`/c/droplist@1?caps=…`). Intents declare which capability ids they require (the data-driven
 * intent→capabilities map authored in `src/_data/intents.json`); the provider tiers the ids; the
 * native-first resolver (#205) composes the two.
 *
 * This module ships the **single provider interface** (D4′) and its **default implementation**, the
 * static build-matrix (`src/_data/capabilityMatrix.json`) — the substrate report's support table as
 * data, paired with the default `build` venue. Runtime feature-detection and edge-service impls
 * (#208) implement the same interface; the resolver never hard-codes capability facts, it always
 * asks a provider.
 */

/** The 3-state polyfillability tier a capability is served at on a given impl (substrate report). */
export type Tier = 'native-ok' | 'polyfill-ok' | 'capability-hard';

export const TIERS: readonly Tier[] = ['native-ok', 'polyfill-ok', 'capability-hard'];

/** One entry of the capability vocabulary (per-capability specs `src/_data/capabilities/<id>.json`, #1157). */
export interface Capability {
  id: string;
  label: string;
  /** The Baseline / `web-features` key this capability tracks. */
  webFeaturesKey: string;
  /** Baseline year (e.g. "2024") or `false` for not-yet-Baseline. */
  baseline: string | false;
  /** Coarse polyfillability class: behavior-recoverable vs UA-privileged capability. */
  polyfill: 'polyfillable' | 'partial' | 'capability';
  summary: string;
}

/**
 * One **registered capability adapter** — a single row of the central adapter table
 * (`src/_data/capabilityMatrix.json` → `impls[]`), per the #206 *adapter granularity & ownership*
 * ruling: ownership distributed (each impl *authors* its row), storage central (registration lives in
 * one discoverable, enumerable table). The row declares the impl's whole **capability id → tier** map;
 * the static build-matrix grid (#204) *is* this set of rows — the adapter table is the matrix's row
 * source, so there is one source of truth and no duplicated capability facts. Adding a new impl is a
 * single-row registration.
 */
export interface CapabilityAdapter {
  id: string;
  label: string;
  summary: string;
  /** Is this the native substrate? The native-first resolver (#205) prefers it to break ties. */
  native?: boolean;
  /** capabilityId → tier, for every capability id in the vocabulary. */
  tiers: Record<string, Tier>;
}

/** @deprecated Use {@link CapabilityAdapter} — a matrix impl row *is* a registered adapter (#206). */
export type MatrixImpl = CapabilityAdapter;

export interface CapabilityMatrix {
  description?: string;
  tiers?: Tier[];
  /** The registered capability adapter table — one row per impl (#206). */
  impls: CapabilityAdapter[];
}

/** intentId → required capability ids (derived from `requiresCapabilities` in intents.json). */
export type IntentCapabilityMap = Record<string, string[]>;

/**
 * The injectable contract every venue's provider satisfies (D4′). One interface, swappable impls:
 * static build-matrix (this module, default), runtime feature-detection, edge-service (#208).
 */
export interface CapabilityProvider {
  /** The tier at which `impl` can serve `capabilityId`. */
  tier(impl: string, capabilityId: string): Tier;
  /** Capability ids `intentId` requires — the data-driven intent→capabilities mapping. */
  requiredCapabilities(intentId: string): string[];
  /** Ids of every impl this provider knows about (the resolver enumerates these for native-first). */
  impls(): string[];
  /**
   * The registered capability adapter rows themselves (#206) — id + human label/summary + the
   * native marker, for discovery surfaces (the `/capabilities/` catalog) that need more than the id.
   */
  adapters(): CapabilityAdapter[];
  /** Is `impl` the native substrate? The native-first resolver prefers it to break lightness ties. */
  isNative(impl: string): boolean;
}

export class UnknownImplError extends Error {
  constructor(impl: string) {
    super(`Unknown impl "${impl}" — not present in the capability matrix`);
    this.name = 'UnknownImplError';
  }
}

export class UnknownCapabilityError extends Error {
  constructor(capabilityId: string, impl: string) {
    super(`Capability "${capabilityId}" has no tier on impl "${impl}" — the matrix is incomplete`);
    this.name = 'UnknownCapabilityError';
  }
}

/**
 * The default provider: tiers come from the static build-matrix, the intent map from authored
 * `requiresCapabilities` fields. Both are injected — `createStaticMatrixProvider()` wires the
 * bundled JSON, but tests (and other venues) can pass their own data.
 */
export class StaticMatrixProvider implements CapabilityProvider {
  /** The registered adapter table, in registration order (#206). */
  #adapters: CapabilityAdapter[];
  #byImpl: Map<string, Record<string, Tier>>;
  #native: Set<string>;
  #intentMap: IntentCapabilityMap;

  constructor(matrix: CapabilityMatrix, intentMap: IntentCapabilityMap = {}) {
    this.#adapters = matrix.impls;
    this.#byImpl = new Map(matrix.impls.map((i) => [i.id, i.tiers]));
    this.#native = new Set(matrix.impls.filter((i) => i.native).map((i) => i.id));
    this.#intentMap = intentMap;
  }

  tier(impl: string, capabilityId: string): Tier {
    const row = this.#byImpl.get(impl);
    if (!row) throw new UnknownImplError(impl);
    const t = row[capabilityId];
    if (!t) throw new UnknownCapabilityError(capabilityId, impl);
    return t;
  }

  requiredCapabilities(intentId: string): string[] {
    return this.#intentMap[intentId] ?? [];
  }

  impls(): string[] {
    return [...this.#byImpl.keys()];
  }

  adapters(): CapabilityAdapter[] {
    return this.#adapters;
  }

  isNative(impl: string): boolean {
    if (!this.#byImpl.has(impl)) throw new UnknownImplError(impl);
    return this.#native.has(impl);
  }
}

/** A resolved (capabilityId, tier) pair for an intent on a given impl. */
export interface CapabilityResolution {
  capabilityId: string;
  tier: Tier;
}

/**
 * Expand an intent to its required capabilities and tier each on `impl`. This is the join the
 * native-first resolver (#205) consumes — "what does this intent need, and can this impl serve it?"
 */
export function resolveIntent(
  provider: CapabilityProvider,
  impl: string,
  intentId: string,
): CapabilityResolution[] {
  return provider
    .requiredCapabilities(intentId)
    .map((capabilityId) => ({ capabilityId, tier: provider.tier(impl, capabilityId) }));
}

/**
 * Build the intent→capabilities map from a list of intent records (intents.json shape). Keeps the
 * mapping data-driven: the provider reads authored `requiresCapabilities`, never a hard-coded table.
 */
export function intentMapFromIntents(
  intents: Array<{ id: string; requiresCapabilities?: string[] }>,
): IntentCapabilityMap {
  const map: IntentCapabilityMap = {};
  for (const intent of intents)
    if (intent.id && Array.isArray(intent.requiresCapabilities) && intent.requiresCapabilities.length)
      map[intent.id] = intent.requiresCapabilities;
  return map;
}
