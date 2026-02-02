/**
 * @file CustomAttributeRegistry.ts
 * @description Registry for managing custom attribute definitions and lifecycle
 * @source Migrated from plateau/src/plugs/custom-attributes/CustomAttributesRegistry.ts
 */

import HTMLRegistry, { type ConstructorDefinition } from '../core/HTMLRegistry';
import CustomAttribute, { type ImplementedAttribute } from './CustomAttribute';

/**
 * Options for defining a custom attribute
 */
export interface CustomAttributeOptions {
  /**
   * Limit this attribute to specific tag names
   * Empty array means all elements
   */
  tagNames?: string[];
  
  /**
   * Type of attribute behavior
   * - 'binding': Bound to specific syntax patterns
   * - 'behavior': Standard attribute behavior
   */
  type?: 'binding' | 'behavior';
}

/**
 * Definition for a registered custom attribute
 */
export interface AttributeDefinition extends ConstructorDefinition<ImplementedAttribute> {
  attachedCallback?(): void;
  detachedCallback?(): void;
  attributeChangedCallback?: (name: string, oldValue: string | null, newValue: string | null) => void;
  formAssociatedCallback?: (...args: unknown[]) => void;
  formDisabledCallback?: (...args: unknown[]) => void;
  formResetCallback?: (...args: unknown[]) => void;
  formStateRestoreCallback?: (...args: unknown[]) => void;
  formAssociated?: boolean;
  observedAttributes: Set<string>;
  tagNames: Set<string>;
}

/**
 * Registry for managing custom attributes with automatic observation
 * 
 * Extends HTMLRegistry to provide:
 * - Attribute definition storage
 * - MutationObserver-based attribute lifecycle management
 * - Automatic attach/detach on attribute changes
 * - Per-element attribute instance tracking
 * 
 * @example
 * ```typescript
 * const registry = new CustomAttributeRegistry();
 * 
 * class TooltipAttribute extends CustomAttribute {
 *   attachedCallback() {
 *     console.log('Tooltip attached');
 *   }
 * }
 * 
 * registry.define('tooltip', TooltipAttribute);
 * registry.upgrade(document.body);
 * ```
 */
export default class CustomAttributeRegistry extends HTMLRegistry<AttributeDefinition, ImplementedAttribute> {
  /**
   * MutationObservers for each root node being watched
   */
  #observers: Map<RootNode, MutationObserver> = new Map();

  /**
   * Local name for this registry type (used by InjectorRoot)
   */
  localName = 'customAttributes';

  /**
   * Track attribute instances per element
   * Map<Element, Map<AttributeConstructor, AttributeInstance>>
   */
  #registrations = new Map<Element, Map<ImplementedAttribute, CustomAttribute>>();

  /**
   * Define a new custom attribute
   * 
   * @param name - The attribute name to register
   * @param attribute - The CustomAttribute class
   * @param options - Configuration options
   */
  define(name: string, attribute: ImplementedAttribute, { tagNames = [] }: CustomAttributeOptions = {}): void {
    const definition: AttributeDefinition = {
      constructor: attribute,
      connectedCallback: attribute.prototype.connectedCallback,
      disconnectedCallback: attribute.prototype.disconnectedCallback,
      attributeChangedCallback: attribute.prototype.attributeChangedCallback,
      adoptedCallback: attribute.prototype.adoptedCallback,
      formAssociatedCallback: attribute.prototype.formAssociatedCallback,
      formDisabledCallback: attribute.prototype.formDisabledCallback,
      formResetCallback: attribute.prototype.formResetCallback,
      formStateRestoreCallback: attribute.prototype.formStateRestoreCallback,
      formAssociated: attribute.formAssociated,
      observedAttributes: new Set(attribute.observedAttributes?.map((attr) => attr.toLowerCase()) || []),
      tagNames: new Set(tagNames.map((tag) => tag.toLowerCase())),
    };

    this.set(name, definition);
  }

  /**
   * Upgrade a DOM tree to activate custom attributes
   * 
   * @param root - The root node to upgrade
   */
  upgrade(root: RootNode): void {
    this.#addAttributesOnTree(root);
    this.#disconnect(root);
    this.#observe(root);
  }

  /**
   * Downgrade a DOM tree to deactivate custom attributes
   * 
   * @param root - The root node to downgrade
   */
  downgrade(root: RootNode): void {
    this.#removeAttributesFromTree(root);
    this.#disconnect(root);
  }

  /**
   * Update an attribute on an element (add, update, or remove)
   */
  #update(element: HTMLElement, attributeName: string, oldValue: string | null): void {
    const definition = this.getDefinition(attributeName);
    const Attribute = definition?.constructor as ImplementedAttribute | undefined;

