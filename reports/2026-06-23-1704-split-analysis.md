# Backlog split analysis — 2026-06-23 (focused: #1704)

Focus: `/slice 1704` — the unsliced epic **"Mint the core semantic layout-role intents (1 per role)"**,
seeded by the ratified taxonomy decision #1680. Epic ⇒ the should-we-decompose question (rubric 1) is
already settled at the parent; each proposed slice is verified against the real tree below.

## Work-investigation pass (the real surface)

- **One intent = one self-contained JSON** under `we:src/_data/intents/<id>.json`. The loader
  (`we:src/_data/intents.js` → `we:scripts/lib/intents-loader.cjs`) **globs the directory** into the
  `intents` array — *no index/registry edit*, and its own header note guarantees "two parallel-batch lanes
  editing different intents never collide." Shape (per the existing `resizable`/`arrangeable` intents):
  `id`, `name`, `requiresCapabilities`, `status: concept`, `summary`, `dimensions{}` (each an axis with
  described values + most-permissive default), and a rich HTML `description` (incl. any fixed a11y invariant).
- **All 12 role ids are unminted** — `stack, cluster, grid, box, center, sidebar, frame, reel, imposter,
  cover, switcher, masonry` all absent from `we:src/_data/intents/`.
- **Catalog auto-renders** — a new intent JSON lights up `/intents/<id>/` with no page/nav edit
  (catalogs-auto-render). ⇒ every slice lands a **valid demoable leaf**.
- **No candidate-role collision.** `modal` (dialog dismissal/stacking) and `anchor` (tethered
  tooltips/popovers) are *behavior* intents on a different axis from layout *arrangement*; `imposter`
  ("center a child over a positioning context") is the arrangement, with dialog semantics as an optional
  annotation — exactly the Fork-1a split (#1680). No existing intent mentions masonry/reel/switcher/imposter.
- **Scope = the WE intent only.** Per-role *FUI block impls* are explicitly downstream ("impls follow
  under the epic") and live in another repo — **out of scope** for these intent-minting slices.

## Could split — #1704 → 12 per-role intent-mint slices

Each slice = author one intent JSON under `we:src/_data/intents/` to the established pattern (summary +
dimensions + HTML description; identity = the composition-intent from #1680's role table; CSS mechanism
cited as *FUI impl guidance, not identity*; landmark as optional annotation). All `task`, `size 2`, **no
DAG edges** (independent globbed files) ⇒ fully batchable, any order.

| Slice | Role (intent) | Composition-intent (identity) | Tier | size |
|---|---|---|---|---|
| 1 | **stack** | even-spaced vertical flow of siblings | core | 2 |
| 2 | **cluster** | wrap-group of peers (tags, action rows) | core | 2 |
| 3 | **grid** | uniform responsive cells, fit-to-container | core | 2 |
| 4 | **box / container** | padded, max-measure container | core | 2 |
| 5 | **center** | center a child + constrain measure | core | 2 |
| 6 | **sidebar / split** | fixed + fluid columns, collapses when narrow | core | 2 |
| 7 | **frame** | crop media to a fixed aspect ratio | core | 2 |
| 8 | **reel** | horizontally scrolling overflow strip | candidate | 2 |
| 9 | **imposter** | center a child over a positioning context | candidate | 2 |
| 10 | **cover** | full-height focal child between optional header/footer | candidate | 2 |
| 11 | **switcher** | flip H↔V at a content threshold (no breakpoint) | candidate | 2 |
| 12 | **masonry** | shortest-column packing | candidate | 2 |

**DAG:** none — 12 leaf slices under epic #1704, zero inter-slice edges.

**Core vs candidate (not a fork, an authoring note).** Slices 1–7 are the #1680-ratified core. Slices
8–12 are candidate-tier: each carries a one-line first step — *confirm it earns role status via the
role-vs-variant-vs-annotation test* — but this is **already answered** by #1680 (each arrangement is named
distinct; masonry's distinctness from grid is the decision's own load-bearing example). So no slice buries
a fork; the note is a quick authoring checkpoint, not a blocking decision.

### Rubric check (all five hold for every slice)
1. **Volume not fork** — settled at the epic; each role is a distinct named arrangement, no buried call.
2. **≥2 nameable slices, real home** — 12, each its own intent JSON under `we:src/_data/intents/`.
3. **size ≤3 / task** — each is one JSON to a proven pattern ⇒ `task`, `size 2`.
4. **Clean DAG / real independence** — globbed files, conflict-free; any order, fully parallel.
5. **Valid demoable state** — each lights up `/intents/<id>/` standalone.

## Could not split

None. (FUI block impls are deliberately out of this epic's scope, not an un-splittable residual — they
form a future FUI-side epic once the intents exist.)

## Net

Proposed: **+12 task slices** under epic #1704 (no conversion needed — already an epic). On approval,
scaffold and the set is immediately batchable via `/batch`.
