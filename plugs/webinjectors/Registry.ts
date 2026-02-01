/**
 * Registry - Interface for provider registries
 * 
 * Source: plateau/src/plugs/custom-injectors/Registry.ts
 * 
 * @module webinjectors
 */

export interface Registry<Definition, Key = string> {
  localName: string;
  set(name: Key, definition: Definition): void;
  get(name: Key): Definition | undefined;
  has(name: Key): boolean;
  delete(name: Key): boolean;
  keys(): IterableIterator<Key>;
  values(): IterableIterator<Definition>;
  entries(): IterableIterator<[Key, Definition]>;
}
