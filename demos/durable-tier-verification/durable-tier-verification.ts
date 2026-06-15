/**
 * A′ durable-tier verification demo (backlog #708, ratified from #675) — the SW-registered page that
 * makes the REAL {@link reloadDurabilityAdapter} the unit under test in a live browser.
 *
 * #684 already proved the generic register → arm → hard-reload → rehydrate cycle, but against a plain-JS
 * fixture that re-implemented the durable contract. This demo's distinct job (the A′ ruling) is to drive
 * the *real* TS adapter — `registerDurableTransfer` / `rehydrateDurableTasks` / `isBackgroundFetchAvailable`
 * — against real browser primitives, doubling ONLY the `getRegistration().backgroundFetch` manager:
 *
 *   - REAL service-worker registration + REAL `navigator.serviceWorker.ready` (mirrored from the adapter's
 *     own `defaultGetRegistration`; it is not exported, so we replicate its one line here),
 *   - REAL `isBackgroundFetchAvailable()` against the real `ServiceWorkerRegistration.prototype`,
 *   - REAL forced-unavailable fallback re-arm via the real `<background-tasks>` element (#134),
 *   - the ONLY double: a `backgroundFetch` manager shadowed onto the real registration, backed by the
 *     real SW (which outlives the page) so a transfer survives the hard reload deterministically.
 *
 * The true Background-Fetch *network* transfer surviving reload stays the documented manual residual.
 *
 * The page exposes a small `window.__durable` surface the `.sw.spec.ts` drives; this doubles as living
 * documentation (the adapter's NOTE points verification at "the block's demo, a SW-registered page").
 */
import {
  registerDurableTransfer,
  rehydrateDurableTasks,
  isBackgroundFetchAvailable,
  type DurableTransfer,
} from '/blocks/background-task-surface/reloadDurabilityAdapter';
import { registerBackgroundTasks } from '/blocks/background-task-surface/registerBackgroundTasks';
import type {
  BackgroundTaskRegisterDetail,
  LoaderStateHandle,
} from '/blocks/background-task-surface/types';

registerBackgroundTasks();

const surface = document.getElementById('surface') as HTMLElement & { hasActiveTasks(): boolean };
const log = (msg: string) => {
  const li = document.createElement('li');
  li.textContent = msg;
  document.getElementById('log')?.appendChild(li);
};

// ── The single permitted double: a SW-backed BackgroundFetchManager ──────────────
// Everything it does crosses to the REAL service worker over a real MessageChannel; the manager itself
// is the only fake, exactly as #675 ratified.
interface BackgroundFetchManagerLike {
  fetch(id: string, requests: Array<string | Request>, options?: { title?: string; downloadTotal?: number }): Promise<unknown>;
  get(id: string): Promise<unknown>;
  getIds(): Promise<string[]>;
}

function sendToSW<T>(message: Record<string, unknown>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const sw = navigator.serviceWorker.controller;
    if (!sw) return reject(new Error('no service-worker controller'));
    const channel = new MessageChannel();
    channel.port1.onmessage = (e) => resolve(e.data as T);
    sw.postMessage(message, [channel.port2]);
  });
}

const doubledManager: BackgroundFetchManagerLike = {
  async fetch(id, _requests, options) {
    await sendToSW({ type: 'BGF_FETCH', id, downloadTotal: options?.downloadTotal ?? 0 });
    return { id, downloaded: 0, downloadTotal: options?.downloadTotal ?? 0, result: '' };
  },
  async getIds() {
    return (await sendToSW<{ ids: string[] }>({ type: 'BGF_GET_IDS' })).ids;
  },
  async get(id) {
    return (await sendToSW<{ record: unknown }>({ type: 'BGF_GET', id })).record ?? undefined;
  },
};

/**
 * The adapter's `getRegistration` seam. Returns the REAL registration (real `navigator.serviceWorker.ready`,
 * the same line `defaultGetRegistration` runs) with `backgroundFetch` shadowed by the single doubled
 * manager — the only fake in the whole pipeline.
 */
async function getRegistrationWithDoubledManager(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.ready; // REAL — identical to defaultGetRegistration
  Object.defineProperty(reg, 'backgroundFetch', { value: doubledManager, configurable: true });
  return reg as ServiceWorkerRegistration;
}

// ── A route-only "active task" the fallback scenario re-arms the guard over ───────
// Independent of the durable adapter: this is plain in-flight work, so the element's degraded-tier guard
// re-arm (#134) can be exercised even when Background Fetch is forced unavailable.
function activeLoaderHandle(): LoaderStateHandle {
  return { getSnapshot: () => ({ state: 'active' }), subscribe: () => () => {} };
}

function adopt(detail: BackgroundTaskRegisterDetail): void {
  surface.dispatchEvent(new CustomEvent('background-task-register', { bubbles: true, detail }));
}

declare global {
  interface Window {
    __durable: {
      ready: boolean;
      bgFetchSupported: boolean;
      registerTransfer(transfer: DurableTransfer): Promise<unknown>;
      rehydrate(): Promise<Array<{ id: string; label: string; progress: string }>>;
      armRouteOnlyTask(task: { id: string; label: string }): void;
      fallbackActive(): boolean;
      clear(): Promise<void>;
    };
  }
}

window.__durable = {
  ready: false,
  bgFetchSupported: false,

  // Drive the REAL adapter; only the backgroundFetch manager is doubled.
  async registerTransfer(transfer) {
    const result = await registerDurableTransfer(transfer, getRegistrationWithDoubledManager);
    log(`registerDurableTransfer(${transfer.id}) → ${JSON.stringify(result)}`);
    return result;
  },

  // Recover durable transfers via the REAL adapter and adopt each into the live surface.
  async rehydrate() {
    const details = await rehydrateDurableTasks(getRegistrationWithDoubledManager);
    for (const detail of details) adopt(detail);
    log(`rehydrateDurableTasks() → ${details.length} task(s)`);
    return details.map((d) => ({ id: d.id, label: d.label, progress: String(d.progress) }));
  },

  // Exercise the element's degraded-tier (route-only) navigation-guard re-arm.
  armRouteOnlyTask(task) {
    adopt({ id: task.id, label: task.label, progress: 'indeterminate', loaderState: activeLoaderHandle() });
    log(`armRouteOnlyTask(${task.id}) — active task adopted (fallback=${surface.hasAttribute('data-durability-fallback')})`);
  },

  // The element's documented observable for "degraded to route-only + guard re-armed" (#134).
  fallbackActive() {
    return surface.hasAttribute('data-durability-fallback');
  },

  async clear() {
    await sendToSW({ type: 'BGF_CLEAR' });
  },
};

async function main(): Promise<void> {
  // REAL service-worker registration (classic worker; Vite serves it verbatim). Scope defaults to this
  // demo directory, so the worker controls this page.
  await navigator.serviceWorker.register('./durable-sw.js');
  await navigator.serviceWorker.ready;
  // Wait for the worker to actually control this client (clients.claim) so the doubled manager's channel
  // has a controller to post to on first load.
  if (!navigator.serviceWorker.controller) {
    await new Promise<void>((resolve) =>
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }),
    );
  }
  // Real feature detection against the real prototype.
  window.__durable.bgFetchSupported = isBackgroundFetchAvailable();
  // On reload, re-adopt any durable transfers the worker still holds (the rehydrate-on-load contract).
  await window.__durable.rehydrate();
  window.__durable.ready = true;
  log(`ready — bgFetchSupported=${window.__durable.bgFetchSupported}`);
}

void main();
