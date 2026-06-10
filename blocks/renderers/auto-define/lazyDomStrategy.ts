/**
 * `lazy-dom` — the reference *inferring* Auto-Define strategy (#242): register a custom element the
 * first time its tag is actually present in the DOM, by dynamically importing its defining module. This
 * is the "lazy-load web components with a MutationObserver" pattern (CSS-Tricks, cited in #227) reified
 * as an {@link AutoDefineStrategy}: it fills in the optional `resolve` (unknown tag → defining module)
 * the `explicit` baseline omits, and pairs with {@link createDomPresenceObserver} — the driver that
 * watches for undefined elements and runs the strategy.
 *
 * Spec: /projects/webcomponents/#protocol-auto-define-strategy
 * @module blocks/renderers/auto-define
 */
import {
  type AutoDefineStrategy,
  type DefiningModule,
  type RegistryScope,
  defineElement,
} from './defineElement';

/** Resolve an unknown tag to the module specifier that defines it. */
export type TagResolver = (tag: string) => DefiningModule | undefined;

export interface LazyDomOptions {
  /**
   * Map an unknown tag to its defining module. Defaults to the convention `./{tag}.js` relative to the
   * importing context — projects override it with a manifest- or alias-backed resolver.
   */
  resolve?: TagResolver;
}

/** The default convention: a tag `foo-bar` is defined by the sibling module `./foo-bar.js`. */
export const conventionResolver: TagResolver = (tag) => ({ specifier: `./${tag}.js` });

/**
 * Build a `lazy-dom` strategy with a custom tag→module resolver. The strategy object satisfies the
 * `AutoDefineStrategy` contract (so it registers like any other) and carries the `resolve` an inferring
 * strategy needs; the actual DOM watching is done by {@link createDomPresenceObserver}.
 */
export function createLazyDomAutoDefine(options: LazyDomOptions = {}): AutoDefineStrategy {
  const resolve = options.resolve ?? conventionResolver;
  return {
    key: 'lazy-dom',
    trigger: 'first-use',
    resolve,
    define: (tag: string, ctor: CustomElementConstructor, _scope?: RegistryScope) => defineElement(tag, ctor),
  };
}

/** The default `lazy-dom` strategy (convention resolver). */
export const lazyDomAutoDefine: AutoDefineStrategy = createLazyDomAutoDefine();

/** Whether a tag is a custom-element tag (hyphenated) that the platform has not yet defined. */
function isUndefinedCustomTag(tag: string): boolean {
  return tag.includes('-') && !customElements.get(tag);
}

export interface DomPresenceObserverOptions {
  /**
   * Import a resolved module specifier. The imported module is expected to self-register the tag
   * (via its own `defineElement(...)` call). Defaults to a native dynamic `import()`. Injectable so the
   * mechanism is testable without a real module graph.
   */
  import?: (specifier: string) => Promise<unknown>;
  /** Notified after a tag's module has been imported (for tests / instrumentation). */
  onResolve?: (tag: string, module: DefiningModule) => void;
}

/**
 * The DOM-presence driver: watch `root` for custom-element tags that are present but `:not(:defined)`,
 * and for each, resolve its defining module via `strategy.resolve` and import it (which self-registers
 * the tag) — the first-use trigger in practice. Processes the initial tree once, then keeps watching via
 * a `MutationObserver`. Returns a `disconnect()` to stop. A no-op if the strategy cannot infer
 * (`resolve` absent — e.g. the `explicit` baseline).
 */
export function createDomPresenceObserver(
  strategy: AutoDefineStrategy,
  root: ParentNode = document,
  options: DomPresenceObserverOptions = {},
): () => void {
  const importModule = options.import ?? ((specifier: string) => import(/* @vite-ignore */ specifier));
  if (!strategy.resolve) return () => {}; // non-inferring strategy — nothing to watch for

  const inFlight = new Set<string>(); // dedupe concurrent resolves of the same tag

  const tryResolve = (tag: string): void => {
    if (!isUndefinedCustomTag(tag) || inFlight.has(tag)) return;
    const mod = strategy.resolve?.(tag);
    const resolved = mod instanceof Promise ? mod : Promise.resolve(mod);
    inFlight.add(tag);
    void resolved
      .then((module) => {
        if (!module) return;
        return Promise.resolve(importModule(module.specifier)).then(() => {
          options.onResolve?.(tag, module);
        });
      })
      .finally(() => inFlight.delete(tag));
  };

  const scan = (node: ParentNode): void => {
    // The node itself may be a custom element, plus any descendants.
    if (node instanceof Element && isUndefinedCustomTag(node.localName)) tryResolve(node.localName);
    // Sweep + filter by tag — portable across DOM engines (some don't implement `:defined`). A browser
    // could narrow this to `querySelectorAll(':not(:defined)')` as an optimization; `isUndefinedCustomTag`
    // is the equivalent predicate (hyphenated tag, not yet in the registry).
    node.querySelectorAll?.('*').forEach((el) => {
      if (isUndefinedCustomTag(el.localName)) tryResolve(el.localName);
    });
  };

  scan(root);

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((n) => {
        if (n instanceof Element) scan(n);
      });
    }
  });
  observer.observe(root instanceof Document ? root.documentElement : (root as Node), {
    childList: true,
    subtree: true,
  });

  return () => observer.disconnect();
}
