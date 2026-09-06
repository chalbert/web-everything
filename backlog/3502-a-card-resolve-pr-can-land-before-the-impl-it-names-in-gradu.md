---
bornAs: xlv5507
kind: story
size: 3
status: open
dateOpened: "2026-09-06"
tags: []
---

# A card-resolve PR can land before the impl it names in graduatedTo, and nothing checks the target exists

A card resolve asserts work outside its own diff — *this is done, and it landed at `<path>`* — yet nothing
verifies the path exists. It also trips no escalation signal (`blast-radius` keys on `^scripts/`, `size` on
400 lines; a resolve is a three-line `backlog/` splice), so it merges unreviewed, and impl-first/WE-last
ordering binds only on manifest-carrying PRs — orphans are "always ready". Observed on the `#2756` couple:
the card landed while its impl sat parked, leaving `main` naming a path that did not exist. Wants a gate
that a `graduatedTo` target resolves before it lands.

## Done when

1. **Executable** — `npm run check:standards` FAILS on a backlog item whose `graduatedTo` names a
   repo-qualified path (`fui:…` / `plateau:…` / `we:…`) that does not exist in the corresponding checkout,
   and PASSES once the path is present. Reproduce with `#2756` itself: its `graduatedTo` names
   `fui:plugs/webdirectives/ssr/rust/`, absent from `frontierui` `main` at the time of writing.
2. **Skip-safe, not fail-open** — where the sibling checkout is absent the gate must say so and skip that
   item explicitly (the `../frontierui not found` shape `check:standards` already prints), never silently
   pass. A gate that cannot see the target must not report the target as present.
3. A test covers both arms: a resolvable target passes, an unresolvable one errors.

## The two mechanisms, separately

**1 — a resolve trips no escalation signal, so it is never reviewed.**
[`we:scripts/lib/review-escalation.mjs`](../scripts/lib/review-escalation.mjs) trips `blast-radius` on
`^scripts/` plus the relocatable engine basenames, and `size` at 400 changed lines. A card resolve is a
three-line frontmatter splice under `backlog/` — on neither list. It is therefore never parked, never earns
a `review:pending`, and merges straight through the sweep. The drain's own
[`we:scripts/merge-ai-prs.mjs`](../scripts/merge-ai-prs.mjs) stamps `no-recorded-review` on it afterwards
and classes it in the DEGRADED set — "the review was skipped or ran narrower than the care level called
for" — noting it is the headline case at 22.5% of merges.

That is a defensible default for most `backlog/` edits. It is a poor one for a **resolve**, because a
resolve's entire semantic content is an assertion about work *outside* the diff: *this is done, and it
landed at `<path>`*. The diff is small precisely because the claim is a pointer. Size and blast-radius
measure the wrong thing here.

**2 — couple ordering binds only on manifest-carrying PRs.**
`we:scripts/merge-ai-prs.mjs` is explicit that "orphan PRs (no manifest → item null, `blockedBy` [],
`stackParents` []) are always ready, so this degrades to the legacy unordered sweep when nothing carries a
manifest". Land order (impl-first/WE-last) and the stacked-open shape both key on the couple manifest that
[`we:scripts/readiness/couple-plan.mjs`](../scripts/readiness/couple-plan.mjs) plans and
`we:scripts/lane-stack.mjs couple-open` writes. A couple opened by hand — outside the `lane/*` convention,
e.g. through the GitHub API on a `claude/*` branch — carries no manifest, so both halves are orphans and
either may land first.

## Why the guard, and not just the ordering

Fixing ordering alone leaves the hole open, because ordering is only ever enforced on the couples the
machinery already recognises — the ones least likely to go wrong. A `graduatedTo`-resolves check binds on
the *content of the claim* rather than on the transport that carried it, so it holds for a hand-opened PR,
a manifest-less orphan, a couple whose halves landed out of order, and a resolve authored directly on
`main` alike. Ordering is a nice-to-have on top; this is the load-bearing half.

## Observed

2026-09-06, the `#2756` couple. `chalbert/web-everything#1952` (the card resolve) merged while its impl
`chalbert/frontierui#43` was still open and parked `review:pending` for `blast-radius` + `size`. WE `main`
now asserts `#2756: status: resolved` with `graduatedTo: frontierui:plugs/webdirectives/ssr/rust/`, a path
absent from `frontierui` `main`. It self-heals when #43 lands and does not if #43 is reworked or rejected.

Both PRs were opened by hand rather than through `couple-open`, so the orphan path above is the direct
cause — the drain behaved exactly as written. The item is filed against the machinery's *invariants*, not
against that run.
