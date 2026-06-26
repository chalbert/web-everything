# Backlog split analysis — #1294 (re-run)

**Date:** 2026-06-26
**Focus:** `/slice 1294` — relocate the ~10 WE-resident logic reference runtimes (webpolicy enforcement/proof + the #1078 subsystems) to FUI.
**Verdict:** **COULD NOT SPLIT — the epic's un-park gate is still unmet (unchanged since 2026-06-24).** No slices carved. One actionable finding below.

## Re-verification of the un-park gate (2026-06-26)

#1294 (`kind: epic`, `status: open`, `childlessReason: parked`) un-parks only when **both** hold:
> (a) FUI hosts each runtime, AND (b) the website can surface FUI for headless logic (a mode-C runtime bundle path **or** the #899 runner is built).

| Gate leg | State 2026-06-26 | Met? |
|---|---|---|
| (a) FUI hosts each runtime | `fui:webpolicy/` still absent; no `@frontierui/webpolicy` package (grep'd FUI tree + `fui:package.json`). WE still holds `we:webpolicy/enforcement.ts` + `we:webpolicy/proof.ts` + `we:webpolicy/contract.ts`. | ❌ |
| (b) website surfaces FUI headless logic | #899 is a **resolved *decision*** (ratified 2026-06-18), **not** delivered runner code — and it has **no children and no `graduatedTo`**, so its FUI reference backend was never opened as a build story. No mode-C headless-logic bundle path exists either. | ❌ |

Nothing material changed in the two days since the prior run (`we:reports/2026-06-24-split-analysis-1294.md`); that analysis stands in full.

## Why no partial split either

Standing up `fui:webpolicy/` in isolation (the lone leg that *looks* carve-able) is **declined** on purpose: with gate (b) absent, the WE-website demo keeps consuming `we:webpolicy/*` until it can surface FUI, so a fresh `fui:webpolicy/` would be a **consumer-less orphan duplicate** that drifts against the WE copy — the exact #1245 drift failure the relocation exists to end. The cascade (stand-up → repoint → delete) is only safe end-to-end, and it can't complete without gate (b). Per *prep: verify mechanism has a consumer* — 0 callers ⇒ defer, don't build the orphan.

## The actionable gap (new vs the prior run)

The cited unblocker, **#899, never opened its build story** — a resolved go with no build child (`Resolve Go = Open Build Story`). So gate (b) isn't merely unbuilt, it is **untracked**: there is no backlog item to land the FUI conformance reference backend + the headless-logic surface path the WE-website demo would repoint to.

**Unblocking action:** file the foundational build story — *"Build the #899 FUI conformance reference backend + headless-logic surface path (mode-C bundle / FUI vector runner)"* — and set `#1294 blockedBy` it (replacing the prose-only park gate with a real DAG edge). Once that lands, re-run `/slice 1294`: gate (a) becomes "move code into an existing home" and gate (b) becomes "repoint to an existing runner," and the per-subsystem stand-up → repoint → delete cascade carves cleanly.

## Could-not-split summary

| Candidate | Failed rubric condition | Unblocking action |
|---|---|---|
| #1294 (epic) | *real home* (no `fui:webpolicy`) + *valid demoable state* (deleting WE runtime strands the live `webpolicy-conformance-demo`, 23 tests) — both downstream of the unbuilt gate (b) | File the #899 FUI-backend build story; `#1294 blockedBy` it; re-slice on landing |
