/**
 * @file traitManifest.ts
 * @description The Map — the standalone trait manifest for the Web Traits
 *   "Scale without Weight" standard. A single `attribute → trait` table applied
 *   to a {@link CustomAttributeRegistry} via {@link registerTraits}.
 *
 *   Each entry declares the trait's **delivery** dimension (see the #032 ruling,
 *   surfaced on `/projects/webtraits/`):
 *   - **`lazy` (the default)** — a bare `() => import()` loader. `registerTraits`
 *     `defineLazy`s it, so its code is a split chunk fetched on first DOM
 *     appearance. Pop-in is acceptable: traits are progressive enhancement.
 *   - **`eager` (override)** — `{ delivery: 'eager', attribute: Class }`. The
 *     class is statically imported (baked into the main bundle); `registerTraits`
 *     `define`s it up front, so it applies synchronously with no pop-in. For
 *     tiny / always-on / first-paint-critical traits the author owns that call.
 *
 *   This is the runtime half of "The Map": one global table, registered in one
 *   place during bootstrap. The build-time half — The Enforcer — *generates* this
 *   table from scanned template usage (a lazy entry per trait by default, a
 *   hoisted static import for an `eager` one). See the materialization decision
 *   on the webtraits standard page.
 *
 * @example
 * ```typescript
 * import Highlight from '../../blocks/traits/Highlight';
 * export const traitManifest: TraitManifest = {
 *   // lazy (default): literal specifier so the bundler can split it into a chunk
 *   sortable: () => import('../../blocks/data-grid/traits/Sortable'),
 *   // eager override: statically imported, baked into the main bundle
 *   highlight: { delivery: 'eager', attribute: Highlight },
 * };
 * ```
 */

import type CustomAttributeRegistry from './CustomAttributeRegistry';
import type { LazyAttributeLoader } from './CustomAttributeRegistry';
import type { ImplementedAttribute } from './CustomAttribute';

/**
 * An **eager** trait-manifest entry (`delivery: 'eager'`). The trait's class is
 * supplied directly — meaning it is statically imported and baked into the main
 * bundle — and {@link registerTraits} `define`s it up front, so the trait applies
 * synchronously on `upgrade()` with no on-demand load and no pop-in. The trait
 * author opts into this for tiny / always-on / first-paint-critical traits.
 */
export interface EagerTraitEntry {
  delivery: 'eager';
  /** The CustomAttribute class (statically imported → in the main bundle). */
  attribute: ImplementedAttribute;
}

/**
 * A **lazy** trait-manifest entry in object form (`delivery: 'lazy'`). Equivalent
 * to the bare-loader shorthand but able to carry the per-*usage* `preload` hint
 * (#202): when a `<trait>-delivery="eager"` usage is scanned, the Enforcer emits
 * this form with `preload: true`, and {@link registerTraits} warms the chunk at
 * bootstrap (via `CustomAttributeRegistry.preload`) instead of waiting for the
 * trait's first DOM appearance. The trait is still code-split — `preload` changes
 * *when it loads*, never *where it's bundled*.
 */
export interface LazyTraitEntry {
  delivery: 'lazy';
  /** The same `() => import()` loader as the bare shorthand (literal specifier). */
  load: LazyAttributeLoader;
  /**
   * Warm the chunk at bootstrap rather than on first appearance (#202). Set by the
   * Enforcer when a `<trait>-delivery="eager"` usage is found — useful for a trait
   * whose element mounts later (a route/view not yet rendered). Omitted/false is
   * identical to the bare-loader default.
   */
  preload?: boolean;
}

/**
 * A single trait-manifest entry — the trait's `delivery` dimension expressed as
 * a shape:
 * - a bare {@link LazyAttributeLoader} (`() => import(...)`) — **`delivery: lazy`**,
 *   the default: code-split and loaded on first DOM appearance;
 * - a {@link LazyTraitEntry} — **`delivery: lazy`** in object form, the same except
 *   it can carry `preload` (the per-usage `delivery="eager"` override, #202);
 * - an {@link EagerTraitEntry} — **`delivery: eager`**: baked into the main bundle
 *   and applied synchronously.
 */
