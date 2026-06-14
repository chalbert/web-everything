/**
 * Source-resolution plane — *given a rendered DOM node, yield its `file:line` source construct* (#575,
 * the keystone build graduating from decision #562, ratified 2026-06-14). The Plateau dev-browser is
 * the consumer; the contract + registry are WE-standard-owned (#475/#091 split).
 *
 * Two coupled pieces, both shipped here as a standalone, dependency-free model (like the
 * validator-resolution (#214) and validity-merge (#212) planes — the runtime plug fulfils the same
 * shape; nothing here imports a framework or the DOM-as-environment):
 *
 *   1. **Source-anchor self-description contract** (#562 Fork 1, ruling A) — a build-emitted,
 *      minification-surviving anchor that maps a node back to source: an **opaque-id `data-*` attribute
 *      + a separately-served sidecar manifest** (`id → file:line`). It is authored as an *extension of
 *      the app's introspectable self-description* — it reuses the capability-manifest's `specVersion`
 *      framing and is **not** a protocol (no swappable-vendor interop story; one shape, opaque ids).
 *      **Fixed invariant: emission is opt-in, off by default** — a build ships no anchors and no
 *      manifest unless the author enables it; the manifest may be access-gated to an authorized session.
 *
 *   2. **Resolver provider set** — the precedence-ordered providers a consumer consults: build-emitted
 *      source anchor (the *only* cold-deployed-capable family) → framework debug metadata (dev-only,
 *      React-19-fragile — never built on framework internals) → source maps (ECMA-426; JS-position
 *      granularity, usually stripped). Degrades to **inert** (yields `null`) when none resolves.
 *
 * The registry + chain live in `./registry.ts`; the default wiring in `./index.ts`.
 */

/**
 * A resolved source location — the terminal a resolver yields. `column` is optional: an anchor maps to
 * a construct (file:line), a source map can refine to a column. Opaque downstream — an IDE bridge
 * (#576) consumes it; this plane never opens a file.
 */
export interface SourceLocation {
  file: string;
  line: number;
  column?: number;
}

/**
 * The opaque-id attribute a build emits onto a rendered element (#562 Fork 1, ruling A — the
 * *least-leaky* variant: an opaque id, **not** a raw `file:line` in public DOM). A minifier renames JS
 * identifiers, never emitted markup strings, so the attribute survives a cold/minified prod build —
 * the one property that makes this the sole cold-deployed-capable resolver. Named, not freeform, so a
 * resolver and an emitter agree without coining a protocol.
 */
export const SOURCE_ANCHOR_ATTR = 'data-we-source-id';

/**
 * The sidecar manifest an opt-in build serves **separately** from the DOM (so the public markup leaks
 * only an opaque id; the `id → file:line` map is access-gated). An extension of the introspectable
 * self-description: it carries the capability-manifest's `specVersion` framing verbatim so a consumer
 * can version-check it the same way, without re-deriving the convention.
 *
 * **Off by default** — the absence of a manifest is the normal production state; a resolver built over
 * an absent manifest degrades to inert, it never throws.
 */
export interface SourceAnchorManifest {
  /** Semver of the anchor-manifest shape (reuses the capability-manifest convention; additive → minor). */
  specVersion: string;
  /** Opaque-id → source location. The map a sidecar serves; keyed by the value of {@link SOURCE_ANCHOR_ATTR}. */
  anchors: Record<string, SourceLocation>;
}

/** The current anchor-manifest spec version. Append-only fields bump the minor; a removal bumps the major. */
export const SOURCE_ANCHOR_SPEC_VERSION = '1.0.0';

/** Read the opaque source-anchor id off an element, or `null` when the build emitted none (opt-in off). */
export function readSourceAnchorId(node: Element): string | null {
  const id = node.getAttribute?.(SOURCE_ANCHOR_ATTR);
  return id && id.length > 0 ? id : null;
}

/**
 * The injectable contract every resolver satisfies — one interface, swappable impls
 * (anchor / framework-debug / source-map / custom). `key` names it for registration; `resolve` maps a
 * node to a location or `null` when *this* resolver can't (the chain then tries the next). A resolver
 * is **pure w.r.t. the registry**: it never mutates the node and never throws on a miss — a miss is
 * `null`, which is how the chain degrades to inert.
 */
export interface CustomSourceResolver {
  readonly key: string;
  resolve(node: Element): SourceLocation | null;
}

/**
 * The cold-deployed-capable resolver: reads the opaque id off the node and looks it up in the sidecar
 * manifest. The **only** family that survives a stripped prod build. Constructed with the manifest a
 * consumer fetched (or `null`/empty when emission is off) — an absent/empty manifest makes every
 * `resolve` a clean `null`, never an error.
 */
export class SourceAnchorResolver implements CustomSourceResolver {
  readonly key = 'source-anchor';
  readonly #anchors: Record<string, SourceLocation>;

  constructor(manifest?: SourceAnchorManifest | null) {
    this.#anchors = manifest?.anchors ?? {};
  }

  resolve(node: Element): SourceLocation | null {
    const id = readSourceAnchorId(node);
    if (id === null) return null;
    return this.#anchors[id] ?? null;
  }
}

/**
 * Framework debug-metadata resolver (`__source`/`_debugSource`, LocatorJS-style). **Dev-only and
 * deliberately conservative**: React 19 removed `_debugSource` (PR #28265), breaking ~8 tools, so this
 * never *builds on* framework internals — it reads a `__source`-shaped property defensively if one
 * happens to be present and yields `null` otherwise. Zero cold-deployed reach by design; it sits in the
 * chain below the anchor so a dev build still benefits when the metadata is there.
 */
export class FrameworkDebugResolver implements CustomSourceResolver {
  readonly key = 'framework-debug';

  resolve(node: Element): SourceLocation | null {
    // `__source` is a non-standard, dev-build-injected property — read it defensively, never require it.
    const src = (node as unknown as { __source?: { fileName?: string; lineNumber?: number; columnNumber?: number } }).__source;
    if (!src || typeof src.fileName !== 'string' || typeof src.lineNumber !== 'number') return null;
    return { file: src.fileName, line: src.lineNumber, column: src.columnNumber };
  }
}

/**
 * Source-map resolver (ECMA-426). A registered placeholder that is **inert by default**: source maps
 * map *JS positions*, not DOM nodes, and are usually stripped or authorization-gated on a deployed
 * build — wrong granularity and rarely present. It holds the precedence slot (below framework-debug)
 * so a future consumer that *has* a JS-position hook can supply a real lookup; absent one it yields
 * `null`, keeping the chain degrading.
 */
export class SourceMapResolver implements CustomSourceResolver {
  readonly key = 'source-map';

  resolve(_node: Element): SourceLocation | null {
    return null;
  }
}
