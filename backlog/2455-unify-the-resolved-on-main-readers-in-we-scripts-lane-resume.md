---
bornAs: x5ac64s
kind: task
status: resolved
relatedTo: ["2396"]
tags: [lane, finish, proof-of-land, bug]
dateOpened: "2026-07-12"
dateResolved: "2026-07-21"
---

# Unify the resolved-on-main readers in we:scripts/lane-resume.mjs (loose resolvedItemSet vs frontmatter-strict resolvedOnMain)

`we:scripts/lane-resume.mjs` now holds two independent readers of the one predicate "is item N `status: resolved` on origin/main": the pre-existing `resolvedItemSet()` (a loose regex over the first 400 chars, feeding `discover`'s blockedBy gating) and #2396's `resolvedOnMain()` (frontmatter-parsed via `readField`, feeding the rebuild-plan proof-of-land). Route both through one frontmatter-strict reader so the discover path can't be spoofed by early-body content while the rebuild path refuses, and so a future proof-format change lands once instead of drifting.

## Why now

Surfaced by the PR #427 review panel (advisory, non-blocking there because `resolvedItemSet` predates the PR): an open item whose body carries a column-0 `status: resolved` within its first 400 bytes is read as a landed blocker by `discover` while the same pass's rebuild half correctly refuses it — one `/finish` pass holding two answers to the same question. Fix shape known: extract the #2396 frontmatter-strict check and have `resolvedItemSet()` use it; keep the single-batched `git show` read pattern for discover's fan-out. Regression test: the fenced-example spoof file must read NOT resolved through *both* entry points.

## Delivered (2026-07-21)
Extracted one frontmatter-strict predicate `docIsResolved(doc)` (= `readField(doc, 'status') === 'resolved'`,
which parses only inside the first `---`…`---`) and routed BOTH readers in `we:scripts/lane-resume.mjs`
through it — `resolvedOnMain` (rebuild proof-of-land) and `resolvedItemSet` (discover's blocker-gate, which
dropped its spoofable 400-char loose regex). `resolvedItemSet` keeps discover's one-sweep fan-out (`ls-tree`
+ per-file `git show`), and gained a `cwd` param + an export for testing. A new regression test in
`we:scripts/__tests__/lane-resume.test.mjs` builds the fenced-example spoof (an OPEN item with a column-0
`status: resolved` in its body) and asserts it reads NOT resolved through **both** entry points, plus a
cross-check that `resolvedItemSet` and `resolvedOnMain` agree for every fixture item. 63 tests green;
adversarially reviewed SHIP (mutation-verified: reverting to the loose reader makes the new test fail).

Follow-up filed (#x7xs42w): a THIRD loose reader of the same predicate lives in `we:scripts/lane-drain.mjs`
(~line 307, `resolveReachable` — a full-body `/^status:\s*resolved/m` test on the merge path), same spoof
class, out of this item's two-reader scope — tracked separately so the drain change gets its own test +
review.
