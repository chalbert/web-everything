/**
 * @file CustomAttributeRegistry.ts
 * @description Registry for managing custom attribute definitions and lifecycle
 * @source Migrated from plateau/src/plugs/custom-attributes/CustomAttributesRegistry.ts
 */

import HTMLRegistry, { type ConstructorDefinition } from '../core/HTMLRegistry';
import type { RootNode } from '../core/types';
import CustomAttribute, { type ImplementedAttribute } from './CustomAttribute';
import { createViewportPresenceObserver } from './viewportPresence';

/**
 * Suffix of the per-usage re-enable attribute: a trait `sortable` is re-enabled
 * inside an `inert` dead-zone by `sortable-active` (#222 ruling 3). Observed and
 * re-evaluated at runtime so toggling the override alone re-activates (#226).
 */
const ACTIVE_SUFFIX = '-active';

/**
 * Suffix + value of the per-usage activation-trigger override (the visibility gate,
 * #221/#280): `<trait>-when="visible"` defers a trait's activation (and, for a lazy
 * trait, its chunk fetch) until the host first enters the viewport. Read from the
 * live DOM at runtime like `-active`, unlike build-time `-delivery`. `when` is a
 * general trigger axis whose first value is `visible`.
 */
const WHEN_SUFFIX = '-when';
const WHEN_VISIBLE = 'visible';

/** Re-entry policy for a visibility-gated trait when its host scrolls back off-screen. */
type ReentryPolicy = 'once' | 'recurring';

/**
 * A pending visibility-gate entry on an observed element. `eager` defers the
 * activation of an already-constructed instance until intersection; `lazy` defers
 * the chunk *fetch* of a not-yet-loaded trait until intersection (fetch-on-view).
 */
type GateEntry =
  | { kind: 'eager'; instance: CustomAttribute; Attribute: ImplementedAttribute; name: string; policy: ReentryPolicy }
  | { kind: 'lazy'; name: string };

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
 * What a lazy attribute loader resolves to: the CustomAttribute class directly,
 * or a module namespace whose `default` export is the class — so a bare
 * `() => import('./trait.js')` works without an explicit `.then(m => m.default)`.
 */
export type LazyAttributeModule = ImplementedAttribute | { default: ImplementedAttribute };

/**
 * Async loader for a lazily-defined attribute, e.g. `() => import('./trait.js')`.
 * Called the first time the attribute appears in an upgraded tree.
 */
export type LazyAttributeLoader = () => Promise<LazyAttributeModule>;

/** A pending lazy registration — its loader plus any tag-name restriction. */
interface LazyRegistration {
  loader: LazyAttributeLoader;
  tagNames: Set<string>;
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
   * Pending lazy attribute loaders: name → { loader, tagNames }.
   * Registered but not yet loaded — mirrors `Injector`'s `#registry`.
   */
  #lazyLoaders = new Map<string, LazyRegistration>();

  /**
   * In-flight lazy loads: name → load promise. Deduplicates concurrent
   * first-sightings of the same attribute — mirrors `Injector`'s `#loading`.
   */
  #lazyLoading = new Map<string, Promise<void>>();

  /**
   * Roots currently upgraded/observed, so a lazy load that resolves later can
   * find and upgrade the elements whose appearance triggered it.
   */
  #roots = new Set<RootNode>();

  /**
   * The single `IntersectionObserver` backing the visibility gate (#221/#280),
   * lazily created on first gated usage — the activation analogue of the `inert`
   * `MutationObserver`. Stays `undefined` (gate inert) in environments without
   * `IntersectionObserver`, where gated traits fall back to activate-on-connect.
   */
  #visibilityObserver?: IntersectionObserver;

  /** Pending visibility-gate entries per observed element (an element may host several gated traits). */
  #gateEntries = new Map<Element, GateEntry[]>();

  /**
   * Elements that have entered the viewport at least once — the gate "opened".
   * Lets a `once`-policy trait that loads/attaches *after* its host is already
   * visible (the lazy fetch-on-view case) activate immediately instead of waiting
   * for a further intersection that may never come.
   */
  #revealed = new WeakSet<Element>();

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

