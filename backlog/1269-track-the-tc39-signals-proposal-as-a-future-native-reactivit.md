---
kind: story
size: 2
parent: "1257"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: none
tags: []
---

# Track the TC39 Signals proposal as a future native-reactivity resolver for webexpressions

TC39/JS lens, strategic: the Signals proposal (early stage, very active; designed to decouple the reactive model from rendering) is the natural future native substrate for the webexpressions binding and reactivity layer. Not yet shippable — track its stage advancement and, if it lands, evaluate deferring webexpressions reactivity to native Signals per native-first (#031). Surfaced by the 2026-06-20 platform-standards watch (#1257), TC39 lens.

## Progress

Resolved 2026-06-20 — **tracking established** (this is a watch item, not a build; Signals is early-stage,
not shippable).

Recorded the tracking durably at the future consumer: we:src/_data/projects/webexpressions.json
description now carries a *Watching* note — TC39 Signals is the tracked future native substrate for the
reactivity model, with the explicit **trigger**: if Signals reaches Stage 4 / ships, file a new item to
evaluate deferring webexpressions reactivity to native Signals per native-first (#031). The note is
discoverable on the /projects/webexpressions/ page, so the watch isn't buried in a closed backlog item.

The platform-standards watch (#1257) review log already lists this as a tracked front-B proposal (alongside
Temporal / Decorators, pre-Stage-4). Resolving the slice = the tracking is recorded; the actual "defer to
Signals" work is a future item filed when the trigger fires (no premature build). `graduatedTo: none`
(a tracking record, no new entity).
