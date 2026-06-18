# Web Permissions / Notifications / Push — prior-art survey & fork analysis

**Date:** 2026-06-11
**For:** backlog #009 (gap #13 — `webpermissions` project decision)
**Research topic:** [/research/web-permissions-project/](../src/_includes/research-descriptions/web-permissions-project.njk)
**Status:** prepared (ready to ratify; #009 stays `status: open`)

## The question

Gap #13 asks whether **Notifications API + Push API + Permissions API** should be a Web
Everything *project/protocol*, a single *intent*, or fold into the existing **`feedback`**
intent (which owns in-app toasts). The item's one real assertion — *"`feedback` owns in-app
toasts; system notifications are a different surface"* — is correct but under-decomposed: it
treats "notifications" as one thing, when the platform splits the concern into three
standards-track APIs with three different shapes (a query layer, a render surface, a
transport). This survey gathers the web-platform prior art so the boundary is drawn on the
platform's own seams, then reframes the single "project vs intent" call into three orthogonal
forks.

## Prior-art survey

### 1. The Permissions API is a cross-cutting *query/state* layer, not a feature

`navigator.permissions.query({name})` returns a `PermissionStatus` whose `.state` is one of
**`granted` | `denied` | `prompt`**, and which fires `change` events. It is deliberately
*generic*: one uniform shape across a long `PermissionDescriptor` name list — `camera`,
`microphone`, `geolocation`, `notifications`, `push`, `clipboard-read/write`,
`persistent-storage`, `background-sync`, `screen-wake-lock`, `midi`, `payment-handler`,
`window-management`, … ([MDN Permissions API](https://developer.mozilla.org/en-US/docs/Web/API/Permissions_API),
[W3C Permissions](https://www.w3.org/TR/permissions/)). Crucially the API **aggregates** every
restriction for the context — secure-context requirement, Permissions-Policy, user-activation
gating, and the user's own choice — into that one tri-state. So "notifications permission" and
"push permission" are just two *names* in a layer that spans far more than notifications.

The **Permissions-Policy** HTTP header (and `allow=` on iframes) is a *different* mechanism:
server-side declaration of which powerful features a document/its frames may use at all. When
policy blocks a feature, `query()` simply reports `denied` and the user is never prompted
([MDN Permissions-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Permissions_Policy)).
Two distinct surfaces: a client-side *state query* vs a server-side *feature gate*.

**Implication:** a permission *state* is a UX-relevant fact (it changes what affordance you
show — ask, re-ask, or route to settings) — that is intent-shaped. The *policy gate* is a
deployment/manifest concern, closer to webmanifests than to any UX intent.

### 2. Notifications API is a *render surface*; Push API is a *transport*

The **Notifications API** (`Notification`, `Notification.requestPermission()`,
`ServiceWorkerRegistration.showNotification()`) renders a **system-level** notification — OS
notification center, outside the page, persists after the tab closes. The **Push API**
(`PushManager.subscribe()` → a `PushSubscription` with an `endpoint` + encryption keys, a
`push` event delivered to a service worker) is the **wakeup transport** that lets the server
re-engage a closed app; the service worker then *calls Notifications* to render
([MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API),
[web.dev push](https://web.dev/articles/use-push-notifications-to-engage-users)). They are
chained but separable: notifications work standalone (local/foreground); push is what makes
them re-engageable, and requires an active service worker + a server signing requests with a
web-push library (VAPID).

This is the platform confirming the item's instinct, sharpened: **in-app toast (`feedback`) ≠
system notification (Notifications API) ≠ push wakeup (Push API)**. Three render/transport
tiers, not one.

### 3. The library landscape splits orchestration from transport

Server-side **web-push** libraries are thin VAPID transports. **OneSignal** is a push-first
omnichannel *orchestration* hub (web/mobile push, email, SMS, in-app). **Novu** is
open-source, vendor-neutral notification *infrastructure* that treats push as one channel in a
multi-channel workflow with a subscriber-centric model
([Novu](https://novu.co/blog/a-developers-guide-to-choosing-the-best-notification-platform/),
[OneSignal](https://onesignal.com/)). The reusable lesson: the **delivery/orchestration**
concern (which channel, which provider, dedupe, retry) is a swappable *provider* behind a
stable contract — exactly the registry+provider shape WE already uses for Guard
([we:protocols.json:94](../src/_data/protocols.json#L94)). It is **not** UX vocabulary; it is a
protocol with a `Custom…Provider` lock.

## How this maps onto the existing tree

- **`feedback` intent** ([we:intents.json:1022](../src/_data/intents.json#L1022)) — transient,
  non-blocking *in-app* toasts/snackbars: `placement`, `severity`, `duration`
  (incl. `indefinite`). Explicitly **in-page**, fire-and-forget. The platform's "render in the
  page" tier.
- **`background-task` intent** ([we:intents.json:1721](../src/_data/intents.json#L1721)) — already
  models a persistent surface that **outlives the originating view** and owns a
  `navigationGuard` ([we:intents.json:1740](../src/_data/intents.json#L1740)). It even notes a
  completed task *may emit a `feedback` toast*. This is the closest existing neighbour to "a
  long thing that re-engages you later" — but it is in-app/in-session, not OS-level.
- **`guard` protocol** ([we:protocols.json:94](../protocols.json#L94), owned by `webguards`
  [we:projects.json:235](../src/_data/projects.json#L235)) — the canonical **async,
  server-authoritative, swappable-provider** protocol. "The front-end is a UX mirror, never
  enforcement." A permission *grant check* and a *push delivery* both have that exact
  trust-crossing shape, so guard is the structural precedent for any permissions protocol.
- **`webmanifests` project** ([we:projects.json:217](../src/_data/projects.json#L217)) — the home
  for deployment-declared metadata; the natural owner of Permissions-Policy *as a manifest
  concern* if it lands anywhere.

## Reframing: one "project vs intent" call → three orthogonal forks

The platform's seams force a decomposition the item collapsed:

| Axis | Platform anchor | Shape | Candidate home |
|---|---|---|---|
| Permission **state/affordance** | Permissions API `query()` tri-state + `change` | UX vocabulary (ask / re-ask / blocked) | **intent** (`permission`) |
| System notification **render** | Notifications API | a render *surface* tier | new intent vs `feedback`/`background-task` neighbour |
| Push **transport/orchestration** | Push API + web-push/Novu/OneSignal | async server-authoritative provider | **protocol** under a project |

So #009 is not "is it a project or an intent" — it is "**which of these three is an intent,
which is a protocol, and does any of it fold into `feedback`?**" The forks below answer each.

### Fork A — permission *state* is an intent (not a fold into `feedback`)

The Permissions API's `granted | denied | prompt` tri-state plus `change` events is pure UX
vocabulary: it decides whether to show an "Enable X" affordance, a "you blocked this — here's
how to re-enable" hint, or nothing. That is intent-shaped and **cross-cutting** (camera,
geolocation, clipboard — not notification-specific), so it must NOT fold into `feedback`
(which is notification render, and only in-app). **Recommended:** a small **`permission`
intent** owning the request/state/re-prompt affordance vocabulary, borrowing the API's tokens
verbatim. Alternative (rejected): fold into `feedback` — wrong axis and wrong breadth.

### Fork B — system notification render: new `system-notification` intent, composed by the feedback family but distinct

Notifications API renders **outside the page**, survives tab close, and shares a *severity/
title/body/action* anatomy with `feedback` but a different surface and lifecycle. Bias-toward-
separation says these are two composable homes, not one stretched intent. **Recommended:** a
distinct **`system-notification` intent** for the OS-surface render, sibling to `feedback`
(in-page) and `background-task` (in-session persistent), reusing the shared severity/action
vocabulary. Alternative (rejected): a `surface: in-app | system` dimension *on* `feedback` —
overloads a transient-toast intent with a persistent OS surface and a permission gate it
disclaims.

### Fork C — push delivery is a *protocol* under a `webpush`/`webpermissions` project, not an intent

Push subscription + VAPID transport + provider orchestration (web-push / Novu / OneSignal) is
**async, server-authoritative, swappable-provider** — the guard shape, not UX vocabulary. A
project (`feedback` toast, `system-notification` render) consumes it but never sees the
transport. **Recommended:** a **push-delivery protocol** with a `CustomPushProvider`
(default → project → custom plug) lock, owned by a project. The **project decision the item
asked about is real but narrowed**: it owns the *protocol* + houses the two new intents'
project-level config — it is not itself the deliverable surface.

### The webmanifests footnote (Permissions-Policy)

Permissions-Policy is a deployment gate, not UX. It is out of scope for the three forks above
and, if it lands at all, belongs to **webmanifests** ([we:projects.json:217](../src/_data/projects.json#L217))
as a manifest/header concern — flagged, not decided here.

## Recommendation summary (to ratify in #009)

1. **Fork A → `permission` intent** (cross-cutting state/affordance; NOT a `feedback` fold).
2. **Fork B → `system-notification` intent** (OS-surface render; sibling of `feedback`, not a
   dimension on it).
3. **Fork C → push-delivery protocol** with a `CustomPushProvider` lock, owned by a project
   (`webpush`/`webpermissions`). The project is the *protocol owner + config home*, not the
   UX deliverable.
4. Permissions-Policy noted as a future **webmanifests** concern, out of #009's scope.

Net: the item's "project vs intent vs fold-into-feedback" resolves to **all three at once on
different axes** — two new intents + one protocol under a (narrowed) project, with `feedback`
left untouched.

## Addendum (2026-06-12) — transport-landscape pass for Fork D (home + name)

Fork C left the protocol's *home + name* open, and `webpush` risks colliding with the W3C
**Web Push API**. A server→client transport-landscape survey was run to ground the name + scope:

- **Two distinct concerns, split on "is the app open?"** *Closed-app* delivery — **Web Push API**
  (service worker + push service + VAPID; survives tab close) — vs *open-app* streaming —
  **WebSocket** (bidi), **SSE/EventSource** (server→client, now the default for streams since LLM
  token-streaming), **WebTransport** (HTTP/3/QUIC; Chrome/Edge only, no Safari), **long-poll/poll**.
  The two sides are **non-fungible** (you don't "fall back" from a live socket to a closed-app push).
- **Vocabulary:** the industry word **"push" means push *notifications*** — the closed-app channel,
  modelled beside email/SMS/in-app (Novu/Knock/Courier). The *umbrella* for the live transport
  family is **realtime / pub-sub / channels** (Ably, Pusher, PubNub, Centrifugo), **never "push."**
- **Conclusion:** dissolve the collision by **narrowing**, not renaming — scope `webpush` to
  *push-notification (closed-app) delivery* (Web Push API as native anchor, `CustomPushProvider`
  for FCM/OneSignal/Novu hubs). The **open-app realtime transport family is a separate, currently
  unowned concern** (verified: no constellation project/protocol covers it) → spin out as its own
  `type:decision` gap (candidate `webrealtime`/`webchannels`), of which Web Push is **not** a
  provider. So **Fork D → (A) mint `webpush`, scoped to push-notification delivery** (Med-high).

## Sources

- [MDN — Permissions API](https://developer.mozilla.org/en-US/docs/Web/API/Permissions_API)
- [W3C — Permissions](https://www.w3.org/TR/permissions/)
- [MDN — Permissions Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Permissions_Policy)
- [MDN — Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [web.dev — Use push notifications to engage users](https://web.dev/articles/use-push-notifications-to-engage-users)
- [Novu — choosing a notification platform](https://novu.co/blog/a-developers-guide-to-choosing-the-best-notification-platform/)
- [OneSignal](https://onesignal.com/)
- [Ably — WebSockets vs SSE](https://ably.com/blog/websockets-vs-sse) · [Ably Pub/Sub basics](https://ably.com/docs/basics)
- [WebSocket.org — transport comparisons](https://websocket.org/comparisons/)
- [WebSockets vs SSE vs WebTransport (2025)](https://aptuz.com/blog/websockets-vs-sse-vs-webtransports/)
- [Centrifugo — realtime messaging server](https://github.com/centrifugal/centrifugo)
- [Knock — notification infrastructure platforms (2026)](https://knock.app/blog/the-top-notification-infrastructure-platforms-for-developers)
