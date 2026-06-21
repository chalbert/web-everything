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

  // The base provides the default name-keyed convention `define(name, definition)`. Subclasses may
  // override with their own registration shape — notably a value-first `define(value, asDefault?)`
  // that derives the key from the value's own `key` (e.g. CustomGuardRegistry, CustomValidityMerge-
  // Registry, CustomValidatorResolutionRegistry). For those overrides to be valid (TS checks method
  // params bivariantly), the first parameter is typed `unknown` rather than `string` — a `string`
  // base param admits neither direction against a value-shaped override and yields a TS2416 mismatch.
  //
  // Guard the namespace you share with the host: a registry whose keys collide with a built-in namespace
  // (custom-attribute names vs standard HTML attributes) should override `define`/`defineLazy` to throw a
  // `SyntaxError` on a bare name lacking a `-`/`:` separator — mirroring `customElements.define` (#1120;
  // FUI mirror #1348). Registries with a private key space (parser/expression/store names) stay bare
  // (#1347 ruling (a), docs/agent/platform-decisions.md#registry-name-guard-namespace).
  define(name: unknown, ...args: unknown[]): void {
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

  entries(): [Key, GetterValue][] {
    const keys = this.keys();
    return Array.from(keys).map((key) => [key, this.get(key)] as [Key, GetterValue]);
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
