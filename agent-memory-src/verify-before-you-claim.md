---
name: verify-before-you-claim
description: Never report a result (landed / merged / passed / present) from an exit-code-only check; confirm by content, from the freshly-fetched lane, and from GitHub when local git looks off.
metadata:
  type: feedback
---

Before telling the user something landed, merged, passed, or exists, VERIFY it by content — not
by an exit code, not by memory, not by a hopeful read.

**Concrete traps that caused a false report (WE #558, Jul 2026):**
- `git ls-tree <ref> <path>` **exits 0 with empty output** when the path is absent — so
  `git ls-tree … && echo "ON MAIN"` fires a **false positive**. Check by content/count, e.g.
  `git ls-tree -r <ref> --name-only | grep <slug>`, or `wc -c` the object, never `&&` on ls-tree.
- The **primary checkout's `origin/main` is stale** (it isn't fetched every session) and its
  working tree is off-limits. Do ALL git state-checks in the **freshly-fetched lane**; never
  edit or `git checkout … -- .` the primary tree (it pollutes the user's checkout).
- When local git reads look wrong or contradict each other, confirm from **GitHub** (`gh pr
  view --json state,mergedAt`, `gh api …/contents/…?ref=` for size) — the source of truth.

**Why:** on #558 I told the user "the drain landed my items and renumbered them" — false,
off an exit-code-only ls-tree check — then spent many calls untangling it. Reporting a wrong
state is worse than reporting "not sure yet."

**How to apply:** state landed/passed/merged only after a content check you'd stake the claim
on; if unsure, say so and go verify. Pairs with [[scaffold-hash-ids-never-hand-number]] and
[[complete-branch-before-labeling-ready-to-merge]] — the shared failure is over-trusting your
own read of the drain's state.
