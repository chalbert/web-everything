---
type: idea
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-19"
relatedReport: reports/2026-02-23-configurable-loading-threshold.md
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "intent:loader"
tags: []
---

# Configurable loading-threshold dimension (delay + minimum + named profiles)

Surfaced by the #1037 deep-reports sweep (audit §13): a tunable loading-threshold as a loading-intent dimension — a configurable delay before a loading indicator shows + a minimum visible duration (anti-flicker) + named profiles. 0 backlog hits today. Prior art + design sketch in we:reports/2026-02-23-configurable-loading-threshold.md. Expose as a configurable intent dimension per the most-flexible-default rule.

## Progress

Surfaced the configurable loading-threshold as a `threshold` dimension on the **loader** intent
(`we:src/_data/intents.json`) — the genuine gap the #1037 sweep found. NOTE: the loader intent already
had `timing` (entry delay, named profiles) and a *binary* `holdFloor`; what was missing was the **real
minimum duration** bound into named two-parameter `{delay, minimum}` profiles (the Angular `@defer`
model). Added:
- New `threshold` dimension: named profiles `immediate (0/0)` / `debounced (400/500, default)` /
  `patient (800/1000)`, each bundling delay + minimum so they tune as one unit; most-flexible-default
  (apps override ms / register profiles, injector-resolved app→route→component→user, reduced-motion →
  immediate).
- "Threshold Profiles" description section with the perception research (300–400ms knee; NNG / React /
  Vaadin / spin-delay convergence) per the prior-art report.
- Interface Protocol: `LoaderThreshold` + `LoaderThresholdProfile {delay, minimum}` types, a `threshold?`
  field, and a two-parameter `thresholds` config example. `timing`/`holdFloor` reframed as the two
  parameters the profile sets.
