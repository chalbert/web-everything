/**
 * Render Strategy contract — Axis-2 of the JSX adapter (how a tree updates over time).
 *
 * Spec:   /projects/webcomponents/#protocol-render-strategy
 * Report: reports/2026-06-06-render-strategy-axis.md
 *
 * Sibling of CustomChangeStrategy (Web States): change strategies DETECT what mutated;
 * render strategies COMMIT how the DOM reflects it. This file ships the CONTRACT only;
 * the native-first default provider is DeclarativeStaticStrategy.
 *
 * @module blocks/renderers/jsx/render-strategy
 */

/**
 * Strategy-shaped input to {@link CustomRenderStrategy.mount}. For the declarative-static
 * strategy this is a pre-built DOM tree (already produced by the JSX factory) or text.
 *
 * Backlog #080 generalises this to a tagged union once the vdom / fine-grained inputs
 * (a `render()` thunk, a reactive computation) are designed.
 */
export type RenderInput = Node | DocumentFragment | string;

/**
 * Opaque scope token. Reserved for full injector-chain resolution, which composes later
 * (the same seam CustomChangeStrategyRegistry will use). Carried through mount so a strategy
 * can associate a scope without the registry needing the full Injector yet.
 */
export interface RenderScope {
  readonly id?: string;
}

/**
 * Handle returned by {@link CustomRenderStrategy.mount}; used to update or dispose the
 * mounted tree later.
 */
export interface RenderHandle {
  /** Name of the strategy that produced this handle. */
  readonly strategy: string;
  /** Host the tree was mounted into. */
  readonly host: ParentNode;
  /** Top-level nodes that were inserted (captured at mount time for dispose). */
  readonly nodes: readonly Node[];
}

/**
 * A registered mechanism that turns a {@link RenderInput} into committed DOM updates.
 *
 * Capability is feature-detected by which OPTIONAL methods are present: a strategy without
 * `update` is **mount-once** (the historical eager construct-once DOM behaviour). This is the
 * identical convention to CustomChangeStrategy, whose optional `diff`/`applyInverse` advertise
 * capability the same way.
 */
export interface CustomRenderStrategy {
  /** Unique registry name, e.g. `declarative-static`. */
  readonly name: string;
  /** Realize `tree` into live DOM under `host`; return a handle for later calls. */
  mount(tree: RenderInput, host: ParentNode, scope?: RenderScope): RenderHandle;
  /** Reflect new state into the mounted tree. Absent ⇒ mount-once. */
  update?(handle: RenderHandle, next: RenderInput): void;
  /** Tear down bindings/subscriptions; leave the DOM removable. */
  dispose?(handle: RenderHandle): void;
}
