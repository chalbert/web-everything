---
type: idea
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-10"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: none
tags: [backlog, split, agile-sizing, batchable, decision]
relatedReport: reports/2026-06-10-backlog-split-analysis.md
---

# Execute the large-story splits from the 2026-06-10 split analysis

The `/split` dry run (2026-06-10) analysed all 9 open `story` items of `size` > 5 against the split-safety rubric and found **6 splittable, 3 not** (full report in `relatedReport`). This item tracks acting on it: perform the safe splits and register the blocked ones as decisions. Each split mutates the backlog (convert original → storied epic / scaffold slices / set edges, gated on `check:standards`) and needs a go, so they're staged here rather than auto-applied.

## Splits to execute (ranked by leverage)

1. **#228** — clean: root construction fix `story·3` + 3 independent lifecycle `task`s (disconnect / attribute-changed / form-associated). Pure win; only #167 carries over.
2. **#005** — clean: capability-manifest schema `story·3` + consumer slices. Slice A also **re-points #085's blocker** to the narrower prerequisite.
3. **#085** — clean fan-out: intent registry + per-adapter slices; slices inherit the #004/#005 blockers (do after #005-A).
4. **#081** — close-out, not epic conversion: v1 + phases 2a/2b/2c are shipped, so **resolve #081** (`--graduated-to=module-service`) and spin out its 4 non-blocking follow-ons.
5. **#086 / #100** — staging splits: slices shrink but stay ≈`5`; lower urgency.

## Could-not-split → register as Tier-B decisions

- **#092** — decide the ingestion model (build-time export vs runtime agent vs both).
- **#093** — run the design/exploration pass it asks for (home / proof format / enforcement seam).
- **#191** — waits on #005's descriptor format; revisit split after #005's manifest slice lands.

## Acceptance

- The 6 splittable items are split (or explicitly deferred with a reason), each leaving `check:standards` green.
- The 3 could-not-split forks are captured as `type: decision` items so they surface in decision-mode selection.

## Progress

**Resolved 2026-06-11.** All splits from the 2026-06-10 analysis (the `relatedReport`, which superseded
this item's original "9 items / 6 splittable" framing by adding #240 and #038) are now executed or
explicitly deferred with a reason.

**Splits executed in a prior (uncommitted) session — verified present this session:**

- **#228** — split & **resolved** (root construction fix landed; 3 independent lifecycle tasks
  **#261/#262/#263** spun out, all resolved).
- **#240** — split & **resolved** (slice A regression-fix landed via **#241/#245**; the bare-specifier
  resolution decision became **#271**, with module-resolution axis **#274** and importmap cleanup **#285**).
- **#005** — converted to **`epic`** umbrella; foundation + consumer slices **#266–#270** scaffolded
  (#266 the capability-manifest slice, the rest `blockedBy` it).

**Splits / close-outs executed this session:**

- **#085** — converted to **`epic`** umbrella; sliced into **#304** (intent enumeration +
  `CustomValidationAdapterRegistry`, `story·3`, the foundation) + adapters **#305** native-HTML
  (`story·2`), **#306** Zod, **#307** Pydantic, **#308** JSON-Schema (`task`s), + **#309** Mode-2 service
  (`story·3`). The old `blockedBy: ["004","005"]` was **re-pointed onto #304 as `["004","266"]`** — #085
  only needed #005's manifest slice, not all of #005. #305–#309 are `blockedBy: ["304"]`, else independent.
- **#081** — **close-out, not epic conversion** (v1 + phases 2a/2b/2c shipped, home decision settled under
  `webadapters`): **resolved** `--graduated-to=module-service`, with its 4 non-blocking follow-ons spun
  out as **#310** (reactivity), **#311** (real id→definition resolver/registry/caching), **#312**
  (production runtime delivery), **#313** (FU functional-component `FORMS` entry).

**Could-not-split → registered as `type: decision`:**

- **#092** — `idea`→`decision`; fork to settle = the **ingestion model** (build-time export vs runtime
  agent vs both) + seam-contract representation. (needs prep — no recommendation on file.)
- **#093** — `idea`→`decision`; needs a **design/exploration pass** (home / proof format & trust model /
  enforcement seam) before it can slice. (needs prep.)
- **#191** — `idea`→`decision`; **`blockedBy` re-pointed `005`→`266`** (the descriptor/manifest slice it
  actually waits on); revisit the split once #266 lands. (needs prep.)

**Splittable but deferred (recorded on each item + here):**

- **#086** / **#100** — both are *staging* splits whose slices stay ≈`5` (no batchability win), so
  executing them now is backlog churn. Deferred with a `> Split status` note on each item; revisit with
  `/split` when the item is picked up or its urgency rises.

**Gate.** `check:standards` is green for every #259-touched item (no new errors/warnings introduced).
The one remaining `error` (orphaned report `reports/2026-06-01-dropdown-ux-behaviors.md`) is **pre-existing
and out of scope** — it predates this work, no #259 item references it, and fixing it would mean editing
the unrelated reports/research-topics subsystem. Flagged, not touched.

**Graduated to** `none` — process item — executed backlog splits #085/#081 + decisions #092/#093/#191 + #304–313 slices.
