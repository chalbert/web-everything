---
kind: epic
status: resolved
dateOpened: "2026-06-14"
dateResolved: "2026-06-15"
graduatedTo: none
tags: []
---

# graduatedTo narrative→body cleanup — relocate prose, leave a canonical leading token

Follow-on to #614. After #614's normalizer auto-typed the safe bare ids, ~74 resolved items still carry a graduatedTo whose value is prose/narrative (e.g. `plateau: we:getStandInElement.ts (tag-keyed …)`) instead of a clean leading entity ref or repo path.

Per #607's hygiene goal, move the narrative into the item body and leave graduatedTo as the canonical token (`kind:id`, repo-path, or `none`) so entity-graph joins and the G3 lineage walk read it reliably. Run `npm run normalize:graduated -- --json` to enumerate the review buckets; also resolve the four `{url,label}` object-form and four item-id-split values. `check:standards` already surfaces the live count via one aggregated warning pointing here.

## Scope reality — outgrew size-5, re-sized 13 + needs `/split` (batch pre-flight 2026-06-14)

Claimed in a batch and assessed on contact: the cleanup is **~99 items**, not the ~74 the body estimated —
`normalize:graduated --json` reports **44 `review-prose` + 55 `review-unresolved`** (+ 1 `fix-bare` the tool
auto-fixes). Each value needs *per-item entity archaeology* (read the resolved item to learn what it truly
became) with **cross-repo path verification** (frontierui / plateau impl paths), and the field feeds the G3
lineage walk so a guessed token corrupts the graph — it **cannot be blind-scripted**. The values are also
structurally irregular: folded-YAML block scalars (e.g. #67 `graduatedTo: >` + indented test-file list),
object-form `{url,label}` (#146/#147/#212/#214), item-id-split (#463 `#505/#506/#507`), `frontierui:` /
`plateau:` colon-refs, bare `*.json` filenames, and bare prose (#2 `Protocol`, #81 `module-service`).

**`/split` into two batchable tranches before re-claiming:**
1. **Determinable-token tranche** (~17, low-judgment): the 13 `review-prose` entries the tool already
   pre-computes a `canonical` for + the 4 object-form `{url,label}` (parse the url path → `kind:id`) +
   the obvious URL→typed (`/intents/x/`→`intent:x`, `/blocks/x/`→`block:x`). Mechanical, scriptable.
2. **Archaeology tranche** (~82, high-judgment): the 55 `review-unresolved` + the residual `review-prose`
   needing cross-repo path resolution + the corrupt/folded values. Read-each-item; size on its own.

Released unworked (drop-reason `outgrew`).

## Split into 7 batchable slices (`/split` 2026-06-15)

Now a **storied epic** — the ~111 manual `graduatedTo` values (live: 55 `review-prose` + 56
`review-unresolved`, + 2 `fix-bare` the tool auto-fixes) are decomposed into 7 independent, fully-parallel
`task` slices, each `size ≤ 3` and bounded by an explicit item-ID set. Each fix is a separate backlog
file, so the slices touch disjoint files (no DAG edges) and any partial completion is a valid gated state
(`check:standards` decrements the aggregated warning count). Slice rationale, exact item lists, and the
rubric check live in [we:reports/2026-06-15-backlog-split-analysis.md](../reports/2026-06-15-backlog-split-analysis.md).

**Per-item bar:** not blind-scriptable even for the "mechanical" tranche — the tool's precomputed
`canonical` takes the *leading* token, which is wrong where the real entity sits in a parenthetical (e.g.
#459 → `intent:system-notification`, not `project:webintents`). Each slice re-derives the true token per
item; narrative moves to the item body.
