/**
 * Vite plugin: The Enforcer — build-time half of the Web Traits "Scale without
 * Weight" standard (pillar 3, "The Map" / gap 3).
 *
 * Reads the build-time **trait Map** (`attribute → module specifier`, optionally
 * with a `delivery` dimension), scans template sources for which trait attributes
 * are actually used, and generates the runtime **trait manifest** as a virtual
 * module. Each entry honours the trait's delivery (#032 ruling):
 * - **`lazy` (default)** — emitted as a literal `() => import(spec)` thunk. The
 *   literal specifier lets Rollup/Vite code-split the trait into its own chunk;
 *   `registerTraits` `defineLazy`s it, loaded on first DOM appearance.
 * - **`eager`** — emitted as a hoisted static `import` plus an
 *   `{ delivery: 'eager', attribute }` entry. The static import bakes the trait
 *   into the main bundle (no split chunk); `registerTraits` `define`s it up front.
 *
 * It also honours a per-*usage* `delivery="eager"` override (#202): a scanned
 * `<trait>-delivery="eager"` usage marks that lazy trait `preload`, emitted as
 * `{ delivery: 'lazy', preload: true, load }`. The trait stays code-split; `preload`
 * only tells `registerTraits` to warm the chunk at bootstrap (via `registry.preload`)
 * instead of on first appearance — for a trait whose element mounts later (a
 * route/view not yet rendered). Eager-only by design; `delivery="lazy"` at a usage
 * site is the no-op default. The build-time scan is what makes the not-yet-mounted
 * case work — the runtime DOM can't see an element that isn't there yet.
 *
 * Build-time decides the split; runtime decides the load (on first DOM appearance,
 * or at bootstrap when preloaded).
 *
 * The scan + codegen are pure functions (exported for testing); the plugin is
 * thin glue over them.
 *
 * Wiring (when real traits exist):
 * ```ts
 * // vite.config.mts
 * traitEnforcer({ traitMap: { sortable: '/blocks/data-grid/traits/Sortable' } })
 * // bootstrap.ts (built via Vite)
 * import { traitManifest } from 'virtual:trait-manifest';
 * registerTraits(window.attributes, traitManifest);
 * ```
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import type { Plugin } from 'vite';

/**
 * A build-time Map entry with an explicit `delivery` dimension. Use the object
 * form to override the default (`lazy`) — typically `{ module, delivery: 'eager' }`
 * for a tiny / always-on trait that should be baked into the main bundle.
 */
export interface TraitMapEntry {
  /** The trait's module specifier (a literal import path). */
  module: string;
  /** How the trait is delivered. Default `'lazy'` (code-split + load on demand). */
  delivery?: 'eager' | 'lazy';
}

/**
 * The build-time Map: attribute name → its module specifier. A bare string is
 * the default (`delivery: 'lazy'`); use a {@link TraitMapEntry} object to set
 * `delivery: 'eager'`.
 */
export type TraitMap = Record<string, string | TraitMapEntry>;

/** Normalize a Map value to `{ module, delivery }`, defaulting delivery to `lazy`. */
function normalizeEntry(value: string | TraitMapEntry): Required<TraitMapEntry> {
  return typeof value === 'string'
    ? { module: value, delivery: 'lazy' }
    : { module: value.module, delivery: value.delivery ?? 'lazy' };
}

export interface TraitEnforcerOptions {
  /** The Map — attribute name → module specifier for that trait. */
  traitMap: TraitMap;
  /** Directories/files scanned for trait-attribute usage. Default `['demos', 'src']`. */
  include?: string[];
  /** Raw HTML strings to scan in addition to {@link include} (handy for tests). */
  templates?: string[];
  /**
   * Tree-shake the manifest by usage (default `true`): only traits whose
   * attribute appears in a scanned template are emitted. Set `false` to emit
   * every entry in the Map regardless of usage.
   */
  scanUsage?: boolean;
  /** The virtual module id the manifest is served under. Default `'virtual:trait-manifest'`. */
  virtualId?: string;
}

