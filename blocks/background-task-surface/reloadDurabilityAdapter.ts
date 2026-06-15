/**
 * @file blocks/background-task-surface/reloadDurabilityAdapter.ts
 * @description The `durability: reload` adapter (#134) — the opt-in tier that makes
 * transfer-backed work survive a full reload / tab close, delegated to the
 * [Background Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Fetch_API)
 * + a service worker rather than baked into the route-only baseline (#128).
 *
 * Native-first + graceful degradation (#450): the durable tier is an *enhancement*.
 * Where Background Fetch is unavailable the surface degrades to the route-only baseline
 * and re-arms the navigation guard — this module never throws on an unsupported browser,
 * it reports unavailability and the element re-arms the guard observably.
 *
 * Scope is bounded to transfer-backed durable *execution* only (#450 ruling 1): a durable
 * task is a Background Fetch (one or more request URLs the browser owns and reports progress
 * on across reload). Non-fetch long tasks stay route-only. There is no `resumable`
 * checkpoint/resume tier here.
 *
 * NOTE ON VERIFICATION: the headline behaviour — work that *actually* survives a reload —
 * rides on a real service worker + the Background Fetch API, which the vitest (happy-dom)
 * and Playwright harnesses here do not exercise. The in-harness-verifiable surface is the
 * feature-detection + the pure shape of the register/rehydrate payloads (covered by unit
 * tests); end-to-end durability needs the real-browser/SW verification path documented in
 * the block's demo (a SW-registered page exercised in a live browser).
 */

import type { BackgroundTaskRegisterDetail, LoaderStateHandle, LoaderSnapshot } from './types';

// ── Feature detection (arm-time) ───────────────────────────────────────────────

/**
 * True when the current context can run the durable tier — a service worker can be
 * registered *and* Background Fetch is exposed on the registration prototype. The element
 * calls this at arm-time (#450 ruling 3) so the navigation-guard re-arm tracks runtime
 * availability, not a build-time assumption.
 *
 * Pure + side-effect-free, so it is unit-testable by stubbing the globals.
 */
export function isBackgroundFetchAvailable(
  scope: { navigator?: { serviceWorker?: unknown }; ServiceWorkerRegistration?: unknown } = (
    globalThis as unknown as {
      navigator?: { serviceWorker?: unknown };
      ServiceWorkerRegistration?: unknown;
    }
  ),
): boolean {
  const hasServiceWorker =
    typeof scope.navigator === 'object' &&
    scope.navigator !== null &&
    'serviceWorker' in scope.navigator &&
    scope.navigator.serviceWorker != null;
  // Cast to a function-with-prototype so the `typeof === 'function'` guard narrows to a usable type:
  // a bare object union narrows to `never` under stricter TS — the cross-repo build discrepancy #695 hit.
  const reg = scope.ServiceWorkerRegistration as (Function & { prototype?: object }) | undefined;
  const hasBackgroundFetch =
    typeof reg === 'function' && !!reg.prototype && 'backgroundFetch' in reg.prototype;
  return hasServiceWorker && hasBackgroundFetch;
}

// ── Durable transfer descriptor (the carried registration payload) ──────────────

/**
 * A transfer the durable tier owns. `id` matches the surface entry id so a rehydrated
 * fetch reconnects to (or seeds) the right entry. `requests` are the URLs handed to
 * Background Fetch; `label`/`progress` mirror the surface register detail so a rehydrated
 * task renders identically to a freshly-registered one.
 */
export interface DurableTransfer {
  id: string;
  label: string;
  /** One or more request URLs (or Requests) the browser fetches durably. */
  requests: Array<string | Request>;
  /** Display metadata Background Fetch shows in its native UI. */
  title?: string;
  /** Total download bytes if known, for determinate progress. */
  downloadTotal?: number;
}

/** Outcome of attempting to register a durable transfer. Never throws on unsupported. */
export interface RegisterDurableResult {
  /** True when the transfer was handed to Background Fetch. */
  durable: boolean;
  /** Present when `durable` is false — why the tier degraded (for observability). */
  fallbackReason?: 'unsupported' | 'no-registration' | 'error';
  /** The Background Fetch registration id, when durable. */
  fetchId?: string;
}

// ── Registration ────────────────────────────────────────────────────────────────

/**
 * Register a transfer with Background Fetch via the active service-worker registration.
 * Degrades gracefully: returns `{ durable: false, fallbackReason }` (never throws) when the
 * API is missing or no SW controls the page, so the caller re-arms the route-only guard.
 */
