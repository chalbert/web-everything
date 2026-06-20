---
kind: epic
parent: "170"
status: open
dateOpened: "2026-06-20"
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

## Slices (carved 2026-06-20 — `we:reports/2026-06-20-backlog-split-analysis.md`)

13 leaf slices. Each per-domain slice **starts** by auditing its own domain vs contract+vectors
(#1270 principle 1), then reconciles FUI up and fixes any contract holes (principle 2) — so there is no
separate audit slice. The proven pair (#1014, #1117) skip straight to the fix. Real surface differs from
the original body estimate: webportals = **5** files (not 10), webtraces = **1** (not 3).

**Per-domain reconciliation (independent — 12-wide parallel batch):**
- **#1297** — webanalytics (proven #1014, `UnknownTrackerError`)
- **#1298** — webcontexts (proven #1117, `resolveContext`)
- **#1299** — webbehaviors · **#1300** — webdirectives · **#1301** — webexpressions
- **#1302** — webguards · **#1303** — webinjectors · **#1304** — webregistries
- **#1305** — webstates · **#1306** — webvalidation (+ consume published `@webeverything/*` contracts)
- **#1307** — port `webportals` → FUI (5 files) · **#1308** — port `webtraces` → FUI (1 file)

**Gate (lands last):**
- **#1309** — plugs WE↔FUI drift gate in `check:standards`, mirroring the blocks-side §8c/#659.
  `blockedBy` all of #1297–#1308 (must land after drift is resolved, or it fails red).

**Downstream (not a slice — already filed):**
- **#1234** — final WE-side repoint (`we:demos`/`we:test-pages` + bootstrap `src` + `@core`/`@webX`
  aliases off `we:plugs/`, add the `@webeverything/* → this-repo` mirror-alias map), `blockedBy` this
  epic; then **#1047** deletes `we:plugs/`.

> Umbrella — sliced; the governing decision (#1270) is resolved so this is pure execution. The 12
> reconcile/port slices are disjoint (per-domain dirs) → run them via `/batch` or `/workflow`; #1309
> closes the loop with the drift gate.

## Grounding addendum (2026-06-20, batch attempt batch-2026-06-20-1297-1306)

A batch run on the per-domain slices surfaced two corrections to the "12-wide clean batch" framing —
**re-scope the family before re-batching:**

1. **"differ" ≠ feature drift.** The drift-map counts include **repo-structural diffs** (import paths,
   doc-comment path refs), not just real feature gaps. e.g. webguards (#1302) "2 diffs" are almost
   entirely WE `../../guard/` vs FUI `../../blocks/guard/` + doc comments — no feature gap. So a slice
   **cannot be reconciled by copying WE files over FUI** (it breaks FUI's imports); each needs a per-file
   audit to separate structural diffs from genuine drift, then port only the real delta.
2. **Enforcing a resolved WE rule drags a consumer migration.** webbehaviors (#1299) reconciles in
   `whenDefined` (#1119), the `target`→`ownerElement` rename (#1121), and the `#assertValidName`
   hyphen check (#1120) — all contract-settled, no fork — but #1120 **throws** on every bare attribute
   name FUI's tests + 3 SPA demos use, and #1121 renames a public property across those same consumers.
   So that slice is a per-domain audit **+ a browser-verifiable demo migration** (size 2 → **8**), not a
   3-file copy. Re-sized #1299 accordingly; the others likely vary (some near-trivial structural-only,
   some with real consumer fallout) — audit each before sizing.

Net: these are careful single-item audits, **not** mechanical size-2/3 batch fodder. Run via `/prepare`
or focused single items, or `/split` after a per-domain audit re-sizes them.
