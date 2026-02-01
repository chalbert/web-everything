// Ported from plateau/src/plugs/custom-injectors/HTMLRegistry.ts
// Registry specialized for HTML node constructors

import CustomRegistry from './CustomRegistry';

export interface BaseDefinition {
  constructor: Function;
  connectedCallback?: () => void;
  disconnectedCallback?: () => void;
  adoptedCallback?: () => void;
}

export interface ConstructorDefinition<Type extends new (...args: any) => any> extends BaseDefinition {
  constructor: Type
}

/**
 * Abstract base class for registries that manage HTML node constructors.
 * Provides bidirectional mapping between constructor functions and local names.
 */
export default abstract class HTMLRegistry<Definition extends ConstructorDefinition<Type>, Type extends new (...args: any) => any> extends CustomRegistry<Definition, string, Type> {
  abstract localName: string;

  #constructors = new Map<Function, string>();

  abstract upgrade(node: Node): void;
  abstract downgrade(node: Node): void;

  getLocalNameOf(constructor: ConstructorDefinition<Type>['constructor']) {
    return this.#constructors.get(constructor);
  }

  set<ActualDefinition extends Definition>(name: string, definition: ActualDefinition) {
    super.set(name, definition);
    this.#constructors.set(definition.constructor, name);
  }

  get(name: string) {
    if (super.has(name)) {
      const definition = super.get(name);
      return definition?.constructor as Type;
    }
    return undefined;
  }

  getDefinition(name: string): Definition | undefined {
    return super.get(name) as unknown as Definition;
  }
}
