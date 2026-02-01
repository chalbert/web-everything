/**
 * HTMLRegistry - HTML-specific registry with bidirectional constructor mapping
 * 
 * Source: plateau/src/plugs/custom-injectors/HTMLRegistry.ts
 * 
 * @module webinjectors
 */

import CustomRegistry from '../core/CustomRegistry';

export interface BaseDefinition {
  constructor: Function;
  connectedCallback?: () => void;
  disconnectedCallback?: () => void;
  adoptedCallback?: () => void;
}

export interface ConstructorDefinition<Type extends new (...args: any) => any> extends BaseDefinition {
  constructor: Type;
}

/**
 * Abstract base class for HTML-specific registries that need bidirectional
 * constructor-to-name mapping.
 * 
 * This is similar to core/HTMLRegistry but includes lifecycle methods and
 * is used specifically within the injector system.
 */
export default abstract class HTMLRegistry<
  Definition extends ConstructorDefinition<Type>,
  Type extends new (...args: any) => any
> extends CustomRegistry<Definition, string, Type> {
  abstract localName: string;

  #constructors = new Map<Function, string>();

  abstract upgrade(node: Node): void;
  abstract downgrade(node: Node): void;

  /**
   * Get the registered local name for a constructor.
   */
  getLocalNameOf(constructor: ConstructorDefinition<Type>['constructor']): string | undefined {
    return this.#constructors.get(constructor);
  }

  /**
   * Register a definition and maintain bidirectional mapping.
   */
  set<ActualDefinition extends Definition>(name: string, definition: ActualDefinition): this {
    super.set(name, definition);
    this.#constructors.set(definition.constructor, name);
    return this;
  }

  /**
   * Get the constructor registered under a name.
   */
  get(name: string): Type | undefined {
    if (super.has(name)) {
      const definition = super.get(name);
      return definition?.constructor as Type;
    }
    return undefined;
  }

  /**
   * Get the full definition (not just constructor) for a name.
   */
  getDefinition(name: string): Definition | undefined {
    return super.get(name) as unknown as Definition;
  }
}
