---
kind: decision
parent: "3383"
status: open
relatedTo: ["3772", "3443", "3556", "3607", "3464", "3797"]
scope: ["we:scripts/conveyor/branch-sync.mjs", "we:scripts/conveyor/branch-drift.mjs", "we:scripts/readiness/dispatch-plan.mjs", "we:scripts/lib/poc-branches.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# Decision: how the prototype branch is kept up to date with main: cadence, conflict owner, alert path and when a slice may graduate

Rule the four points of the prototype-sync policy that #3772 leaves open. **Already ruled by the operator, 2026-09-21 (not a fork):** keep `lane/mechanical-dispatcher` up to date with `main` mechanically, by a MERGE COMMIT (never a rebase or force-push), with a conflict resolved on a STAGING ref and the operator fast-forwarding the shared branch. Card 3797 is the loop that carries this out. Relates #3772, #3443, #3556 (ratified: a reconcile agent on escalation) and #3607.

*Not prepared:* no skeptic pass has run on the forks below and there is no `preparedDate`. Each default is mine, from the code reads cited here.

## FOUND (verified 2026-09-21)

- **The gap is large and growing.** `git rev-list --left-right --count origin/main...origin/lane/mechanical-dispatcher` reads 465 commits only on main and 253 only on the branch.
- **The staging ref is already stale.** `origin/lane/mechanical-dispatcher-catchup` sits at dd9d51bfb (54 conflicts resolved once, 390 files changed). The branch has since gained 12 commits, so the branch tip is NOT an ancestor of the staging ref: `git merge-base --is-ancestor origin/lane/mechanical-dispatcher origin/lane/mechanical-dispatcher-catchup` fails and a plain fast-forward is no longer possible. The staging merge must be redone (or merged in) before the operator's fast-forward.
- **Alert machinery exists in three places, none the operator sees.** `we:scripts/conveyor/branch-sync.mjs` writes a durable alert record in the scratch clone's git directory and a desktop notice; on the prototype only, `we:scripts/conveyor/poc-branch-sync.mjs` writes its own per-branch alert record in the same place; `we:scripts/conveyor/branch-drift.mjs` publishes a verdict as a git note and `we:scripts/readiness/dispatch-plan.mjs` turns a `blocked` verdict (dry-run conflict, or more than 40 commits behind, `DEFAULT_MAX_BEHIND`) into the `branch-drift-blocked` hold. That hold only stops queued cards whose scope overlaps the branch's declared scope. The live scratch-clone loop has sat at attempt 5 since 2026-09-12 with an alert file nobody read (3797 records it).
- **A merge-and-push already exists on the prototype only.** `we:scripts/conveyor/poc-branch-sync.mjs` builds the merge commit with git plumbing and pushes it plainly (never forced) under `withPocLandLock`, gated on the registry's `autoSync` flag; it is not on `main`. Card 3797's line "nothing pushes" is true of `we:scripts/conveyor/branch-sync.mjs` only. Not verified: whether that pass has ever pushed a real merge live.
- **Escalation to an agent is already ratified.** #3556 (resolved) ruled a dispatched reconcile agent on escalation, capped at one attempt per distinct conflict signature; #3607 (open) builds it for `we:scripts/conveyor/branch-sync.mjs` only.

## Fork 1 — cadence

- **(a) [default] After each landing on main.** The sync pass runs on the runner tick and merges whenever `main` has something the branch lacks, so each merge carries one landing's worth of change. Conflicts stay small and are attributed to the landing that caused them; a stuck conflict is noticed within one tick, not at the next hourly slot. Cost: up to one merge commit per landing on the prototype, and a bounded wait against the fast-lander's per-branch lock (the pass already skips a contended tick).
- **(b) A fixed timer, hourly.** Fewer merge commits and no lock churn. Rejected: each hour's batch bundles many landings, so a conflict is harder to attribute and the reconcile agent gets a bigger problem; the branch is behind for up to an hour on every landing.
- **(c) Only when the main-only count passes a threshold** (the 40-commit ceiling). Rejected as the primary trigger: it is what let the count reach 465 in practice, since nothing acts until the ceiling and then the merge is the largest one. It stays as the BACKSTOP that raises `branch-drift-blocked`.

## Fork 2 — who resolves a conflict

- **(a) [default] The loop freezes and alerts once; a dispatched reconcile agent resolves it on a staging ref; then the operator.** Follows #3556's ratified shape (one attempt per conflict signature) extended to the staging-ref rule. The agent never writes to the shared branch. Whatever it cannot decide comes back as a decision card (the catch-up merge left five, see the sibling catch-up card), and the operator fast-forwards the branch.
- **(b) A human only.** Today's alert path. Rejected: it is the state that produced 54 conflicts and a 9-day-old alert file.
- **(c) The agent resolves and pushes to the shared branch directly.** Rejected: a wrong semantic resolution lands on the branch every dispatch reads; the operator's own ruling put a staging ref and a human fast-forward between the two.

## Fork 3 — the alert path

- **(a) The alert file and the desktop notice only.** Today. Rejected: the file lives in a scratch clone's git directory and the notice is transient; nobody saw attempt 5.
- **(b) [default] The alert file stays the durable record, and a frozen sync also raises an entry the operator already reads** (the operator queue, `we:scripts/operations/operator-queue.mjs`, which also feeds the wip report), with the existing scoped `branch-drift-blocked` hold unchanged. Not verified: whether the operator queue can carry a new row kind without a change; that is part of the design.
- **(c) Widen the hold so a frozen sync stops ALL dispatch.** Rejected: an unrelated card is not endangered by a merge conflict elsewhere, and the scoped hold already stops the cards that are.

## Fork 4 — when a slice may graduate to main

- **(a) [default] Only from a branch that is level with main.** A slice graduates after a sync merge that leaves the branch zero commits behind main (checked at graduation time), then goes through the normal lane, verify and pull-request path to `main`. The next sync merge picks the landed version up as identical content. This is #3772's point 4 stated as a check.
- **(b) Any time, as today.** Rejected: the graduation diff is computed against a base that has moved, so the reviewer sees changes that are really main's own; #3443's graduation notes already record hand-ports for this reason.
- **(c) Only when the whole branch is frozen and reconciled.** Rejected: it serializes every slice behind the slowest merge and is stricter than the diff-correctness problem needs.

## Not in this decision

Duplicate backlog ids on the merge stay on #3772 point 3 and on the branch-health card #3768; the catch-up merge renumbered nothing. The loop's build details (dedicated clone, lock, the stuck process) stay on 3797.

## Done when

1. **Executable** — `grep -l '^## Ruling' we:backlog/*prototype-branch-is-kept-up-to-date*.md` lists this card (it fails until the operator has ruled and a `## Ruling` section names the chosen option for each of the four forks).
2. The ruling's build work is carved into slices under #3383 or folded into 3797 and #3772; the loop's own acceptance, not this card, checks `git rev-list --left-right --count origin/main...origin/lane/mechanical-dispatcher` against the ruled cadence.
