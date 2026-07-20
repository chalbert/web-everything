---
bornAs: xaz4dcn
kind: epic
parent: "2505"
status: open
blockedBy: ["2553"]
tags: [plateau-loop, console, console-board, epic, port-mock, sliced, slice-2555]
dateOpened: "2026-07-18"
relatedReport: reports/2026-07-20-slice-2555-console-board.md
---

# Real launch-review console board — port the v68 mock to product

The launch-review console board — the human intervention surface of the Plateau Loop — exists today only as a
converged mock (v68, 31 review rounds) and a design doc. This epic builds it for real in plateau-app, against
the ratified grammar + the taxonomy spec ([#2553]) + the visual/scale forks ([#2554]/[#2557]). Serves G1
(review/prioritize/launch/steer/review at scale), G3 (parallel lanes), G4 (attention-first + time-as-geometry
+ leverage). Started: plateau-app #69 dogfoods `we-section-card` as the base cell.

Sub-slices (split into stories as scheduled; two are already split out as children):
- **Board shell + lane windowing** — lanes = agent slots, sticky headers, collapse-to-strips + paginate, NO
  horizontal scroll, resize-aware (cite the `windowed-collection` dimension from #2523).
- **Card-state rendering + board-parity** — render each of the 37 states; flip its webcase `rendered=pending→yes`
  as it lands. Consumes [#2552] (read-model) and [#2553] (spec).
- **Delivery-time visualization** — horizon/conveyor (cards rise by real progress, cross at delivery, gray
  past-mask, day-folded navigable history) + sized time-ruler (height=Σ, lane ETA, oversize→slice) + two-track
  progress unified with crossing (plan vs spec-proven). Consumes the graduated mints #2534 (scale-ruler),
  #2535 (progress secondary-track), #2536 (semantic-zoom), and the FUI blocks #2539/#2540/#2542.
- **Cross-lane spans + leverage graph** — waits-on-multiple-leases (span-only docking + ⌃ tacks, non-adjacent
  wire), forked sub-lanes + fan-in (incl. degraded); frees-now vs gates-chain (WE-graph semantics) + teal
  cascade. Consumes the swimlane mint #2537 / FUI #2543.
- **Operator actions** — drag-to-queue (fit check, overlap warn, drain-lane refusal — extends #2522), review
  modal over the board (spec-proven rows + evidence, diff [consume #2538/#2224], auto-review findings,
  on-merge effects; merge/bounce/take-over), decision surface (open from a lane, never ratify inline; scoped
  auto-expiring per-launch waiver), new-work composer (story/epic/decision via lane→PR) incl. the new-spec-
  candidate → constitution-promotion loop (accept a mid-build requirement → files a decision, never main).
- **Glossary + attention + accessibility + concurrency** — dismissible glossary + rare-term hints (✳ option);
  attention-first surfacing; keyboard-first (j/k traversal, Enter-primary, native `<dialog>` focus/Escape,
  ARIA + `aria-live` on the live-updating attention strip, focus retained across re-renders); two-operator
  presence/lock (gated on the presence fork in [#2554]); simulate = frozen-snapshot mode.
- **Failure-axis detectors + chips-not-states** — see [#2551]/[#2562] for backends; on-board: stalled,
  orphaned, desynced, drain-halted, merged-but-wrong; chips: bounced ×N + threshold, waiting-on-#X starvation
  + cycle warning, launching transient + lease-lost, held-Nh age, built-under-ruling provenance, feed-stale
  banner. Reuse the resolved stuck-lane classification (#2477).
- **Cross-program L0 constellation + needs-you inbox** — attention aggregates UP the zoom (T3): the needs-you
  inbox lives at L0 across programs, not only the single-program L1 board.
- **Empty / first-run / degenerate states + error copy** — degenerate zoom (launchable vs all-gated vs neither
  → disabled-with-reason), min-sample "too little history", first-run empty program, and the constitution
  invariant that every error names its reason + the fixing action.

OPEN QUESTION (design doc §3f-H): the **tester / loop-return edge** (shipped-awaiting-exercise strip,
launch-the-explorer, file-bug feeder) and the **filer/shape** actions (edit blockedBy/kind/size, slice from
the console) — in this console's scope, or a separate surface? Rule before building those slices.

## Sliced into
The board build was sliced into seven stories (slicing rationale:
[we:reports/2026-07-20-slice-2555-console-board.md](../reports/2026-07-20-slice-2555-console-board.md)),
on top of the two children that already existed — [#2552] board read-model (resolved) and [#2560]
scope-lease + conflict-policy engine. **One of the seven — the shell [#xo9wnlp] — has since been delivered**
(it already landed in `plateau-app:src/backlog-view/lane-board.ts`; see its banner), so it is not remaining
work: it is owed a resolve-as-graduated. That leaves **six independently-deliverable to-build slices** plus
the graduating shell. With the shell delivered, the effective root is `{ #2578 } → renderer → {horizon,
spans/leverage, write-affordances}` in parallel, then `horizon → lease-zone` (the zones lay bands along the
horizon's vertical axis) and `review-actions` additionally waits on the still-open [#2522]:

- **[#xo9wnlp] Board shell + lane windowing** (5) — **ALREADY DELIVERED, graduating** (landed in
  `plateau-app:src/backlog-view/lane-board.ts`, wired at `/console-board`; owed a resolve-as-graduated, not a
  build). The container: lane columns, sticky-header NOW line, collapse-to-strips + no-horizontal-scroll
  windowing, dock frames, data-driven renderer. `blockedBy`: —.
- **[#xq8fvck] Card renderer — the 37-state taxonomy with per-state glyph + motion** (8) — renders all 37
  states citing the glyph/motion by UC-id from `plateau-app:src/backlog-view/card-taxonomy.webcases.ts`
  (the §6e glyph/color/motion fields are ported by [#2578] — filed, not yet landed, a hard prerequisite);
  flips each webcase `rendered=pending→yes`. `blockedBy`: [#2578] (the shell [#xo9wnlp] is **delivered**, so
  its edge is dropped — not a build gate; xo9wnlp is still owed a resolve-as-graduated).
- **[#xc3ofgt] Delivery-horizon + size-scaled conveyor** (5) — cards rise by progress + cross at delivery,
  gray past-mask + day-folded history, `▤` size-scaled height=Σ mode + lane ETA. **Owns the lane column's
  vertical axis** (time-as-height), which [#xzsx09z] lays its zone bands along. `blockedBy`: [#xq8fvck].
- **[#xzsx09z] Scope-lease board zone** (5) — the four lane zones (running/ready/purgatory/next-sprint),
  lease chip + overlap/forced/breach cells + overtake affordance; soft-consumes [#2560]. Its **running** band
  *is* [#xc3ofgt]'s conveyor region and the other three bands sit below it on the same axis, so it builds on
  [#xc3ofgt]. `blockedBy`: [#xq8fvck], [#xc3ofgt].
- **[#x2kpohd] Cross-lane spans + leverage graph** (5) — waits-on-multiple-leases spans, forked/fan-in
  across-lanes overlay, `⚡` frees-now/gates chips + teal cascade. `blockedBy`: [#xq8fvck].
- **[#xuff4b8] Review + queue operator actions** (5) — drag-to-queue (extends [#2522]) + review modal over
  the board (merge/bounce/take-over). `blockedBy`: [#xq8fvck], [#2522] (**#2522 is still open** — this slice
  is not parallel-eligible with the others until it lands).
- **[#xprj9ov] Write affordances — open-decision-from-a-lane + new-work composer** (5) — open [#2565]'s
  ratify surface from a lane (never inline), composer via lane→PR, new-spec→constitution loop. `blockedBy`:
  [#xq8fvck].

Not split in this pass (kept as future children under this epic): the glossary/attention/accessibility/
concurrency hardening, the failure-axis live detectors + chips-not-states (backends [#2551]/[#2562]), the
cross-program L0 constellation + needs-you inbox, and the empty/first-run/degenerate-state copy. Rationale
in the report.

## Acceptance
The real board renders the ratified states, runs the operator actions on the lane→PR + drain seams, and the
taxonomy conformance ([#2553]) reports N-of-37 states green. Children: [#2560] scope-lease engine, [#2552]
read-model, plus the seven board slices above.
