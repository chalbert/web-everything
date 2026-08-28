---
bornAs: xm1izdn
kind: story
size: 2
parent: "3321"
status: open
dateOpened: "2026-08-27"
tags: []
---

# check:standards' stranded-hash rule cannot be fixed through a normal PR

Two live findings from tonight (2026-08-27), reproduced, not inferred.

**1. `numberPendingHashes` did not fire when PR #1664 merged.** That PR's own content was the
backlog card `we:backlog/x4jcqm4-verify-lane-has-no-sanctioned-way-...md`, scaffolded as a
hash-slug id per the normal JIT-numbering flow. It should have been renumbered to a real `NNN` at
land time (per `we:scripts/lane-drain.mjs`'s `numberPendingHashes`, wrapped in
`withNumberingLock`). After the merge, `git ls-tree -r origin/main -- backlog/` (verified with a
fresh `git fetch origin main`) still showed it under its hash-slug name — stranded on the real
shared `main`, not a stale local view.

**2. The rule that catches this (`we:scripts/check-standards-rules.mjs:2218`,
`strandedHashesOnMain`) cannot be satisfied by the PR that fixes it.** It reads
`git ls-tree -r origin/main` directly (`we:scripts/check-standards.mjs:550`) — the real shared
branch, not the PR's own branch content. Running the sanctioned repair
(`we:scripts/backlog.mjs number-stranded`) in a lane fixes the file in that lane's `HEAD`, but
`check:standards` there still fails, because it is reading `origin/main`, which cannot reflect the
fix until it is already merged — which itself requires this check to pass. A structural
chicken-and-egg: verified by running `number-stranded` locally, confirming the rename, and
re-running `check:standards`, which still errored on the unrenamed name read from `origin/main`.

**Consequence, stated plainly:** while any card sits stranded on the real `main`, `check:standards`
fails for every PR, not just the one that would fix it — including PRs with no relation to backlog
numbering at all, since the rule runs unconditionally as part of the standard gate.

## Done when

1. **Executable** — a test reproduces the chicken-and-egg: a fixture where `origin/main` (not the
   working branch) carries a stranded hash, asserts `check:standards` fails for an UNRELATED
   change on a branch that already fixed its own copy of the file, and asserts today's design
   cannot pass without an out-of-band act (the drain merging despite this one rule, or a
   break-glass).
2. **Executable** — the drain's own merge path is asserted to run `numberPendingHashes` for every
   card in the PR it is about to merge, so a #1664-shaped miss cannot recur; a regression test
   drives a merge through a fixture drain and asserts no hash-slug filename survives on the
   fixture's `main` afterward.
3. Either the drain is proven to have (or gains) an override that lands a stranded-hash repair
   despite this one rule reading red, or `check:standards` is changed to treat this rule specially
   (e.g. exempt a PR whose own diff strictly reduces the stranded set) — whichever keeps the
   invariant enforced without making it self-blocking.
