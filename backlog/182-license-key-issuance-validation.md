---
type: decision
workItem: story
size: 3
parent: "181"
status: resolved
dateOpened: "2026-06-08"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: none
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

## Resolution (2026-06-11) — shape ratified, build deferred

This is a `decision`, and the change-later risk is **asymmetric**: greenfield-cheap to
revise until a real key is issued, expensive after (an issued key is an immutable contract
in a customer's hands). The block on [#183](/backlog/183-payments-merchant-of-record/) is
**nominal** — nothing is actually waiting, there is no product to sell yet, and the team
won't ship until the product is in a much better state. So the right move is to **settle the
shape now** (removes the design fork) and **defer the implementation** until a product is
near first sale. Don't build code now.

The five forks, ruled:

1. **Validation is offline-by-default; only issuance is always-on (the keystone).** The CLI
   verifies a key locally by checking a signature against a public key baked into the binary —
   no network call. The single always-on serverless surface does only **issuance** (called by
   the #183 payment webhook) + an **optional revocation phone-home**. This is exactly the epic's
   "one tiny always-on surface" and honors the deferred live-serve / tier-1 constraint.
2. **Signing scheme → Ed25519** (ratifies the lean). Asymmetric: the public key ships in the CLI
   for offline verify; the private signing key lives only on the issuance endpoint. HMAC rejected
   (symmetric secret would have to ship to every validator to verify offline = leak).
3. **Key format → self-describing signed claims**, not opaque random strings. Payload (base64url)
   `{product, tier, seats, customerId, issuedAt, expiry?, grace}` + Ed25519 signature, pasteable as
   one string. Opaque keys force a DB lookup per validation = always-on validation, defeating fork 1.
4. **Offline window + phone-home.** Perpetual licenses: signature alone is proof, valid forever
   offline, no phone-home. Subscriptions: embed `expiry` + a **~14-day grace window**, soft
   phone-home (~weekly) only to catch revocation/refund; offline or failed phone-home → keep
   working through grace, warn near expiry, never hard-lock mid-work. (Numbers are the lean —
   revisit when building.)
5. **Host → a small dedicated package under the Plateau FSL tier** (per [#098](/backlog/098-licensing-strategy/)
   "leverage code lives in/under Plateau"), not a module inside plateau-app. The issuance endpoint
   deploys independently and is security-sensitive; the verify half is a library the CLI imports.

**Implementation is deferred, not done.** When the product is near first sale, re-open the *build*
as its own story under #181 (the offline-verify library + the issuance endpoint), carrying this
shape. Until then no keys exist in the wild, so any of the above is still free to change.

## Progress

- **Status:** resolved (decision — shape ratified, build deferred)
- **Branch:** docs/standard-authoring-workflow
- **Done:** ruled the five design forks (offline-validating Ed25519 signed claims, issuance-only
  always-on surface, dedicated Plateau-tier package); recorded the asymmetric change-later risk.
- **Next:** nothing now — the whole #181 commercialization epic is deprioritized behind product
  maturity. Re-open a *build* story under #181 when the product is near first sale.
- **Notes:** no entity created (strategy ruling, `graduatedTo: none`). #183 is unblocked on
  *ambiguity* but stays deferred — it's the same decide-shape/defer-build pattern.
