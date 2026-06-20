---
kind: epic
size: 13
parent: "170"
status: open
dateOpened: "2026-06-20"
childlessReason: undecided
tags: [plugs, dedup, drift, reconciliation, frontierui, contract-anchored]
---

# Re-reconcile FUI plugs UP to WE (contract-anchored) + add a real plugs drift gate

`fui:plugs/` has drifted BEHIND `we:plugs/` across ~11 of 14 domains +2 WE-only (webportals,
webtraces), so the #449/#1234 repoint onto FUI is lossy (regresses #1014 analytics + #1117 webcontexts
demos) and #1047 can't delete `we:plugs/`. The direction (reconcile FUI UP, not repoint WE down) and the
two governing reconciliation principles are ruled in the carved-out decision
[#1270](/backlog/1270-reconcile-fui-plugs-up-to-we-contract-anchored-not-repoint-d/) (resolved,
user-confirmed) — so this epic is pure execution: bring FUI up to WE per domain, contract-anchored.
Plugs analog of the blocks-side #1245 (whose direction fork is carved as #1246).

## Origin

Grounding #1234 (2026-06-20) found #449's WE-side repoint partly landed (45 `we:blocks`/`we:src` files
already import `@frontierui/plugs`, zero `../plugs/` left), but FUI is a **lossy subset** of WE's local
plugs — so the repoint can't finish and `we:plugs/` can't be deleted (#1047). A trial repoint regressed
the analytics (#1014 `UnknownTrackerError`) + webcontexts (#1117 `resolveContext`) demos against stale
FUI and was fully reverted. The #606/#817 "FUI is the canonical plugs superset" premise had decayed:
WE stayed the de-facto plugs dev tree and FUI fell behind, with no working drift gate to catch it.

## Governing decision

Direction + the two reconciliation principles (contract-anchored; holes-get-fixed) are ruled in
**[#1270](/backlog/1270-reconcile-fui-plugs-up-to-we-contract-anchored-not-repoint-d/)** — read it before
starting any slice. Summary: reconcile FUI **up** to WE (never blind-copy); the **contract + conformance
vectors** decide where WE and FUI disagree; contract holes get fixed (spec/vector added), never papered
over in the impl.

## Drift map (non-test `*.ts`, WE-local vs FUI, 2026-06-20)

| domain | differ | WE-only files | note |
|---|---|---|---|
| core, webcomponents | 0 | 0 | clean (identical) |
| webanalytics | 1 | 1 | FUI missing `UnknownTrackerError` (#1014) |
| webcontexts | 4 | 0 | FUI missing `resolveContext` strict/flexible (#1117) |
| webbehaviors | 3 | 0 | |
| webdirectives | 2 | 5 | |
| webexpressions | 4 | 1 | |
| webguards | 2 | 0 | |
| webinjectors | 2 | 0 | |
| webregistries | 2 | 2 | |
| webstates | 1 | 4 | |
| webvalidation | 3 | 2 | also consumes published `@webeverything/*` contracts (#700/#872) FUI's copy doesn't |
| **webportals** | — | all (10) | no FUI home — needs a full port |
| **webtraces** | — | all (3) | no FUI home — needs a full port |

"differ" is direction-agnostic — the per-domain contract audit (#1270 principle 1, contract-anchored)
determines who is right.

## Slices to carve on pickup

Per-domain (or grouped) reconciliation slices once the contract audit scopes each. Likely:

1. **Per-domain contract-anchored reconciliation** — one slice per drifted domain (audit vs contract →
   fix contract holes → bring FUI up). Start with the proven-broken pair: webanalytics (#1014) +
   webcontexts (#1117).
2. **Port `webportals` → FUI** (10 files, contract-anchored; consumer: `we:demos/webportals-conformance-demo`).
3. **Port `webtraces` → FUI** (3 files, contract-anchored; `sessionReplayEnvelope`).
4. **A real plugs drift gate** — extend `check:standards` to actually fail on `we:plugs/` vs `fui:plugs/`
   divergence (the current gate does not catch it). Mirror the #1245 blocks-side gate ask.
5. **Final WE-side repoint = #1234** — once FUI is the superset, finish repointing `we:demos`/`we:test-pages`
   + the bootstrap `src` + the `@core`/`@webX` aliases off `we:plugs/`, add the `@webeverything/* →
   this-repo` mirror-alias map (so FUI plugs that consume contracts resolve when served by WE), then
   #1047 deletes `we:plugs/`. **#1234 is `blockedBy` this epic.**

> Umbrella — do not start dedup before the per-domain contract audit (#1270 principle 1). `childlessReason:
> undecided` until the audit carves the slices above.
