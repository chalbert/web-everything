# Slicing proposal — #2565 console decision-ratify surface

**Date:** 2026-07-20 · **Session:** slice-2565 · **Parent epic:** [#2565]

> This is the slicing rationale for [#2565] (the "SLICE-2565 proposal"). It lives in `reports/` — not
> `backlog/` — because any `.md` under `backlog/` is parsed as a backlog *item* and hard-errors the standards
> gate if it lacks an `NNN-` id prefix. [#2565] references this file via `relatedReport`, so it is exposed on
> the board, not a hidden doc.

## What #2565 was
A size-8 **candidate** story (design-record §3g-T2), captured from a working ruling-console mock built to rule
four console decisions. It held "strong bones" (the fork card, the product color-grammar, the summary strip,
both-theme shell) plus a list of **gaps to build** that turn the static explainer into a real *rule
interface*. It was explicitly flagged "refine/split before build — do NOT build unshaped." This proposal does
that shaping.

## What changed on #2565
Converted `kind: story` (size 8) → **`kind: epic`, no size** (a sliced epic carries no points; its children
carry them). Title lost the "(candidate)" qualifier; a "## Sliced into" section now lists the three children;
tags swapped `candidate` → `sliced`. The seed / strong-bones / gaps record stays intact as the epic's
umbrella body, and the tracked mock remains the cited UI-design input.

## The three slices
The five "gaps to build" fold into three independently-deliverable stories along a **read → write → govern**
spine:

| Slice | Size | Realizes | blockedBy |
|---|---|---|---|
| [#xntcdet] Render the ruling surface from the live read port | 8 | live data (read port) · read-port decision-fork projection · evidence deep-links | — (self-contained: projects the fork shape onto the read port itself; #2554, #2558 resolved → ready now) |
| [#xcg9jr9] Rule a fork through the write port with first-class override | 5 | the ruling action (write port) · override capture | #2558, #xntcdet |
| [#xzlknku] Governance guardrails (§3g-T2) | 3 | governance guardrails | #xcg9jr9 |

Total = 16 points across three stories (up from the seed's single 8 — slicing surfaced the write-path and
governance work the seed had bundled, and the read slice owns projecting the decision-fork shape onto the read
port, which no other item builds). Each slice is a distinct, valuable deliverable: the read slice makes
the surface *live and honest* on its own; the write slice makes it *rule*; the governance slice makes ruling
*safe*.

### Explicit size-8 exception on #xntcdet (rubric condition 3)

The read slice [#xntcdet] re-estimates to **`size` 8**, above the slice rubric's **`size` ≤ 5** bar
(`we:docs/agent/backlog-workflow.md:728`, condition 3). This is a **deliberate, recorded exception**, not an
oversight — kept because splitting it further would *cost* value, the exact failure the rubric's conservative
instinct guards against:

- **The only natural cut fails the value-preserving-split test.** #xntcdet's two halves are a **server-side
  fork projection** (parse the decision markdown → `DecisionForkDTO` + a fork-scoped read endpoint in the
  `we-backlog` adapter, ~4-5) and a **view render** (fork cards, evidence deep-links, both-theme token shell,
  responsive panes, ~4-5). Cutting there leaves the projection slice shipping **no visible value** (a DTO no
  surface consumes) and the render slice **unable to ship without it** (nothing to render) — a rigid linear
  chain with a value-less backend half. That violates rubric conditions 4 (real independence / incremental
  delivery) and 5 (every slice leaves a valid, demoable state), so the "split" would trade one honest size-8
  deliverable for two lesser ones. Per the skill's own instinct ("when a clean seam isn't obvious, don't
  split"), it stays whole.
- **8 is the batchable ceiling, not the should-split band.** The sizing guide
  (`we:docs/agent/backlog-workflow.md:148`) puts `8` at the **large / batchable ceiling** and reserves the
  **split candidate** band for `size` > 8 (`13`). #xntcdet at 8 is therefore still agent-ready and batchable —
  it is *at* the ceiling, not over it — even though it exceeds the tighter ≤5 slice-output bar.
- **Net for this epic:** condition 3's ≤5 preference is read as the ≤8 batchable ceiling for #xntcdet, and the
  exception is logged here so the size-8 read slice is *analyzed-and-accepted*, not an un-caught rubric breach.
  The sibling slices [#xcg9jr9] (5) and [#xzlknku] (3) sit within ≤5 unchanged.

## Why this cut (and not another)
- **Read / write / govern is the natural seam.** The `#2558` adapter decision already names a **read port**
  (`/api/backlog/*` DTOs) and a separate **write port** (`POST /api/backlog/write`, lane→PR). Slicing along
  those two ports gives each slice a single, already-ratified contract to code against, and the R2 boundary
  (views never touch a bare CLI/disk/`gh` source) is testable per slice.
- **Deep-links fold into the read slice**, not their own item — but they *do* carry a build surface: the
  four evidence links are projected onto the read-port decision-fork DTO alongside the fork narrative (a
  server-side parse of the decision markdown), then attached while rendering. No value shipped alone, so they
  ride the read slice rather than a card of their own.
- **Override capture folds into the write slice** — the override path *is* part of recording a verdict (it is
  the branch of the ruling control that writes the operator's alternative into `--codified-to`). Splitting it
  out would leave an accept/reject stub with no way to record a real human call.
- **Governance is its own slice** — it is a distinct gate (opens-not-ratifies, statute→policy-menu, scoped
  waivers) that wraps the write path rather than living inside it, and it can be built and reviewed on its own
  once the write path exists.

## The DAG
`#xntcdet` (read) is the foundation → `#xcg9jr9` (write) attaches the ruling control to its live fork cards →
`#xzlknku` (govern) fences that write path. Cross-item prerequisites (`#2554` grammar, `#2558` ports) are both
already **resolved**, so `#xntcdet` is ready to build now; the other two unblock in sequence as their siblings
land.

## What was deliberately NOT split
- **#2565 was not folded into [#2555]'s Operator-actions** (an option the seed's acceptance floated). It stays
  a dedicated full-page sibling: the ruling surface is a distinct, full-page channel, not a modal action on
  the board. `#2555`'s Operator-actions still carries the *open-from-a-lane* affordance; `#2565` is what that
  affordance opens *into*.
- **Deep-links and override were not given their own cards** — see "Why this cut" above (no standalone value;
  they are facets of the read / write slices).
- **No slice re-litigates the `#2558` seam** — the read/write port *contracts* and the
  `@webeverything/contracts/backlog` mint are `#2558`'s own spin-offs; these slices don't change the ratified
  seam form or transport. The one read-side addition: `#xntcdet` projects a new decision-fork DTO onto the
  read port (a server-side parse of the decision markdown), because `#2558`'s DTO carries only core fields +
  a rendered `detailHtml` blob and `#2561` fixes the *item requirement* spec — neither is the decision-fork
  narrative, and no other item emits it. That projection is a consumer-driven read-port extension inside the
  `we-backlog` adapter, not a change to the seam's shape or the write path.
- **No new statute anchor is minted.** The governance slice *reads* the existing `codifiedIn`/`one-off`
  signal; it does not legislate new turf.

## Locus notes
The surface is plateau-app view code (`plateau-app:src/backlog-view/`), coding only against the `#2558` ports.
Contract/types are WE-side ([we:src/_data/backlog.js](src/_data/backlog.js) → `@webeverything/contracts/backlog`
once minted). The decision-resolve verb runs in the lane's own [we:scripts/backlog.mjs](scripts/backlog.mjs).

## Not done here (per task)
No settle / resolve / commit. The three children are **born-active** (owned by `slice-2565`); publish each with
`node` [we:scripts/backlog.mjs](scripts/backlog.mjs) `settle <id>` once accepted.
