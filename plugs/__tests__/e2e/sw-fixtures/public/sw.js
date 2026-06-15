/* Sample durable-tier service worker for the real-browser rehydration harness (#684).
 *
 * It holds in-flight "tasks" the page hands off, so a hard reload can re-hydrate them
 * FROM THE WORKER — which outlives the page. This is the service-worker mechanism the
 * #675 durable tier rides; the harness proves reload-survival, not a specific feature.
 *
 * State is kept in-memory in the worker. A page reload does not terminate the worker,
 * so the Map survives the round trip the test exercises. (A production durable tier
 * would persist to Cache/IndexedDB to also survive worker eviction — that is #675's
 * feature, not the harness's.) */
const tasks = new Map();

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('message', (event) => {
  const data = event.data || {};
  const reply = event.ports && event.ports[0];
  if (data.type === 'ARM_TASK' && data.task) {
    tasks.set(data.task.id, { ...data.task, bgFetch: !!data.bgFetch });
    if (reply) reply.postMessage({ type: 'ARMED', id: data.task.id });
  } else if (data.type === 'GET_TASKS') {
    if (reply) reply.postMessage({ type: 'TASKS', tasks: [...tasks.values()] });
  } else if (data.type === 'CLEAR') {
    tasks.clear();
    if (reply) reply.postMessage({ type: 'CLEARED' });
  }
});
