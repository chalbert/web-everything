---
kind: decision
size: 3
parent: "2527"
status: open
dateOpened: "2026-07-18"
tags: [plateau-loop, console, adapter-seam, provider-agnostic, architecture]
---

# Provider-agnostic backlog adapter seam

Serves G6 (provider-agnostic domain model) and the north-star (multiple backlog systems + bridging — design
doc §6b). The north-star says "do NOT build multi-provider now" but "hold the constraint" is unenforceable
without a named boundary — every board slice will otherwise hardcode WE-CLI calls and the retrofit gets
expensive. This decision **defines and enforces the read/write adapter interface the console codes against** —
it does not build a second provider.

## What to decide / define
- The **read interface** the console depends on (list/read items, statuses, the connection graph) — consolidated
  onto the existing `?repo=` / REPOS registry seam (#2507, multi-repo #2472/#2475), no WE-CLI specifics leaking
  into the views.
- The **write interface** — every write rides the lane→PR seam (never main directly); name it as the single
  write port the composer/actions call.
- The **domain-model interlingua** (roles · statuses `open/active/resolved` · granularity ladder · connection
  types `parent`/`blockedBy`) each foreign system maps INTO — so a later Jira/Linear/GitHub adapter is a
  mapping layer, not a re-architecture.

## Acceptance
The adapter interface is named + documented; a lint/constraint keeps board slices ([#xaz4dcn]) coding against the
seam (no bare WE-CLI in views); the north-star bridging work becomes "add an adapter," not "rewrite the console."
