/**
 * Composed-component trait-set authoring construct (#720) — the first-class way a
 * composed component declares **the trait set it binds**, so the component's
 * code-split footprint is exactly its declared set and nothing more.
 *
 * Today only the per-*usage* attribute scan (#034/#202) decides what loads: the
 * Enforcer walks the rendered HTML and splits on the attributes it finds. That is
 * right for a page, but a *composed component* (a date-picker, a time-picker)
 * needs to state its trait set at the **component** level — a date-picker binds
 * `calendar-grid`, a time-picker binds `clock`, and **never each other's**. This
 * construct makes that declaration explicit and composable:
 *
 *   - {@link defineComposedComponent} — declare one component's trait set (a
 *     {@link TraitMap} from the #716 contract). The declared set *is* the
 *     footprint; an undeclared trait is never bound, so it never ships.
 *   - {@link composeTraitSets} — a component built from sub-components binds the
 *     **union** of their declared sets (date-picker composing calendar-grid binds
 *     calendar-grid's traits, not clock's). Conflicting declarations for the same
 *     trait name are a hard error, so two sub-components can't silently disagree.
 *
 * Pure data + the #716 `TraitMap` — no DOM, no bundler. The production
 * build-chunk assertion that proves an unused trait emits **zero** chunk lives in
 * the test suite (`__tests__/composedTraitSet.test.ts`), run over a real Rollup
 * build, not a dev server.
 */
import type { TraitMap, TraitMapEntry } from './traitManifestContract';

/** A composed component's declared trait set — its exact code-split footprint. */
export interface ComposedTraitSet {
  /** The composed component's name, e.g. `'date-picker'`. */
  readonly name: string;
  /** The trait set it binds — **only** its own traits (the #716 `TraitMap`). */
  readonly traits: TraitMap;
  /** The declared trait names, ascending-lexicographic (matches `MANIFEST_KEY_ORDER`). */
  readonly traitNames: readonly string[];
}

function moduleOf(entry: string | TraitMapEntry): string {
  return typeof entry === 'string' ? entry : entry.module;
}

/**
 * Declare one composed component's trait set. The returned set is frozen; its
 * `traitNames` are the sorted keys of the declared map.
 */
export function defineComposedComponent(name: string, traits: TraitMap): ComposedTraitSet {
  if (!name || !name.trim()) throw new Error('defineComposedComponent: a component name is required');
  return Object.freeze({
    name,
    traits: Object.freeze({ ...traits }),
    traitNames: Object.freeze(Object.keys(traits).sort()),
  });
}

/**
 * Bind the **union** of several sub-components' declared trait sets under a new
 * composed-component name. A trait declared by more than one sub-component must
 * resolve to the **same** module in each, else it's a conflict (a hard error) —
 * two sub-components can't bind the same trait name to different code.
 */
export function composeTraitSets(name: string, ...sets: readonly ComposedTraitSet[]): ComposedTraitSet {
  const merged: TraitMap = {};
  for (const set of sets) {
    for (const trait of Object.keys(set.traits)) {
      const incoming = set.traits[trait];
      const existing = merged[trait];
      if (existing !== undefined && moduleOf(existing) !== moduleOf(incoming)) {
        throw new Error(
          `composeTraitSets("${name}"): trait "${trait}" is declared with conflicting modules ` +
            `("${moduleOf(existing)}" vs "${moduleOf(incoming)}")`,
        );
      }
      merged[trait] = incoming;
    }
  }
  return defineComposedComponent(name, merged);
}
