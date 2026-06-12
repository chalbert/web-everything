---
type: decision
workItem: story
size: 3
status: open
dateOpened: "2026-05-31"
tags: [gap-analysis, project, intent, notifications, permissions]
relatedReport: reports/2026-06-11-webpermissions-project.md
preparedDate: "2026-06-11"
---

# Decide on Notifications / Permissions project — `webpermissions` (gap #13)

No design exists yet. The item's "project vs intent vs fold into `feedback`" call is under-decomposed: the platform splits this concern into three standards-track APIs with three shapes — a cross-cutting *state* layer (Permissions API), a *render* surface (Notifications API), and a *transport* (Push API). The three forks below are grounded in a prior-art survey published as the [Web Permissions / Notifications / Push](/research/web-permissions-project/) research topic; each names a recommended default in **bold**. Net: it resolves to all three at once on different axes, with `feedback` left untouched.

The concern decomposes into orthogonal axes the survey pins to the real tree: **permission state/affordance** (`granted | denied | prompt`, cross-cutting across camera/geolocation/clipboard — intent-shaped) vs `feedback`, the *in-app* toast tier ([intents.json:1022](../src/_data/intents.json#L1022)); **system-notification render** (OS surface, survives tab close) vs the in-session-persistent `background-task` neighbour that already owns a `navigationGuard` ([intents.json:1721](../src/_data/intents.json#L1721), [intents.json:1740](../src/_data/intents.json#L1740)); and **push delivery** (subscription + VAPID + orchestration), whose async / server-authoritative / swappable-provider shape matches the `guard` protocol ([protocols.json:94](../src/_data/protocols.json#L94), owned by `webguards` [projects.json:235](../src/_data/projects.json#L235)), not any UX intent. Permissions-Policy is a deployment gate that, if it lands, belongs to `webmanifests` ([projects.json:217](../src/_data/projects.json#L217)).

### Triage context

- **Kind**: Project and/or Intent · **Native anchor**: Permissions API, Notifications API, Push API
- **Native-first**: ▽ low · **Gap**: ◆ medium · **Effort**: ◆ medium · **Rank**: 13

### Recommended path at a glance

Ratify all three rows, or override just the one you'd change. **Confidence** says where judgment is actually needed.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **A · permission state** | new cross-cutting `permission` intent | fold into `feedback` *(rejected)* | **High** — API is generic, not notification-specific |
| **B · system-notification render** | new `system-notification` intent (sibling of `feedback`) | `surface` dimension on `feedback` *(rejected)* | **High** — bias toward separation; distinct surface + lifecycle |
| **C · push delivery** | push-delivery **protocol** + `CustomPushProvider`, owned by a project | push as an intent | **Med-high** — guard-shaped; protocol is the only lock |

## Fork A — where does permission *state* live? (not a `feedback` fold)

The Permissions API tri-state `granted | denied | prompt` + `change` events is pure UX vocabulary — it decides whether to show an "Enable X" affordance, a "you blocked this" re-enable hint, or nothing — and is **cross-cutting** (camera, geolocation, clipboard, not notification-specific; [W3C Permissions](https://www.w3.org/TR/permissions/)). `feedback` ([intents.json:1022](../src/_data/intents.json#L1022)) is *in-app toast render* — the wrong axis and far narrower.

- **(A — recommended) New small `permission` intent** owning request / state / re-prompt affordance, borrowing the API tokens verbatim.
- **(B) Fold into `feedback`.** *Rejected* — wrong axis (state vs render) and wrong breadth (permissions span far beyond notifications).

## Fork B — system-notification render: new intent vs a dimension on `feedback`

The Notifications API renders **outside the page**, survives tab close, and carries a permission gate; it shares a severity/title/body/action anatomy with `feedback` but a different surface and lifecycle. `background-task` ([intents.json:1721](../src/_data/intents.json#L1721)) is the nearest neighbour (persistent, outlives the view, owns `navigationGuard` [intents.json:1740](../src/_data/intents.json#L1740)) but is in-session, not OS-level.

- **(A — recommended) New `system-notification` intent** for the OS-surface render — sibling to `feedback` (in-page) and `background-task` (in-session), reusing the shared severity/action vocabulary.
- **(B) `surface: in-app | system` dimension on `feedback`.** *Rejected* — overloads a transient-toast intent with a persistent OS surface + permission gate it disclaims; bias toward separation says two composable homes.

## Fork C — push delivery: protocol vs intent

Push subscription + VAPID transport + provider orchestration (web-push thin transports; Novu/OneSignal multi-channel hubs) is **async, server-authoritative, swappable-provider** — the `guard` shape ([protocols.json:94](../src/_data/protocols.json#L94)), not UX vocabulary. A consuming project sees the render intents, never the transport.

- **(A — recommended) Push-delivery protocol** with a `CustomPushProvider` lock (default → project → custom plug), owned by a (narrowed) **project** that also houses the two intents' project-level config. The project the item asked about is **real but narrowed** — protocol owner + config home, not the UX deliverable.
- **(B) Push as an intent.** *Rejected* — transport/orchestration is not UX; modeling it as an intent leaks impl into the UX layer.

### Out of scope (flagged, not decided)

Permissions-Policy is a server-side feature gate, not UX; if it lands it belongs to `webmanifests` ([projects.json:217](../src/_data/projects.json#L217)) as a manifest/header concern.

## Open call

Ratify the three forks (A·`permission` intent, B·`system-notification` intent, C·push-delivery protocol under a narrowed project). Confirm: project name (`webpush` vs `webpermissions`), and whether the protocol + both intents live under one project or the intents publish standalone with the project owning only the protocol.

## Resolution (partial) — 2026-06-11

- **Fork A — new cross-cutting `permission` intent**: the Permissions API tri-state (`granted | denied | prompt` + `change`) is generic UX vocabulary spanning camera/geolocation/clipboard — a different axis (state) and far broader scope than `feedback`'s in-app toast render, so it earns its own small intent rather than folding in.
- **Fork B — new `system-notification` intent (sibling of `feedback`)**: the OS render surface survives tab close and carries a permission gate; distinct surface + lifecycle from a transient in-page toast, so bias-toward-separation gives it a composable home alongside `feedback` (in-page) and `background-task` (in-session).
- **Fork C — push-delivery protocol + `CustomPushProvider`**: subscription/VAPID/orchestration is async, server-authoritative, swappable-provider — the guard protocol shape, not UX vocabulary; modeling it as a protocol keeps the only lock escapable and the transport invisible to consuming projects.

**Open — needs a human call:** the push-delivery protocol's home + name — a new `webpush`-style project vs folding it (plus both intents' project-level config) under `webpermissions`, and standalone-intents vs one-project — because this is an irreversible scope/naming commit that the bottom-up forks don't settle; it picks the constellation's project boundary.
