---
bornAs: xw9c2tk
kind: story
size: 3
parent: "2555"
status: resolved
dateOpened: "2026-07-21"
dateResolved: "2026-07-21"
tags: [plateau-loop, console, console-board, composer, write-seam, slice-2555]
---

# Console board new-work composer (scaffold write verb)

Carved from #2587 (a size-5 slice with three write concerns): this is the piece SHIPPED — the board's FIRST real
write affordance. A docked "new work" composer files a backlog item through the existing lane→PR write seam,
never touching main.

## Scope (delivered)
- **New `scaffold` write verb, end-to-end** (`plateau-app:src/backlog-view/write.ts` ·
  `plateau-app:vite.config.mts` · `plateau-app:src/backlog-view/write-action.ts`): `POST /api/backlog/write`
  `{ verb:'scaffold', kind, title, size?, parent?, blockedBy?, digest? }` runs
  `we:scripts/backlog.mjs scaffold` in a lane clone and opens a PR — born OPEN (no `--session`). Validated at
  the endpoint (kind allowlist; anchored title allowlist rejecting shell/flag/newline chars; story-requires-size;
  numeric parent/blockedBy). `execFile` single-token argv — no shell.
- **The composer UI** (`plateau-app:src/backlog-view/composer.ts` `renderComposer`): a docked-left form (kind
  select · title · story-only size · optional parent/blockedBy/digest · "Create draft" · "never writes main"
  note), mounted by `plateau-app:src/backlog-view/lane-board.ts` in a flex board-row, submit wired to a copied
  `applyWrite`/`pollWrite`. An in-flight LOCK blocks a double-submit (the seam does not coalesce scaffolds, so a
  double-click would file two items + two PRs).

## Acceptance
The composer files a `story|epic|decision` (title + optional parent/blockedBy/digest) through the lane→PR seam,
born open, never writing main; a double-click files once; sighted both themes; `plateau-app` `backlog-view`
suite green (387), all submit tests stub `fetch` (never the real endpoint). Delivered as plateau PR for #2587.

## Not here (see remaining #2587)
- Open-decision-from-a-lane (navigate a UC-A9 cell to the #2565 ratify surface, never ratify inline) — the
  ratify surface isn't built yet.
- The new-spec-candidate → constitution-promotion loop (accept a generalizing candidate → FILE A DECISION).
Both stay in #2587.
