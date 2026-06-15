/**
 * @file blocks/draft-persistence/types.ts
 * @description Shared types for the Draft-Persistence block — the durable
 * save-and-resume runtime ruled in #011 as a thin storage facet of `webstates`
 * (IndexedDB + `navigator.storage.persist()`), plus the last-writer-wins co-edit
 * primitive (a change-tracking strategy gated to the concurrent-editor case).
 *
 * @module blocks/draft-persistence
 */

// -----------------------------------------------------------------------
// Storage strategy contract (the #011 `CustomStorageStrategy` seam)
// -----------------------------------------------------------------------

/**
 * The pluggable durable-store contract. IndexedDB is the native-first default,
 * `localStorage` the graceful degradation, an in-memory map the SSR/test fallback —
 * all behind this one async key→value interface (#011 Fork 1A).
 */
export interface CustomStorageStrategy {
  /** A stable name (`indexeddb`, `localstorage`, `memory`, …) for diagnostics. */
  readonly name: string;
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

// -----------------------------------------------------------------------
// Draft snapshot
// -----------------------------------------------------------------------

/** The durable record persisted per draft — the working state plus co-edit metadata. */
export interface DraftSnapshot<S = unknown> {
  /** The entity this draft belongs to (e.g. `loan:42`). */
  entityKey: string;
  /** The serialized working state (field values). */
  state: S;
  /** Epoch ms of this save — the last-writer-wins comparison key. */
  savedAt: number;
  /** The editor token that wrote this snapshot. */
  editor: string;
  /** Schema/version tag so a stale-shape draft can be discarded on restore. */
  version: number;
}

export interface DraftPersistenceConfig {
  /** Debounce window (ms) for autosave-on-change. */
  autosaveDebounceMs: number;
  /** Schema version; a restored draft with a different version is dropped. */
  version: number;
  /** Best-effort request for durable (non-evictable) storage on first save. */
  requestPersistent: boolean;
}

export const DEFAULT_CONFIG: DraftPersistenceConfig = {
  autosaveDebounceMs: 800,
  version: 1,
  requestPersistent: true,
};

// -----------------------------------------------------------------------
// Co-edit (last-writer-wins) primitive
// -----------------------------------------------------------------------

/** A peer editor currently working the same entity, seen over the presence channel. */
export interface CoEditor {
  editor: string;
  /** Epoch ms this peer was last heard from. */
  lastSeen: number;
}

/** Verdict of a last-writer-wins comparison between a local and an incoming snapshot. */
export interface LwwResult<S = unknown> {
  /** The snapshot that wins (the later `savedAt`; ties break toward the incoming remote). */
  winner: DraftSnapshot<S>;
  /** True when the incoming remote snapshot displaced the local one. */
  remoteWon: boolean;
}

export const PRESENCE_EVENT = 'coedit-presence';
export const CONFLICT_EVENT = 'coedit-conflict';
