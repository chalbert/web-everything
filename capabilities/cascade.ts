/**
 * Scoped binding cascade — the D6 precedence model of epic #203 (story #207).
 *
 * A slot (and its strictness knob, and the capability-provider *context* it resolves in) can be set
 * at four nested scopes — **base → app → view → fragment** — and the cascade is **plain
 * nearest-scope-wins**, borrowing context-provider / CSS-cascade semantics: the most specific scope
 * that defines a field overrides the broader ones; a scope that leaves a field unset inherits it.
 *
 * The subtle, deliberate rule (the #203 D6 ruling): **inheritance carries the slot value _as
 * written_, not the parent's resolution.** A `native-first` policy stays a policy as it flows down,
 * and is **re-resolved at the leaf in the leaf's own provider context** — so the same inherited
 * `native-first` resolves to the *native* impl on a Chrome view and a *custom* impl on a Safari view,
 * instead of freezing whatever the parent happened to pick. A *pin* likewise carries as-written.
 * Only the explicit *slot value* cascades; the *resolution* is always recomputed per context.
 *
 * No magic-on-absence (the #025 / #203 foundation): the **base must define the slot** — an inherited
 * default is an explicit base value, never a value conjured from nothing.
 */
import type { CapabilityProvider } from './provider.js';
import { resolveSlot, type Slot } from './resolver.js';
import {
  validateSlot,
  DEFAULT_STRICTNESS,
  type Strictness,
  type ValidationOutcome,
} from './strictness.js';
import { providerForVenue, DEFAULT_VENUE, type Venue, type VenueConfig } from './venues.js';

/** The four nested binding scopes, broadest → most specific. */
export type Scope = 'base' | 'app' | 'view' | 'fragment';

export const SCOPES: readonly Scope[] = ['base', 'app', 'view', 'fragment'];

const SCOPE_RANK: Record<Scope, number> = { base: 0, app: 1, view: 2, fragment: 3 };

/** What a single scope may set. Any field omitted is inherited from the nearest broader scope. */
export interface Binding {
  /** The provider slot — a concrete pin or a named policy. Carried *as written* down the cascade. */
  slot?: Slot;
  /** The validation strictness knob (D5). */
  strictness?: Strictness;
  /**
   * The resolution venue (#208) — the authored *where/when* the tiers are computed: `build` (default,
   * static matrix), `runtime` (live feature detection), or `edge` (Client-Hints lookup). Cascaded
   * nearest-scope-wins like the others; unset anywhere ⇒ the `build` base default (no magic-on-absence).
   * At resolution it is turned into a provider via {@link providerForVenue} — unless an explicit
   * {@link provider} is set, which always overrides (the escape hatch).
   */
  venue?: Venue;
  /**
   * An explicit capability-provider context this scope resolves in (e.g. a specific Chrome vs Safari
   * view, or a test double). When set it **overrides** the {@link venue} field — venue produces the
   * provider only when no explicit one is bound.
   */
  provider?: CapabilityProvider;
}

/** A binding tagged with the scope it sits at. */
export interface ScopeBinding extends Binding {
  scope: Scope;
}

/** The cascaded effective binding — each field plus the scope it was inherited from. */
export interface EffectiveBinding {
  slot: Slot;
  strictness: Strictness;
  venue: Venue;
  provider: CapabilityProvider | null;
  /**
   * The scope each field's value came from. `strictnessSource: null` ⇒ the `warn` default;
   * `venueSource: null` ⇒ the `build` default.
   */
  slotSource: Scope;
  strictnessSource: Scope | null;
  venueSource: Scope | null;
  providerSource: Scope | null;
}

/** The base scope never set a slot — there is no value to inherit (no magic-on-absence). */
export class UnboundSlotError extends Error {
  constructor() {
    super('No scope in the cascade defines a slot — the base must bind one (no magic-on-absence)');
    this.name = 'UnboundSlotError';
  }
}

/** A scope appears more than once, or out of base→fragment order — an ill-formed chain. */
export class MalformedCascadeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MalformedCascadeError';
  }
}

/**
 * Collapse a base→…→leaf chain into its effective binding — nearest-scope-wins per field. The chain
 * must be ordered broad→specific with no repeated scope (so precedence is unambiguous). Only the
 * *slot value* cascades here; resolution happens later, per context (see {@link resolveScoped}).
 */
