---
kind: story
size: 5
parent: "2387"
status: resolved
blockedBy: []
dateOpened: "2026-07-10"
dateStarted: "2026-07-10"
dateResolved: "2026-07-10"
graduatedTo: none
tags: []
---

# Proof-of-land gate: land a stacked couple only when its stackParents are proven landed

Teach the drain sweep in we:scripts/merge-ai-prs.mjs to build the impl-PR-to-WE-manifest laneRef join (map each lane ref to its WE manifest from repos[], so impl/orphan PRs inherit item + stackParents + blockedBy from their couple, closing the impl-orphan-always-ready hole). Gate a couple READY only if every stackParent is landed this pass (in-memory set) OR bornAs-proven on main, else DEFER — evaluated at item/couple granularity, preserving impl-first/WE-last. Happy-path rebuild reuses the existing we:scripts/lib/rebase-drop-manifest.mjs step unchanged. Also commit the durable capability marker (gateVersion) to origin/main. Kept atomic (irreducible safety unit — any partial ship is an unsafe intermediate drain state). Tests: a chain lands in order; a red/absent parent defers its descendants including their impl PRs (no stowaway at either level); a disjoint sibling is unaffected; a manifest-less impl PR is held with its couple.

## Progress

- **Status:** done (pending resolve)
- **Branch:** `lane/2393-proof-of-land-gate` (lane-5)
- **Done:**
  - `joinImplToCouples(verdicts)` in `we:scripts/merge-ai-prs.mjs` — indexes every WE couple manifest by its `repos[].ref`, then a manifest-less impl PR inherits its couple's `item`/`blockedBy`/`stackParents` by matching its head ref (closes the impl-orphan-always-ready hole). A true orphan matches nothing → unchanged.
  - `planLabelDrain(candidates, {landedThisPass, provenOnMain})` extended with the positive proof-of-land `stackParents` gate: a descendant is READY only if every stackParent is landed-this-pass (WE-carrier merge) OR bornAs-proven on main (`landedNumberFor`) OR an already-landed numeric NNN — else DEFER. Absence is never read as landed (stowaway guard).
  - CLI wiring: collect `v.stackParents`/`v.manifestRefs`; call the join over the global candidate list; build `provenOnMain` per pass; thread `landedThisPass` (populated on each WE-carrier merge) + `provenOnMain` into every `planLabelDrain` call. Happy-path rebuild reuses `we:scripts/lib/rebase-drop-manifest.mjs` unchanged.
  - Durable capability marker: `we:scripts/readiness/drain-capability.json` (`gateVersion: 1`) + reader `we:scripts/readiness/drain-capability.mjs` (`GATE_VERSION`, `parseCapabilityMarker`, `stackingSupported` defaulting hard to siblings, `readCapabilityFromMain`). Lands to origin/main via this PR so the later producer slice can confirm the gate is live before stacking.
  - Tests: `we:scripts/__tests__/merge-ai-prs.test.mjs` (+ join + gate blocks) and new `we:scripts/__tests__/drain-capability.test.mjs`. All green; `check:standards` 0 errors.
- **Next:** resolve.
