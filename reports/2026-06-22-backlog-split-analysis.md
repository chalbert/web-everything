# Backlog split analysis — 2026-06-22

Three focused runs recorded today: **#1502** (below), **#1485** (appended), and **#1234** (at the end).

---

## Run 1 — `/split 1502`

Candidate: **#1502** — *Codification-hygiene sweep: re-point G7 backlog
citations from `#N` to their platform-decisions statute anchor* (`kind: story`, `size: 13`).

## Could split

_none._

## Could not split

| Candidate | Failing condition | Unblocking action |
|---|---|---|
| **#1502** (`size:13` story) | Rubric (4) **real independence**, under the conservative-instinct override (needless fragmentation, zero gain). Mechanically the work *partitions* (by statute anchor — see below — each cluster is independent, task-sized, no DAG edges, each leaves a valid demoable state where the G7 audit count drops). But the property that disqualified this item from batching is **whole-backlog concurrent-file contention** (it edits ~73 `backlog/*.md` files that other live sessions hold/edit) — a **scheduling** constraint, not a **volume** constraint. No decomposition removes it: every anchor-slice still sprays edits across many concurrent-held backlog files, so the slices are no more safely-batchable than the parent. `/split` exists to *feed* `/batch`; here it would emit fragments that each still demand a quiescent backlog and still can't run concurrently (with other sessions *or* with each other). Net = one coherent sweep fragmented into ~6 pieces that only make sense run sequentially in one quiescent session (= the original), plus 6× audit re-runs and 6 review seams. | **None via decomposition.** Run #1502 as-is as a single focused sweep when no concurrent backlog sessions are active (it was deliberately re-sized 5→13 to leave the batch pool for exactly this reason — see the item's pre-flight note). It is correctly sized and correctly *not* batchable. If one session ever wants to chunk the 73 internally, that's intra-session sequencing by anchor, not a backlog split. |

### Why the mechanical partition is real but irrelevant

For the record, the work *does* cluster cleanly by statute anchor (counts from the live G7 section of
`we:audits/backlog-health-audit.md`, ~73 citing items, several cite >1 anchor):

