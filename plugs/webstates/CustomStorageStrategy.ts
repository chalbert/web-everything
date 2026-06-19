/**
 * Storage contract + native default strategies (#1106, webstates completion #1089).
 *
 * Spec: `we:src/_includes/project-webstates.njk` (the durable-storage facet, #503 ruling). Durable
 * structured-record CRUD over one scope behind a swappable {@link CustomStorageStrategy}. **Async by
 * default** — IndexedDB is async, and an async contract lets a remote / SQLite / OPFS engine satisfy it
 * too. IndexedDB is the native-first default; localStorage is the graceful-degradation floor. Plus
 * {@link StoragePersistence} — the `navigator.storage` persistence-class + quota surface, normalized.
 *
 * Non-invasive: the strategies wrap the platform storage APIs, patching no global.
 */
import type { Disposable } from './CustomChangeStrategy';

/** One operation in a bulk write. */
export type StorageBulkOp<T> = { op: 'set'; id: string; value: T } | { op: 'delete'; id: string };

/**
 * A durable structured-record store over one scope, swappable per the #503 ruling. `key` names the
 * engine (`'native-indexeddb'`, `'local-storage'`, `'rxdb'`); `bulk` / `subscribe` are optional
 * (feature-detected — engines that support them implement them).
 */
export interface CustomStorageStrategy<T = unknown> {
  readonly key: string;
  get(scope: string, id: string): Promise<T | undefined>;
  set(scope: string, id: string, value: T): Promise<void>;
  delete(scope: string, id: string): Promise<void>;
  keys(scope: string): Promise<string[]>;
  /** Optional bulk write for engines that support it. */
  bulk?(scope: string, ops: StorageBulkOp<T>[]): Promise<void>;
  /** Optional change notification for engines that support it. */
  subscribe?(scope: string, onChange: (id: string) => void): Disposable;
}

/** Persistence class + quota — the `navigator.storage` surface, normalized. */
export interface StoragePersistence {
  /** `navigator.storage.persist()` — best-effort upgrade to persistent. */
  persist(): Promise<boolean>;
  /** Whether storage is already persistent. */
  persisted(): Promise<boolean>;
  /** `navigator.storage.estimate()` — usage + quota. */
  estimate(): Promise<StorageEstimate>;
}

// ── localStorage strategy — the graceful-degradation floor ─────────────────────────────────────────────

/**
 * Synchronous Web Storage adapted to the async contract. Entries are namespaced `webstates:<scope>:<id>`
 * and JSON-serialized. The degradation floor when IndexedDB is unavailable (private mode, old engines).
 */
export class LocalStorageStrategy<T = unknown> implements CustomStorageStrategy<T> {
  readonly key = 'local-storage';
  readonly #ns: string;

  constructor(namespace = 'webstates', private readonly store: Storage = localStorage) {
    this.#ns = namespace;
  }

  #prefix(scope: string): string {
    return `${this.#ns}:${scope}:`;
  }

  async get(scope: string, id: string): Promise<T | undefined> {
    const raw = this.store.getItem(this.#prefix(scope) + id);
    return raw === null ? undefined : (JSON.parse(raw) as T);
  }

  async set(scope: string, id: string, value: T): Promise<void> {
    this.store.setItem(this.#prefix(scope) + id, JSON.stringify(value));
  }

  async delete(scope: string, id: string): Promise<void> {
    this.store.removeItem(this.#prefix(scope) + id);
  }

  async keys(scope: string): Promise<string[]> {
    const prefix = this.#prefix(scope);
    const out: string[] = [];
    for (let i = 0; i < this.store.length; i += 1) {
      const k = this.store.key(i);
      if (k && k.startsWith(prefix)) out.push(k.slice(prefix.length));
    }
    return out;
  }

  async bulk(scope: string, ops: StorageBulkOp<T>[]): Promise<void> {
    for (const op of ops) {
      if (op.op === 'set') await this.set(scope, op.id, op.value);
      else await this.delete(scope, op.id);
    }
  }
}

// ── IndexedDB strategy — the native-first default ──────────────────────────────────────────────────────

/**
 * The native-first durable store: one IndexedDB database, one object store per scope (created lazily),
 * records keyed by `id`. Real, browser-correct code; in a DOM environment without IndexedDB (e.g.
 * happy-dom) construct `LocalStorageStrategy` instead — `pickStorageStrategy()` does that feature-detect.
 */
export class IndexedDBStrategy<T = unknown> implements CustomStorageStrategy<T> {
  readonly key = 'native-indexeddb';
  readonly #dbName: string;
  #db: Promise<IDBDatabase> | null = null;
  readonly #scopes = new Set<string>();

  constructor(dbName = 'webstates') {
    this.#dbName = dbName;
  }

  #open(scope: string): Promise<IDBDatabase> {
    this.#scopes.add(scope);
    // Re-open with a bumped version when a new scope (object store) is needed.
    this.#db = new Promise<IDBDatabase>((resolve, reject) => {
      const existing = this.#db;
      const version = this.#scopes.size + 1;
      const req = indexedDB.open(this.#dbName, version);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of this.#scopes) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      void existing; // prior handle is superseded by the version bump
    });
    return this.#db;
  }

  async #tx<R>(scope: string, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<R> {
    const db = await this.#open(scope);
    return new Promise<R>((resolve, reject) => {
      const req = run(db.transaction(scope, mode).objectStore(scope));
      req.onsuccess = () => resolve(req.result as R);
      req.onerror = () => reject(req.error);
    });
  }

  async get(scope: string, id: string): Promise<T | undefined> {
    return this.#tx<T | undefined>(scope, 'readonly', (s) => s.get(id));
  }
  async set(scope: string, id: string, value: T): Promise<void> {
    await this.#tx(scope, 'readwrite', (s) => s.put(value, id));
  }
  async delete(scope: string, id: string): Promise<void> {
    await this.#tx(scope, 'readwrite', (s) => s.delete(id));
  }
  async keys(scope: string): Promise<string[]> {
    const ks = await this.#tx<IDBValidKey[]>(scope, 'readonly', (s) => s.getAllKeys());
    return ks.map(String);
  }
}

// ── Persistence + feature-detected default picker ──────────────────────────────────────────────────────

/** `navigator.storage`-backed persistence; degrades to no-op/false when the API is absent. */
export const nativeStoragePersistence: StoragePersistence = {
  async persist() {
    return typeof navigator !== 'undefined' && navigator.storage?.persist ? navigator.storage.persist() : false;
  },
  async persisted() {
    return typeof navigator !== 'undefined' && navigator.storage?.persisted ? navigator.storage.persisted() : false;
  },
  async estimate() {
    return typeof navigator !== 'undefined' && navigator.storage?.estimate ? navigator.storage.estimate() : {};
  },
};

/** Native-first pick: IndexedDB where present, else the localStorage degradation floor. */
export function pickStorageStrategy<T = unknown>(): CustomStorageStrategy<T> {
  return typeof indexedDB !== 'undefined' ? new IndexedDBStrategy<T>() : new LocalStorageStrategy<T>();
}
