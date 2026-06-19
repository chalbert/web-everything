/**
 * Change-Tracking contract + native default strategy (#1105, webstates completion #1089).
 *
 * Spec: `we:src/_includes/project-webstates.njk` (the change-tracking facet). Every detection mechanism
 * is a {@link CustomChangeStrategy} that turns a tracked target into a stream of {@link ChangeRecord}s.
 * The **native default** — a store-subscription firing on mutation — is the zero-config baseline
 * (native-first); libraries (Immer, Yjs, a diff engine) are opt-in adapters behind the same contract.
 *
 * Types only here are compile-erased; the native strategy is the runtime baseline. Non-invasive — it
 * patches no global, it just subscribes to a store it is handed.
 */

/** Attribution channel for a change. Generalizes validation's value-input (user) vs baseline-change (program/server). */
export interface ChangeSource {
  channel: 'user' | 'program' | 'server-sync' | 'replay' | 'external';
  /** Optional W3C Trace Context link to the initiating span. */
  traceparent?: string;
}

/**
 * A single mutation, self-contained so it can be reversed without the original document. `oldValue` is
 * carried because RFC 6902 `remove`/`replace` are not self-inverting; `version` is left opaque (Lamport
 * clock, vector clock, or document version) so distributed strategies supply their own causal token.
 */
export interface ChangeRecord {
  /** JSON Pointer to the mutated location. */
  path: string;
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy';
  /** REQUIRED for self-contained reversal — RFC 6902 ops are not self-inverting. */
  oldValue?: unknown;
  newValue?: unknown;
  /** Attribution — who/what caused the change. */
  source: ChangeSource;
  timestamp: number;
  /** Optional causal / optimistic-concurrency token. */
  version?: string | number;
}

/** A teardown handle returned by `track` — calling `dispose()` stops the change stream. */
export interface Disposable {
  dispose(): void;
}

/**
 * A change-detection strategy — turns a tracked target into a stream of {@link ChangeRecord}s. The
 * `key` names the mechanism (`'native-signals'`, `'snapshot-diff'`, `'crdt'`); `diff` is for snapshot
 * strategies, `applyInverse` for reversible ones (both optional — the native baseline implements them).
 */
export interface CustomChangeStrategy {
  readonly key: string;
  track(target: object, emit: (record: ChangeRecord) => void): Disposable;
  /** For snapshot strategies: derive the records that turn `baseline` into `current`. */
  diff?(baseline: unknown, current: unknown): ChangeRecord[];
  /** For reversible strategies: apply the inverse of `records` to `target`. */
  applyInverse?(target: object, records: ChangeRecord[]): void;
}

// ── Native default — store-subscription change detection ──────────────────────────────────────────────

/** A store-like target: subscribes to mutations and can read/write top-level items. Duck-typed. */
interface StoreLike {
  subscribe(listener: (state: Record<string, unknown>) => void): () => void;
  setItem?(key: string, value: unknown): void;
  getState?(): Record<string, unknown>;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Top-level shallow diff of two state objects → one {@link ChangeRecord} per changed key. */
function diffStates(
  baseline: Record<string, unknown>,
  current: Record<string, unknown>,
  source: ChangeSource,
  now: number,
): ChangeRecord[] {
  const records: ChangeRecord[] = [];
  const keys = new Set([...Object.keys(baseline), ...Object.keys(current)]);
  for (const key of keys) {
    const had = key in baseline;
    const has = key in current;
    const oldValue = baseline[key];
    const newValue = current[key];
    if (had && !has) records.push({ path: `/${key}`, op: 'remove', oldValue, source, timestamp: now });
    else if (!had && has) records.push({ path: `/${key}`, op: 'add', newValue, source, timestamp: now });
    else if (oldValue !== newValue) records.push({ path: `/${key}`, op: 'replace', oldValue, newValue, source, timestamp: now });
  }
  return records;
}

/**
 * The native-first change strategy: subscribe to a store and emit a {@link ChangeRecord} per changed
 * top-level key, diffing each notification against the prior snapshot. The zero-config baseline; richer
 * strategies (snapshot-diff, CRDT) plug in behind the same contract. `source.channel` defaults to
 * `'program'` (a programmatic store write); a caller wires `'user'` upstream when relevant.
 */
export class NativeChangeStrategy implements CustomChangeStrategy {
  readonly key = 'native-signals';
  readonly #now: () => number;

  constructor(now: () => number = () => Date.now()) {
    this.#now = now;
  }

  track(target: object, emit: (record: ChangeRecord) => void): Disposable {
    const store = target as StoreLike;
    let prev: Record<string, unknown> = isRecord(store.getState?.()) ? { ...store.getState!() } : {};
    const source: ChangeSource = { channel: 'program' };
    const unsubscribe = store.subscribe((state) => {
      const current = isRecord(state) ? state : {};
      for (const record of diffStates(prev, current, source, this.#now())) emit(record);
      prev = { ...current };
    });
    return { dispose: () => unsubscribe() };
  }

  /** Snapshot diff between two states (top-level). */
  diff(baseline: unknown, current: unknown): ChangeRecord[] {
    return diffStates(
      isRecord(baseline) ? baseline : {},
      isRecord(current) ? current : {},
      { channel: 'program' },
      this.#now(),
    );
  }

  /** Reverse `records` against a store target, latest-first, restoring each `oldValue`. */
  applyInverse(target: object, records: ChangeRecord[]): void {
    const store = target as StoreLike;
    if (!store.setItem) return;
    for (let i = records.length - 1; i >= 0; i -= 1) {
      const r = records[i];
      const key = r.path.replace(/^\//, '');
      // add → undo by clearing; remove/replace → restore the prior value.
      store.setItem(key, r.op === 'add' ? undefined : r.oldValue);
    }
  }
}

/** The zero-config native change strategy instance. */
export const nativeChangeStrategy = new NativeChangeStrategy();