/**
 * Find which of `names` appear as attributes in `html`.
 *
 * Matches an attribute token — `name` preceded by whitespace/start and followed
 * by `=`, `/`, `>`, whitespace, or end — so `sortable` matches `<div sortable>`
 * and `<div sortable="">` but not `sortableness`. Names may contain `:` / `-`
 * (e.g. `nav:list`, `export-csv`). Errs toward inclusion: a stray match only
 * means an extra never-loaded chunk, never a missing trait.
 */
export function scanTraitsInHtml(html: string, names: string[]): Set<string> {
  const found = new Set<string>();
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?:^|\\s)${escaped}(?=[\\s=/>]|$)`, 'm');
    if (re.test(html)) found.add(name);
  }
  return found;
}

/**
 * Find which of `names` carry a per-*usage* `delivery="eager"` override (#202) —
 * the reserved `<trait>-delivery="eager"` suffix attribute, e.g.
 * `<ul sortable sortable-delivery="eager">`. A trait so marked is *preloaded*:
 * its (still code-split) chunk is warmed at bootstrap rather than on first DOM
 * appearance, so it's ready when its element mounts later (a route/view not yet
 * rendered). Reading the override from template *source* is what makes the
 * not-yet-mounted case work — the runtime DOM can't see an element that isn't
 * there yet.
 *
 * Matches `name-delivery = eager` with optional whitespace and optional quotes,
 * the attribute token preceded by whitespace/start. Only `eager` flips preload;
 * `delivery="lazy"` (or any other value) is the no-op default and is ignored.
 * Names may contain `:` / `-` (`nav:list-delivery`, `export-csv-delivery`).
 */
export function scanTraitDeliveryOverrides(html: string, names: string[]): Set<string> {
  const preload = new Set<string>();
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?:^|\\s)${escaped}-delivery\\s*=\\s*["']?eager(?=[\\s"'/>]|$)`, 'm');
    if (re.test(html)) preload.add(name);
  }
  return preload;
}

/**
 * Generate the runtime trait-manifest module source from the Map.
 *
 * Emits a deterministic (key-sorted) table for the `used` attributes (defaults to
 * every Map entry), honouring each trait's `delivery`:
 * - **lazy** → a literal `() => import(spec)` thunk, so the bundler code-splits
 *   the trait into its own chunk and the runtime loads it on first appearance;
 * - **lazy + preload** (a name in `preload`, from a scanned `<trait>-delivery="eager"`
 *   usage, #202) → the object form `{ delivery: "lazy", preload: true, load: () => import(spec) }`.
 *   Still code-split — `preload` only tells the runtime to warm it at bootstrap;
 * - **eager** → a hoisted static `import` (baking the trait into the main bundle)
 *   plus an `{ delivery: 'eager', attribute }` entry the runtime `define`s up front.
 *
 * A `preload` name is unioned into the emitted set, so a trait used *only* via its
 * `-delivery="eager"` override (no bare occurrence) is still emitted. `preload` is
 * ignored for eager traits — they are already in the main bundle, nothing to warm.
 */
