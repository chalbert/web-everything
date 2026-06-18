// Interface for registry pattern used across Web Everything

export interface Registry<Provided, Key extends string | symbol, GetterValue> {
  localName: string;
  
  // First param is `unknown` (not `string`) so subclasses may override with a value-first
  // registration shape — see CustomRegistry.define for the rationale.
  define(name: unknown, ...args: unknown[]): void;
  get(name: Key): GetterValue | undefined;
  has(name: Key): boolean;
  keys(): IterableIterator<Key>;
  values(): GetterValue[];
  entries(): [Key, GetterValue][];
}