export async function registerDurableTransfer(
  transfer: DurableTransfer,
  getRegistration: () => Promise<ServiceWorkerRegistration | undefined> = defaultGetRegistration,
): Promise<RegisterDurableResult> {
  if (!isBackgroundFetchAvailable()) return { durable: false, fallbackReason: 'unsupported' };
  let registration: ServiceWorkerRegistration | undefined;
  try {
    registration = await getRegistration();
  } catch {
    return { durable: false, fallbackReason: 'error' };
  }
  const bgFetch = (registration as unknown as { backgroundFetch?: BackgroundFetchManagerLike })
    ?.backgroundFetch;
  if (!registration || !bgFetch) return { durable: false, fallbackReason: 'no-registration' };
  try {
    await bgFetch.fetch(transfer.id, transfer.requests, {
      title: transfer.title ?? transfer.label,
      downloadTotal: transfer.downloadTotal,
    });
    return { durable: true, fetchId: transfer.id };
  } catch {
    return { durable: false, fallbackReason: 'error' };
  }
}

// ── Rehydration ──────────────────────────────────────────────────────────────────

/**
 * The state of a durable transfer recovered on the next page load — enough to rebuild a
 * surface register detail so a reload-surviving task reconnects to its entry (the handle
 * that crossed the reload boundary).
 */
export interface RehydratedTransfer {
  id: string;
  label: string;
  /** Mapped from the Background Fetch record's progress, when determinate. */
  progress?: number;
  /** Terminal-or-active phase derived from the recovered record. */
  state: LoaderSnapshot['state'];
}

/**
 * Recover in-progress / recently-completed durable transfers on load and map each to a
 * surface register detail, so the surface re-adopts them after a reload. Returns `[]` (never
 * throws) when Background Fetch is unavailable — the route-only baseline simply has nothing
 * to rehydrate.
 *
 * The recovered `LoaderStateHandle` wraps the live Background Fetch record: `getSnapshot`
 * reads its current progress, `subscribe` listens to the record's `progress` events. This is
 * the seam where a reload-surviving task reconnects to the surface's Loader-state contract
 * without the surface knowing the work was durable.
 */
export async function rehydrateDurableTasks(
  getRegistration: () => Promise<ServiceWorkerRegistration | undefined> = defaultGetRegistration,
): Promise<BackgroundTaskRegisterDetail[]> {
  if (!isBackgroundFetchAvailable()) return [];
  let registration: ServiceWorkerRegistration | undefined;
  try {
    registration = await getRegistration();
  } catch {
    return [];
  }
  const bgFetch = (registration as unknown as { backgroundFetch?: BackgroundFetchManagerLike })
    ?.backgroundFetch;
  if (!bgFetch) return [];
  let ids: string[] = [];
  try {
    ids = await bgFetch.getIds();
  } catch {
    return [];
  }
  const details: BackgroundTaskRegisterDetail[] = [];
  for (const id of ids) {
    let record: BackgroundFetchRegistrationLike | undefined;
    try {
      record = await bgFetch.get(id);
    } catch {
      record = undefined;
    }
    if (!record) continue;
    details.push({
      id,
      label: id,
      progress: record.downloadTotal && record.downloadTotal > 0 ? 'determinate' : 'indeterminate',
      loaderState: handleForRecord(record),
    });
  }
  return details;
}

/** Wrap a Background Fetch record as a Loader state handle the surface can adopt. */
function handleForRecord(record: BackgroundFetchRegistrationLike): LoaderStateHandle {
  const snapshot = (): LoaderSnapshot => ({
    state: recordState(record),
    progress:
      record.downloadTotal && record.downloadTotal > 0
        ? Math.min(1, record.downloaded / record.downloadTotal)
        : undefined,
  });
  return {
    getSnapshot: snapshot,
    subscribe(listener) {
      const onProgress = () => listener(snapshot());
      record.addEventListener?.('progress', onProgress);
      return () => record.removeEventListener?.('progress', onProgress);
    },
  };
}

function recordState(record: BackgroundFetchRegistrationLike): LoaderSnapshot['state'] {
  if (record.result === 'failure') return 'error';
  if (record.result === 'success') return 'success';
  return 'active';
}

async function defaultGetRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  const sw = (navigator as unknown as { serviceWorker?: { ready?: Promise<ServiceWorkerRegistration> } })
    .serviceWorker;
  return sw?.ready;
}

// ── Minimal structural types for the Background Fetch API ────────────────────────
// The lib.dom types don't ship Background Fetch yet; these are the slices we touch.

interface BackgroundFetchManagerLike {
  fetch(
    id: string,
    requests: Array<string | Request>,
    options?: { title?: string; downloadTotal?: number },
  ): Promise<BackgroundFetchRegistrationLike>;
  get(id: string): Promise<BackgroundFetchRegistrationLike | undefined>;
  getIds(): Promise<string[]>;
}

interface BackgroundFetchRegistrationLike {
  id: string;
  downloaded: number;
  downloadTotal: number;
  result: '' | 'success' | 'failure';
  addEventListener?(type: 'progress', listener: () => void): void;
  removeEventListener?(type: 'progress', listener: () => void): void;
}
