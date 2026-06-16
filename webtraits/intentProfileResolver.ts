/**
 * @file webtraits/intentProfileResolver.ts
 * @description Intent-profile → trait build-time resolver (backlog #776, the mechanic #747 Fork 4 carved).
 *   The principled *indirect* path: a design system never names a trait; it sets **intent defaults**, and
 *   this resolver maps the active intent profile to the traits that should bundle (and how they ship —
 *   eager/lazy). It is the layer that keeps **intents UX-only** (no impl refs, ratified) and **traits
 *   technical**: the intent→trait mapping lives here, in neither the intent nor the trait.
 *
 * WE-resident standard logic (a pure, dependency-free resolver over the WE registries — the same shape as
 * `webcases/requirementValidator.ts`): it consumes the `intentDimension` keys traits already declare in
 * `blocks.json` and an active profile, and returns the build-time bundle plan. The FUI build and the
 * Plateau Technical Configurator are *consumers* of this resolver, not its home — standard logic → WE.
 *
 * Scope (per #776): **build-time inclusion + delivery** only — which traits ship and whether eager or lazy.
 * Runtime activation gates (inert / visibility) stay DOM-driven and are out of scope.
 */

export type Delivery = 'eager' | 'lazy';

/** A trait that may be bundled, as declared on a block (`blocks.json` trait entries). */
export interface TraitCandidate {
  name: string;
  /**
   * The intent-dimension *value* that activates this trait at build time, as `"<intent>.<dimension>.<value>"`
   * (e.g. `"type-ahead.matching.prefix"`). `null`/`undefined` = **unconditional** — always bundled, it has no
   * intent gate (e.g. a baseline behaviour like `withContainerQueries`).
   */
  intentDimension?: string | null;
  /** Explicit delivery; defaults to `lazy` (keep the eager bundle small — the perf-first, most-flexible default). */
  delivery?: Delivery;
}

/** The active intent profile: `"<intent>.<dimension>"` → the chosen value. (Intents are UX-only; this is values, not impl.) */
export type IntentProfile = Record<string, string>;

/** Why a trait was included, and how it ships. */
export interface ResolvedTrait {
  name: string;
  reason: 'unconditional' | 'profile-match';
  delivery: Delivery;
  /** The trait's declared `intentDimension` (null for unconditional traits). */
  intentDimension: string | null;
}

/** Split a `"<intent>.<dimension>.<value>"` key into its dimension key (`"<intent>.<dimension>"`) and value. */
export function splitIntentDimension(key: string): { dimension: string; value: string } | null {
  const lastDot = key.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === key.length - 1) return null;
  return { dimension: key.slice(0, lastDot), value: key.slice(lastDot + 1) };
}

/**
 * Resolve which trait candidates bundle for an active intent profile. A trait with no `intentDimension` is
 * unconditional (always bundled); one with an `intentDimension` bundles iff the profile selects that exact
 * value. Deterministic and side-effect-free.
 */
export function resolveTraits(profile: IntentProfile, candidates: readonly TraitCandidate[]): ResolvedTrait[] {
  const resolved: ResolvedTrait[] = [];
  for (const c of candidates) {
    const delivery: Delivery = c.delivery ?? 'lazy';
    if (c.intentDimension == null) {
      resolved.push({ name: c.name, reason: 'unconditional', delivery, intentDimension: null });
      continue;
    }
    const parts = splitIntentDimension(c.intentDimension);
    if (parts && profile[parts.dimension] === parts.value) {
      resolved.push({ name: c.name, reason: 'profile-match', delivery, intentDimension: c.intentDimension });
    }
  }
  return resolved;
}

/** The build-time bundle plan: the resolved trait names grouped by how they ship. */
export interface BundlePlan {
  eager: string[];
  lazy: string[];
}

/** Group a resolved trait set into the eager/lazy delivery buckets a bundler consumes. */
export function bundlePlan(profile: IntentProfile, candidates: readonly TraitCandidate[]): BundlePlan {
  const plan: BundlePlan = { eager: [], lazy: [] };
  for (const t of resolveTraits(profile, candidates)) plan[t.delivery].push(t.name);
  return plan;
}
