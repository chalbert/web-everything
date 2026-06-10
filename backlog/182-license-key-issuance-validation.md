---
type: decision
workItem: story
size: 3
parent: "181"
status: open
dateOpened: "2026-06-08"
tags: [monetization, auth, licensing, license-key, serverless, infrastructure, solo-founder]
crossRef: { url: /backlog/098-licensing-strategy/, label: "Licensing strategy (#098)" }
---

# License-key issuance + validation — the one tiny always-on surface

A **license-key** model for self-run tools, *not* a hosted auth system: signed,
offline-tolerant keys with optional periodic phone-home. A minimal serverless
endpoint issues and validates keys — kept tiny because it's the **only**
always-on surface a tier-1 solo-founder product can afford to operate.

Scope: key signing/verification (offline-tolerant), an issuance hook (called by
payments — see [#183](/backlog/183-payments-merchant-of-record/)), a validation
path the CLI calls, and graceful-degradation when offline. The OSS-vs-commercial
license *policy* is a separate decision in [#098](/backlog/098-licensing-strategy/);
this story is the *mechanism*.

## Not batchable here — placement/scope fork (noted 2026-06-10)

Pulled into a batch and released without building: this is **not** a webeverything
(standard-repo) change. [#098](/backlog/098-licensing-strategy/) "Consequence for code
location" (resolved) rules that **commercialization/leverage code lives in/under
Plateau** — so the license-key mechanism belongs in **plateau-app**, a different repo
from where the standard backlog runs. It is also the one **always-on / live-serve**
surface, which the monetization stance explicitly defers for the tier-1 solo-founder
constraint. Before this is agent-ready, settle (a) which repo/package hosts the module
(plateau-app vs a new infra package), and (b) the security-sensitive key design —
signing scheme (default lean: Ed25519 signed, offline-tolerant claims), the
offline-tolerance window, and phone-home cadence — since a wrong default on a license
surface has real consequences. Best worked as a single focused item in the plateau-app
context, not a webeverything batch slice.
