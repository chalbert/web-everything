---
kind: decision
size: 3
status: resolved
dateOpened: "2026-05-31"
dateStarted: "2026-06-12"
tags: [gap-analysis, project, intent, notifications, permissions]
relatedReport: reports/2026-06-11-webpermissions-project.md
preparedDate: "2026-06-12"
blockedBy: [455]
dateResolved: "2026-06-13"
graduatedTo: "project:webnotifications"
codifiedIn: "docs/agent/platform-decisions.md#project-protocol-bar"
---

# Decide the Notifications / Permissions domain — `webnotifications` (gap #13)

The platform splits this gap into three shapes — a *state* layer (Permissions API), a *render* surface (Notifications API), and a *transport* (Push API) — so "project vs intent vs fold into `feedback`" resolves to all three at once, `feedback` untouched ([prior-art survey](/research/web-permissions-project/), extended 2026-06-12). **Forks A–C settled in prep** (permission state · system-notification render · push *is* a protocol). The live call is **Fork D — the notification *domain* home** (`webnotifications`: render surfaces + orchestration + a `notification-marker` family). The **transport home** (where push lives + the open-app realtime family) is split out to **[#455](/backlog/455-server-to-client-delivery-transport-home-by-purpose-vs-by-me/)**, which this blocks on.

The concern decomposes into orthogonal axes the survey pins to the real tree: **permission state/affordance** (`granted | denied | prompt`, cross-cutting across camera/geolocation/clipboard — intent-shaped) vs `feedback`, the *in-app* toast tier ([we:intents.json:1022](../src/_data/intents.json#L1022)); **system-notification render** (OS surface, survives tab close) vs the in-session-persistent `background-task` neighbour that already owns a `navigationGuard` ([we:intents.json:1721](../src/_data/intents.json#L1721), [we:intents.json:1740](../src/_data/intents.json#L1740)); and **push delivery** (subscription + VAPID + orchestration), whose async / server-authoritative / swappable-provider shape matches the `guard` protocol ([we:protocols.json:94](../src/_data/protocols.json#L94), owned by `webguards` [we:projects.json:235](../src/_data/projects.json#L235)), not any UX intent. Permissions-Policy is a deployment gate that, if it lands, belongs to `webmanifests` ([we:projects.json:217](../src/_data/projects.json#L217)).

### Triage context

- **Kind**: Project and/or Intent · **Native grounding**: Permissions API, Notifications API, Push API
- **Native-first**: ▽ low · **Gap**: ◆ medium · **Effort**: ◆ medium · **Rank**: 13

### Recommended path at a glance

Ratify all three rows, or override just the one you'd change. **Confidence** says where judgment is actually needed.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **A · permission state** | new cross-cutting `permission` intent | fold into `feedback` *(rejected)* | **High** — API is generic, not notification-specific |
| **B · system-notification render** | new `system-notification` intent (sibling of `feedback`) | `surface` dimension on `feedback` *(rejected)* | **High** — bias toward separation; distinct surface + lifecycle |
| **C · push delivery** | push-delivery is a **protocol** + `CustomPushProvider` (its *home* → #455) | push as an intent *(rejected)* | **Med-high** — guard-shaped; protocol is the only lock |
| **D · notification domain home** | mint **`webnotifications`** — render surfaces + orchestration + a `notification-marker` family | bare intents, no domain project | **Med** — domain is real (toast · OS · markers · badging); transport home delegated to #455 |

## Fork A — where does permission *state* live? (not a `feedback` fold)

The Permissions API tri-state `granted | denied | prompt` + `change` events is pure UX vocabulary — it decides whether to show an "Enable X" affordance, a "you blocked this" re-enable hint, or nothing — and is **cross-cutting** (camera, geolocation, clipboard, not notification-specific; [W3C Permissions](https://www.w3.org/TR/permissions/)). `feedback` ([we:intents.json:1022](../src/_data/intents.json#L1022)) is *in-app toast render* — the wrong axis and far narrower.

- **(A — recommended) New small `permission` intent** owning request / state / re-prompt affordance, borrowing the API tokens verbatim.
- **(B) Fold into `feedback`.** *Rejected* — wrong axis (state vs render) and wrong breadth (permissions span far beyond notifications).

## Fork B — system-notification render: new intent vs a dimension on `feedback`

The Notifications API renders **outside the page**, survives tab close, and carries a permission gate; it shares a severity/title/body/action anatomy with `feedback` but a different surface and lifecycle. `background-task` ([we:intents.json:1721](../src/_data/intents.json#L1721)) is the nearest neighbour (persistent, outlives the view, owns `navigationGuard` [we:intents.json:1740](../src/_data/intents.json#L1740)) but is in-session, not OS-level.

- **(A — recommended) New `system-notification` intent** for the OS-surface render — sibling to `feedback` (in-page) and `background-task` (in-session), reusing the shared severity/action vocabulary.
- **(B) `surface: in-app | system` dimension on `feedback`.** *Rejected* — overloads a transient-toast intent with a persistent OS surface + permission gate it disclaims; bias toward separation says two composable homes.

## Fork C — push delivery: protocol vs intent

Push subscription + VAPID transport + provider orchestration (web-push thin transports; Novu/OneSignal multi-channel hubs) is **async, server-authoritative, swappable-provider** — the `guard` shape ([we:protocols.json:94](../src/_data/protocols.json#L94)), not UX vocabulary. A consuming project sees the render intents, never the transport. **Scope:** this is *closed-app push-notification* delivery (the Web Push API as native anchor — service worker + push service + VAPID, survives tab close), **not** the open-app realtime/streaming transport family (WebSocket/SSE/WebTransport/long-poll). **Where the protocol *lives* is decided in [#455](/backlog/455-server-to-client-delivery-transport-home-by-purpose-vs-by-me/)** (the transport-home split); this fork only classifies it as a protocol, not an intent.

- **(A — recommended) Push-delivery is a protocol** with a `CustomPushProvider` lock (default → project → custom plug). Its home — `webnotifications` (by-purpose) vs a shared transport home (by-mechanism) — is delegated to #455.
- **(B) Push as an intent.** *Rejected* — transport/orchestration is not UX; modeling it as an intent leaks impl into the UX layer.

### Out of scope (flagged, not decided)

Permissions-Policy is a server-side feature gate, not UX; if it lands it belongs to `webmanifests` ([we:projects.json:217](../src/_data/projects.json#L217)) as a manifest/header concern.

## Settled by convention (not a fork)

The original "Open call" asked two things; an internal-convention survey collapses the second. **The two new intents publish standalone in the intent registry — no project "owns" them.** The constellation has no intent-ownership field in either direction: no project declares owned intents, and no intent references an owning project — every intent lives in `webintents` ([we:projects.json:114](../src/_data/projects.json#L114), "declarative profiles for UX/UI behavior"). So `permission` (Fork A) and `system-notification` (Fork B) go in the intent registry like every other intent; bundling them "under" a project would be unprecedented. A `webnotifications` project therefore **coordinates** the notification render-intent family and owns the **orchestration** concern (and, per #455, possibly the push protocol) — it does not own the intents.

## Fork D — the notification *domain* home: a `webnotifications` project

The notification concern is bigger than render+transport: it spans **multiple render surfaces** — in-page toast (`feedback` ✓ [we:intents.json:1022](../src/_data/intents.json#L1022)), OS notification (`system-notification`, Fork B), and **unread markers** (favicon badge, `document.title` count, app-icon **Badging API** `setAppBadge`) — plus **orchestration** (which surface, grouping, dedup; the Novu/Knock layer). That is a *domain*, not a single standard — which is why a transport-named micro-project (`webpush`) is the wrong altitude, and why the `webpush`↔Web-Push-API name collision evaporates (push becomes a protocol *within/consumed by* the domain, never the project name).

- **(A — recommended) Mint a `webnotifications` project** as the domain home — owning the notification **orchestration** concern, *coordinating* the render-intent family, and (per #455) possibly owning the push-delivery protocol. Names the concern per convention (`webguards`→`guard`); render surfaces stay standalone intents in `webintents` (the project coordinates, doesn't own them). *Not* the over-claiming trap that sank `webpermissions` — notifications genuinely **is** the domain, whereas permission-state (Fork A) is a cross-cutting intent that belongs to nothing here.
- **(B) No domain project — bare intents only.** *Weak* — leaves orchestration, badging, and the push protocol homeless or scattered; a real domain with a coordination concern earns a home.
- **Render decomposition:** `system-notification` (Fork B) **+ a new `notification-marker` intent family** (favicon / title / app-icon badge — unread-count indicators across surfaces). *Spin out* the marker intent (and the orchestration concern) as their own items under `webnotifications` at close-out.

### Delegated — the transport home → [#455](/backlog/455-server-to-client-delivery-transport-home-by-purpose-vs-by-me/)

Whether `webnotifications` **owns** the push-delivery protocol (by-purpose) or merely **consumes** it from a shared transport home (by-mechanism), plus the home + name + scope of the open-app realtime family (WebSocket / SSE / WebTransport / long-poll — *currently unowned*, verified 2026-06-12), is a separate, larger decision split out to **#455**. This item `blockedBy` #455 for the push-ownership line only; the domain shape above stands either way.

## Resolution — 2026-06-11 (A/B/C) · 2026-06-13 (D)

- **Fork A — new cross-cutting `permission` intent**: the Permissions API tri-state (`granted | denied | prompt` + `change`) is generic UX vocabulary spanning camera/geolocation/clipboard — a different axis (state) and far broader scope than `feedback`'s in-app toast render, so it earns its own small intent rather than folding in.
- **Fork B — new `system-notification` intent (sibling of `feedback`)**: the OS render surface survives tab close and carries a permission gate; distinct surface + lifecycle from a transient in-page toast, so bias-toward-separation gives it a composable home alongside `feedback` (in-page) and `background-task` (in-session).
- **Fork C — push-delivery protocol + `CustomPushProvider`**: subscription/VAPID/orchestration is async, server-authoritative, swappable-provider — the guard protocol shape, not UX vocabulary; modeling it as a protocol keeps the only lock escapable and the transport invisible to consuming projects.

- **Fork D — mint the `webnotifications` domain home.** Notifications is a *domain* (render surfaces — toast/OS/markers — + orchestration), not a single standard, so it earns a project; this dissolved the `webpush`↔Web-Push-API name collision (push is a protocol *within* the domain, not the project name). The render surfaces publish as **standalone intents** in `webintents` (the project coordinates, doesn't own them); the project owns orchestration and — per #455's by-purpose ruling — the push-delivery protocol. Built in **[#456](/backlog/456-author-the-webnotifications-project-push-delivery-protocol-n/)**.

**Graduates to builds** (composition order): [#456](/backlog/456-author-the-webnotifications-project-push-delivery-protocol-n/) `webnotifications` project + push-delivery protocol → [#459](/backlog/459-author-the-system-notification-intent-os-notification-render/) `system-notification` intent + [#460](/backlog/460-author-the-notification-marker-intent-family-favicon-title-a/) `notification-marker` intent (both blocked on #456); plus the independent [#457](/backlog/457-author-the-permission-intent-cross-cutting-permissions-api-s/) `permission` intent. The **transport home** was delegated to [#455](/backlog/455-server-to-client-delivery-transport-home-by-purpose-vs-by-me/) (resolved: push lives in `webnotifications`; the open-app realtime family → new `webrealtime`, built in [#458](/backlog/458-author-the-webrealtime-project-transport-negotiation-protoco/)).
