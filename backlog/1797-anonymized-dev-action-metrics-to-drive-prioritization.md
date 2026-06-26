---
kind: story
size: 3
status: open
dateOpened: "2026-06-26"
tags: [telemetry, metrics, prioritization, privacy]
crossRef: { url: /backlog/1415-telemetry-analytics-events-declarative-event-emission-vocabu/, label: "#1415 declarative telemetry vocabulary" }
---

# Anonymized dev-action metrics to drive prioritization

The platform should collect **anonymized developer actions** — counts of installs, builds, tests, and similar — so prioritization is informed by what developers actually do, not guesswork. This is the *product/operations* use of telemetry (what to build next), distinct from the in-app declarative telemetry **vocabulary/emission seam** being designed in #1415/#1475 (how an app emits its own events). This card is the dev-tooling metrics consumer; decide whether it rides on #1415's mechanism or is its own pipeline.

Privacy is a first-class constraint: aggregate, anonymized, opt-in/opt-out per the project's stance — no per-developer identifiable data.

## Build
- Define the minimal dev-action metric set (installs, builds, tests, …) and the anonymization model.
- Decide the collection path: reuse #1415's emission seam vs. a dedicated dev-tooling channel.
- Wire collection + a way to read the aggregate for prioritization.

## Acceptance
- Metrics are collected anonymized and aggregate-only; opt-out honored.
- Relationship to #1415 is resolved (reuse or separate), not left implicit.
- `check:standards` green.

_Converted from `we:plans/dev-stats.md` (#1792 hidden-docs cleanup)._
