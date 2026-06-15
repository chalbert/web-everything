/**
 * @file blocks/draft-persistence/storage.ts
 * @description Concrete {@link CustomStorageStrategy} implementations and the
 * native-first selection used by the Draft-Persistence block (#011 Fork 1A):
 * IndexedDB is the default, `localStorage` the graceful degradation, an in-memory
 * map the SSR/test fallback. All share one async key→value contract.
 */

import type { CustomStorageStrategy } from './types';

/** In-memory store — the SSR/test fallback (never durable; cleared on reload). */
export class MemoryStorageStrategy implements CustomStorageStrategy {
  readonly name = 'memory';
  #map = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | null> {
    return (this.#map.has(key) ? (this.#map.get(key) as T) : null);
  }
  async set<T>(key: string, value: T): Promise<void> {
    // Round-trip through JSON so the stored value is a snapshot, not a live reference.
    this.#map.set(key, JSON.parse(JSON.stringify(value)));
  }
  async delete(key: string): Promise<void> {
    this.#map.delete(key);
  }
  async keys(): Promise<string[]> {
    return [...this.#map.keys()];
  }
}

/** `localStorage`-backed store — the graceful degradation when IndexedDB is unavailable. */
export class LocalStorageStrategy implements CustomStorageStrategy {
  readonly name = 'localstorage';
  #prefix: string;
  constructor(prefix = 'we-draft:') {
    this.#prefix = prefix;
  }
  async get<T>(key: string): Promise<T | null> {
    const raw = localStorage.getItem(this.#prefix + key);
    return raw == null ? null : (JSON.parse(raw) as T);
  }
  async set<T>(key: string, value: T): Promise<void> {
    localStorage.setItem(this.#prefix + key, JSON.stringify(value));
  }
  async delete(key: string): Promise<void> {
    localStorage.removeItem(this.#prefix + key);
  }
  async keys(): Promise<string[]> {
    const out: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(this.#prefix)) out.push(k.slice(this.#prefix.length));
    }
    return out;
  }
}

/** IndexedDB-backed store — the native-first default for durable structured records. */
export class IndexedDbStorageStrategy implements CustomStorageStrategy {
  readonly name = 'indexeddb';
  #dbName: string;
  #storeName: string;
  #dbPromise: Promise<IDBDatabase> | null = null;

  constructor(dbName = 'we-drafts', storeName = 'drafts') {
    this.#dbName = dbName;
    this.#storeName = storeName;
  }

  #open(): Promise<IDBDatabase> {
    if (this.#dbPromise) return this.#dbPromise;
    this.#dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(this.#dbName, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.#storeName)) db.createObjectStore(this.#storeName);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.#dbPromise;
  }

  async #tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
    const db = await this.#open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(this.#storeName, mode);
      const req = fn(tx.objectStore(this.#storeName));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const v = await this.#tx<T | undefined>('readonly', (s) => s.get(key));
    return v == null ? null : v;
  }
  async set<T>(key: string, value: T): Promise<void> {
    await this.#tx('readwrite', (s) => s.put(value as unknown as never, key));
  }
  async delete(key: string): Promise<void> {
    await this.#tx('readwrite', (s) => s.delete(key));
  }
  async keys(): Promise<string[]> {
    const keys = await this.#tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys());
    return keys.map(String);
  }
}

/**
 * Pick the most durable available strategy: IndexedDB → localStorage → memory.
 * Native-first default with deterministic degradation.
 */
export function pickDefaultStorage(): CustomStorageStrategy {
  if (typeof indexedDB !== 'undefined') return new IndexedDbStorageStrategy();
  if (typeof localStorage !== 'undefined') return new LocalStorageStrategy();
  return new MemoryStorageStrategy();
}
