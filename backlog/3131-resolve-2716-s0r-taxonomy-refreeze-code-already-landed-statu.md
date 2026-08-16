---
bornAs: xv8qb99
kind: story
size: 1
parent: "2705"
status: resolved
scope: ["we:backlog/2716-s0r-taxonomy-reconcile-spec-allow-list-refreeze-r1.md"]
dateOpened: "2026-08-15"
dateResolved: "2026-08-16"
graduatedTo: none
tags: []
---

# Resolve #2716 (S0r taxonomy refreeze) — code already landed, status stuck open, blocking #2717

Found while preparing #2693 (auto case-taxonomy → webcases): `we:backlog/2716-*.md` still reads `status: open`, but its code has already landed in `plateau-app:src/feature-tracker/feature-tracking.webcases.ts` (plateau-app PR #115, commit `da66083`, "WE #2716: FT taxonomy reconcile + SPEC allow-list refreeze R1 (plateau-app)"). The landed code satisfies #2716's own acceptance line: `SPEC_BEFORE_RENDER` freezes exactly the 44 codes named (S17, F13–15, M8/13/22/23/32/38, E2–16, L2–13, C1–3, R1–4), `RENDERED_COUNT` = 71, and `validateFtRegister()` enforces both the reconcile (every `yes` case maps to a real v3 surface) and the list-only-shrinks invariant.

The consequence is not cosmetic: `we:backlog/2717-*.md` (S0a — the FT webcases registry + conformance test) is `blockedBy: ["2716"]`, and `node we:scripts/check-readiness.mjs --select` requires every `blockedBy` entry to be `resolved` before an item counts as Tier A/B (`we:scripts/readiness/engine.mjs` — "isReady requires every blockedBy resolved"). With #2716 stuck `open`, #2717 sits in Tier C (blocked) even though its actual prerequisite is done. Verified 2026-08-15: `we:scripts/check-readiness.mjs --select --json` lists #2716 in `tierA` and does **not** list #2717 in either `tierA` or `tierB`.

## Decided approach

No design decision here — this is a verification + bookkeeping fix, not new code. Re-verify #2716's landed code against its acceptance line (already spot-checked above; re-confirm before flipping), then run the normal `resolve` mechanics: `node we:scripts/backlog.mjs resolve 2716 --graduated-to=plateau-app:src/feature-tracker/feature-tracking.webcases.ts` (adjust flag per current CLI surface — see `we:scripts/backlog.mjs resolve --help`).

## Tasks

1. Re-read `plateau-app:src/feature-tracker/feature-tracking.webcases.ts` at its current HEAD and re-verify each acceptance clause in `we:backlog/2716-*.md` still holds (no drift since 2026-08-15).
2. Confirm the plateau-app PR #115 / commit `da66083` is the one that satisfies it (not a coincidental later change).
3. `node we:scripts/backlog.mjs resolve 2716 --graduated-to=plateau-app:src/feature-tracker/feature-tracking.webcases.ts` in a lane clone; land via the standard PR flow.
4. Re-run `node we:scripts/check-readiness.mjs --select --json` and confirm #2717 now appears in `tierA` or `tierB`.

## Done when

- `we:backlog/2716-*.md` frontmatter reads `status: resolved` with `dateResolved` and `graduatedTo` set, landed via a ready-to-merge PR.
- `we:scripts/check-readiness.mjs --select --json` lists #2717 in `tierA` or `tierB` (no longer Tier C).
- `npm run check:standards` is 0 errors.

## Delivery shape

Single small doc-only change to `we:backlog/2716-*.md` frontmatter (plus this card's own resolve) — lands as one piece, no branch/flag needed.

## Resolved 2026-08-16 — superseded, #2716 already resolved independently

Closing as superseded, not as delivered work: a queue-generation scan flagged this card's ask ("flip #2716 to
resolved") as still open, but `we:backlog/2716-*.md` already reads `status: resolved` —

- **Commit `87823064`** — "resolve #2716: FT taxonomy reconcile + SPEC allow-list refreeze R1 -- code already
  landed, status was stale" — set `status: resolved`, `dateResolved: "2026-08-15"`,
  `graduatedTo: "plateau-app:src/feature-tracker/feature-tracking.webcases.ts"` on `we:backlog/2716-*.md`,
  and is an ancestor of `origin/main` HEAD. That commit is not from this card's own line of work; it landed
  independently of #3131/#3133 the day before this sweep.
- This card's own downstream check now also passes: `node we:scripts/check-readiness.mjs --select --json`
  lists `#2717` in `tierA` (verified live on the current tree) — the consequence #3131 named (#2717 stuck
  Tier C behind a stale `blockedBy`) is already gone.

**Nothing in this card's own Tasks was executed to produce that result** — the ask was independently
fulfilled before this card could be picked up. Marking it `resolved` with a build credit would misstate
what happened, so this closes as **moot**: `graduatedTo: none`, no code/doc delivered under this card's own
authorship. See #3133 for the sibling ask, closed the same way and citing the same commit.