    if (Attribute) {
      const hasAttribute = element.hasAttribute(attributeName);
      const hasInstance = this.#registrations.get(element)?.has(Attribute);

      if (hasAttribute) {
        if (hasInstance) {
          // Update existing attribute
          this.#updateAttribute(element, attributeName, Attribute, oldValue);
        } else {
          // Add new attribute
          this.#addAttribute(element, Attribute, attributeName);
        }
      } else if (hasInstance) {
        // Remove attribute
        this.#removeAttribute(element, Attribute);
      }
    }
  }

  /**
   * Add a custom attribute instance to an element
   */
  #addAttribute(element: HTMLElement, Attribute: ImplementedAttribute, attributeName?: string): void {
    const existingInstance = this.#registrations.get(element)?.get(Attribute);
    
    if (!existingInstance) {
      // Create instance storage if needed
      if (!this.#registrations.has(element)) {
        this.#registrations.set(element, new Map());
      }

      // Create and attach attribute instance
      const value = attributeName ? element.getAttribute(attributeName) : undefined;
      const attributeInstance = new Attribute({
        name: attributeName,
        value: value || undefined,
      });
      
      attributeInstance.attach(element);
      this.#registrations.get(element)?.set(Attribute, attributeInstance);

      // Call lifecycle callbacks
      attributeInstance.attachedCallback?.();

      if (element.isConnected && !attributeInstance.isConnected) {
        attributeInstance.isConnected = true;
        attributeInstance.connectedCallback?.();
      }
    }
  }

  /**
   * Update an existing custom attribute instance
   */
  #updateAttribute(
    element: HTMLElement,
    attributeName: string,
    Attribute: ImplementedAttribute,
    oldValue: string | null
  ): void {
    const attributeInstance = this.#registrations.get(element)?.get(Attribute);
    
    if (attributeInstance?.attributeChangedCallback) {
      const newValue = element.getAttribute(attributeName);
      attributeInstance.attributeChangedCallback(attributeName, oldValue, newValue);
    }
  }

  /**
   * Remove a custom attribute instance from an element
   */
  #removeAttribute(element: Element, Attribute: ImplementedAttribute): void {
    const attributeInstance = this.#registrations.get(element)?.get(Attribute);
    
    if (attributeInstance) {
      // Call lifecycle callbacks
      attributeInstance.detachedCallback?.();
      
      if (attributeInstance.isConnected) {
        attributeInstance.disconnectedCallback?.();
        attributeInstance.isConnected = false;
      }

      // Clean up registration
      attributeInstance.detach();
      this.#registrations.get(element)?.delete(Attribute);
    }
  }

  /**
   * Add custom attributes to all elements in a tree
   */
  #addAttributesOnTree(tree: Node): void {
    this.#applyOnTree(tree, 'add');
  }

  /**
   * Remove custom attributes from all elements in a tree
   */
  #removeAttributesFromTree(tree: Node): void {
    this.#applyOnTree(tree, 'remove');
  }

  /**
   * Apply add or remove action to all relevant attributes in a tree
   */
  #applyOnTree(tree: Node, action: 'add' | 'remove'): void {
    const treeWalker = document.createTreeWalker(tree, NodeFilter.SHOW_ELEMENT);
    
    do {
      if (treeWalker.currentNode instanceof HTMLElement) {
        const element = treeWalker.currentNode;
        
        // Check each attribute on the element
        for (let i = 0; i < element.attributes.length; i++) {
          const attr = element.attributes[i];
          const attributeName = attr.localName;
          const definition = this.getDefinition(attributeName);
          
          if (definition) {
            const Attribute = definition.constructor as ImplementedAttribute;
            
            // Check if attribute applies to this element's tag
            const appliesToTag = !definition.tagNames.size || 
              definition.tagNames.has(element.tagName.toLowerCase());
            
            if (appliesToTag) {
              if (action === 'add') {
                this.#addAttribute(element, Attribute, attributeName);
              } else {
                this.#removeAttribute(element, Attribute);
              }
            }
          }
        }
      }
    } while (treeWalker.nextNode());
  }

  /**
   * Start observing a root node for attribute changes
   */
  #observe(root: RootNode): void {
    const observer = this.#getRootObserver(root);
    const attributeNames = Array.from(this.keys());

    observer.observe(root, {
      childList: true,
      attributeFilter: attributeNames.length > 0 ? attributeNames : undefined,
      subtree: true,
      attributes: true,
      attributeOldValue: true,
    });
  }

  /**
   * Stop observing a root node
   */
  #disconnect(root: RootNode): void {
    const observer = this.#observers.get(root);
    observer?.disconnect();
  }

  /**
   * Get or create the MutationObserver for a root node
   */
  #getRootObserver(root: RootNode): MutationObserver {
    let observer = this.#observers.get(root);
    
    if (!observer) {
      observer = this.#createObserver();
      this.#observers.set(root, observer);
    }
    
    return observer;
  }

  /**
   * Create a new MutationObserver for attribute tracking
   */
  #createObserver(): MutationObserver {
    return new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.target instanceof HTMLElement && mutation.attributeName) {
          // Attribute was added, removed, or changed
          this.#update(mutation.target, mutation.attributeName, mutation.oldValue);
        } else if (mutation.type === 'childList') {
          // Nodes were added or removed
          if (mutation.addedNodes.length > 0) {
            Array.from(mutation.addedNodes).forEach((node) => {
              this.#addAttributesOnTree(node);
            });
          }

          if (mutation.removedNodes.length > 0) {
            Array.from(mutation.removedNodes).forEach((node) => {
              this.#removeAttributesFromTree(node);
            });
          }
        }
      }
    });
  }

  /**
   * Get the attribute instance attached to an element
   * 
   * @param element - The element to query
   * @param Attribute - The attribute constructor
   * @returns The attribute instance or undefined
   */
  getInstance(element: Element, Attribute: ImplementedAttribute): CustomAttribute | undefined {
    return this.#registrations.get(element)?.get(Attribute);
  }

  /**
   * Get all attribute instances attached to an element
   * 
   * @param element - The element to query
   * @returns Map of attribute constructors to instances
   */
  getInstances(element: Element): Map<ImplementedAttribute, CustomAttribute> | undefined {
    return this.#registrations.get(element);
  }
}
