---
kind: story
size: 5
parent: "2555"
status: active
scaffoldedBy: "slice-2555"
dateScaffolded: "2026-07-20"
dateOpened: "2026-07-20"
blockedBy: ["xq8fvck"]
tags: [plateau-loop, console, console-board, composer, decision-surface, write-seam, slice-2555]
---

# Console board write affordances — open-decision-from-a-lane and new-work composer

The board's create/decide affordances (design-record §3i v25–v27 + §3f-D): open a prepared decision from the
lane that is blocked on it, and file new work from a docked composer — both through the lane→PR write seam,
never a direct write to `main`. This is the "capture + decide" write family, sibling of the review/queue
action slice [#xuff4b8].

## Scope
- **Open-decision-from-a-lane (design-record §3d-2 + §3f-A, ratified — never ratify inline).** A
  decision-awaiting lane cell (taxonomy UC-A9) offers **Open decision**, which navigates to the ratify
  surface ([#2565]'s full-page channel), it **does not ratify in place** (§3g-T2: ratifying inside the red
  "this blocks your launch" gate is a biased frame). The board provides only the *open-from-a-lane*
  affordance + a scoped, auto-expiring, per-launch waiver (never a global policy edit from a launch context).
- **New-work composer (design-record §3i v25–v27).** A composer docked LEFT: `story | epic | decision` +
  title + feature + `blockedBy`; `⇱` opens the full editor page. It files via the lane→PR write seam, never
  writes `main`. Simplified in the dock; the full editor is the escape hatch.
- **New-spec-candidate → constitution-promotion loop (design-record §3e-2 + §3f-D).** A requirement surfaced
  mid-build appears as a new-spec candidate with accept / reject; accepting a candidate that generalizes is
  **promoted to the constitution by FILING A DECISION** (prepare → ratify), never a one-click direct law
  change — the ratified governance rule.

## Where the code goes (locus)
- The composer dock, the open-decision affordance, and the candidate loop land in this slice's own module
  `plateau-app:src/backlog-view/write-affordances.ts` (disjoint file from the sibling downstream slices),
  extending the board view under `plateau-app:src/backlog-view/` (the composer mounts into the shell's dock
  slot from [#xo9wnlp] without editing the shell module; open-decision acts on a cell from [#xq8fvck]). All three write through the read port's write side (`POST /api/backlog/write`,
  lane→PR — the [#2558] write port), which runs the sanctioned CLI ([we:scripts/backlog.mjs](scripts/backlog.mjs)
  `scaffold` / decision items) behind the seam; the view issues intents only — no bare CLI / `gh` / `main`
  write from a rendering path ([#2558] R2 boundary).
- Open-decision navigates to the ratify surface [#2565] rather than embedding it; that epic owns the ruling
  UI.

## Out of scope (other slices)
- The full decision-ratify surface (fork cards, evidence, the ruling write) → [#2565] and its children; this
  slice only opens it from a lane. Review / merge / bounce / drag-to-queue → [#xuff4b8].

## Acceptance
- A decision-awaiting lane cell offers **Open decision** that navigates to [#2565]'s surface (never ratifies
  inline); the only in-context write is a scoped, auto-expiring, per-launch waiver.
- The docked composer files a `story | epic | decision` (title + feature + `blockedBy`, `⇱` → full editor)
  through the lane→PR write seam, never touching `main`.
- Accepting a new-spec candidate that generalizes **files a decision** (prepare → ratify), never a direct
  constitution edit.
- Both themes render; `plateau-app`'s `npm test` + `we:` `check:standards` pass.
