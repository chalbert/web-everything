---
bornAs: xq8fvck
kind: story
size: 8
parent: "2555"
status: resolved
scaffoldedBy: "slice-2555"
dateScaffolded: "2026-07-20"
dateOpened: "2026-07-20"
blockedBy: ["2578"]
dateResolved: "2026-07-20"
tags: [plateau-loop, console, console-board, card-renderer, taxonomy, glyph, slice-2555]
---

# Console card renderer — the 37-state taxonomy with per-state glyph and motion

The board's core cell: one renderer that takes an item's card-state (a UC-id) and draws the correct cell —
glyph, color-grammar fork, motion, and the L1/L2/L3 disclosure level. This is what makes the board show
"where each item is" honestly across all 37 ratified states (five families A/B/C/D/E). It renders every
state; the live detectors and cross-lane geometry ride other slices.

## Scope
- **State → cell, keyed to the maintained conformance spec.** For each of the 37 states, render the cell per
  the taxonomy spec ([#2553]). The glyph, color/style fork, and motion for a state are **cited by UC-id from
  the maintained spec** — `plateau-app:src/backlog-view/card-taxonomy.webcases.ts`. The design-record §6e
  visual-grammar manifest (per-state Lucide glyph + the 7 color/style forks + the you-act action-button
  glyphs + per-state motion) is **filed, not yet landed** — [#2578] is the port that adds the
  `glyph`/`color`/`motion` fields to that spec, and **2584 is `blockedBy` it**. Once [#2578] lands, **cite
  that file per state; do NOT re-port the manifest here** — it is the single source, and this renderer
  consumes it. (Today the `assert:` lines carry only `actor · edge · primary · rendered · uc`, so this slice
  cannot start until [#2578] populates them.)
- **Color grammar (design-record §6, ratified — one symbol, one meaning).** Action-fill = blue (fork A);
  amber LEFT EDGE is the one needs-you signal and appears only on `actor=you` states (fork B / F3);
  failure = red edge (fork G), distinct from needs-you; the failure family E shares the `xcircle` glyph and
  the action verb disambiguates. Green stays DELIVERED-only; leverage teal is the leverage slice's concern.
- **Motion.** Master on, `prefers-reduced-motion` respected, cadence = loop; only radially-symmetric glyphs
  spin; the per-state overrides (pulse/nudge/shake/breathe/draw) come from §6e — read them from the spec,
  don't re-derive.
- **Disclosure (design-record §6, "progress = crossing; 3 levels").** Every card × state has an L1 condensed
  / L2 standard (board default) / L3 expanded form; attention never compresses away. The running card's
  plan-todo (✓/⟳/○) + plan-progress bar is the L2/L3 treatment.
- **Board-parity flip.** As each state renders on the real board, flip its webcase `rendered=pending→yes` in
  `plateau-app:src/backlog-view/card-taxonomy.webcases.ts` and extend the conformance test so the taxonomy
  reports **N-of-37 states green** (the epic's acceptance metric).

## Where the code goes (locus)
- The cell renderer is plateau-app view code under `plateau-app:src/backlog-view/`, rendering into the shell
  from [#2583] — **already delivered** as `plateau-app:src/backlog-view/lane-board.ts`, so its `blockedBy`
  edge is dropped here (the shell exists in code; the edge would otherwise stay unclearable until 2583 is
  graduated, leaving this renderer and the whole fan-out under it inert). [#2583] is still owed a
  resolve-as-graduated — that is its own status splice, not a build gate on this slice. It reads state from
  the resolved read-model
  `plateau-app:src/backlog-view/card-state-read-model.ts` ([#2552], resolved — the
  `{lane, lease, drain, PR-label, progress} → UC-id` mapping) and the glyph/motion spec from
  `plateau-app:src/backlog-view/card-taxonomy.webcases.ts` ([#2553]; the glyph/color/motion fields land via
  [#2578], a `blockedBy` prerequisite — filed, not yet in the file).
- Glyphs are the inline SVG Lucide stroke sprite + `ic()` helper the mock already carries (design-record §6
  icon ruling); pull real Lucide at port time rather than hand-maintaining.
- The view codes only against the read-model / read port (the [#2558] R2 boundary) — no bare CLI/disk/`gh`
  from a rendering path.

## Size note (recorded size-8 exception)
`size: 8` sits above the slice rubric's `size` ≤ 5 preference
([we:docs/agent/backlog-workflow.md](docs/agent/backlog-workflow.md) condition 3) but **at** the `size` ≤ 8
batchable ceiling. Held deliberately: the only natural cut is "render half the 37 states," which leaves both
halves without independent value (a board that renders an arbitrary subset is not a demoable deliverable) —
the value-preserving-split failure the rubric guards against. The read-model ([#2552]) is already landed; the
glyph spec ([#2578]) is filed and is a `blockedBy` prerequisite, not yet landed — once it lands, the work
here is the renderer itself, not the grammar. Full rationale in the slicing report.

## Acceptance
- The renderer draws all **37** card-states into the shell with the correct per-state glyph, color-grammar
  fork, and motion, each **cited by UC-id** from `plateau-app:src/backlog-view/card-taxonomy.webcases.ts`
  (no re-ported manifest; editing a state's glyph in that spec changes the rendered cell).
- The attention invariant holds by construction: only `actor=you` states carry the amber left edge + exactly
  one filled primary verb; failure states carry the red edge; running is a quiet run-state.
- Each rendered state's webcase flips `rendered=pending→yes` and the conformance test reports N-of-37 green.
- `prefers-reduced-motion` is respected; both themes render; `plateau-app`'s `npm test` + `we:`
  `check:standards` pass.
