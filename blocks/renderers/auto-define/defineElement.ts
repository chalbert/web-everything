/**
 * Auto-Define contract — the native-baseline self-registration mechanic for generated and
 * hand-authored custom elements (Axis: *when/how a tag↔class binding enters the registry*).
 *
 * Spec:   /projects/webcomponents/#protocol-auto-define-strategy
 * Report: graduated from the #227 ruling (Auto-Define Strategy Protocol).
 *
 * This file ships the parts that need NO strategy object: the `defineElement` helper every
 * module calls, and the `AutoDefineStrategy` CONTRACT with its native-first `explicit` baseline.
 * The inferring strategies (lazy-dom / build-parsed / manifest) and the resolving registry land
 * in #242 — they are the ones that fill in `resolve`. This file's contract mirrors the published
 * protocol page exactly; the implementation conforms to the spec, not the other way round.
 *
 * Sibling of CustomRenderStrategy (Render Strategy): both are contract-only files whose default
 * provider is the platform-native behaviour. Here the native behaviour is `customElements.define`,
 * made idempotent so re-import / duplicate tag / HMR re-run stop throwing.
 *
 * @module blocks/renderers/auto-define
 */

/**
 * Idempotent, collision-safe, HMR-safe element registration — the **one call every module makes**
 * (generated OR hand-authored).
 *
 * `customElements.define(tag, ctor)` throws if `tag` (or `ctor`) is already registered, so a bare
 * top-level call breaks on re-import, a duplicate tag, or an HMR module re-run. Guarding on
 * `customElements.get(tag)` makes the call a no-op once the tag is taken — registration stays
 * one-shot per tag for the page, exactly as the platform intends, but no longer fatal to re-entry.
 */
export function defineElement(tag: string, ctor: CustomElementConstructor): void {
  if (!customElements.get(tag)) customElements.define(tag, ctor);
}

/**
 * When an {@link AutoDefineStrategy} performs its `define`. The native baseline is `import`:
 * registration happens eagerly when the module is imported (the generated `defineElement(...)`
 * call). The inferring triggers (#242) defer it — first-use (DOM presence), in-viewport, build-time,
 * server-render — but share this same contract.
 */
export type AutoDefineTrigger = 'import' | 'first-use' | 'in-viewport' | 'build-time' | 'server-render';

/**
 * Opaque scope token. Default scope is the global registry; this is reserved for the Scoped Custom
 * Element Registries proposal (#228), so a strategy can target a non-global registry without the
 * contract needing the full registry type yet.
 */
export interface RegistryScope {
  readonly id?: string;
}

/**
 * The module that, once imported, defines a requested (unknown) tag — what an inferring strategy's
 * `resolve` returns. The shape grows with the registry in #242; the contract only needs the
 * specifier to import.
 */
export interface DefiningModule {
  readonly specifier: string;
}

/**
 * A registered mechanism that binds a tag to a constructor in some registry.
 *
 * Capability is feature-detected by which OPTIONAL methods are present: a strategy without
 * `resolve` cannot infer the defining module for an unknown tag — it relies on the author/generator
 * already having imported it (the `explicit` baseline). This is the identical convention to
 * {@link CustomRenderStrategy}, whose optional `update`/`dispose` advertise capability the same way.
 */
export interface AutoDefineStrategy {
  /** Unique registry name, e.g. `explicit`. */
  readonly key: string;
  /** When this strategy triggers a define. */
  readonly trigger: AutoDefineTrigger;
  /**
   * Resolve an unknown tag to its defining module. Absent ⇒ no inference (the author/generator
   * already imported the module). Present on the inferring strategies (#242).
   */
  resolve?(tag: string): Promise<DefiningModule> | DefiningModule | undefined;
  /** Perform the registration. Default scope is the global registry. */
  define(tag: string, ctor: CustomElementConstructor, scope?: RegistryScope): void;
}

/**
 * The native-first baseline strategy — the one that needs no strategy object: `define` is just the
 * idempotent {@link defineElement}, and there is **no `resolve`** (the module is already imported,
 * so there is no unknown tag to infer). Every generated module uses this implicitly by emitting a
 * top-level `defineElement(...)` call; this object reifies that behaviour so the registry (#242) can
 * treat it as one strategy among the inferring ones.
 */
export const explicitAutoDefine: AutoDefineStrategy = {
  key: 'explicit',
  trigger: 'import',
  define: (tag, ctor) => defineElement(tag, ctor),
};
