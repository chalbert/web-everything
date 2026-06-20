---
kind: story
size: 2
parent: "1259"
locus: webeverything
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:src/_data/modelCapabilityFloor.json"
tags: []
---

# Define the Plateau on-device cost/accuracy floor metric (model-capability watch front-A)

The front-A conformance metric for the model-capability watch (#1259): define and track the on-device tier accuracy/cost floor — the threshold the on-device classifier and Tier-2 VLM must meet so the cost-linearity rule holds without falling back to uncapped hosted calls. The Plateau-side analogue of the platform-standards front-A metric (#1267). Makes the next watch run quantitative. Surfaced by the 2026-06-20 model-capability watch.

## Progress

Defined the front-A floor metric for the model-capability watch (#1259) as a curated tracking ledger,
the Plateau-side analogue of `we:src/_data/nativeFirstWatch.json` (the #1257/#1267 platform-standards
front-A ledger):

- `we:src/_data/modelCapabilityFloor.json` — one row per vision tier (Tier-1 on-device classifier,
  Tier-2 on-device VLM) plus an aggregate **cost-linearity guard** row, each with a `floor` threshold,
  `current` value, `costClass`, and a `meets` verdict the next watch run re-asserts. Encodes the rule:
  every flat-rate vision task resolves at a fixed on-device cost; the floor keeps the on-device tiers
  accurate enough that the product never silently falls back to an uncapped hosted call. Baselines from
  the 2026-06-20 watch report; `maturity` moves the program L0 (no metric) → L1 (metric defined).

Placed with the watch machinery (sibling of nativeFirstWatch.json, both in `we:src/_data`, both read by
the WE watch program) — fixed `locus` (was `plateau-app`) → `webeverything` to match: the artifact is a
WE watch ledger about Plateau's tiers, not plateau-app code. Makes the next #1259 run quantitative; L2
(a measured eval harness filling `current`) is gated on the #514/#490 vision build.
