---
kind: decision
parent: "3383"
status: open
dateOpened: "2026-08-30"
tags: []
---

# The ratified hosted-key-billed delivery mode has no metering, billing, or auth design named anywhere

we:docs/agent/platform-decisions.md#operations-declared-once-callers-generated clause 4 (ratified, #3031) names two permanent delivery modes: solo-local (subscription-funded) and hosted-key-billed. The solo mode is built; the hosted mode has zero design past its name — no card describes key-to-spend attribution, metering, or how `we:scripts/operations/http-adapter.mjs` (no auth/token concept today) would authenticate a caller once it isn't localhost-only. The backlog's only billing cards (#2531, #2779, #2780, #554) are scoped to plateau-app's own paid page-building product — a different consumer, not this operation engine. Capture only, mirroring #3049's own capture-then-gate style.

Distinct from #3049: that decision gates *selling* the conveyor externally ("NOT-YET", pending a real customer ask) and explicitly holds that clause 4's two modes are "narrower... nothing... proposes selling the hosted tier to a third party." This item is about the mode existing at all for WE's own use — a ratified target, not a speculative sale — so it is not blocked on #3049's trigger.

## Done when

1. Capture, not build: name what "key-billed" actually requires — attribution (whose key, which run), metering (what unit, read from where), and an auth story for we:scripts/operations/http-adapter.mjs once a caller isn't implicitly trusted localhost. No implementation is required to close this card; a decision record with named forks (or a stated "not yet, here's the trigger" per the #3049 shape) is sufficient.
2. Checked against #2626/#2742 (the operational-state-store decision) so this card doesn't re-litigate the settled local-lock-vs-DO split — it should cite that decision, not duplicate it.
