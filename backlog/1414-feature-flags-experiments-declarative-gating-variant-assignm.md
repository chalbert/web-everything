---
kind: decision
size: 3
parent: "099"
status: open
dateOpened: "2026-06-21"
tags: [decision, book-candidate, feature-flags, experiments, cross-cutting, gap]
---

# Feature flags & experiments — declarative gating + variant assignment standard: placement

Surfaced by the app-infrastructure cross-cutting lens
([#1402](/backlog/1402-discovery-lens-app-infrastructure-cross-cutting-concerns-inv/)): nearly every
non-trivial app ships **feature flags** (gate a route/subtree/behavior on a runtime-evaluated flag) and
**experiments / A-B variant assignment** (deterministically bucket a user, render the assigned variant,
emit an exposure event), yet no WE intent/block owns it.

It is **distinct from [access-control](../src/_data/intents/access-control.json)** (authorization — *may
this user* see X) and from a plain conditional: a flag is an *operational rollout* switch evaluated against
a swappable provider (LaunchDarkly / Statsig / a local config / an on-device ruleset), with a deny-outcome
family that mirrors access-control's (hide / fallback-variant / placeholder). The shape rhymes with the
access-control gate (one shared provider, declarative gating) — which is the strongest prior art to borrow.

**Decision (placement-unsure ⇒ decision):** a `feature-flag` intent (UX-level: gate this subtree on flag X,
render variant V) with a swappable evaluation **provider** (the #052/#081 runtime-DI seam) — mirroring the
access-control provider — **vs** folding flag-gating into `access-control` as a non-authz gate kind **vs** a
pure behavior/provider with no intent. Experiment assignment + exposure-event emission likely composes with
the telemetry lens gap ([#1415](/backlog/1415-telemetry-analytics-events-declarative-event-emission-vocabu/)).
Refs: [we:src/_data/intents/access-control.json](../src/_data/intents/access-control.json),
[we:src/_data/intents/permission.json](../src/_data/intents/permission.json). **Needs `/prepare`.** Unsure
⇒ decision; costs nothing.