- `#monetization` — the bulk (e.g. #89, #97, #140, #142, #143, #181, #184, #186, #285, #297, #302, #314,
  #428, #554–#557, #563, #646, #660, #666, #1083, #1104, #1391, #1500, …)
- `#constellation-placement` — #99, #170, #291, #479, #561, #642, #699, #800, #820, #872, #907, #912,
  #967, #978, #999, #1030, #1234, #1353, #1355, #1356, #1494, …
- `#we-fui-embed-boundary` — #728, #764, #777, #818, #1234, #1504, …
- `#intents-ux-only` — #99, #140, #142, #315, #317, #318, #746, #777, …
- `#project-protocol-bar` — #142, #153 (→#2), #236, #237, #283, #315, #646, #1153, #1207, …
- `#no-leakage-client` — #490, #513, #514, #798, #890, #1073
- `#forward-generation-adapters` — #818, #939, #1258, #1451
- `#component-dc` — #232, #715, #928
- `#runtime-di-vs-devtools-provider-seam`, `#native-first-baseline`, `#behavior-activation-lifecycle`,
  `#config-extends-platform-default`, `#surface-contract-not-computation` — singletons / pairs

Each cluster satisfies rubric (1) (volume, decision already codified), (2) (≥2 nameable, real home in the
citing items' files), (3) (task-sized), (5) (valid demoable state — audit count monotonically drops). It
fails only on the independence-that-matters: the slices aren't independent of the concurrent-edit
contention that is the *whole reason* the parent left the batch pool. A partition that reproduces the
disqualifying property in every piece is a needless fragmentation, not a split.

## Net flow

`+0` — no mutation. Report-only; #1502 left as a `size:13` story.

---

## Run 2 — `/split 1485`

Candidate: **#1485** — *Realizing dockable block — recursive container + drag-to-dock +
serialization + popout* (`kind: story`, `size: 13`, `status: open`, `blockedBy: 1437✓, 1484✓`).

### Verdict: **CAN SPLIT** — 5 new slices + reuse existing #1486

#### Why it's safe (rubric — all five hold)

1. **Size is volume, not an unresolved decision.** Every fork is ratified in #1437 (resolved):
   Fork 1a (standalone intent), Fork 2a (layout-tree as a first-class Protocol), Fork 3a
   (`popout` default `none`). The dockable **intent** JSON already landed
   (`we:src/_data/intents/dockable.json`, via resolved #1484). What remains is net-new contract +
   impl **volume** for a golden-layout/dockview-class paradigm.
2. **≥2 nameable slices, each with a real home.** Contract → WE (`we:blocks/dockable/contract.ts`
   + `we:contracts/dockable.ts`); render / interaction / serialization / popout → FUI impl
   (`locus: frontierui`). Pattern verified against `we:contracts/stepper.ts` (type-only re-export
   of `we:blocks/<name>/contract`) + the `exports` map in `we:contracts/package.json`.
3. **Each slice lands `size` ≤ 3 / task.** A=2, B=3, C=3, D=2, E=3 (sum = 13, matches the re-size).
4. **Clean DAG, incremental delivery.** Contract (A) unblocks both the impl chain and the protocol;
   render (B) → {interaction (C), serialization (D)}; serialization realizes the conforming impl
   that lets the #1486 protocol be extracted.
5. **Every slice leaves a valid demoable state** (A is the foundational gate-verifiable contract
   exception; B–E each leave a runnable docking demo).

#### Proposed slices

| Slice | Title | locus | kind·size | blockedBy | demoable state |
|-------|-------|-------|-----------|-----------|----------------|
| **A** | WE dockable block contract — `we:blocks/dockable/contract.ts` + `we:contracts/dockable.ts` re-export + `we:contracts/package.json` export | WE | story·2 | — (deps #1437/#1484 resolved) | contract compiles; gate green; #1486 + FUI impl can import the node-tree types |
| **B** | FUI recursive container render — row/column/stack via CSS Grid/Flex + recursive `resizable` splits + APG Window Splitter a11y | FUI | story·3 | A | static partition-tree renders; dividers resize siblings (demo page) |
| **C** | FUI drag-to-dock — edge/center zone hit-testing + topology mutation (split a leaf into a new row/column/stack) + APG Tabs on stacks | FUI | story·3 | B | drag a panel → live re-tile (composes #1384 Pointer-Events + `moveBefore` + #1495 `pan`); **live-interactive** |
| **D** | FUI layout-tree serialize / restore — emit & rehydrate `{type,children\|tabs,size}` | FUI | story·2 | B | save → reload → identical layout round-trip; the conforming impl that validates the #1486 core schema |
| **E** | FUI `popout: window` — cross-document subtree relocation (`window.open()` + `adoptedStyleSheets`; deferred, highest-risk; breaks `moveBefore` + roving-tabindex) | FUI | story·3 | C | pop a stack into an OS window, still live |

**Reused (NOT a new slice):** #1486 — dockable layout-tree interchange Protocol — already exists as
the body-carve's slice 4. Action: **re-parent** under #1485 and **repoint** `blockedBy: ["1485"]`
→ `["<D>"]`. D is the realizing serialization impl that validates the core schema, honoring #1486's
own protocol-bar temporal rule ("extracted once a conforming impl validates the core schema").
Repointing to D (not the whole epic) keeps the blocker DAG honest.

#### DAG

```
            ┌──→ B ──┬──→ C ──→ E
A (contract)┤        └──→ D ──→ #1486 (existing, repointed)
```

#### Execution on approval

1. Convert **#1485** in place: `story` → storied **epic**, drop `size`, refresh digest to umbrella
   framing, keep `status: open`, keep the number.
2. Scaffold A, B, C, D, E with `--parent=1485` + the `--blocked-by` edges above; add
   `locus: frontierui` to B–E after scaffold (no `--locus` flag).
3. Re-parent #1486 (`--parent 1485`) + repoint its `blockedBy` to D.
4. Gate `npm run check:standards` green; confirm backlog count +5.

#### Could not split

None — #1485 splits cleanly.

### Net flow (run 2, on approval)

`+5` slices, #1485 story → epic, #1486 re-parented + repointed. Report-only until "go".

---

## Run 3 — `/split 1234`

Candidate: **#1234** — *Land the WE→`@frontierui/plugs` repoint for real* (`kind: story`, `size: 13`,
`status: open`).

### Verdict: **could not split** — `atomic`

## Could split

_none._

## Could not split

| Candidate | Failing condition | Unblocking action |
|---|---|---|
| **#1234** (`size:13` story) | Rubric **(5) every slice leaves a valid demoable state** (and consequently **(2)/(3)** — no slice is independently demoable at `size ≤ 3`). | **None via decomposition** — it is genuinely atomic. Run it as a single focused WE session that owns the dev-server lifecycle (already noted on the item). |

### Why #1234 is atomic — the investigation

The remaining work (from the item's 2026-06-22 pre-flight) is four points, all landing in **one file**
(`we:vite.config.mts`) against **one live-only acceptance** (26 demos + 5 test-pages still rendering):

1. Replicate FUI's ~26-entry `@webeverything/*` alias block into `we:vite.config.mts`.
2. Re-apply the `/plugs`→FUI prefix alias + 8 sub-aliases + the 5 test-page `../plugs/`→`/plugs/` rewrites.
3. Iteratively live-verify the full 26-demo/test-page surface until **0 transitive 500s**.
4. Handle the bare `@webeverything/{contracts,plugs,conformance-vectors}` specifiers FUI plugs import.

I read the real tree to test whether a seam falls anywhere here:

- **The alias-block addition (point 1) is a no-op in isolation.** Verified: none of the 26 entries
  (`capability-manifest`, `validation-generation/*`, `contracts/*`, `commitment-policy`, `error-summary`,
  `interaction-state`, `webcases/requirementValidator`) exist in `we:vite.config.mts:165-185` today
  (vs. `fui:vite.config.mts:215-245`), and **no WE-side runtime/demo/test-page imports any of them** (the
  lone `@webeverything/webstates` hit in `we:demos/webmanifests-conformance-demo.ts:28` is a string literal,
  not an import). They go live *only* the instant the `/plugs`→FUI repoint (point 2) makes FUI plugs the
  served source, because the FUI plugs transitively re-export from that graph. Landing point 1 alone
  produces nothing demoable to verify — fails "independently-deliverable".

- **The repoint (point 2) without the full alias graph (point 1) breaks the surface.** Proven across the
  item's three pre-flights: a partial repoint 500s (`Failed to resolve import @webeverything/capability-manifest`)
  and "silently blanks the demo surface" — an invalid demoable state. Each prior attempt was *fully reverted*
  for exactly this reason.

- **The transitive tail (points 3/4) is discovered, not pre-partitioned.** Acceptance is "iterate until
  0 transitive 500s across 26 pages." The alias set actually needed is found *by running the live loop*;
  you can't draw `file:line`-citable slice boundaries ahead of a closure you only learn by executing it.

There is also no per-demo seam: the repoint is **one** prefix alias (`/plugs`→FUI), not a per-demo edit —
you can't "repoint half the demos." The 5 test-page rewrites are per-file but trivial and inert until the
alias lands.

**Conclusion:** alias graph + repoint + iterative live-verify are one coupled config edit. Any partition
yields either a no-op non-deliverable (point 1 alone) or an invalid demoable state (point 2 before 1), and
the transitive tail can't be sliced in advance. Volume bound to a single live-verify loop, not separable.
Recorded as `unsplittableReason: atomic` on the item.

**No new fork** is buried here — the design direction (contract-anchored, FUI-as-superset) is resolved
(#1250), so this is not an `undecided`/decision-card case.

### Net flow (run 3)

`+0` — no mutation. Report-only; #1234 left as a `size:13` story, `unsplittableReason: atomic` recorded.
