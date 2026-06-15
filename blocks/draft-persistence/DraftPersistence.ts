/**
 * @file blocks/draft-persistence/DraftPersistence.ts
 * @description The Draft-Persistence controller — durable save-and-resume of an
 * entity's working state (#011, the durable storage facet of `webstates`). It
 * autosaves a snapshot on change (debounced), restores it across sessions to the
 * exact field state, and wires the last-writer-wins co-edit primitive so a second
 * editor is detectable and a newer remote save wins deterministically.
 *
 * Pluggable store: IndexedDB native-first default, `localStorage` degradation,
 * in-memory test fallback — all behind {@link CustomStorageStrategy}.
 */

import { CoEditCoordinator, resolveLww } from './coedit';
import { pickDefaultStorage } from './storage';
import {
  DEFAULT_CONFIG,
  type CustomStorageStrategy,
  type DraftPersistenceConfig,
  type DraftSnapshot,
} from './types';

export interface DraftPersistenceOptions extends Partial<DraftPersistenceConfig> {
  /** The durable store; defaults to the native-first pick (IndexedDB → localStorage → memory). */
  storage?: CustomStorageStrategy;
  /** A stable per-editor token (per tab/user); defaults to a random one. */
  editor?: string;
  /** Enable the cross-tab co-edit presence/conflict signal. */
  coEdit?: boolean;
}

export default class DraftPersistence<S = unknown> {
  #storage: CustomStorageStrategy;
  #config: DraftPersistenceConfig;
  #editor: string;
  #coordinators = new Map<string, CoEditCoordinator>();
  #timers = new Map<string, ReturnType<typeof setTimeout>>();
  #coEdit: boolean;

  constructor(opts: DraftPersistenceOptions = {}) {
    this.#storage = opts.storage ?? pickDefaultStorage();
    this.#config = {
      autosaveDebounceMs: opts.autosaveDebounceMs ?? DEFAULT_CONFIG.autosaveDebounceMs,
      version: opts.version ?? DEFAULT_CONFIG.version,
      requestPersistent: opts.requestPersistent ?? DEFAULT_CONFIG.requestPersistent,
    };
    this.#editor = opts.editor ?? makeEditorToken();
    this.#coEdit = opts.coEdit ?? false;
  }

  get editor(): string {
    return this.#editor;
  }

  get storageName(): string {
    return this.#storage.name;
  }

  /** Best-effort durable-storage request so the OS won't evict the drafts under pressure. */
  async requestPersistent(): Promise<boolean> {
    if (!this.#config.requestPersistent) return false;
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      try {
        return await navigator.storage.persist();
      } catch {
        return false;
      }
    }
    return false;
  }

  /** Immediately write a snapshot of `state` for `entityKey`. */
  async save(entityKey: string, state: S): Promise<DraftSnapshot<S>> {
    const snapshot: DraftSnapshot<S> = {
      entityKey,
      state,
      savedAt: Date.now(),
      editor: this.#editor,
      version: this.#config.version,
    };
    await this.#storage.set(this.#key(entityKey), snapshot);
    if (this.#coEdit) this.#coordinator(entityKey).signalSave(snapshot.savedAt);
    return snapshot;
  }

  /** Debounced autosave-on-change — the typical wiring behind an input listener. */
  autosave(entityKey: string, state: S): void {
    const existing = this.#timers.get(entityKey);
    if (existing) clearTimeout(existing);
    this.#timers.set(
      entityKey,
      setTimeout(() => {
        this.#timers.delete(entityKey);
        void this.save(entityKey, state);
      }, this.#config.autosaveDebounceMs),
    );
  }

  /** Restore a draft, or `null` if none exists or the schema version is stale. */
  async restore(entityKey: string): Promise<DraftSnapshot<S> | null> {
    const snap = await this.#storage.get<DraftSnapshot<S>>(this.#key(entityKey));
    if (!snap) return null;
    if (snap.version !== this.#config.version) {
      await this.discard(entityKey);
      return null;
    }
    return snap;
  }

  /** Drop a draft (e.g. after a successful commit). */
  async discard(entityKey: string): Promise<void> {
    const t = this.#timers.get(entityKey);
    if (t) {
      clearTimeout(t);
      this.#timers.delete(entityKey);
    }
    await this.#storage.delete(this.#key(entityKey));
  }

  /** List the entity keys with a saved draft. */
  async list(): Promise<string[]> {
    const keys = await this.#storage.keys();
    return keys.filter((k) => k.startsWith(PREFIX)).map((k) => k.slice(PREFIX.length));
  }

  /**
   * Reconcile an incoming remote snapshot against the locally-stored one by
   * last-writer-wins, persisting the winner. Returns whether the remote displaced local.
   */
  async reconcile(remote: DraftSnapshot<S>): Promise<{ remoteWon: boolean; winner: DraftSnapshot<S> }> {
    const local = await this.#storage.get<DraftSnapshot<S>>(this.#key(remote.entityKey));
    if (!local) {
      await this.#storage.set(this.#key(remote.entityKey), remote);
      return { remoteWon: true, winner: remote };
    }
    const { winner, remoteWon } = resolveLww(local, remote);
    if (remoteWon) await this.#storage.set(this.#key(remote.entityKey), winner);
    return { remoteWon, winner };
  }

  /** The co-edit coordinator for an entity (presence + conflict events); created on demand. */
  coordinator(entityKey: string): CoEditCoordinator {
    return this.#coordinator(entityKey);
  }

  /** Tear down timers + coordinators. */
  destroy(): void {
    for (const t of this.#timers.values()) clearTimeout(t);
    this.#timers.clear();
    for (const c of this.#coordinators.values()) c.destroy();
    this.#coordinators.clear();
  }

  #coordinator(entityKey: string): CoEditCoordinator {
    let c = this.#coordinators.get(entityKey);
    if (!c) {
      c = new CoEditCoordinator(entityKey, this.#editor);
      c.announce();
      this.#coordinators.set(entityKey, c);
    }
    return c;
  }

  #key(entityKey: string): string {
    return PREFIX + entityKey;
  }
}

const PREFIX = 'draft:';

function makeEditorToken(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `editor-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}
