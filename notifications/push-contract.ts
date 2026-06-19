/**
 * Push-Delivery protocol — the **pure-contract half** (#1024, slice #1064).
 *
 * Types and interfaces only: this module is fully **compile-erased** (no runtime emit) so it can become
 * the `@webeverything/contracts/push-delivery` entry (#872/#874) that FUI depends on (the FUI→WE arrow),
 * superseding byte-replication — exactly like `guard/contract.ts` and `analytics/contract.ts`. The
 * runtime half — the native Web Push default provider and the multi-channel hub adapters (FCM,
 * OneSignal, Novu) behind the swap registry — is impl and lives in FUI; only the contract crosses the
 * seam (npm scope mirrors layer).
 *
 * Web Notifications is the notification-domain home; this protocol is the **closed-app push-delivery**
 * transport (#455 Fork 1 — transport home *by purpose*: push lives here, the open-app realtime family
 * (WebSocket/SSE/WebTransport) is webrealtime, #455 Fork 2). A producer never bundles a push service: it
 * resolves a `CustomPushProvider` through the injector chain and delivers — native Web Push is the
 * default, a hub plugs in behind the one contract. This is a genuine Protocol (a real provider seam, per
 * the Project/Protocol bar; #456/#459/#460 design, #009 Fork D home).
 *
 * Scope of THIS contract: the closed-app push transport only. The OS-surface render lives in the
 * `system-notification` intent and the in-app toast in the `feedback` intent (both already in the intent
 * registry, #009 Forks A/B) — this module does not redefine them. Out of scope (the project's open
 * questions, decided downstream): surface-routing policy (push vs marker vs badge), the dedup/collapse
 * key locus. `DeliveryReceipt.status` follows the closed set the resolved design page commits to.
 */

/**
 * A service-worker push subscription against a push service, VAPID-authenticated — what a provider
 * delivers to. Mirrors the Web Push API `PushSubscription` essentials.
 */
export interface PushSubscriptionInfo {
  /** The push-service URL the provider delivers to. */
  endpoint: string;
  /** Web Push encryption keys (VAPID-authenticated). Absent for providers that don't use the Web Push envelope. */
  keys?: { p256dh: string; auth: string };
  /** Which `CustomPushProvider` owns this subscription (its `id`). */
  provider: string;
}

/** The result of a `send` — what an audit / report trail records (a `DeliveryReceipt` is a report source). */
export interface DeliveryReceipt {
  /** The subscription endpoint / provider target id. */
  target: string;
  /** Delivery status — the closed set the resolved design commits to. */
  status: 'queued' | 'delivered' | 'failed';
  /** ISO timestamp of the receipt. */
  at: string;
  /** Advisory failure / status note. */
  reason?: string;
}

/**
 * A push provider — the swappable seam, the lock. Native Web Push (`id: 'web-push'`) is the default; a
 * multi-channel hub (FCM, OneSignal, Novu) plugs in behind the one contract. Concrete providers are impl
 * and live in FUI, resolved nearest-scope-wins through the injector chain.
 */
export interface CustomPushProvider {
  /** `'web-push'` (native default) | `'fcm'` | `'onesignal'` | … */
  readonly id: string;
  /** Create a subscription against the push service. */
  subscribe(options: { vapidKey?: string }): Promise<PushSubscriptionInfo>;
  /** Deliver a payload to a subscription, returning the receipt. */
  send(target: PushSubscriptionInfo, payload: unknown): Promise<DeliveryReceipt>;
  /** Tear down a subscription. */
  unsubscribe(target: PushSubscriptionInfo): Promise<void>;
}
