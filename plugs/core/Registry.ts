// Interface for registry pattern used across Web Everything

export interface Registry<Provided, Key extends string | symbol, GetterValue> {
  localName: string;
  
  define(name: string, ...args: unknown[]): void;
  get(name: Key): GetterValue | undefined;
  has(name: Key): boolean;
  keys(): IterableIterator<Key>;
  values(): GetterValue[];
  entries(): [Key, GetterValue][];
}
