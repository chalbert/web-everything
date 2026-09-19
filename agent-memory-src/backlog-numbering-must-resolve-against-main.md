---
name: backlog-numbering-must-resolve-against-main
description: Backlog item filing and JIT-numbering/renumbering-collision heal operations must always resolve against main's canonical numbering state — never independently resolved against a long-diverged prototype/lane branch's own history, or two branches can silently mint the same number for different items.
metadata:
  type: feedback
---

`main` is the single source of truth for the shared backlog-number namespace. Filing a
new item, or running a renumbering-collision heal (`scripts/backlog-renumber-collisions.mjs`),
must always be done against `main`'s current numbering state — even when the actual
code/content work for an item lives on a long-lived prototype branch (per this epic's
own established "build on the prototype first" default). A collision-heal or JIT-number
assignment resolved independently on a diverged branch can silently mint a number that's
ALREADY been assigned to something different on `main` in the meantime, since the
branches aren't numbering-aware of each other.

**Tiebreaker rule:** when a numbering collision is found between `main` and a diverged
branch, **`main` always wins**. The branch's conflicting item is the one that gets
renumbered — never main's. Main's assignment is authoritative because it's the canonical
numbering source; the diverged branch is the one that drifted. This is not a
case-by-case judgment call — it is the standing tiebreaker, applied automatically.

**Why:** found live today — epic #3383's `lane/mechanical-dispatcher` branch had its own
JIT-numbering/collision-heal event (commit `f4395e2af`) that assigned `#3654` to a
"Codex model routing" item, independently of `main`, which by then had already assigned
`#3654` to a different, unrelated "graduation criteria for exiting probation" item via
its own real filing (PRs #2185/#2187). Neither numbering event was wrong in isolation —
each was correct against the numbering state its own branch could see — but the two
branches disagreed about what `#3654` means, a collision only surfaced when checking
both branches side by side. Caught before the prototype branch merged (which would have
made it a real, live collision on `main`), not after.

**How to apply:**
- File new backlog items via a lane/clone based on current `main` (this repo's own
  lane-pool convention already does this structurally for `file-item` calls — the risk
  is specifically renumbering-heal operations, which can run inside any checkout,
  including a long-diverged prototype branch).
- Before running a renumbering-collision heal on ANY branch, fetch and check against
  current `origin/main`'s numbering state first, not just the local branch's own history.
- When a collision is found, renumber the diverged branch's item, never main's — `main`
  wins by default, unconditionally.
- When syncing a long-diverged prototype branch back with `main` (merge/rebase), always
  explicitly check for and heal number collisions as part of that sync — don't assume
  git's own merge will surface them cleanly (a number collision is a semantic clash, two
  files with different names, not a textual merge conflict git would flag on its own).
