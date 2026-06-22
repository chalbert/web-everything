---
kind: story
size: 13
parent: "1353"
status: open
blockedBy: []
dateOpened: "2026-06-21"
dateStarted: "2026-06-22"
tags: []
---

# Re-home CollectionOperationsBehavior + data-table backend semantics to FUI (per #1467/#899); WE keeps verifier + vectors + types

Per ratified #1467 (→ b) under #899's vector-conformance split, the data-table runnable backend is impl →
FUI. Move `renderDataTable`/`cellContent`/`cellDisplayText` + the backend semantics
`applyPipeline`/`aggregate`/`summaryText`/sort-state/`announce` out of
`we:blocks/renderers/data-table/renderDataTable.ts` to FUI, and re-home the
`we:blocks/renderers/collection-operations/CollectionOperationsBehavior.ts` coordinator (it value-imports
`applyPipeline, aggregate`). WE keeps the contract **types** + the vector corpus
(`we:blocks/renderers/data-table/__fixtures__/data-table-cases.ts`) + the `auditDataTable` assertion-
semantics **verifier**, which asserts the stored golden output as data (no live WE render). This is the
prereq that unblocks #1355's renderer delete — file #1355 `blockedBy` this.

## Acceptance

- `we:blocks/renderers/collection-operations/CollectionOperationsBehavior.ts` no longer value-imports from
  `we:blocks/renderers/data-table/` (coordinator + its conformance live in FUI, or it consumes the FUI backend).
- `we:blocks/renderers/data-table/renderDataTable.ts` reduced to types + verifier; backend + semantics gone to FUI.
- WE conformance suite (`we:blocks/__tests__/unit/renderers/data-table.test.ts`) asserts `auditDataTable`
  against the stored vector golden output — green without importing a WE `renderDataTable`.
- `npm run check:standards` green in both repos; FUI gate green for the moved backend.

## Pre-flight (batch-2026-06-21-1429-1487) — outgrew (5 → 8): verifier redesign, not a file move

Claimed and grounded both trees. FUI **already has** the full backend (`fui:blocks/renderers/data-table/`
+ `fui:blocks/renderers/collection-operations/` — `renderDataTable`, `DataTableBehavior`,
`CollectionOperationsBehavior`, `windowCollection`, fixtures, tests), so the "move to FUI" is really
"delete the WE runtime + reduce WE to types + verifier + vectors." But the acceptance's verifier shape is
**not yet built**, and getting there is materially more than a story·5 move:

- **`auditDataTable` is NOT a data-reader — it re-runs the backend.** It calls
  `applyPipeline(rows, config)` + `cellDisplayText` + `summaryText` to compute the *expected* result and
  compares against the rendered DOM (`we:blocks/renderers/data-table/renderDataTable.ts:390`). The
  #1467/#899 ruling requires the verifier to **assert the stored golden output as data (no live render,
  no backend recompute)** — so `auditDataTable` must be **redesigned** into a pure golden-reader, else
  "backend → FUI" and "verifier stays WE" contradict (the verifier currently *depends* on the backend it
  must shed).
- **No golden output exists.** `we:blocks/renderers/data-table/__fixtures__/data-table-cases.ts` cases are
  **input-only** (rows + config); the "golden" is computed live. The data-reading verifier needs **stored
  goldens generated and committed** per case — net-new vector infra (the #899 model), not present.
- **No WE conformance test file exists.** `find blocks/__tests__` returns no `data-table*`/
  `collection-op*` test — the acceptance's `we:blocks/__tests__/unit/renderers/data-table.test.ts` must be
  (re)created against goldens.
- **A live demo imports the WE backend.** `we:demos/data-table-demo.ts` value-imports the runtime; deleting
  it breaks the demo/typecheck until the #1355 swap (which `blockedBy` this) — needs careful sequencing.

So this is a **conformance-verifier redesign + golden generation + cross-repo move + demo handling**, a
focused session — re-sized 5 → 8, carry-forward reason **outgrew**. No new design fork (the #899 model +
#1467 placement are ruled — golden format is an impl detail). #1355's delete stays `blockedBy` this.
Released to `open`.

## Pre-flight (batch-2026-06-21-1501-1356) — entangled with #1355; must co-land (blocked-in-fact for a solo close)

Re-grounded against the boundary. The verifier-redesign + golden + WE-test + coordinator-removal parts are
clean, but the acceptance line "backend + semantics gone to FUI, **check:standards green in both repos**"
**cannot be met in isolation**: removing the WE backend strands `we:demos/data-table-demo.ts`, which
value-imports and *calls* `renderDataTable()`/the fixtures (`we:demos/data-table-demo.ts:13,79,171`). The
ratified docs-rendering boundary (#701 — WE iframes FUI, never imports its block code) **forbids repointing
a WE demo to FUI's block code**, so the only correct demo fix is the **#701 FUI-hosted iframe swap — which is
#1355** (`blockedBy` this, and itself live-iframe work). #1494 alone therefore leaves a knowingly-broken
demo (the "reckless" anti-pattern) or an un-green tree. **#1494 and #1355 are mutually entangled and must
co-land in one focused session** (move backend + swap demo to iframe together); the `#1355 blockedBy #1494`
edge understates a true co-dependency. Carry-forward reason: **blocked-in-fact** (clean green end-state
depends on #1355's demo swap). Released to `open`; recommend folding #1355 into the same focused session.

## Pre-flight (batch-2026-06-22-1510-1483) — re-sized 8 → 13 (must-co-land unit, not a solo batchable slice)

Third independent pre-flight reaches the same conclusion: this is **not batchable as one**. The acceptance
("`check:standards` green in both repos") provably cannot hold for #1494 alone — deleting the WE backend
strands `we:demos/data-table-demo.ts`, and the ratified #701 boundary forbids repointing it to FUI block
code, so green is only restored by #1355's #701 FUI-iframe swap. #1494 is therefore the **head of a
must-co-land unit (#1494 → #1355)** whose combined scope — `auditDataTable` verifier redesign into a
golden-reader + generate/commit per-case goldens (#899 vector model) + delete the WE backend + re-home the
coordinator to FUI + (#1355) build the FUI-hosted demo + swap `we:demos/data-table-demo.ts` to a #701
iframe + delete it + live-iframe verification — is a focused cross-repo session well past an 8-pt slice.
A mutual `blockedBy` would deadlock (#1355 is already `blockedBy #1494`), so the honest encoding is
**size 13** (drops it from the batch pool; #1355 stays blocked behind it). Not a gut "looks big" — solo
close is provably un-green. No new design fork (the #899 model + #1467 placement are ruled). Left `open`.
