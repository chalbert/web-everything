/**
 * Web Notifications conformance demo (#1066, slice C of #1024) — the runnable proof of the push-delivery
 * contract+provider swap seam (#1064, contract `notifications/push-contract.ts`).
 *
 * The push-delivery contract is type-only (the runtime providers — native Web Push, FCM/OneSignal/Novu
 * hubs — are impl in FUI). So this demo proves the contract the honest way: in-demo **recording-stub**
 * providers that CONFORM to `CustomPushProvider`, swapped behind one call site. The conformance claim:
 * the app issues the same subscribe()/send()/unsubscribe() calls while the resolved provider is swapped,
 * and a `DeliveryReceipt` carries the closed-set status. `setPlaygroundReady` reports the pass count.
 */
import type {
  CustomPushProvider,
  PushSubscriptionInfo,
  DeliveryReceipt,
} from '/notifications/push-contract.ts';
import { setPlaygroundReady } from '/demos/playground-harness';

/** A recording-stub provider conforming to CustomPushProvider — no network, records every call. */
function recordingProvider(id: string): CustomPushProvider & { sent: unknown[] } {
  const sent: unknown[] = [];
  return {
    id,
    sent,
    async subscribe(options): Promise<PushSubscriptionInfo> {
      return { endpoint: `https://push.example/${id}/${options.vapidKey ?? 'anon'}`, provider: id };
    },
    async send(target, payload): Promise<DeliveryReceipt> {
      sent.push({ target: target.endpoint, payload });
      return { target: target.endpoint, status: 'delivered', at: '2026-06-19T00:00:00Z' };
    },
    async unsubscribe(): Promise<void> {
      sent.push({ unsubscribed: true });
    },
  };
}

const checks: { name: string; pass: boolean; detail: string }[] = [];
const assert = (name: string, pass: boolean, detail: string) => checks.push({ name, pass, detail });

// One call site, the provider swapped underneath — the app never names a vendor.
async function deliver(provider: CustomPushProvider, payload: unknown): Promise<DeliveryReceipt> {
  const sub = await provider.subscribe({ vapidKey: 'demo' });
  return provider.send(sub, payload);
}

const webPush = recordingProvider('web-push'); // the native default
const hub = recordingProvider('onesignal'); // a hub plugged in behind the same contract

const r1 = await deliver(webPush, { title: 'hello' });
assert('native web-push provider delivers a receipt', r1.status === 'delivered' && r1.target.includes('web-push'), `status=${r1.status}`);

const r2 = await deliver(hub, { title: 'hello' });
assert('hub provider swapped behind the same call site', r2.target.includes('onesignal'), `target=${r2.target}`);

assert('DeliveryReceipt.status is in the closed set', ['queued', 'delivered', 'failed'].includes(r1.status), `status=${r1.status}`);

// The subscription carries its owning provider id (the seam the injector resolves).
const sub = await hub.subscribe({});
assert('PushSubscriptionInfo names its provider', sub.provider === 'onesignal', `provider=${sub.provider}`);

// unsubscribe tears down (records the call) — full lifecycle.
await hub.unsubscribe(sub);
assert('unsubscribe completes the lifecycle', hub.sent.some((s: any) => s.unsubscribed === true), 'recorded');

// Both providers satisfy the identical interface shape (structural conformance).
const conforms = (p: CustomPushProvider) => typeof p.subscribe === 'function' && typeof p.send === 'function' && typeof p.unsubscribe === 'function' && typeof p.id === 'string';
assert('both providers conform to CustomPushProvider', conforms(webPush) && conforms(hub), 'structural');

// ── Render ──
const passCount = checks.filter((c) => c.pass).length;
const root = document.getElementById('play-root')!;
root.innerHTML = '';
const summary = document.createElement('p');
summary.className = 'conformance-summary';
summary.textContent = `${passCount}/${checks.length} conformance checks passed`;
const list = document.createElement('ul');
list.className = 'conformance-list';
for (const c of checks) {
  const li = document.createElement('li');
  li.className = c.pass ? 'pass' : 'fail';
  li.textContent = `${c.pass ? '✓' : '✗'} ${c.name} — ${c.detail}`;
  list.appendChild(li);
}
root.append(summary, list);
setPlaygroundReady(passCount);