    // An eager definition supersedes any pending lazy registration for this name.
    this.#lazyLoaders.delete(name);
    this.#lazyLoading.delete(name);

    this.set(name, definition);
  }

  /**
   * Define a lazily-loaded custom attribute.
   *
   * Unlike {@link define}, the attribute's class is not required up front: the
   * `loader` runs the first time the attribute appears in an upgraded tree
   * (during {@link upgrade} or via the MutationObserver), its module is
   * dynamic-imported, and only then is the attribute `define`d and applied to
   * the elements that triggered it. Concurrent first-sightings are deduplicated
   * and the resolved class is cached — the `Injector` `register`/`consume`
   * pattern, applied to attributes.
   *
   * Like {@link define}, call this *before* {@link upgrade}: the MutationObserver's
   * attribute filter is fixed at upgrade time and is unioned with the lazy names
   * so the first sighting is observed.
   *
   * @param name - The attribute name to register
   * @param loader - Async loader returning the CustomAttribute class, or a module
   *   whose `default` export is the class (so `() => import('./trait.js')` works)
   * @param options - Configuration options (tag-name restriction)
   *
   * @example
   * ```typescript
   * registry.defineLazy('sortable', () => import('./traits/sort.js'));
   * registry.upgrade(document.body); // sort.js loads when `<… sortable>` first appears
   * ```
   */
  defineLazy(name: string, loader: LazyAttributeLoader, { tagNames = [] }: CustomAttributeOptions = {}): void {
    this.#lazyLoaders.set(name, {
      loader,
      tagNames: new Set(tagNames.map((tag) => tag.toLowerCase())),
    });
  }

  /**
   * Eagerly warm a pending lazy attribute's module *now*, without waiting for its
   * first DOM appearance — the runtime half of the per-*usage* `delivery="eager"`
   * override (#202).
   *
   * The default lazy path loads a trait's chunk only when its element first
   * appears in an upgraded tree. That defers nothing for the *initial* DOM (the
   * observer sees everything present at `upgrade()`), so the only thing worth
   * forcing eager at a usage site is a trait whose element is **not yet mounted**
   * — e.g. used in a route/view rendered later. The Enforcer scans template
   * source (including such views), marks that lazy trait `preload`, and
   * {@link registerTraits} calls this at bootstrap so the chunk is fetched and the
   * class cached ahead of the element mounting; when it does mount, the trait
   * applies synchronously with no on-demand wait.
   *
   * Reuses the same in-flight dedup + cache as on-appearance loading, so a preload
   * and a later first-sighting collapse to one load. A no-op if `name` is not a
   * pending lazy registration (already eager-defined, or unknown).
   *
   * @param name - The lazy attribute to warm
   * @returns The load promise (resolves once the chunk is fetched and defined),
   *   or a resolved promise if there is nothing to preload.
   */
  preload(name: string): Promise<void> {
    if (!this.#lazyLoaders.has(name)) return Promise.resolve();
    return this.#loadLazy(name);
  }

  /**
   * Upgrade a DOM tree to activate custom attributes
   *
   * @param root - The root node to upgrade
   */
  upgrade(root: RootNode): void {
    this.#roots.add(root);
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
    this.#roots.delete(root);
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
    } else if (element.hasAttribute(attributeName) && this.#shouldLoadLazy(attributeName, element)) {
      // No eager definition, but a pending lazy attribute just appeared.
      if (this.#isLazyVisibilityGated(element, attributeName)) {
        this.#gateLazy(element, attributeName); // fetch-on-view: defer the chunk until intersection (#280)
      } else {
        this.#loadLazy(attributeName);
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

      // Connected ≠ activated (#222/#223): once connected, decide whether the trait
      // should actually run. An interaction-driven trait inside an `inert`
      // dead-zone stays connected but dormant unless re-enabled per-usage.
      if (attributeInstance.isConnected) {
        const name = attributeName ?? attributeInstance.name;
        // Visibility gate (#221/#280): a `-when="visible"` (or manifest-default)
        // trait stays dormant until its host first intersects the viewport.
        if (this.#isVisibilityGated(element, name, Attribute)) {
          this.#gateEager(element, attributeInstance, Attribute, name);
        } else {
          this.#setActivated(attributeInstance, this.#shouldBeActivated(element, Attribute, name));
        }
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
      // Drop any pending visibility-gate entry for this instance so a removed trait
      // is never activated by a later intersection (#280).
      this.#dropGateEntry(element, (e) => e.kind === 'eager' && e.instance === attributeInstance);

      // Stop running before tearing down — the inverse of activate-after-connect.
      if (attributeInstance.isActivated) {
        attributeInstance.isActivated = false;
        attributeInstance.deactivatedCallback?.();
      }

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

        // A removed host can never intersect — purge any pending visibility-gate
        // entries (incl. lazy ones with no instance for #removeAttribute to clear) (#280).
        if (action === 'remove') this.#dropGateEntry(element, () => true);

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
          } else if (action === 'add' && this.#shouldLoadLazy(attributeName, element)) {
            // No eager definition — a pending lazy attribute appears in the tree.
            if (this.#isLazyVisibilityGated(element, attributeName)) {
              this.#gateLazy(element, attributeName); // fetch-on-view (#280)
            } else {
              this.#loadLazy(attributeName);
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
    // Observe eagerly-defined names, pending lazy names (so a lazy attribute's
    // first appearance is seen and can trigger its load), each name's per-usage
    // `<name>-active` override (so toggling the override alone re-evaluates
    // activation — #226), and native `inert` (so an `inert` flip re-evaluates the
    // dead-zone — #223). Neither `inert` nor a `-active` suffix is a trait name,
    // so the observer callback branches on them.
    const traitNames = [...this.keys(), ...this.#lazyLoaders.keys()];
    const attributeNames = [
      ...traitNames,
      ...traitNames.map((name) => `${name}${ACTIVE_SUFFIX}`),
      'inert',
    ];

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
          if (mutation.attributeName === 'inert') {
            // `inert` flipped — re-evaluate the dead-zone across the subtree (#223).
            this.#onInertChanged(mutation.target);
          } else if (this.#isActiveOverride(mutation.attributeName)) {
            // A per-usage `<name>-active` override (#222) was added or removed at
            // runtime — re-evaluate just that element+trait's activation (#226).
            this.#onActiveChanged(mutation.target, mutation.attributeName);
          } else {
            // Attribute was added, removed, or changed
            this.#update(mutation.target, mutation.attributeName, mutation.oldValue);
          }
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

  /**
   * Whether `name` is a pending lazy attribute that applies to `element`'s tag.
   */
  #shouldLoadLazy(name: string, element: HTMLElement): boolean {
    const registration = this.#lazyLoaders.get(name);
    if (!registration) return false;
    return !registration.tagNames.size || registration.tagNames.has(element.tagName.toLowerCase());
  }

  /**
   * Load a pending lazy attribute's module on first sighting.
   *
   * Stores the in-flight promise so concurrent first-sightings dedup to one load
   * (the `Injector.consume` pattern). On success the resolved class is `define`d
   * — caching it — and every observed root is swept so the elements that
   * triggered the load are upgraded. On failure the in-flight marker is dropped
   * so a later sighting retries; the loader registration is left intact.
   */
  #loadLazy(name: string): Promise<void> {
    const inFlight = this.#lazyLoading.get(name);
    if (inFlight) return inFlight;

    const registration = this.#lazyLoaders.get(name);
    if (!registration) return Promise.resolve();

    const load = registration.loader().then(
      (loaded) => {
        // Bail if superseded by an eager define()/delete since the load started.
        if (this.#lazyLoading.get(name) !== load || !this.#lazyLoaders.has(name)) return;
        const Attribute = this.#resolveAttributeClass(name, loaded);
        // define() clears the lazy maps and caches the class.
        this.define(name, Attribute, { tagNames: [...registration.tagNames] });
        this.#attachLazyToRoots(name, Attribute);
      },
      () => {
        // Drop the in-flight marker so a later sighting can retry — Injector parity.
        if (this.#lazyLoading.get(name) === load) this.#lazyLoading.delete(name);
      },
    );

    this.#lazyLoading.set(name, load);
    return load;
  }

  /**
   * Normalize a lazy loader's result to a CustomAttribute class — accepting the
   * class directly or a module namespace whose `default` export is the class.
   */
  #resolveAttributeClass(name: string, loaded: LazyAttributeModule): ImplementedAttribute {
    if (typeof loaded === 'function') return loaded;
    const fromDefault = (loaded as { default?: ImplementedAttribute })?.default;
    if (typeof fromDefault === 'function') return fromDefault;
    throw new Error(
      `Lazy attribute "${name}" loader did not resolve to a CustomAttribute class ` +
        `(got ${typeof loaded}). Return the class, or a module with a default export.`,
    );
  }

  /**
   * After a lazy attribute is defined, attach it to every element bearing it in
   * the currently-observed roots — i.e. the elements whose appearance triggered
   * the load. Mirrors `#applyOnTree`'s walk (root included, tag-name respected).
   */
  #attachLazyToRoots(name: string, Attribute: ImplementedAttribute): void {
    for (const root of this.#roots) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      do {
        const node = walker.currentNode;
        if (node instanceof HTMLElement && node.hasAttribute(name) && this.#appliesToTag(name, node)) {
          this.#addAttribute(node, Attribute, name);
        }
      } while (walker.nextNode());
    }
  }

  /**
   * Whether the (now eagerly-defined) attribute `name` applies to `element`'s tag.
   */
  #appliesToTag(name: string, element: HTMLElement): boolean {
    const definition = this.getDefinition(name);
    if (!definition) return false;
    return !definition.tagNames.size || definition.tagNames.has(element.tagName.toLowerCase());
  }

  // ── Activation lifecycle: connected ≠ activated (the `inert` dead-zone, #222/#223) ──

  /**
   * Toggle a trait instance's **activated** state, firing `activatedCallback()` /
   * `deactivatedCallback()` on a change. Activated = "should be running" (e.g.
   * interaction listeners attached), orthogonal to connected (in the DOM).
   * Idempotent — a no-op when the instance is already in the target state, so
   * repeated `inert` mutations don't re-fire the callbacks.
   */
  #setActivated(instance: CustomAttribute, activated: boolean): void {
    if (instance.isActivated === activated) return;
    instance.isActivated = activated;
    if (activated) instance.activatedCallback?.();
    else instance.deactivatedCallback?.();
  }

  /**
   * Whether a trait instance on `element` should be activated right now.
   *
   * An **ambient** trait (activationSurface `'ambient'`) is always activated —
   * `inert` says nothing about behaviour that doesn't respond to interaction. An
   * **interaction-driven** trait (the default) is dormant inside an `inert`
   * dead-zone (the element or any ancestor carries `inert`, which inherits) unless
   * the placement re-enables it with the per-usage `<trait>-active` attribute
   * (#222 ruling 3). The override is read from the live DOM at runtime — unlike
   * the build-time `<trait>-delivery` override (#202).
   */
  #shouldBeActivated(element: HTMLElement, Attribute: ImplementedAttribute, name?: string): boolean {
    if (!this.#isInteractionDriven(Attribute)) return true;
    if (name && element.hasAttribute(`${name}-active`)) return true;
    return !this.#isInsideInert(element);
  }

  /** Whether `Attribute`'s activation surface is interaction-driven (the default). */
  #isInteractionDriven(Attribute: ImplementedAttribute): boolean {
    return (Attribute.activationSurface ?? 'interaction') === 'interaction';
  }

  /**
   * Whether `element` sits inside an `inert` subtree. `inert` inherits down the
   * tree, so `closest('[inert]')` (the element itself or any ancestor) is the
   * dead-zone test — an attribute selector, so it works without the `.inert` IDL
   * property being implemented.
   */
  #isInsideInert(element: HTMLElement): boolean {
    return element.closest('[inert]') !== null;
  }

  /**
   * React to an `inert` attribute flip on `target`: recompute the activated state
   * of every *connected* trait in `target`'s subtree. `inert` inherits, so a flip
   * on an ancestor toggles all descendants; `#shouldBeActivated` re-tests
   * `closest('[inert]')`, so a nested inner `inert` region keeps its traits dormant
   * even when the outer one flips live. Ambient traits short-circuit to activated in
   * `#shouldBeActivated`, so the walk leaves them untouched.
   */
  #onInertChanged(target: HTMLElement): void {
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_ELEMENT);
    do {
      const node = walker.currentNode;
      if (node instanceof HTMLElement) {
        const instances = this.#registrations.get(node);
        if (instances) {
          for (const [Attribute, instance] of instances) {
            if (!instance.isConnected) continue;
            this.#setActivated(instance, this.#shouldBeActivated(node, Attribute, instance.name));
          }
        }
      }
    } while (walker.nextNode());
  }

  /**
   * Whether `attributeName` is a per-usage `<name>-active` override (#222/#226)
   * for a loaded, registered trait — i.e. it ends in `-active` and its `<name>`
   * part resolves to a defined attribute. A trait whose own name happens to end
   * in `-active` has no registered base, so it is not an override and falls
   * through to the normal `#update` path.
   */
  #isActiveOverride(attributeName: string): boolean {
    if (!attributeName.endsWith(ACTIVE_SUFFIX)) return false;
    return this.getDefinition(attributeName.slice(0, -ACTIVE_SUFFIX.length)) !== undefined;
  }

  /**
   * React to a per-usage `<name>-active` override being added or removed at
   * runtime (#226). Activation depends on this override (#222 ruling 3 —
   * re-enable inside an `inert` dead-zone), but it can be toggled independently
   * of any `inert` flip, which `#onInertChanged` does not see. Recompute just
   * that one element+trait's activated state via the existing predicate — the
   * override is read live from the DOM, so add → re-activate, remove →
   * re-evaluate the surrounding `inert` state. A no-op if the element has no
   * connected instance of the trait (only `#isActiveOverride`-confirmed names
   * reach here, so the base is always a defined attribute).
   */
  #onActiveChanged(element: HTMLElement, attributeName: string): void {
    const name = attributeName.slice(0, -ACTIVE_SUFFIX.length);
    const Attribute = this.getDefinition(name)?.constructor as ImplementedAttribute | undefined;
    if (!Attribute) return;
    const instance = this.#registrations.get(element)?.get(Attribute);
    if (!instance || !instance.isConnected) return;
    this.#setActivated(instance, this.#shouldBeActivated(element, Attribute, name));
  }

  // ── Visibility gate: defer activation/fetch until the host intersects (#221/#280) ──

  /**
   * Whether an (eager, class-known) trait usage is visibility-gated. The page-author
   * per-usage `<name>-when` attribute wins; absent it, the trait-author manifest
   * default {@link CustomAttribute.activationWhen} applies. Gating requires
   * `IntersectionObserver` — without it the gate is inert and the trait activates on
   * connect (graceful degradation).
   */
  #isVisibilityGated(element: HTMLElement, name: string, Attribute: ImplementedAttribute): boolean {
    if (typeof IntersectionObserver === 'undefined') return false;
    const override = element.getAttribute(`${name}${WHEN_SUFFIX}`);
    if (override !== null) return override === WHEN_VISIBLE;
    return (Attribute.activationWhen ?? 'connect') === WHEN_VISIBLE;
  }

  /**
   * Whether a not-yet-loaded *lazy* trait usage is visibility-gated. Only the
   * per-usage `<name>-when="visible"` attribute can gate here — the manifest default
   * lives on the class, which is the very chunk we are deferring the fetch of.
   */
  #isLazyVisibilityGated(element: HTMLElement, name: string): boolean {
    if (typeof IntersectionObserver === 'undefined') return false;
    return element.getAttribute(`${name}${WHEN_SUFFIX}`) === WHEN_VISIBLE;
  }

  /**
   * The re-entry policy for a gated trait: a trait-author
   * {@link CustomAttribute.visibilityReentry} override wins; otherwise it derives
   * from the activation surface (#222) — `ambient` → `recurring` (pause off-screen),
   * `interaction` → `once` (activate-and-stay).
   */
  #reentryPolicy(Attribute: ImplementedAttribute): ReentryPolicy {
    return Attribute.visibilityReentry ?? (this.#isInteractionDriven(Attribute) ? 'once' : 'recurring');
  }

  /**
   * Register an eager (class-known) gated instance for intersection-driven
   * activation. A `once`-policy trait whose host is already revealed activates
   * immediately (the lazy fetch-on-view re-attach case); otherwise it stays dormant
   * until the observer reports an intersection.
   */
  #gateEager(element: HTMLElement, instance: CustomAttribute, Attribute: ImplementedAttribute, name: string): void {
    const policy = this.#reentryPolicy(Attribute);
    if (policy === 'once' && this.#revealed.has(element)) {
      this.#setActivated(instance, this.#shouldBeActivated(element, Attribute, name));
      return;
    }
    this.#observeVisibility(element, { kind: 'eager', instance, Attribute, name, policy });
  }

  /** Register a lazy gated usage so its chunk is fetched only once the host intersects. */
  #gateLazy(element: HTMLElement, name: string): void {
    this.#observeVisibility(element, { kind: 'lazy', name });
  }

  /** Add a gate entry for `element` and ensure the IntersectionObserver is watching it. */
  #observeVisibility(element: HTMLElement, entry: GateEntry): void {
    const observer = this.#getVisibilityObserver();
    if (!observer) {
      // No IntersectionObserver (the #is*Gated guards already exclude this, but stay safe).
      if (entry.kind === 'eager')
        this.#setActivated(entry.instance, this.#shouldBeActivated(element, entry.Attribute, entry.name));
      else this.#loadLazy(entry.name);
      return;
    }
    const entries = this.#gateEntries.get(element);
    if (entries) {
      entries.push(entry);
    } else {
      this.#gateEntries.set(element, [entry]);
      observer.observe(element);
    }
  }

  /** Lazily create the shared visibility `IntersectionObserver` (once). */
  #getVisibilityObserver(): IntersectionObserver | undefined {
    if (this.#visibilityObserver) return this.#visibilityObserver;
    // Compose the shared viewport-presence trigger (#320/#321): one home owns observer creation +
    // option defaulting. The gate keeps its own logic — `#onIntersection` handles both enter and
    // leave (recurring traits re-close off-screen), so route both dispatches to it. Returns null
    // when IntersectionObserver is unavailable (the #is*Gated guards already exclude that path).
    this.#visibilityObserver =
      createViewportPresenceObserver({
        onEnter: (record) => this.#onIntersection(record),
        onLeave: (record) => this.#onIntersection(record),
      }) ?? undefined;
    return this.#visibilityObserver;
  }

  /** React to a host crossing the viewport boundary — open the gate, or (recurring) re-close it. */
  #onIntersection(record: IntersectionObserverEntry): void {
    const element = record.target as HTMLElement;
    const entries = this.#gateEntries.get(element);
    if (!entries) return;

    if (record.isIntersecting) {
      this.#revealed.add(element);
      // Lazy loads + once-activations remove their own entry; iterate a snapshot.
      for (const entry of [...entries]) {
        if (entry.kind === 'lazy') {
          this.#dropGateEntry(element, (e) => e === entry);
          this.#loadLazy(entry.name); // fetch now; re-attach sees the host already revealed
        } else if (entry.instance.isConnected) {
          this.#setActivated(entry.instance, this.#shouldBeActivated(element, entry.Attribute, entry.name));
          if (entry.policy === 'once') this.#dropGateEntry(element, (e) => e === entry);
        }
      }
    } else {
      // Off-screen: recurring traits pause; once traits are already unobserved; lazy untouched.
      for (const entry of entries) {
        if (entry.kind === 'eager' && entry.policy === 'recurring' && entry.instance.isConnected) {
          this.#setActivated(entry.instance, false);
        }
      }
    }
  }

  /** Remove gate entries matching `pred` for `element`; unobserve once none remain. */
  #dropGateEntry(element: Element, pred: (entry: GateEntry) => boolean): void {
    const entries = this.#gateEntries.get(element);
    if (!entries) return;
    const kept = entries.filter((e) => !pred(e));
    if (kept.length === entries.length) return;
    if (kept.length === 0) {
      this.#gateEntries.delete(element);
      this.#visibilityObserver?.unobserve(element);
    } else {
      this.#gateEntries.set(element, kept);
    }
  }
}
