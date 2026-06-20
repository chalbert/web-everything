---
type: issue
workItem: story
size: 3
parent: "1038"
status: open
dateOpened: "2026-06-20"
tags: []
---

# Implement observable-state grounding (co-located, typed, progressive) per #1160

Build slice graduated from the ratified #1160 ruling (Home=A co-locate / Grammar=A typed / Rollout=A progressive). Closes the last `then.observe` coverage gap for the #1038 Cases-Spec slice. Four ordered, agent-ready steps:

1. Extend the protocol schema + `RequirementRegistries` to model an `observables` list — entries typed `{ id, kind: 'state'|'event', platform? }`, co-located on each protocol record (`we:src/_data/protocols/<id>.json`).
2. Declare `observables` on the protocols that have them — `validation` / `change-tracking` / `audit-trail` first.
3. Flip `then.observe` in `we:webcases/requirementValidator.ts` from the info fall-through (lines 115-125) to progressive-hard: `error` when the resolved protocol declares `observables` and the token is absent, `info` when it declares none.
4. Thread `kind` through the `<!-- assert: protocol observe tier -->` directive (`we:webcases/compileRequirement.ts:65`) so the #1162 case→test bridge reads-a-state vs awaits-an-event.
