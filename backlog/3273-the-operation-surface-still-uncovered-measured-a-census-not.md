---
bornAs: xl7gdim
kind: epic
parent: "3029"
status: open
dateOpened: "2026-08-25"
tags: []
---

# The operation surface still uncovered, measured — a census, not a guess

Fifteen operations are declared and the raw call sites they were meant to replace are still the majority. Measured on main after the scaffold/resolve rewire landed: we:scripts/lane-pool.mjs 35 sites, we:scripts/backlog.mjs 30, we:scripts/progress-board.mjs 27, we:scripts/merge-ai-prs.mjs 11, we:scripts/lane-resume.mjs 9, we:scripts/conveyor/learnings-drop.mjs 7, we:scripts/gap-sweep-status.mjs 5, we:scripts/lane-stack.mjs 4. Twelve backlog verbs have no operation at all — reserve, unreserve, prepare-stamp, calibrate, release, prepare-release, prepare-hold, cost, yield, settle, retype, build-queue — and progress-board and merge-ai-prs have none for any verb. This card is the census so the remaining surface is a known list rather than something each sweep rediscovers; each operation is its own build.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

## The census

Measured on `main` after #1542's `scaffold`/`resolve` rewire landed. Counts are documented call sites
across `we:skills-src/`, `we:docs/`, `we:.claude/` and `we:AGENTS.md` — the places an agent is *told* to
run something.

### By script

| script | raw sites | operation exists? |
|---|---|---|
| `we:scripts/lane-pool.mjs` | 35 | `dispatch-lane` — covers dispatch, not the pool verbs listed below |
| `we:scripts/backlog.mjs` | 30 | `claim`, `scaffold`, `resolve` only |
| `we:scripts/progress-board.mjs` | 27 | **none** |
| `we:scripts/merge-ai-prs.mjs` | 11 | **none** |
| `we:scripts/lane-resume.mjs` | 9 | **none** |
| `we:scripts/conveyor/learnings-drop.mjs` | 7 | **none** |
| `we:scripts/gap-sweep-status.mjs` | 5 | **none** |
| `we:scripts/lane-stack.mjs` | 4 | **none** |

### The twelve uncovered `we:scripts/backlog.mjs` verbs

`reserve` · `unreserve` · `prepare-stamp` · `calibrate` · `release` · `prepare-release` ·
`prepare-hold` · `cost` · `yield` · `settle` · `retype` · `build-queue`

### The five `we:scripts/lane-pool.mjs` verbs

`acquire` (13) · `status` (9) · `release` (7) · `provision` (3) · `adopt` (1)

## Two things the census settles, so a future sweep does not re-derive them

**`claim` is NOT uncovered.** Its 4 remaining raw sites are the operation's *sanctioned front door* —
`we:scripts/backlog.mjs` routes the verb to the declared operation via `claimViaOperation`. Rewiring
them to `we:scripts/operations/run.mjs claim --ref=` would drop the `--stop-for-rename` behaviour and gain nothing. Filed
separately as `3269`; repeated here because a raw-site count is exactly what would tempt the next
sweep to "fix" it.

**A count is not a coverage number.** These are the sites a doc *tells an agent to run*. A script whose
verbs are internal, or invoked by other scripts rather than by prose, is under-counted here — and a
verb documented five times is over-weighted against one documented once but run constantly. Treat the
table as the surface to work through, not as a metric to optimise.

## Not one build

Each operation is its own item with its own declaration, io module, tests and — since #2949 landed the
fidelity qualifier — at least one criterion exercising the real mechanism. This card exists so the
remaining surface is a **known list** rather than something each sweep rediscovers by grepping. Slice it
when a batch is actually going to be worked; do not pre-slice fifteen cards nobody has picked up.

## Done when

1. **Observable** — every script and verb in the tables above is either a declared operation, or carries
   a one-line reason on this card for why it should stay raw (an internal helper, a front door that
   already delegates, a verb with no meaningful `input`/`effect` split).
2. **Executable** — a check derives this census rather than trusting the table: it recomputes the raw
   call sites and fails when a script listed here as uncovered has since gained an operation, so the card
   cannot silently rot. It must RED against a deliberately stale table.