export function generateManifestModule(
  map: TraitMap,
  used?: Iterable<string>,
  preload?: Iterable<string>,
): string {
  const preloadSet = new Set(preload ?? []);
  const usedSet = used ? new Set(used) : new Set(Object.keys(map));
  for (const name of preloadSet) if (map[name]) usedSet.add(name); // preload implies emitted
  const names = Object.keys(map)
    .filter((name) => usedSet.has(name))
    .sort();

  const imports: string[] = [];
  const lines: string[] = [];
  let eagerIndex = 0;

  for (const name of names) {
    const { module, delivery } = normalizeEntry(map[name]);
    if (delivery === 'eager') {
      // Static import → baked into the main bundle (no split chunk).
      const local = `__traitEager${eagerIndex++}`;
      imports.push(`import ${local} from ${JSON.stringify(module)};`);
      lines.push(`  ${JSON.stringify(name)}: { delivery: "eager", attribute: ${local} },`);
    } else if (preloadSet.has(name)) {
      // Lazy, but a usage-site delivery="eager" override warms it at bootstrap (#202).
      lines.push(
        `  ${JSON.stringify(name)}: { delivery: "lazy", preload: true, load: () => import(${JSON.stringify(module)}) },`,
      );
    } else {
      // Literal import() → code-split chunk, loaded on demand.
      lines.push(`  ${JSON.stringify(name)}: () => import(${JSON.stringify(module)}),`);
    }
  }

  return [
    '// Generated by trait-enforcer — do not edit.',
    ...imports,
    ...(imports.length ? [''] : []),
    'export const traitManifest = {',
    ...lines,
    '};',
    'export default traitManifest;',
    '',
  ].join('\n');
}

/** Recursively collect `.html` file paths under the given dirs/files. */
function walkHtmlFiles(includes: string[]): string[] {
  const out: string[] = [];
  const visit = (path: string): void => {
    let stat;
    try {
      stat = statSync(path);
    } catch {
      return; // missing path — skip
    }
    if (stat.isDirectory()) {
      for (const entry of readdirSync(path)) {
        if (entry === 'node_modules' || entry.startsWith('.')) continue;
        visit(join(path, entry));
      }
    } else if (stat.isFile() && path.endsWith('.html')) {
      out.push(path);
    }
  };
  for (const inc of includes) visit(inc);
  return out;
}

/** Union the trait attributes used across raw templates and scanned `.html` files. */
function collectUsedTraits(
  names: string[],
  templates: string[],
  include: string[],
): Set<string> {
  const used = new Set<string>();
  const absorb = (html: string) => {
    for (const name of scanTraitsInHtml(html, names)) used.add(name);
  };
  for (const html of templates) absorb(html);
  for (const file of walkHtmlFiles(include)) {
    try {
      absorb(readFileSync(file, 'utf-8'));
    } catch {
      /* unreadable file — skip */
    }
  }
  return used;
}

/**
 * Union the traits carrying a `<trait>-delivery="eager"` override (#202) across
 * raw templates and scanned `.html` files — the preload set. Mirrors
 * {@link collectUsedTraits} but scans for the per-usage override.
 */
function collectPreloadTraits(
  names: string[],
  templates: string[],
  include: string[],
): Set<string> {
  const preload = new Set<string>();
  const absorb = (html: string) => {
    for (const name of scanTraitDeliveryOverrides(html, names)) preload.add(name);
  };
  for (const html of templates) absorb(html);
  for (const file of walkHtmlFiles(include)) {
    try {
      absorb(readFileSync(file, 'utf-8'));
    } catch {
      /* unreadable file — skip */
    }
  }
  return preload;
}

/**
 * The Enforcer Vite plugin. Serves the generated trait manifest at the virtual
 * module id (default `virtual:trait-manifest`).
 */
export function traitEnforcer(options: TraitEnforcerOptions): Plugin {
  const {
    traitMap,
    include = ['demos', 'src'],
    templates = [],
    scanUsage = true,
    virtualId = 'virtual:trait-manifest',
  } = options;
  const resolvedId = '\0' + virtualId;
  const names = Object.keys(traitMap);

  return {
    name: 'web-everything-trait-enforcer',

    resolveId(id) {
      return id === virtualId ? resolvedId : undefined;
    },

    load(id) {
      if (id !== resolvedId) return undefined;
      const used = scanUsage ? collectUsedTraits(names, templates, include) : new Set(names);
      // The per-usage delivery="eager" override is always scanned (it's a usage-site
      // hint, independent of the usage tree-shake toggle).
      const preload = collectPreloadTraits(names, templates, include);
      return generateManifestModule(traitMap, used, preload);
    },
  };
}
