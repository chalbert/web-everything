/**
 * Client-storage schema-versioning facet (#1295, ruling #1251).
 *
 * A **thin versioning facet above {@link CustomStorageStrategy}** (#1251 Fork 2 → A): wrap any storage
 * strategy once and *every* engine gets versioning for free, riding the registry's existing
 * IndexedDB→localStorage degrading read path (#1108) — no per-engine duplication. Home = webstates
 * (Fork 1 → A): versioning operates directly on persisted state.
 *
 * On **write**, each value is wrapped in a per-key `{ v, data }` envelope stamped with the current schema
 * version (Fork 3 default granularity — per-key; a per-store single-sidecar shape is the author's opt-in,
 * not built here). On **read** (lazy, #1108), the stored envelope's `v` is compared to the reading
 * schema's `version`:
 *  - **match** → return `data`;
 *  - **mismatch** (older `v`, a legacy un-enveloped value, or — with `detect` — a structurally-invalid
 *    payload) → run the registered `migrate` (the author's opt-in) if present, else **discard → defaults**
 *    (return `undefined`, the #1251 default mismatch policy — fixes the #487 stale-state footgun generically).
 *
 * Developer-facing axes, all support-both with the #1251 defaults: **detection** = version stamp (default;
 * pass `detect` for structural `safeParse`-style validation); **mismatch policy** = discard→defaults
 * (default; pass `migrate` to upgrade instead). None is a mandate.
 */
import type { CustomStorageStrategy, StorageBulkOp } from './CustomStorageStrategy';
import type { Disposable } from './CustomChangeStrategy';

/** The per-key version envelope a versioned write persists. */
export interface VersionedEnvelope<T = unknown> {
  /** The schema version the `data` was written under. */
  readonly v: number;
  readonly data: T;
}

/** Options for {@link VersionedStorageStrategy}. */
export interface VersioningOptions<T = unknown> {
  /** The schema version the reading code expects. A stored value with a different `v` is stale. */
  readonly version: number;
  /**
   * Upgrade a stale value to the current schema (the author's opt-in). Receives the stale payload (the
   * envelope's `data`, or the raw legacy value) and the version it was written under (`undefined` for a
   * legacy un-enveloped value), and returns the migrated value — or `undefined` to fall through to discard.
   */
  readonly migrate?: (stale: unknown, fromVersion: number | undefined) => T | undefined;
  /**
   * Structural detection (opt-in, #1251 support-both): validate the unwrapped data even when `v` matches;
   * `false` ⇒ treat as a mismatch (migrate-or-discard). Omitted ⇒ pure version-stamp detection (default).
   */
  readonly detect?: (data: unknown) => boolean;
  /**
   * Heal the store on read: when a migration produces a value, re-persist it under the current envelope so
   * the next read is clean. Default `true` (lazy migration, #1108). `false` keeps `get` side-effect-free.
   */
  readonly persistMigrated?: boolean;
}

/** True for a `{ v: number, data }` version envelope (vs a legacy un-enveloped value). */
export function isVersionedEnvelope(value: unknown): value is VersionedEnvelope {
  return !!value && typeof value === 'object' && typeof (value as { v?: unknown }).v === 'number' && 'data' in (value as object);
}

/**
 * Wraps an inner {@link CustomStorageStrategy} with the per-key versioning envelope (#1295/#1251). Drop it
 * in anywhere a strategy is expected; it delegates persistence to the inner engine and applies versioning
 * on the read/write boundary.
 */
export class VersionedStorageStrategy<T = unknown> implements CustomStorageStrategy<T> {
  readonly key: string;
  readonly #inner: CustomStorageStrategy<VersionedEnvelope<T>>;
  readonly #opts: VersioningOptions<T>;

  constructor(inner: CustomStorageStrategy<unknown>, options: VersioningOptions<T>) {
    this.#inner = inner as CustomStorageStrategy<VersionedEnvelope<T>>;
    this.#opts = options;
    this.key = `versioned:${inner.key}`;
  }

  /** Wrap a value in the current-version envelope. */
  #wrap(value: T): VersionedEnvelope<T> {
    return { v: this.#opts.version, data: value };
  }

  /**
   * Resolve a stored raw value against the current schema: `{ ok: true, data }` when current (and, if
   * `detect` is set, structurally valid), else the stale payload + its version for migrate-or-discard.
   */
  #resolve(raw: unknown): { ok: true; data: T } | { ok: false; stale: unknown; from: number | undefined } {
    const enveloped = isVersionedEnvelope(raw);
    const v = enveloped ? raw.v : undefined;
    const data = enveloped ? (raw.data as T) : (raw as T);
    const versionOk = v === this.#opts.version;
    const structureOk = this.#opts.detect ? this.#opts.detect(data) : true;
    if (versionOk && structureOk) return { ok: true, data };
    return { ok: false, stale: data, from: v };
  }

  async get(scope: string, id: string): Promise<T | undefined> {
    const raw = await this.#inner.get(scope, id);
    if (raw === undefined) return undefined;
    const r = this.#resolve(raw);
    if (r.ok) return r.data;
    // Stale: migrate (author opt-in) or discard → defaults (#1251 default).
    const migrated = this.#opts.migrate?.(r.stale, r.from);
    if (migrated === undefined) return undefined;
    if (this.#opts.persistMigrated !== false) await this.#inner.set(scope, id, this.#wrap(migrated));
    return migrated;
  }

  async set(scope: string, id: string, value: T): Promise<void> {
    return this.#inner.set(scope, id, this.#wrap(value));
  }

  delete(scope: string, id: string): Promise<void> {
    return this.#inner.delete(scope, id);
  }

  keys(scope: string): Promise<string[]> {
    return this.#inner.keys(scope);
  }

  bulk(scope: string, ops: StorageBulkOp<T>[]): Promise<void> {
    if (!this.#inner.bulk) {
      // No inner bulk: fall back to sequential set/delete through the versioning boundary.
      return ops.reduce<Promise<void>>(
        (p, op) => p.then(() => (op.op === 'set' ? this.set(scope, op.id, op.value) : this.delete(scope, op.id))),
        Promise.resolve(),
      );
    }
    const wrapped: StorageBulkOp<VersionedEnvelope<T>>[] = ops.map((op) =>
      op.op === 'set' ? { op: 'set', id: op.id, value: this.#wrap(op.value) } : op,
    );
    return this.#inner.bulk(scope, wrapped);
  }

  subscribe(scope: string, onChange: (id: string) => void): Disposable {
    if (!this.#inner.subscribe) return { dispose() {} };
    return this.#inner.subscribe(scope, onChange);
  }
}

/** Factory — wrap `inner` with the versioning facet. `versioned(new LocalStorageStrategy(), { version: 2 })`. */
export function versioned<T = unknown>(inner: CustomStorageStrategy<unknown>, options: VersioningOptions<T>): VersionedStorageStrategy<T> {
  return new VersionedStorageStrategy<T>(inner, options);
}
