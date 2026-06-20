---
kind: task
parent: "991"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: backlog/1043-configurable-loading-threshold-dimension-delay-minimum-named.md
tags: []
---

# Surface 2-3 net-new proposals found by the deep reports/research sweep

Deep L2 sweep of all 173 reports + 127 research topics (audit §13) confirmed the corpus is ~85% surfaced — most flagged candidates were false positives (stale or owning item missed: lazy-traits defineLazy=#034, @domain=#002, collection-ops-coordinator=#369, validation-adherence=#005). After verification, the genuinely un-tracked proposals are small: (1) configurable-loading-threshold as a tunable loading intent dimension (delay + minimum + named profiles; 0 backlog hits); (2) the dom-less `display:contents` provider-element pattern (existing hits are unrelated scoped-registration items); (3) a vague UI-configuration standard (low-value). Confirm each, then file or discard. Larger proposals (validation adapters, change-tracking, injector completion) are already in L3 #1017. Sources: `we:reports/2026-02-23-configurable-loading-threshold.md`.

## Progress (batch-2026-06-18)

Triaged the 3 confirmed un-tracked proposals from the deep-reports sweep (audit §13):
- **(1) configurable loading-threshold** → filed owning item **#1043** (story·3, tagged webintents) — a
  tunable loading-intent dimension (delay + minimum + named profiles); prior art in
  `we:reports/2026-02-23-configurable-loading-threshold.md`. Confirmed 0 prior backlog hits.
- **(2) dom-less `display:contents` provider-element** → filed owning item **#1044** (story·3, tagged
  webinjectors) — a layout-neutral DI-scoping host, distinct from the scoped-registration items.
- **(3) vague UI-configuration standard** → **discarded** as low-value per the body's pre-assessment (no
  concrete surface; would duplicate the Technical Configurator + per-intent dimensions already in flight).
  Surfacing only: building #1043/#1044 is a prioritization call left to ranking.
