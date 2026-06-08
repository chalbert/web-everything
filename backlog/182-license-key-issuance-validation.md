---
type: idea
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
