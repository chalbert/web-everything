/**
 * @file blocks/draft-persistence/coedit.ts
 * @description The last-writer-wins co-edit primitive (#011 Fork 3, gated to the
 * concurrent-editor case). A pure {@link resolveLww} decides which snapshot wins by
 * `savedAt`, and {@link CoEditCoordinator} broadcasts an "X also editing" presence
 * signal over BroadcastChannel (with a `storage`-event fallback) so a second tab/
 * editor is detectable.
 */

import { CONFLICT_EVENT, PRESENCE_EVENT, type CoEditor, type DraftSnapshot, type LwwResult } from './types';

/**
 * Last-writer-wins: the snapshot with the later `savedAt` wins; a tie breaks toward
 * the incoming `remote` (it arrived later in wall-clock terms). Pure — no I/O.
 */
export function resolveLww<S>(local: DraftSnapshot<S>, remote: DraftSnapshot<S>): LwwResult<S> {
  const remoteWon = remote.savedAt >= local.savedAt;
  return { winner: remoteWon ? remote : local, remoteWon };
}

interface PresenceMessage {
  type: 'hello' | 'bye' | 'saved';
  entityKey: string;
  editor: string;
  at: number;
  savedAt?: number;
}

/**
 * Coordinates presence + save signals across tabs/editors for one entity. Uses
 * BroadcastChannel where available; otherwise falls back to `localStorage` + the
 * `storage` event (which fires in *other* tabs only — exactly the cross-tab signal we want).
 * It does not merge state — it surfaces who-else-is-editing and emits a conflict signal
 * when a peer's save is newer, leaving the resolution policy ({@link resolveLww}) to the caller.
 */
export class CoEditCoordinator extends EventTarget {
  #entityKey: string;
  #editor: string;
  #channel: BroadcastChannel | null = null;
  #storageKey: string;
  #peers = new Map<string, CoEditor>();
  #storageHandler: ((e: StorageEvent) => void) | null = null;

  constructor(entityKey: string, editor: string) {
    super();
    this.#entityKey = entityKey;
    this.#editor = editor;
    this.#storageKey = `we-coedit:${entityKey}`;

    if (typeof BroadcastChannel !== 'undefined') {
      this.#channel = new BroadcastChannel(this.#storageKey);
      this.#channel.onmessage = (e) => this.#onMessage(e.data as PresenceMessage);
    } else if (typeof window !== 'undefined') {
      this.#storageHandler = (e: StorageEvent) => {
        if (e.key === this.#storageKey && e.newValue) this.#onMessage(JSON.parse(e.newValue) as PresenceMessage);
      };
      window.addEventListener('storage', this.#storageHandler);
    }
  }

  /** Announce this editor is present. */
  announce(): void {
    this.#post({ type: 'hello', entityKey: this.#entityKey, editor: this.#editor, at: now() });
  }

  /** Signal a save so peers can detect a newer write. */
  signalSave(savedAt: number): void {
    this.#post({ type: 'saved', entityKey: this.#entityKey, editor: this.#editor, at: now(), savedAt });
  }

  /** Peers seen recently (within `staleMs`). */
  peers(staleMs = 15000): CoEditor[] {
    const cutoff = now() - staleMs;
    return [...this.#peers.values()].filter((p) => p.lastSeen >= cutoff);
  }

  destroy(): void {
    this.#post({ type: 'bye', entityKey: this.#entityKey, editor: this.#editor, at: now() });
    this.#channel?.close();
    if (this.#storageHandler && typeof window !== 'undefined') window.removeEventListener('storage', this.#storageHandler);
  }

  #post(msg: PresenceMessage): void {
    if (this.#channel) {
      this.#channel.postMessage(msg);
    } else if (typeof localStorage !== 'undefined') {
      // Writing fires `storage` in other tabs. Vary the value so repeated saves still fire.
      localStorage.setItem(this.#storageKey, JSON.stringify(msg));
    }
  }

  #onMessage(msg: PresenceMessage): void {
    if (msg.editor === this.#editor || msg.entityKey !== this.#entityKey) return;
    if (msg.type === 'bye') {
      this.#peers.delete(msg.editor);
    } else {
      this.#peers.set(msg.editor, { editor: msg.editor, lastSeen: msg.at });
      // A peer arriving prompts us to re-announce so presence is mutual.
      if (msg.type === 'hello') this.announce();
    }
    this.dispatchEvent(new CustomEvent(PRESENCE_EVENT, { detail: { peers: this.peers() } }));
    if (msg.type === 'saved' && msg.savedAt != null) {
      this.dispatchEvent(new CustomEvent(CONFLICT_EVENT, { detail: { editor: msg.editor, savedAt: msg.savedAt } }));
    }
  }
}

function now(): number {
  return Date.now();
}
