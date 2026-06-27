---
kind: story
size: 3
status: parked
parkedReason: maturityGated
maturityTrigger: "adoptionSignal: an app emits a #1689 DeclaredRule conformance tier"
parent: "1522"
locus: plateau-app
dateOpened: "2026-06-26"
tags: [explorer, a11y, conformance, intent-conformance]
---

# Explorer a11y-overclaim check vs declared conformance tier

Conformance-lane sibling to the explorer's UX-intent oracle (#1698; contract ruled in #1791). When an app emits a declared WCAG conformance tier (a #1689 DeclaredRule `kind:conformance`+`tier` — a platform-config value, NOT a `data-intent-*` attribute), compare it against the absolute axe results already on `Observation.a11yViolations` and flag **over-claims** (violations at/below the declared tier). Additive and monotonic — never suppresses axe (a suppression-capable level would let any app silence the explorer by declaring level A). Homed in the conformance lane, not the UX-intent oracle, because a11y conformance is technical, not a UX intent. maturityGated until a consumer emits a tier.
