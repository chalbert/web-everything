/* Service worker for the A′ durable-tier verification demo (backlog #708, ruling from #675).
 *
 * This is a REAL, registered service worker — the demo's `navigator.serviceWorker.ready` resolves to
 * this worker, exactly as the real `reloadDurabilityAdapter.defaultGetRegistration()` expects. Its only
 * job is to be the durable store that OUTLIVES the page: it holds the in-flight Background-Fetch
 * "transfers" the page hands off, so a hard reload can re-hydrate them FROM THE WORKER.
 *
 * Why the worker holds the state: the real Background Fetch API persists the transfer in the browser so
 * it survives a reload. A real network transfer surviving reload is non-deterministic in automation
 * (#675's documented manual residual), so the demo doubles ONLY the `getRegistration().backgroundFetch`
 * MANAGER — and that double is backed here, in the worker, which a page reload does not terminate. Every
 * other primitive (SW registration, `navigator.serviceWorker.ready`, the real `isBackgroundFetchAvailable`
 * prototype check) stays real. State is in-memory in the worker (it survives the reload round trip the
 * spec exercises); a production tier would persist to Cache/IndexedDB to also survive worker eviction —
 * that is the durable tier's own feature (#134), not this harness's. */
const transfers = new Map();

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('message', (event) => {
  const data = event.data || {};
  const reply = event.ports && event.ports[0];
  switch (data.type) {
    // The doubled BackgroundFetchManager.fetch() — record a durable transfer.
    case 'BGF_FETCH':
      transfers.set(data.id, {
        id: data.id,
        downloaded: 0,
        downloadTotal: data.downloadTotal || 0,
        result: '',
      });
      if (reply) reply.postMessage({ ok: true, id: data.id });
      break;
    // getIds()
    case 'BGF_GET_IDS':
      if (reply) reply.postMessage({ ids: [...transfers.keys()] });
      break;
    // get(id)
    case 'BGF_GET':
      if (reply) reply.postMessage({ record: transfers.get(data.id) || null });
      break;
    // Test hygiene — clear durable state between scenarios.
    case 'BGF_CLEAR':
      transfers.clear();
      if (reply) reply.postMessage({ ok: true });
      break;
    default:
      if (reply) reply.postMessage({ ok: false, error: 'unknown-message' });
  }
});
