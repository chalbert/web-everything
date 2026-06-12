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

export type ImplementedElement = (new (options: CustomElementOptions) => CustomElement) & {
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

  define(name: string, element: ImplementedElement, options?: ElementDefinitionOptions) {
    // TODO: Validate that no element with same name or constructor exists on this registry

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

    // Register stand-in element with native customElements if not already registered
    // This allows the browser to parse the custom element tag
    if (!originalCustomElements.get(name)) {
      // TODO: Implement getStandInElement() function
      // For now, register a simple class
      const BaseClass = options?.extends ? (window as any)[`HTML${options.extends.charAt(0).toUpperCase() + options.extends.slice(1)}Element`] || HTMLElement : HTMLElement;
      const StandInElement = class extends BaseClass {};
      
      try {
        originalCustomElements.define(name, StandInElement, options);
      } catch (error) {
        // Element may already be defined in native registry
        console.warn(`Failed to define stand-in for ${name}:`, error);
      }
    }
  }

  upgrade(...args: Parameters<typeof OriginalCustomElementRegistry.prototype.upgrade>) {
    OriginalCustomElementRegistry.prototype.upgrade.apply(this, args);
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
    if (this.has(name)) {
      return Promise.resolve(this.get(name)!);
    }

    // TODO: Implement proper promise that resolves when element is defined
    return new Promise((resolve, reject) => {
      reject(new Error(`whenDefined() not fully implemented yet for: ${name}`));
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
