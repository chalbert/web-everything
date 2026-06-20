# Backlog split analysis — 2026-06-20 (focused: #1179)

`/slice 1179` — single-item run. Candidate: **#1179 — Temporal / advanceable-media sequence
intent family (deck · video · carousel)** (`workItem: epic`, `size: 5`, `relatedProject: webintents`,
no children → unsliced-epic candidate kind **b**).

## Verdict: **could not split** — overtaken by the #1173 carve; residual is one atomic intent

#1179's body instructs: *"slice into the member intents (advance, autoplay, up-next, interstitial,
present-surface) **once the deck carve (#1173) confirms** the concrete shape each consumer needs."*
That gate has **already fired**, and it dissolved the split rather than enabling it:

- **#1173 is resolved** (graduated to `we:reports/2026-06-19-deck-slide-standards.md`).
- **#1175 ratified B (fully distributed)** — no `webdecks` umbrella; the 21 deck contracts were carved
  as **standalone** slices #1180–1200, each homed by `relatedProject`, none parented.
- **4 of the 5 "member intents" #1179 names already exist as those standalone slices**, and they
  reference #1179 as the kernel they *compose* (they are its consumers, not its children):

  | #1179 member | already-carved standalone slice | home | size |
  |---|---|---|---|
  | autoplay / timed-advance | [#1188](../backlog/1188-autoplay-timed-advance-extension-carousel-wake-lock.md) | webintents | 2 |
  | "up next" preview | [#1199](../backlog/1199-up-next-what-to-view-next-preview-shared.md) | webintents | 2 |
  | interstitial / overlay | [#1200](../backlog/1200-interstitial-overlay-insertion-ad-breaks-shared.md) | webintents | 3 |
  | present-surface (fullscreen) | [#1198](../backlog/1198-fullscreen-presentation-mode-semantic-intent.md) | webportals | 2 |
  | *(deck-layer composers)* | [#1181](../backlog/1181-fragment-incremental-reveal-intent-step-reveal-within-a-slide.md) fragment · [#1187](../backlog/1187-overview-grid-zoom-out-intent-slide-sorter.md) overview | webintents | 3 / — |

  [#1181](../backlog/1181-fragment-incremental-reveal-intent-step-reveal-within-a-slide.md#L15)
  literally states *"Composes the advanceable-sequence family (#1179)."* — so these are **downstream
  consumers**, not slice candidates hidden inside #1179.

What remains **uniquely** to #1179 after the carve is a single deliverable: **mint the
`advanceable-sequence` kernel intent in webintents** — the `current/next/prev` + sequence-position
vocabulary and family meta-schema that [we:carousel](../src/_data/blocks/carousel.json) already owns
informally (its `composesIntents: [motion, live-region-status, navigation]` has no sequence kernel)
and that deck/video/carousel compose. There is **no existing `advanceable-sequence` / `sequence`
intent** under [src/_data/intents/](../src/_data/intents/) (the `temporal` intent there is date/time
selection — unrelated). That kernel is one atomic intent-authoring story (~size 3–5), not ≥2 slices.

### Could-not-split table

| # | Title | Failed rubric condition | Unblocking / cleanup action |
|---|---|---|---|
| **#1179** | Temporal / advanceable-media sequence intent family | **(2) ≥2 nameable slices, each a real home** — the 5 named members are already standalone slices (#1188/#1199/#1200/#1198 + composers #1181/#1187); the unique residual is a single atomic kernel intent. Also fails the *premise*: at `size: 5` it was never oversized (≤8 = batchable) — it entered the set only as an `epic`-with-no-children, a now-stale shape. | **Re-scope #1179 `epic` → `story` (size ~5)**: it is the single "mint the `advanceable-sequence` kernel intent" story. Replace the stale *"slice into the member intents once #1173 confirms"* body (the carve happened; members are standalone) with cross-refs to the already-carved composers (#1188/#1199/#1200/#1198/#1181/#1187). Then it flows straight into `/batch` as one story. |

### Why not the alternatives

- **Re-parent #1188/#1199/#1200/#1198 under #1179 to make it a real family epic** — would **reverse
  ratified #1175 (B, fully distributed, no umbrella, standalone slices homed by `relatedProject`)`.
  Decisions are reversible, but slicing is not the place to do it, and there's no case here: the
  distributed homes are working and the consumers already reference #1179 by prose. Not recommended.
- **Slice the kernel itself into "mint intent JSON" + "rewire carousel to compose it"** — a thin
  2-step linear chain (size 2 + 2) out of a size-5 story: exactly the *needless* split the conservative
  instinct refuses (fragments one coherent deliverable, adds review overhead, zero independence gain).
  Keep it whole.

## Could split

*(none this run)*

## Recommended action (gated on approval — not a split)

No on-disk **split**. The honest move is a one-item **re-scope**: convert #1179 `epic → story` (size 5),
de-stale its body to reference the already-standalone composers. This is a backlog edit, not a slice,
so it's outside `/slice`'s auto-mutation mandate — flagged here, applied only on a "go".

---

# Focused: #1245 — reference-runtime blocks duplicated/drifting between WE and FUI

`/slice 1245` — single-item run. Candidate: **#1245** (`type: issue`, `workItem: epic`, `size: 8`,
`relatedProject: webblocks`, no children → unsliced-epic candidate kind **b**).

## Verdict: **could not split** — the epic buries a live canonical-home decision (rubric condition 1)

| # | Title | Kind | Verdict |
|---|---|---|---|
| #1245 | Reference-runtime blocks (router, navigation, …) are duplicated and drifting between WE and FUI | unsliced `epic` (`size 8`, no children) | **Could NOT split** — embedded canonical-home decision gates all build work |

### Investigation (the real tree, 2026-06-20)

- **The duplication is real.** `we:blocks/` holds full runtime `.ts` for the STAY subset
  (`router/`, `navigation/`, `parsers/`, `text-nodes/`, `for-each/`, `transient/`, `attributes/`,
  `draft-persistence/`, plus `view/`, `tabs/`, `wizard/`, `workflow-engine/`, `resource-loader/`,
  `data-transfer/`, `renderers/*`, `stores/`), and `fui:blocks/` holds a parallel copy of each.
- **The contract already says FUI-canonical.** Every STAY block with a spec declares
  `implementedBy: @frontierui/blocks/<id>/…`, `status: active` (the per-block spec files
  router/view/for-each/draft-persistence/tabs/wizard/workflow-engine/resource-loader under
  `we:src/_data/blocks/`). Per **#641**
  (resolved 2026-06-15, codified `we:docs/agent/platform-decisions.md#constellation-placement`):
  *WE blocks are pure protocols; impl lives in FUI; WE holds NO block-impl copy.*
- **But #697 (resolved 2026-06-17, AFTER #641) deliberately kept a reference-runtime subset in WE**
  ("blocks whose demos exercise a WE *standard*"). The later ruling carved an exception to the earlier
  one, and the filesystem reflects both at once: the contract says FUI-canonical while a full WE
  runtime copy persists. **That contradiction is the open decision the epic buries.**
- **Five dirs have no spec at all:** `navigation`, `parsers`, `text-nodes`, `transient`, `attributes`
  — no entry under `we:src/_data/blocks/`, so they aren't even declared WE protocols and the **#659**
  drift gate (`validateBlockImplConformance`, `we:scripts/check-standards-rules.mjs:1326`) never sees
  them. Pure undeclared duplicates.
- **The existing drift gate covers only the MOVED families.** #659 checks an `implementedBy` pointer
  *resolves* in FUI; it does **not** flag a WE `blocks/<id>/` runtime copy *existing* for an
  `implementedBy`-declared block, and can't see the five unspec'd dirs. So the hazard #1245 names is
  genuinely untracked.

### Could-not-split table

| # | Failed condition | Why | Unblocking action |
|---|---|---|---|
| #1245 | **(1) Volume, not uncertainty** — the body holds a live `type: decision` fork ("canonical home", §"Open question") that sets the *direction* for every dedup and the drift-gate shape; slicing now just scatters the same fork across children. (Also (5): the gate's form — byte-diff vs contract-seam vs no-WE-copy — is undefined until the seam is chosen.) | #641 (FUI-canonical, no WE copy) vs #697 (kept reference-runtime STAY subset in WE) are in unreconciled tension; the filesystem reflects both. A blind file-copy is wrong either way (copies carry deliberate FUI adaptations: import style, tag defaults, the #365/#423 deltas). | **Resolve the canonical-home decision first.** Carve it out of the epic body into its own `type: decision` card, de-bury the parent (inline fork → pointer), set epic `blockedBy` the card. Once ruled, the slices below become batchable. |

### Slices that become carvable once the decision resolves (proposed, not filed)

1. **`router` dedup** (`story`, ~3) — first; has live evidence + load-bearing for every consuming app.
   Reconcile per the ruling (delete WE copy + wire seam, *or* formalize the WE reference-runtime home),
   regression-guard the #365/#423 fixes.
2. **Per-family dedup** (`story`/`task`, ~2 each) — `navigation`, `parsers`, `text-nodes`, `for-each`,
   `transient`, `attributes`, `draft-persistence`, then the remaining #697 STAY families
   (`view`, `tabs`, `wizard`, `workflow-engine`, `resource-loader`, `data-transfer`, `renderers/*`,
   `stores/simple`). Each blocked by slice 1's seam pattern.
3. **Declare the five unspec'd dirs** (`task`, ~2) — add `we:src/_data/blocks/{navigation,parsers,
   text-nodes,transient,attributes}.json` (or fold into siblings) so #659 can see them.
4. **Extend the drift gate** (`story`, ~3) — extend `validateBlockImplConformance` to *also* fail when a
   WE `blocks/<id>/` runtime dir exists for an `implementedBy`-declared block (no WE impl copy),
   mirroring the plugs byte-diff guard. Blocked by the dedup slices (enforced once the tree is clean).

DAG: `decision → slice 1 (router) → slices 2/3 (parallel per family) → slice 4 (gate, enforced last)`.

## Recommended action (gated on approval — not a split)

No on-disk split. The honest move per the could-not-split handling: **file the buried fork as its own
`type: decision` card** (next free `#1246`), register it Tier-B, and **de-bury #1245** (inline
"Open question — canonical home" § → a pointer; epic `blockedBy: ["1246"]`, `childlessReason: undecided`,
`size 8` kept — still unsliced). Gated on one "go".
