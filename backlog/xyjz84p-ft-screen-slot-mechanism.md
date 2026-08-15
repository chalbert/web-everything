---
kind: decision
status: open
dateOpened: "2026-08-15"
relatedTo: ["2705", "2721", "2723", "2725", "2726", "2727", "2728", "2729", "2731", "2732"]
tags: []
---

# FT screen: name the cross-slice "slot" + delegated-jump mechanism at LEAST three producer files assume

**Widened during independent review (2026-08-15) — the first draft undercounted this.** It named only two
producer/consumer pairs; the real count across epic #2705 is at least three producer files and nine
registering consumers:

- **#2721 (S1b, the mount file)** pre-builds "the header banner slot" for **#2723** (S8, the bottleneck
  banner).
- **#2725 (S2, the detail shell)** pre-builds "the dependencies-tab content slot" for **#2729** (S7, the
  one-hop dependency DAG — its own text: "registers into S2's dep-tab slot — does NOT edit the detail
  shell"), AND separately pre-builds "a data-driven section registry" that **#2727** (S3, velocity),
  **#2732** (S4, burn-up), and **#2726** (S5, rollup) each independently "register into."
- **#2726 (S5, the rollup)**, once built, itself becomes a THIRD producer: **#2731** (S6a, ship-log markers)
  "registers via rollup's marker slot," and **#2728** (S6b, filmstrip markers) is `blockedBy` #2726 with
  near-identical deliverable shape to #2731 though its own card text does not use the word "registers."

No producer card (#2721, #2725, #2726) names a mechanism, and none of the nine consumer cards originally did
either.

Surfaced while preparing #2723 to build-ready (2026-08-15): a real ES import cannot point at a file that does
not exist yet, and the producer in each pair (S1b, S2) necessarily ships and lands BEFORE its consumer (S8,
S7-dag) — `blockedBy` orders it that way. So "the slot" cannot be a static import in the producer's own file
at the time the producer is built.

#2723's own preparation resolved this FOR ITSELF two ways, both grounded in existing code (not invented):

1. **Corrected its own `scope:`** to include a small additive touch to the mount file (S1b's own file) —
   one import plus one call in the render pass the mount file already owns — rather than inventing a
   zero-touch auto-discovery scheme. This is safe because the ordering guarantee (`blockedBy`) already rules
   out a concurrent-edit conflict: by the time S8 is built, S1b is already merged.
2. **Grounded the render-function shape and the click-delegation shape in a real precedent already in this
   codebase**: `renderInfraBanner(lanes): string` (`plateau-app:src/backlog-view/lane-board.ts:305`) — a pure
   function returning `''` when nothing to show, interpolated inline by its caller's own template
   (`plateau-app:src/backlog-view/lane-board.ts:1459`) — and one delegated click listener elsewhere in the
   same file resolving `data-cause`/`data-id` via `.closest()` (`plateau-app:src/backlog-view/lane-board.ts:1651`)
   rather than a bespoke per-button listener.

## Why this needs a decision, not just #2723's private choice

#2723's fix is scoped to its own banner module and the mount file only. #2729 hits the exact same shape of
problem against #2725's detail shell — and so do #2727/#2732/#2726 (against #2725's section registry) and
#2731/#2728 (against #2726's rollup marker slot), once each is prepared. None of #2725, #2726, #2727, #2728,
#2729, #2731, or #2732 has been prepared yet. If they are each prepared independently without reference to
#2723's resolution, they may invent DIFFERENT mechanisms across up to three producer files (a real
slot-registry object, or `import.meta.glob`-based auto-discovery — both plausible, both already used
elsewhere in this codebase for OTHER purposes, e.g. `plateau-app:src/component-assembler/authoring.ts:20`) —
which would mean the feature-tracking screen ships several incompatible "registration" conventions across its
nine registering slices, undiscovered until integration. This is the mirror image of the #2803/#2351 lesson
in the story-preparation checklist: an unnamed cross-card architectural assumption that independently built
slices could each resolve differently — now confirmed to span a larger surface than the first draft of this
item accounted for.

## Options

1. **Ratify #2723's resolution as the epic-wide convention, for all three producer files.** Producer
   pre-builds an empty, well-known container (or, for #2725's section registry specifically, one container
   per registering slice's named section) in its own template; consumer exports a pure `render<X>(state):
   string`; producer's existing render pass gains ONE additive call per consumer at land time;
   cross-navigation goes through `data-jump-to`/`data-jump-tab` (or an equivalent pair) plus one delegated
   listener per producer file, never a bespoke per-slot listener. Cheapest, already precedented twice over in
   this codebase, no new abstraction to build. Requires #2721's, #2725's, and #2726's OWN (not-yet-written)
   preparation to explicitly plan the small producer-side follow-up edit per consumer, rather than assuming
   their file is frozen the moment it lands.
2. **Build a real, generic slot-registry module** (e.g. a small `plateau-app:src/feature-tracker/` helper
   using `import.meta.glob`-based auto-discovery) so producer files truly never need a follow-up edit once
   they ship. More machinery, but now a STRONGER case than the first draft's "only two pairs" — #2725 alone
   has four registering consumers (#2726, #2727, #2729, #2732) and #2726 has at least one more (#2731,
   probably #2728) — a real registry amortises better across nine consumers than it did across two. Still, no
   card currently scopes building it.
3. **Leave it to each slice's own preparation to decide independently.** Cheapest right now, highest risk of
   exactly the divergence this item exists to prevent, now on a wider surface.

## Recommendation

Option 1 for the header-banner and dep-tab-slot pairs (#2721↔#2723, #2725↔#2729) — reuse the proven pattern,
low consumer count. **Revisit option 2 specifically for #2725's section registry** (four consumers) and
#2726's marker slot (two consumers) when THOSE producers are next prepared: four-plus additive edits to one
file across separately-landing PRs is a real repeated-small-conflict-surface cost that a genuine
`import.meta.glob`-based registry would remove entirely, unlike the two-consumer pairs where the extra
machinery isn't yet worth it. Whichever way each producer's own preparation rules, name it explicitly there
and cite this item, so #2723's two-consumer default isn't assumed to generalize silently to the four-and-more
cases.
