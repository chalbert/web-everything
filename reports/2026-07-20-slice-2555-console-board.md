# Slicing proposal — #2555 real launch-review console board

**Date:** 2026-07-20 · **Session:** slice-2555 · **Parent epic:** [#2555] (under [#2505] / the Plateau Loop
[#2527])

> This is the slicing rationale for [#2555]. It lives in `reports/` — not `backlog/` — because any `.md`
> under `backlog/` is parsed as a backlog *item* and hard-errors the standards gate if it lacks an `NNN-` id
> prefix. [#2555] references this file via `relatedReport`, so it is exposed on the board, not a hidden doc.

## What #2555 is

A `kind: epic` (no size — already sliced) that ports the converged v68 console mock + the design record
(`plateau-app:docs/backlog-console-design.md`) to a real board in plateau-app. Its body carried ~10 prose
sub-slice bullets and one open question. Two children already existed before this pass:

- **[#2552] board read-model** — `{lane, lease, drain, PR-label, progress} → card-state (UC-id)` mapping.
  **Resolved** (graduated to `plateau-app:src/backlog-view/card-state-read-model.ts`).
- **[#2560] scope-lease + conflict-policy engine** — the novel lease mechanism, its own child epic. Open.

The epic was `blockedBy: [#2553]` (taxonomy conformance spec), which is now **resolved** — so the board work
is unblocked. This pass converts the prose sub-slice bullets into buildable, independently-deliverable
story cards.

## The cite source for the visual grammar (do not re-port)

[#2578] is the **filed, not-yet-landed** port that adds the design-record §6e per-state visual-grammar
manifest into `plateau-app:src/backlog-view/card-taxonomy.webcases.ts` — every state's Lucide glyph, the 7
color/style forks, the 17 you-act action-button glyphs, and per-state motion. Today the `assert:` lines carry
only `actor · edge · primary · rendered · uc`; there is **no glyph/color/motion field yet**. So the
card-renderer slice ([#xq8fvck]) is **`blockedBy` [#2578]**: once [#2578] lands, the renderer **cites a
state's glyph/motion by UC-id from that spec** rather than re-porting it. This keeps the manifest
single-sourced and the renderer a pure consumer.

## The seven slices

Size ≤ 8 (prefer ≤ 5); ordered by real dependency (`blockedBy`). The DAG is a single foundation chain then a
fan-out:

| Slice | Size | What it delivers | blockedBy |
|---|---|---|---|
| [#xo9wnlp] Board shell + lane windowing **(ALREADY DELIVERED — graduating)** | 5 | lane columns, sticky-header NOW line, no-horizontal-scroll windowing, dock frames, data-driven renderer — landed in `plateau-app:src/backlog-view/lane-board.ts`, owed a resolve-as-graduated | — |
| [#xq8fvck] Card renderer — 37-state taxonomy + glyph/motion | 8 | all 37 states rendered, glyph/motion cited by UC-id from the webcases spec, board-parity `rendered` flip | [#2578] |
| [#xc3ofgt] Delivery-horizon + size-scaled conveyor | 5 | cards rise by progress + cross at delivery, past-mask + day-folded history, `▤` size mode + lane ETA; **owns the lane vertical axis** (`plateau-app:src/backlog-view/conveyor.ts`) | [#xq8fvck] |
| [#xzsx09z] Scope-lease board zone | 5 | four lane zones (running/ready/purgatory/next-sprint), lease chip + overlap/forced/breach cells + overtake; lays bands **along #xc3ofgt's axis** (`plateau-app:src/backlog-view/lease-zone.ts`) | [#xq8fvck], [#xc3ofgt] |
| [#x2kpohd] Cross-lane spans + leverage graph | 5 | waits-on-multiple-leases spans, forked/fan-in across-lanes overlay, `⚡` frees-now/gates + teal cascade (`plateau-app:src/backlog-view/cross-lane-spans.ts`) | [#xq8fvck] |
| [#xuff4b8] Review + queue operator actions | 5 | drag-to-queue (extends #2522) + review modal over the board (merge/bounce/take-over) (`plateau-app:src/backlog-view/operator-actions.ts`) | [#xq8fvck], [#2522] |
| [#xprj9ov] Write affordances — open-decision + composer | 5 | open #2565's ratify surface from a lane, new-work composer via lane→PR, new-spec→constitution loop (`plateau-app:src/backlog-view/write-affordances.ts`) | [#xq8fvck] |

The cut was 38 points across seven stories. **The shell [#xo9wnlp] (5) has since been delivered** (it landed
in `plateau-app:src/backlog-view/lane-board.ts`, wired at `/console-board`; owed a resolve-as-graduated, not
a build), so remaining to-build work is **~33 points across six slices** plus the graduating shell. With the
shell delivered, the DAG re-roots at the renderer. The fan-out is **not a flat five-way parallel** — it
carries two internal ordering edges:
`{ #2578 (glyph-manifest port) } → #xq8fvck (renderer) → { #xc3ofgt, #x2kpohd, #xprj9ov }` fan out in
parallel; then `#xc3ofgt → #xzsx09z` (the lease zone lays its bands along the vertical axis the conveyor
owns); and `#xuff4b8` additionally `blockedBy` the still-open `#2522`, so it is not parallel-eligible with the
first three until #2522 lands. The shell's `blockedBy` edge into #xq8fvck is pre-satisfied.
([#2578] is an existing sibling under [#2555]'s parent [#2505], not one of the seven new slices; it is a hard
prerequisite of the renderer because it populates the glyph/color/motion fields the renderer cites.)

## Why this cut (and not another)

- **The shell is the one true foundation** (and is now delivered). Every card, zone, span, and action
  renders *into* lane columns with a NOW line. It was built first and alone — it landed in
  `plateau-app:src/backlog-view/lane-board.ts` and is owed a resolve-as-graduated — giving every sibling a
  stable container and a data-driven fixture to extend. It had no board dependency, so it was ready to build
  before the rest; with it delivered, the renderer is the effective root of the remaining chain.
- **The renderer is the single fan-out point.** Five of the seven slices act on *rendered cells* — you
  cannot position a card on the horizon, stack it in a lease zone, span it across lanes, review it, or open
  a decision from it until the cell exists. So the renderer is the one hard prerequisite the five downstream
  slices share. To make them **disjoint by file, not just by mechanism**, each lands in its own named module
  under `plateau-app:src/backlog-view/`: `plateau-app:src/backlog-view/conveyor.ts` (#xc3ofgt),
  `plateau-app:src/backlog-view/lease-zone.ts` (#xzsx09z),
  `plateau-app:src/backlog-view/cross-lane-spans.ts` (#x2kpohd),
  `plateau-app:src/backlog-view/operator-actions.ts` (#xuff4b8), and
  `plateau-app:src/backlog-view/write-affordances.ts` (#xprj9ov) — so they layer onto the delivered
  `plateau-app:src/backlog-view/lane-board.ts` shell without editing the same file (the composer mounts into
  the shell's dock slot rather than editing the shell). Two of the five are **not** free-parallel, though:
  #xzsx09z `blockedBy` #xc3ofgt (its zones are bands along the conveyor's vertical axis — a real ordering,
  same axis, one owner), and #xuff4b8 additionally `blockedBy` the still-open #2522. So the genuinely
  parallel-once-the-renderer-lands set is **#xc3ofgt · #x2kpohd · #xprj9ov**; #xzsx09z follows #xc3ofgt and
  #xuff4b8 waits on #2522.
- **Geometry, lease-zone, and spans are three distinct visual mechanisms**, not one. The delivery-horizon is
  *time-as-vertical-position*; the lease zone is *within-lane stacking + conflict state*; spans/leverage is
  *cross-lane wiring + the ⚡ graph*. Each cites different design-record sections (§3i-v28 / §6d-2 / §6d-1+4)
  and different graduated mints (#2534–36 / #2560 / #2537), and each ships a demoable board on its own. A
  single "board visuals" slice would have been a 13+ grab-bag.
- **Operator actions split by direction of the write.** The review/queue slice acts on *existing* cells
  (drag a ready item, review a finished build) — the read-and-act family. The write-affordances slice
  *creates or decides* (open a decision, file new work, promote a spec candidate) — the capture family,
  all riding the lane→PR write seam. This is the same read-port / write-port seam the #2558 adapter already
  names, so each slice codes against one already-ratified contract.
- **Leverage uses the right field (design-record §6d-4).** The spans slice pins the ⚡ chip to
  `unblocksToReady` (frees-now) vs `transitiveUnblocks` (gates), teal per the ratified color grammar — not
  the inflating `directUnblocks`. Baked into the acceptance so the build can't regress it.

### Explicit size-8 exception on #xq8fvck (rubric condition 3)

The card renderer re-estimates to **`size` 8**, above the slice rubric's `size` ≤ 5 bar
(`we:docs/agent/backlog-workflow.md` condition 3) but **at** the batchable ceiling
(`we:docs/agent/backlog-workflow.md:148`). Deliberate, recorded exception:

- **The only natural cut fails the value-preserving-split test.** Splitting "render 18 states" from "render
  the other 19" leaves neither half a demoable deliverable — a board that renders an arbitrary subset of the
  taxonomy is not independently valuable, and the conformance metric (N-of-37 green) only reads honestly when
  the renderer is whole. That violates rubric conditions 4 (real independence) and 5 (each slice leaves a
  valid state), so the "split" would trade one honest size-8 for two lesser ones.
- **The grammar is ruled and being ported.** The read-model (#2552) is already in code; the glyph/motion
  manifest (#2578) is filed and a `blockedBy` prerequisite (§6e is ruled, the port into the spec is pending),
  so this slice is the *renderer*, not the grammar — the 8 is rendering-mechanics breadth (37 ×
  glyph/color/motion/disclosure), not hidden design work.
- **8 is the ceiling, not the should-split band** (reserved for `> 8` / `13`), so it stays agent-ready and
  batchable. The other six slices sit at ≤ 5 unchanged.

## What was deliberately NOT split

- **The scope-lease + conflict-policy engine ([#2560]) was left as its own child epic**, not folded into the
  board slices. The board *renders* lease/breach/overlap state (via the #2552 read-model); the engine that
  *computes* leases, detects breaches, and applies the configurable policies is a distinct backend concern
  built on `we:scripts/lane-lease.mjs`. #xzsx09z soft-consumes it through the read-model rather than
  hard-`blockedBy`-ing the engine epic, so the zone can be built + demoed from the read-model + fixtures
  before the live engine wiring lands.
- **The ruling / ratify surface ([#2565]) was not absorbed.** #xprj9ov only carries the *open-decision-from-
  a-lane* affordance; the full-page fork-card ratify UI (with its own read/write/govern slices #2580/#2581/
  #2582) stays [#2565]'s. The board opens it, never embeds or ratifies inline (the §3g-T2 biased-frame rule).
- **Four epic sub-bullets are kept as future children, not sliced now** — to hold this pass to the "build the
  board" core (aim 4–7 slices) and because each is a genuinely separable, later concern:
  1. **Glossary + attention + accessibility + concurrency** — dismissible glossary, keyboard-first traversal,
     ARIA / `aria-live`, two-operator presence (gated on the presence fork in [#2554]). Cross-cutting
     hardening that rides *on top of* a rendered board.
  2. **Failure-axis live detectors + chips-not-states** — the family-E *cards* are rendered by #xq8fvck; the
     live *detectors* (stalled/orphaned/desynced/drain-halted/merged-but-wrong) and their backends are
     [#2551]/[#2562], a separate wiring job.
  3. **Cross-program L0 constellation + needs-you inbox** — attention aggregated UP across programs (T3); a
     zoom-level above the single-program board, not part of building the board itself.
  4. **Empty / first-run / degenerate states + error copy** — degenerate zoom, min-sample history, first-run
     empty program, the "every error names its reason + fix" constitution invariant.
  Each becomes a `scaffold … --parent=2555` child when scheduled.
- **The open question in the epic body was NOT resolved here** (the tester/loop-return edge + filer/shape
  actions — in this console's scope or a separate surface?). It is a design call to *rule before building*
  those slices, not a slicing decision; it stays flagged on the epic.

## Locus notes

Every slice is plateau-app view code under `plateau-app:src/backlog-view/`, coding only against the #2558
read/write ports (the R2 boundary — no bare CLI / disk / `gh` from a rendering path). The cited sources are
WE-/plateau-side: the design record `plateau-app:docs/backlog-console-design.md`, the taxonomy spec
`plateau-app:src/backlog-view/card-taxonomy.webcases.ts`, the read-model
`plateau-app:src/backlog-view/card-state-read-model.ts`, and the leverage numbers from
[we:src/_data/backlog.js](src/_data/backlog.js). Write actions run the sanctioned
[we:scripts/backlog.mjs](scripts/backlog.mjs) behind the write port.

## Not done here (per task)

No settle / resolve / commit. The seven children are **born-active** (owned by `slice-2555`); publish each
with `node` [we:scripts/backlog.mjs](scripts/backlog.mjs) `settle <id>` once accepted.
