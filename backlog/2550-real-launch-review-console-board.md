---
kind: epic
parent: "2505"
status: open
blockedBy: ["2548"]
tags: [plateau-loop, console, console-board, epic, port-mock]
dateOpened: "2026-07-18"
---

# Real launch-review console board — port the v68 mock to product

The launch-review console board — the human intervention surface of the Plateau Loop — exists today only as a
converged mock (v68, 31 review rounds) and a design doc. This epic builds it for real in plateau-app, against
the ratified grammar + the taxonomy spec ([#2548]) + the visual/scale forks ([#2544]/[#2546]). Serves G1
(review/prioritize/launch/steer/review at scale), G3 (parallel lanes), G4 (attention-first + time-as-geometry
+ leverage). Started: plateau-app #69 dogfoods `we-section-card` as the base cell.

Sub-slices (split into stories as scheduled; two are already split out as children):
- **Board shell + lane windowing** — lanes = agent slots, sticky headers, collapse-to-strips + paginate, NO
  horizontal scroll, resize-aware (cite the `windowed-collection` dimension from #2523).
- **Card-state rendering + board-parity** — render each of the 37 states; flip its webcase `rendered=pending→yes`
  as it lands. Consumes [#2552] (read-model) and [#2548] (spec).
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
  presence/lock (gated on the presence fork in [#2544]); simulate = frozen-snapshot mode.
- **Failure-axis detectors + chips-not-states** — see [#2554]/[#2553] for backends; on-board: stalled,
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

## Acceptance
The real board renders the ratified states, runs the operator actions on the lane→PR + drain seams, and the
taxonomy conformance ([#2548]) reports N-of-37 states green. Children: [#2551] scope-lease engine, [#2552]
read-model.