export type TraitManifestEntry = LazyAttributeLoader | EagerTraitEntry | LazyTraitEntry;

/**
 * The standalone trait manifest: attribute name → its delivery entry. Lazy
 * entries' `import()` specifiers must stay *literal* so bundlers can split each
 * trait into its own chunk; eager entries reference a statically-imported class.
 */
export type TraitManifest = Record<string, TraitManifestEntry>;

/**
 * The default trait manifest.
 *
 * Ships empty: traits are added here (by hand for now, by The Enforcer later)
 * as they are authored. An empty manifest means `registerTraits` is a no-op —
 * the lazy path exists and is wired, with nothing yet to load.
 */
export const traitManifest: TraitManifest = {};

/**
 * Register every trait in a manifest on a {@link CustomAttributeRegistry}
 * according to its `delivery` dimension — the bootstrap wiring point for The Map.
 *
 * Mirrors the other `register*(attributes)` helpers (navigation, router, event
 * attributes). A **lazy** entry (a bare loader, the default) is `defineLazy`'d so
 * its code is dynamic-imported on first DOM appearance; an **eager** entry
 * (`{ delivery: 'eager', attribute }`) is `define`'d up front so its
 * already-bundled class applies synchronously. A lazy entry in object form
 * (`{ delivery: 'lazy', load, preload }`) is `defineLazy`'d the same way, and if
 * `preload` is set it is additionally `preload`ed — warmed at bootstrap rather
 * than on first appearance (the per-usage `delivery="eager"` override, #202).
 * Call during bootstrap, *before* the first `upgrade()` — the observer's attribute
 * filter is fixed at upgrade time, and an eager `define` must precede the upgrade
 * it should apply on (same constraint as `defineLazy`).
 *
 * A manifest name that is not a valid custom-attribute name (no `-` hyphen and no `:` namespace
 * separator) is **skipped with a warning**, never registered — because `define`/`defineLazy` *throw* on
 * such a name, and the manifest is a *generated* artifact: a usage-scanner can false-positive a bare word
 * in prose (e.g. the documentation line `filter + clearable + … + anchor +`) into a manifest key. Letting
 * one bad key throw would abort the whole loop and **kill the entire bootstrap** before text-node
 * upgrade, blanking every interpolation/behavior demo (#1503). Gating keeps bootstrap resilient: the bad
 * trait simply does not register (it could never have been a valid CustomAttribute anyway), and the
 * warning names it so a genuinely-misnamed trait gets hyphenated at the source.
 *
 * @param attributes - The registry to register the traits on
 * @param manifest - The trait manifest (defaults to {@link traitManifest})
 */
export function registerTraits(
  attributes: CustomAttributeRegistry,
  manifest: TraitManifest = traitManifest,
): void {
  for (const [name, entry] of Object.entries(manifest)) {
    // Gate: a CustomAttribute name MUST contain a hyphen or a ':' namespace separator. A generated
    // manifest can carry an invalid bare name (scanner false-positive on prose, #1503); skip it with a
    // warning rather than let `define`/`defineLazy` throw and abort the whole bootstrap.
    if (!name.includes('-') && !name.includes(':')) {
      console.warn(
        `[Web Everything] Skipping invalid trait name "${name}" from the trait manifest — a custom ` +
          `attribute name must contain a hyphen or a ':' namespace separator. Likely a usage-scanner ` +
          `false-positive on prose; hyphenate the trait at its source if it is a real trait (#1503).`,
      );
      continue;
    }
    if (typeof entry === 'function') {
      // delivery: lazy (default, shorthand) — code-split, loaded on first appearance.
      attributes.defineLazy(name, entry);
    } else if (entry.delivery === 'eager') {
      // delivery: eager — class already in the main bundle, applied synchronously.
      attributes.define(name, entry.attribute);
    } else {
      // delivery: lazy (object form) — defineLazy as usual; warm now if preload (#202).
      attributes.defineLazy(name, entry.load);
      if (entry.preload) attributes.preload(name);
    }
  }
}
