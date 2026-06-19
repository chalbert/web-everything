// Ported from plateau/src/plugs/custom-elements/CustomElementRegistry.ts
// Scoped custom element registry with hierarchical inheritance

import HTMLRegistry, { ConstructorDefinition } from '../core/HTMLRegistry';
import CustomElement, { CustomElementOptions } from '../webcomponents/CustomElement';

const OriginalCustomElementRegistry = window.CustomElementRegistry;
const originalCustomElements = window.customElements;

// Real browsers refuse to construct a custom-element class that is not itself natively registered:
// `new RealClass()` / `Reflect.construct(RealClass, …)` throw "Illegal constructor" because the
// HTMLElement constructor resolves `new.target` against the native registry and finds nothing. The
// scoped registry can't register the real class under the *user's* tag (that tag carries a no-op
// stand-in so the browser parses `<my-el>` while the scope keeps its own definition), so the real
// class would never be legally constructible. The fix: register the real class natively under a
// unique *private* tag. That makes the class a registered constructor — so `new RealClass()` and
// `Reflect.construct(RealClass, …)` are legal — without colliding with the user's tag or its
// stand-in. We memoise per constructor (a class may be defined in several scoped registries, and a
// constructor can only be natively registered once) and only do this for autonomous elements; the
// customized-built-in path keeps its base-derived stand-in untouched.
const nativeConstructionTagFor = new WeakMap<Function, string>();
let constructionTagCounter = 0;

/**
 * Ensure `element` (an autonomous custom-element class) is legally constructible in a real browser
 * by registering it natively under a unique private tag. Idempotent per constructor.
 */
function ensureNativelyConstructible(element: ImplementedElement): void {
  if (nativeConstructionTagFor.has(element)) return;
  const privateTag = `scoped-ctor-${++constructionTagCounter}-el`;
  try {
    originalCustomElements.define(privateTag, element as unknown as CustomElementConstructor);
    nativeConstructionTagFor.set(element, privateTag);
  } catch (error) {
    // Already registered under another tag (e.g. a prior define of the same class), or the
    // environment rejects it — either way construction may already be legal; record best-effort.
    console.warn(`Failed to register private construction tag for ${privateTag}:`, error);
  }
}

export interface CustomElementRegistryOptions {
  extends?: CustomElementRegistry[];
}

export type ImplementedElement = (new (options?: CustomElementOptions) => CustomElement) & {
  formAssociated?: (typeof CustomElement)['formAssociated'],
  observedAttributes?: (typeof CustomElement)['observedAttributes'],
};

export interface ElementDefinition extends ConstructorDefinition<ImplementedElement> {
  localName: string;
  options?: ElementDefinitionOptions;
  observedAttributes?: Set<string>;
  formAssociated?: boolean;
  attributeChangedCallback?(attributeName: string, oldValue: string | null, newValue: string | null): void;
  formAssociatedCallback?(): void;
  formDisabledCallback?(): void;
  formResetCallback?(): void;
  formStateRestoreCallback?(): void;
}

/**
 * Scoped CustomElementRegistry that supports hierarchical inheritance.
 * Allows different parts of the DOM tree to have different element definitions.
 * 
 * Key features:
 * - Scoped registries (different definitions in different DOM subtrees)
 * - Registry inheritance (extends option)
 * - Stand-in elements for native customElements compatibility
 * - Form-associated custom elements support
 * 
 * @example
 * const registry = new CustomElementRegistry();
 * registry.define('my-element', MyElement);
 */
export default class CustomElementRegistry extends HTMLRegistry<ElementDefinition, ImplementedElement> {
  localName = 'customElements';

  /** Pending `whenDefined(name)` resolvers, settled the moment that name is `define`d (#1101). */
  #whenDefinedResolvers = new Map<string, ((ctor: ImplementedElement) => void)[]>();

