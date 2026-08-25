---
bornAs: xl7gdim
kind: epic
parent: "3029"
status: open
dateOpened: "2026-08-25"
preparedDate: "2026-08-25"
tags: [operations, epic-3029, census, parallelism, scope]
scope:
  - we:backlog/3273-the-operation-surface-still-uncovered-measured-a-census-not.md
  - we:scripts/check-standards-rules.mjs
  - we:scripts/__tests__/check-standards-rules.test.mjs
---

# The operation surface still uncovered, measured — a census, not a guess

Fifteen operations are declared and the raw call sites they were meant to replace are still the majority. Measured on main after the scaffold/resolve rewire landed: we:scripts/lane-pool.mjs 35 sites, we:scripts/backlog.mjs 30, we:scripts/progress-board.mjs 27, we:scripts/merge-ai-prs.mjs 11, we:scripts/lane-resume.mjs 9, we:scripts/conveyor/learnings-drop.mjs 7, we:scripts/gap-sweep-status.mjs 5, we:scripts/lane-stack.mjs 4. Twelve backlog verbs have no operation at all — reserve, unreserve, prepare-stamp, calibrate, release, prepare-release, prepare-hold, cost, yield, settle, retype, build-queue — and progress-board and merge-ai-prs have none for any verb. This card is the census so the remaining surface is a known list rather than something each sweep rediscovers; each operation is its own build.

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

## HOW to slice it — by disjoint scope, so the slices build in parallel

Added 2026-08-25, because *when* to slice was written down and *how* was not — and the wrong split makes
fifteen items that cannot run beside each other.

**A new operation is naturally parallel-safe.** Its declaration, its io module and its tests are new files
nobody else names. Two such slices collide only on the registry line in `we:scripts/operations/run.mjs`,
which is a **false collision**: same file, different line, no semantic overlap. That is precisely the shape
`#2678`'s small-file preference calls a throughput lock point — *"many items serialize on this one file even
with zero real overlap between them."* So: **one operation per slice, and do not merge two just because
both touch the registry.**

**A slice that edits an existing hot file is the opposite** and must be sized against real contention.
Measured on `main` today, the files most named across queued items' `scope:`:

| file | code lines | queued items naming it |
|---|---|---|
| `we:scripts/merge-ai-prs.mjs` | 2938 | **34** |
| `we:scripts/__tests__/merge-ai-prs.test.mjs` | 3065 | 28 |
| `we:scripts/lib/review-escalation.mjs` | 1774 | 24 |
| `we:scripts/check-standards.mjs` | 1495 | 16 |
| `we:scripts/check-standards-rules.mjs` | 2393 | 14 |

Anything in this census that would edit one of those is **not** parallel with the other thirteen items
already queued against it, whatever its own scope says. Two consequences, and they are the actual slicing
rule:

1. **Prefer slices that add files over slices that edit hot ones.** An operation that wraps a verb by
   shelling its existing script adds files and touches the script barely; one that restructures the script
   serializes behind everything else queued on it.
2. **Where a hot file must be edited, that is a signal to split the FILE first** — the remedy `#2678` names
   — rather than to accept a queue of items that cannot run beside each other.
   `we:scripts/merge-ai-prs.mjs` at 2938 lines and 34 claimants is the clearest instance in the repo.

**Order slices by the contention they inherit, not by their own size.** A size-2 slice against
`we:scripts/merge-ai-prs.mjs` costs more wall-clock than a size-5 slice against three new files, because
the first waits and the second does not.

## Done when

1. **Observable** — every script and verb in the tables above is either a declared operation, or carries
   a one-line reason on this card for why it should stay raw (an internal helper, a front door that
   already delegates, a verb with no meaningful `input`/`effect` split).
2. **Executable** — a check derives this census rather than trusting the table: it recomputes the raw
   call sites and fails when a script listed here as uncovered has since gained an operation, so the card
   cannot silently rot. It must RED against a deliberately stale table.
