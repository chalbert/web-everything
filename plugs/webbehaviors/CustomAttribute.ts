/**
 * @file CustomAttribute.ts
 * @description Base class for custom attributes with lifecycle management
 * @source Migrated from plateau/src/plugs/custom-attributes/CustomAttribute.ts
 */

import type { ConstructorDefinition } from '../core/HTMLRegistry';
import InjectorRoot from '../webinjectors/InjectorRoot';

/**
 * Track custom attributes attached to elements
 */
const elementRegistrationMap = new Map<Element, CustomAttribute[]>();

/**
 * Store referenced custom attributes for lazy resolution
 */
const referencedCustomAttributes = new Map<symbol, typeof CustomAttribute>();

/**
 * Options for creating a CustomAttribute instance
 */
export interface CustomAttributeOptions {
  name?: string;
  value?: string;
}

/**
 * Type for an implemented custom attribute constructor
 */
export type ImplementedAttribute = (new (options?: CustomAttributeOptions) => CustomAttribute) & {
  formAssociated?: (typeof CustomAttribute)['formAssociated'];
  observedAttributes?: (typeof CustomAttribute)['observedAttributes'];
};

/**
 * Abstract base class for custom attributes
 * 
 * Custom attributes extend native element behavior through declarative attributes.
 * They have lifecycle methods similar to Custom Elements and can observe attribute changes.
 * 
 * @example
 * ```typescript
 * class TooltipAttribute extends CustomAttribute {
 *   attachedCallback() {
 *     console.log('Tooltip attached to', this.target);
 *   }
 * 
 *   attributeChangedCallback(name, oldValue, newValue) {
 *     if (name === 'tooltip') {
 *       this.updateTooltip(newValue);
 *     }
 *   }
 * }
 * ```
 */
export default abstract class CustomAttribute<
  Options extends CustomAttributeOptions = CustomAttributeOptions,
  Target extends HTMLElement = HTMLElement,
> {
  /**
   * Array of attribute names to observe for changes
   * Similar to observedAttributes in Custom Elements
   */
  static observedAttributes?: string[];

  /**
   * Whether this attribute is associated with form functionality
   */
  static formAssociated?: boolean;

  /**
   * The target element this attribute is attached to
   */
  #target: Target | undefined;

  /**
   * The current value of the attribute
   */
  #value: string = '';

  /**
   * The name of the attribute (for dynamic naming)
   */
  #name: string | undefined;

  /**
   * Get the current attribute value
   */
  get value(): string {
    return this.#value;
  }

  /**
   * Set the attribute value and sync with target element
   */
  set value(value: string) {
    this.#value = value;
    const attributeName = this.#name || this.localName;
    if (this.target && attributeName !== '[[undetermined]]') {
      this.target.setAttribute(attributeName, value);
    }
  }

  /**
   * Set the attribute name (only if localName not yet determined)
   */
  set name(name: string) {
    if (!this.localName || this.localName === '[[undetermined]]') {
      this.#name = name;
    }
  }

  /**
   * Get the attribute name
   */
  get name(): string {
    return this.#name || this.localName;
  }

  /**
   * Options passed during construction
   */
  options: Options;

  /**
   * Create a new CustomAttribute instance
   * 
   * @param options - Configuration options
   */
  constructor(options: Options = {} as Options) {
    this.options = options;
    this.#name = options.name;
    
    if (options.value) {
      this.#value = options.value;
    }

    // Set up prototype chain to extend Attr
    let proto = Object.getPrototypeOf(this);
    while (proto instanceof CustomAttribute) {
      proto = Object.getPrototypeOf(proto);
    }
    Object.setPrototypeOf(proto, Attr.prototype);
  }

  /**
   * Get the target element this attribute is attached to
   */
  get target(): Target | undefined {
    return this.#target;
  }

  /**
   * Create a unique symbol reference for this attribute class
   * Used for lazy registration and resolution
   * 
   * @returns A unique symbol identifier
   */
  static pushRef(): symbol {
    const ref = Symbol(this.name);
    referencedCustomAttributes.set(ref, this);
    return ref;
  }

  /**
   * Resolve and remove a symbol reference
   * 
   * @param ref - The symbol to resolve
   * @returns The attribute class associated with the symbol
   */
  static dropRef(ref: symbol): typeof CustomAttribute | undefined {
    const Attribute = referencedCustomAttributes.get(ref);
    referencedCustomAttributes.delete(ref);
    return Attribute;
  }

  /**
   * Convert the class to a symbol reference (used in template literals)
   * 
   * @returns A unique symbol identifier
   */
  static toString(): symbol {
    return this.pushRef();
  }

  /**
   * Get the local name of this attribute within its registry
   * Looks up the name from the closest injector's customAttributes registry
   * 
   * @returns The registered local name or '[[undetermined]]'
   */
  get localName(): string {
    if (this.target) {
      const constructor = this.constructor as ConstructorDefinition<ImplementedAttribute>['constructor'];
      const localName = InjectorRoot.getLocalNameInProviderOf(
        this.target,
        'customAttributes',
        constructor
      );

      if (localName) {
        return localName;
      }
    }

    return '[[undetermined]]';
  }

  /**
   * Whether this attribute is currently connected to the DOM
   */
  isConnected: boolean = false;

  // Lifecycle callbacks

  /**
   * Called when the attribute is attached to an element
   */
  attachedCallback?(): void;

  /**
   * Called when the attribute is detached from an element
   */
  detachedCallback?(): void;

  /**
   * Called when the element is connected to the document
   */
  connectedCallback?(): void;

  /**
   * Called when the element is disconnected from the document
   */
  disconnectedCallback?(): void;

  /**
   * Called when the element is moved to a new document
   */
  adoptedCallback?(): void;

  /**
   * Called when an observed attribute changes
   * 
   * @param attributeName - The name of the changed attribute
   * @param oldValue - The previous value
   * @param newValue - The new value
   */
  attributeChangedCallback?(attributeName: string, oldValue: string | null, newValue: string | null): void;

  /**
   * Called when the element is associated with a form
   * Only called if formAssociated is true
   */
  formAssociatedCallback?(): void;

  /**
   * Called when the form's disabled state changes
   */
  formDisabledCallback?(): void;

  /**
   * Called when the form is reset
   */
  formResetCallback?(): void;

  /**
   * Called when the form state is restored
   */
  formStateRestoreCallback?(): void;

  /**
   * Attach this attribute to a target element
   * 
   * @param target - The element to attach to
   */
  attach(target: Target): void {
    this.#target = target;

    // Register this attribute instance with the element
    if (!elementRegistrationMap.has(target)) {
      elementRegistrationMap.set(target, []);
    }
    elementRegistrationMap.get(target)?.push(this);

    // Call lifecycle callback
    this.attachedCallback?.();
  }

  /**
   * Detach this attribute from its target element
   */
  detach(): void {
    if (this.#target) {
      const registrations = elementRegistrationMap.get(this.#target);
      if (registrations) {
        const index = registrations.indexOf(this);
        if (index !== -1) {
          registrations.splice(index, 1);
        }
      }
    }
    this.#target = undefined;
  }

  /**
   * Get all custom attributes attached to an element
   * 
   * @param element - The element to query
   * @returns Array of attached custom attributes
   */
  static getAttachedAttributes(element: Element): CustomAttribute[] {
    return elementRegistrationMap.get(element) || [];
  }
}
