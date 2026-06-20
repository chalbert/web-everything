---
type: issue
workItem: story
size: 3
parent: "1038"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:webcases/requirementValidator.ts"
tags: []
---

# Implement observable-state grounding (co-located, typed, progressive) per #1160

Build slice graduated from the ratified #1160 ruling (Home=A co-locate / Grammar=A typed / Rollout=A progressive). Closes the last `then.observe` coverage gap for the #1038 Cases-Spec slice. Four ordered, agent-ready steps:

1. Extend the protocol schema + `RequirementRegistries` to model an `observables` list — entries typed `{ id, kind: 'state'|'event', platform? }`, co-located on each protocol record (`we:src/_data/protocols/<id>.json`).
2. Declare `observables` on the protocols that have them — `validation` / `change-tracking` / `audit-trail` first.
3. Flip `then.observe` in `we:webcases/requirementValidator.ts` from the info fall-through (lines 115-125) to progressive-hard: `error` when the resolved protocol declares `observables` and the token is absent, `info` when it declares none.
4. Thread `kind` through the `<!-- assert: protocol observe tier -->` directive (`we:webcases/compileRequirement.ts:65`) so the #1162 case→test bridge reads-a-state vs awaits-an-event.

## Resolved (batch-2026-06-20)

All four steps landed:

1. `we:webcases/requirementValidator.ts` — added `ObservableKind` (`'state'|'event'`) + `ProtocolObservable` (`{ id, kind, platform? }`) and widened `RequirementRegistries.protocols` to carry an optional `observables` list.
2. Declared `observables` on `we:src/_data/protocols/validation.json` (`invalid-state-announced`/`valid-state-announced` events, `validity-state` state), `we:src/_data/protocols/change-tracking.json` (`change-record-emitted`/`current-value`), `we:src/_data/protocols/audit-trail.json` (`audit-event-appended`/`entity-timeline`) — each grounded in the protocol's own vocabulary; the `loadProtocols` per-entry loader (#1146) passes the field through, no aggregate to regen.
3. Flipped `then.observe` grounding to **progressive-hard**: the validator resolves the `then.protocol` record once and, if it declares observables, errors when the token names none; a protocol that declares none still grounds soft (info), so the registry rolls out per-protocol without breaking the rest.
4. Threaded `kind` into the assert directive via an optional injected `ObservableLookup` on `compileRequirement` (mirrors the validator's injected-registries pattern) — `kind="state|event"` is emitted only when a lookup resolves the observable; absent lookup ⇒ byte-identical pre-#1201 output. `we:webcases/generateCase.ts` passes the live protocols so production compiles thread `kind`, and `heuristicProposer` now proposes a grounded observe token when the protocol declares one.

29 webcases tests green (incl. new progressive-hard + undeclared-error + soft-rollout + kind-threading cases); `check:standards` clean for the changeset (the 1 residual error — `#1202` invalid type "bug" — is a concurrent session's untracked new item, not this changeset). This closes the last `then.observe` coverage gap; the #1162 case→test bridge can now read `kind` to pick read-a-state vs await-an-event.
