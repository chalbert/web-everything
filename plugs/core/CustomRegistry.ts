// Ported from plateau/src/plugs/custom-registry/CustomRegistry.ts
// Core registry abstraction for all Web Everything registries

import { Registry } from "./Registry";

export interface CustomRegistryOptions<Definition, Key extends string | symbol = string, GetterValue = Definition> {
  extends?: CustomRegistry<Definition, Key, GetterValue>[];
}

/**
 * Base class for all custom registries in Web Everything.
 * Provides hierarchical registry pattern with inheritance support.
 * 
 * @example
 * class MyRegistry extends CustomRegistry<MyDefinition> {
 *   localName = 'myRegistry';
 * }
 */
export default abstract class CustomRegistry<Definition, Key extends string | symbol = string, GetterValue = Definition> implements Registry<Record<Key, Definition>, Key, GetterValue> {
  abstract localName: string;

  #extends: CustomRegistry<Definition, Key, GetterValue>[];
  #values = new Map<Key, Definition>();

  constructor(options: CustomRegistryOptions<Definition, Key, GetterValue> = {}) {
    this.#extends = options.extends || [];
  }

  define(name: string, ...args: unknown[]): void {
    this.set(name as Key, args[0] as Definition);
  }

  get size() {
    return Array.from(this.keys()).length;
  }

  get ownSize() {
    return this.#values.size;
  }

  set<ActualDefinition extends Definition>(name: Key, definition: ActualDefinition) {
    this.#values.set(name, definition);
  }

  get(name: Key): GetterValue | undefined {
    if (this.#values.has(name)) return this.#values.get(name) as GetterValue;
    const firstRegistryWithName = this.#extends.find((registry) => registry.has(name));
    if (firstRegistryWithName) {
      // Use getOwn to get raw definition, preventing double-transformation in inheritance
      return firstRegistryWithName.getOwn(name);
    }
    return undefined;
  }

  getOwn(name: Key): GetterValue | undefined {
    return this.#values.get(name) as GetterValue | undefined;
  }

  has(name: Key): boolean {
    return this.#values.has(name) || this.#extends.some(registry => registry.has(name));
  }

  hasOwn(name: Key): boolean {
    return this.#values.has(name);
  }

  keys() {
    const keys = this.#extends.reduce((result, registry) => {
      registry.ownKeys().forEach((key) => {
        if (!result.includes(key)) result.push(key);
      });
      return result;
    }, this.ownKeys());

    return keys.values();
  }

  entries(): [Key, Definition][] {
    const keys = this.keys();
    return Array.from(keys).map((key) => [key, this.get(key)] as [Key, Definition]);
  }

  values() {
    const keys = this.keys();
    return Array.from(keys).map((key) => this.get(key)) as GetterValue[];
  }

  ownKeys(): Key[] {
    return Array.from(this.#values.keys());
  }

  ownValues() {
    return Array.from(this.#values.values()) as unknown as GetterValue[];
  }

  clear(): void {
    this.#values.clear();
  }

  delete(name: Key): boolean {
    return this.#values.delete(name);
  }
}