  define(name: string, element: ImplementedElement, options?: ElementDefinitionOptions) {
    // Reject a duplicate name or constructor on THIS registry, mirroring native
    // CustomElementRegistry.define() (#1102). The same constructor may live in *different* scoped
    // registries, so this is a per-registry (own) check, not the global native-construction memo.
    if (this.hasOwn(name)) {
      throw new DOMException(
        `Failed to execute 'define' on 'CustomElementRegistry': the name "${name}" has already been used with this registry`,
        'NotSupportedError',
      );
    }
    const existingName = this.getLocalNameOf(element);
    if (existingName !== undefined) {
      throw new DOMException(
        `Failed to execute 'define' on 'CustomElementRegistry': the constructor has already been used with this registry (as "${existingName}")`,
        'NotSupportedError',
      );
    }

    // For autonomous elements, register the real class natively under a private tag first so the
    // browser will permit constructing it (see ensureNativelyConstructible). Without this, the
    // `new element()` below — and the `Reflect.construct(element, …)` upgrade path — throw
    // "Illegal constructor" in a real browser. Customized built-ins keep their existing path.
    if (!options?.extends) {
      ensureNativelyConstructible(element);
    }

    // Create a temporary instance to get instance properties (like callbacks defined with =)
    const tempInstance = new element();

    const definition: ElementDefinition = {
      constructor: element,
      localName: name,
      options,
      connectedCallback: tempInstance.connectedCallback || element.prototype.connectedCallback,
      disconnectedCallback: tempInstance.disconnectedCallback || element.prototype.disconnectedCallback,
      attributeChangedCallback: tempInstance.attributeChangedCallback || element.prototype.attributeChangedCallback,
      adoptedCallback: tempInstance.adoptedCallback || element.prototype.adoptedCallback,
      formAssociatedCallback: tempInstance.formAssociatedCallback || element.prototype.formAssociatedCallback,
      formDisabledCallback: tempInstance.formDisabledCallback || element.prototype.formDisabledCallback,
      formResetCallback: tempInstance.formResetCallback || element.prototype.formResetCallback,
      formStateRestoreCallback: tempInstance.formStateRestoreCallback || element.prototype.formStateRestoreCallback,
      formAssociated: element.formAssociated,
      observedAttributes: new Set(element.observedAttributes || []),
    };

    this.set(name, definition);

    // Resolve any pending whenDefined(name) promises now the name is registered (#1101).
    const pending = this.#whenDefinedResolvers.get(name);
    if (pending) {
      this.#whenDefinedResolvers.delete(name);
      pending.forEach((resolve) => resolve(element));
    }

    // Register stand-in element with native customElements if not already registered
    // This allows the browser to parse the custom element tag
    if (!originalCustomElements.get(name)) {
      const StandInElement = this.#getStandInElement(options);
      try {
        originalCustomElements.define(name, StandInElement, options);
      } catch (error) {
        // Element may already be defined in native registry
        console.warn(`Failed to define stand-in for ${name}:`, error);
      }
    }
  }

  /**
   * Build the native stand-in element class the browser registers so it can PARSE a scoped custom-element
   * tag (the real scoped class is resolved on construction/upgrade). An autonomous element stands in on
   * `HTMLElement`; a customized built-in (`options.extends`) stands in on the matching `HTML*Element` base
   * (e.g. `extends: 'button'` → `HTMLButtonElement`), falling back to `HTMLElement` when that base is absent.
   */
  #getStandInElement(options?: ElementDefinitionOptions): typeof HTMLElement {
    const ext = options?.extends;
    const BaseClass: typeof HTMLElement = ext
      ? ((window as any)[`HTML${ext.charAt(0).toUpperCase()}${ext.slice(1)}Element`] as typeof HTMLElement) || HTMLElement
      : HTMLElement;
    return class extends BaseClass {};
  }

  // Concrete native signature — not `Parameters<typeof OriginalCustomElementRegistry…>`,
  // which would be self-referential here (this class is assigned to window.CustomElementRegistry).
  upgrade(root: Node): void {
    OriginalCustomElementRegistry.prototype.upgrade.apply(this, [root]);
  }

  downgrade() {
    // TODO: What should downgrade do?
    // Placeholder for future implementation
  }

  /**
   * Returns a promise that resolves when the custom element with the given name is defined.
   * Compatible with native CustomElementRegistry.whenDefined()
   */
  whenDefined(name: string): Promise<ImplementedElement> {
    // Fast path: already defined here (or up the extends chain).
    if (this.has(name)) {
      return Promise.resolve(this.get(name)!);
    }

    // Otherwise resolve on the next matching define(name, …) — a real pending promise keyed by name,
    // mirroring native CustomElementRegistry.whenDefined() (#1101).
    return new Promise((resolve) => {
      const list = this.#whenDefinedResolvers.get(name) ?? [];
      list.push(resolve);
      this.#whenDefinedResolvers.set(name, list);
    });
  }

  /**
   * Gets the constructor for a defined custom element.
   * Returns undefined if the element is not defined.
   */
  get(name: string): ImplementedElement | undefined {
    return super.get(name);
  }
}