export function cascade(chain: ScopeBinding[]): EffectiveBinding {
  let lastRank = -1;
  for (const b of chain) {
    const rank = SCOPE_RANK[b.scope];
    if (rank === undefined) throw new MalformedCascadeError(`Unknown scope "${b.scope}"`);
    if (rank <= lastRank)
      throw new MalformedCascadeError(
        `Scope "${b.scope}" is out of order or duplicated — bind base→app→view→fragment, once each`,
      );
    lastRank = rank;
  }

  let slot: Slot | undefined;
  let slotSource: Scope | undefined;
  let strictness: Strictness | undefined;
  let strictnessSource: Scope | null = null;
  let venue: Venue | undefined;
  let venueSource: Scope | null = null;
  let provider: CapabilityProvider | undefined;
  let providerSource: Scope | null = null;

  // base→leaf: a later (more specific) scope overrides; an omitted field keeps the inherited value.
  for (const b of chain) {
    if (b.slot !== undefined) {
      slot = b.slot;
      slotSource = b.scope;
    }
    if (b.strictness !== undefined) {
      strictness = b.strictness;
      strictnessSource = b.scope;
    }
    if (b.venue !== undefined) {
      venue = b.venue;
      venueSource = b.scope;
    }
    if (b.provider !== undefined) {
      provider = b.provider;
      providerSource = b.scope;
    }
  }

  if (slot === undefined || slotSource === undefined) throw new UnboundSlotError();

  return {
    slot,
    strictness: strictness ?? DEFAULT_STRICTNESS, // unset anywhere ⇒ the base default
    venue: venue ?? DEFAULT_VENUE, // unset anywhere ⇒ the `build` base default (no magic-on-absence)
    provider: provider ?? null,
    slotSource,
    strictnessSource,
    venueSource,
    providerSource,
  };
}

/**
 * The effective capability-provider context for a cascaded binding. An **explicit `provider`** bound at
 * any scope always wins (the escape hatch — a specific Chrome/Safari context or a test double). Absent
 * one, the cascaded **`venue`** is turned into a provider via {@link providerForVenue} (so authoring
 * `venue: edge` routes through the degrading edge provider with no code change), given a
 * {@link VenueConfig}. Absent both, the supplied `fallbackProvider` is used.
 *
 * Returns `null` when no context can be produced — the caller decides whether that's an error.
 */
function effectiveProvider(
  effective: EffectiveBinding,
  venueConfig?: VenueConfig,
  fallbackProvider?: CapabilityProvider,
): CapabilityProvider | null {
  if (effective.provider) return effective.provider; // explicit context overrides venue
  if (venueConfig) return providerForVenue(effective.venue, venueConfig); // venue → provider
  return fallbackProvider ?? null;
}

/** A scoped resolution: the cascaded binding + the validated resolution in the leaf's context. */
export interface ScopedResolution {
  effective: EffectiveBinding;
  /** The validation outcome under the effective strictness — carries the resolved impl (or null). */
  outcome: ValidationOutcome;
}

/**
 * Cascade a chain, then **re-resolve the inherited slot in the leaf's own provider context** and
 * validate it under the effective strictness. This is where D6's "re-resolved at the leaf" bites: an
 * inherited `native-first` is resolved against `effective.provider` (the nearest-scoped provider, or
 * `fallbackProvider`), so the *same* slot yields a different impl per context.
 */
export function resolveScoped(
  chain: ScopeBinding[],
  intentIds: string[],
  fallbackProvider?: CapabilityProvider,
  venueConfig?: VenueConfig,
): ScopedResolution {
  const effective = cascade(chain);
  const provider = effectiveProvider(effective, venueConfig, fallbackProvider);
  if (!provider)
    throw new MalformedCascadeError(
      'No capability provider for the cascade — bind a provider, author a venue with a VenueConfig, or pass a fallback',
    );
  const outcome = validateSlot(provider, effective.slot, intentIds, effective.strictness);
  return { effective, outcome };
}

/**
 * Resolve the inherited slot directly (no strictness validation) — a thin convenience that proves
 * the "as-written, re-resolved per context" rule in isolation. Most callers want
 * {@link resolveScoped} so the strictness knob is honored.
 */
export function resolveScopedSlot(
  chain: ScopeBinding[],
  intentIds: string[],
  fallbackProvider?: CapabilityProvider,
  venueConfig?: VenueConfig,
) {
  const effective = cascade(chain);
  const provider = effectiveProvider(effective, venueConfig, fallbackProvider);
  if (!provider) throw new MalformedCascadeError('No capability provider available to resolve the slot');
  return { effective, resolution: resolveSlot(provider, effective.slot, intentIds) };
}
