/**
 * ForEachBehavior - Structural directive for rendering lists
 *
 * Iterates over a collection and stamps a `<template>` for each item,
 * using comment markers to track boundaries (no wrapper DOM element).
 * Each stamped item receives its own injector context so that
 * `{{@item.name}}` (or whatever alias the author chose) resolves correctly
 * through the standard injector chain.
 *
 * Phase 1: One-time rendering on connect. Reactive updates deferred to Phase 2.
 *
 * Default registration name: for-each
 *
 * @module blocks/for-each
 *
 * @example
 * ```html
 * <template for-each="@route.data.users as user">
 *   <div class="user-row">
 *     <span>{{@user.name}}</span>
 *   </div>
 * </template>
 * ```
 *
 * @example
 * ```html
 * <!-- Implicit "item" context name -->
 * <template for-each="@route.data.items">
 *   <div>{{@item.name}}</div>
 * </template>
 * ```
 */

import CustomAttribute from '../../plugs/webbehaviors/CustomAttribute';
import InjectorRoot from '../../plugs/webinjectors/InjectorRoot';

/** Regex to parse "expression as alias" — alias is optional */
const AS_REGEX = /^(.+?)\s+as\s+(\w+)$/;

/** Regex for a named context reference: @contextName.path */
const CONTEXT_REF_REGEX = /^@(\w+)(?:\.(.+))?$/;

/**
 * Navigate a dot-separated path on an object.
 *
 * @example resolvePath('a.b.c', { a: { b: { c: 42 } } }) // 42
 */
function resolvePath(path: string, obj: unknown): unknown {
  if (!path) return obj;
  const segments = path.split('.');
  let current: unknown = obj;
  for (const segment of segments) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export default class ForEachBehavior extends CustomAttribute {
  /** Comment node marking the start of stamped content */
  #startMarker: Comment | null = null;

  /** Comment node marking the end of stamped content */
  #endMarker: Comment | null = null;

  /** All DOM nodes stamped between the markers */
  #stampedNodes: Node[] = [];

  /** Parsed alias for the loop context (default: "item") */
  #contextName: string = 'item';

  /** Parsed expression string for the items source */
  #expression: string = '';

  /** The key attribute for future diffing (Phase 2) */
  #key: string | null = null;

  /** The resolved items collection */
  get items(): unknown[] {
    return this.#resolveItems() ?? [];
  }

  /** The alias used for each item's context */
  get contextName(): string {
    return this.#contextName;
  }

  connectedCallback(): void {
    const template = this.target;
    if (!template || !(template instanceof HTMLTemplateElement)) {
      console.warn('[ForEachBehavior] Must be attached to a <template> element');
      return;
    }

    // Parse the attribute value: "expression as alias" or just "expression"
    this.#parseValue(this.value);

    // Read optional key attribute
    this.#key = template.getAttribute('key');

    // Insert comment markers around the template
    const parent = template.parentNode;
    if (!parent) return;

    this.#startMarker = document.createComment(` for-each:start (${this.#expression}) `);
    this.#endMarker = document.createComment(` for-each:end `);

    parent.insertBefore(this.#startMarker, template);
    parent.insertBefore(this.#endMarker, template.nextSibling);

    // Stamp items
    this.#stamp();
  }

  disconnectedCallback(): void {
    this.#unstamp();

    // Remove comment markers
    this.#startMarker?.parentNode?.removeChild(this.#startMarker);
    this.#endMarker?.parentNode?.removeChild(this.#endMarker);
    this.#startMarker = null;
    this.#endMarker = null;
  }

  /**
   * Clear and re-stamp all items. Useful for external triggers
   * before Phase 2 reactive updates.
   */
  refresh(): void {
    this.#unstamp();
    this.#stamp();
  }

  /** Parse "expression as alias" from the attribute value */
  #parseValue(raw: string): void {
    const trimmed = raw.trim();
    const match = trimmed.match(AS_REGEX);
    if (match) {
      this.#expression = match[1].trim();
      this.#contextName = match[2];
    } else {
      this.#expression = trimmed;
      this.#contextName = 'item';
    }
  }

  /** Resolve the items collection from the expression */
  #resolveItems(): unknown[] | null {
    const template = this.target;
    if (!template) return null;

    // Try named context reference: @contextName.path
    const contextMatch = this.#expression.match(CONTEXT_REF_REGEX);
    if (contextMatch) {
      const contextName = contextMatch[1];
      const path = contextMatch[2] || '';
      const contextValue = InjectorRoot.getProviderOf(
        template,
        `customContexts:${contextName}` as any,
      );
      if (contextValue === undefined) {
        console.warn(`[ForEachBehavior] Context "@${contextName}" not found in injector chain`);
        return null;
      }
      const resolved = path ? resolvePath(path, contextValue) : contextValue;
      return Array.isArray(resolved) ? resolved : null;
    }

    // Fallback: try as bare state path via default "state" context
    const stateContext = InjectorRoot.getProviderOf(
      template,
      'customContexts:state' as any,
    );
    if (stateContext !== undefined) {
      const resolved = resolvePath(this.#expression, stateContext);
      return Array.isArray(resolved) ? resolved : null;
    }

    return null;
  }

  /** Stamp all items from the resolved collection */
  #stamp(): void {
    const template = this.target as HTMLTemplateElement | undefined;
    if (!template || !this.#endMarker) return;

    const items = this.#resolveItems();
    if (!items || items.length === 0) return;

    const parent = this.#endMarker.parentNode;
    if (!parent) return;

    const injRoot = InjectorRoot.getInjectorRootOf(template);

    for (const item of items) {
      // Clone template content
      const fragment = template.content.cloneNode(true) as DocumentFragment;
      const nodes = Array.from(fragment.childNodes);

      // For each top-level element in the stamp, set the item context on its injector
      for (const node of nodes) {
        if (node instanceof HTMLElement && injRoot) {
          const injector = injRoot.ensureInjector(node);
          injector.set(`customContexts:${this.#contextName}`, item);
        }
      }

      // Insert before end marker
      parent.insertBefore(fragment, this.#endMarker);

      // Track all stamped nodes
      this.#stampedNodes.push(...nodes);
    }
  }

  /** Remove all stamped nodes between the markers */
  #unstamp(): void {
    for (const node of this.#stampedNodes) {
      node.parentNode?.removeChild(node);
    }
    this.#stampedNodes = [];
  }
}
