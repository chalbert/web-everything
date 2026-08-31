---
bornAs: xirq9vf
kind: story
size: 3
parent: "3029"
blockedBy: ["3423"]
status: open
dateOpened: "2026-08-27"
tags: [operations, conveyor, github, branch-protection, sole-writer]
---

# Branch protection does not structurally enforce the sole-writer/numbering invariant

`#2288`/`#2290`'s "the drain is the sole serial writer to main" — the property every JIT-numbering guarantee
depends on — is enforced entirely by script discipline (`assertMayMerge`, `withNumberingLock`, the drain
lease). Nothing at GitHub's own layer would refuse a merge or push that skipped all of it. That gap was found
live on 2026-08-27 while investigating an apparent unaccounted-for merge (which turned out benign — see
below) — investigating it surfaced a real structural gap independent of that specific incident.

## What was checked, read from the live repo, not assumed

`gh api repos/chalbert/web-everything/branches/main/protection` on 2026-08-27:

```json
{
  "required_status_checks": {"contexts": ["test", "smoke"], "strict": false},
  "required_pull_request_reviews": {"required_approving_review_count": 0},
  "enforce_admins": {"enabled": false},
  "allow_force_pushes": {"enabled": false},
  "allow_deletions": {"enabled": false}
}
```

No `restrictions` key at all — nothing limits WHICH users/apps/tokens may push or merge. Two consequences:

1. **`enforce_admins: false`** means an admin-scoped actor can push directly to `main` or merge without the
   `test`/`smoke` checks or review, and GitHub itself will not refuse it. The whole numbering/sole-writer
   discipline (`numberPendingHashes`, `withNumberingLock`, `assertMayMerge`) runs INSIDE `we:scripts/pr-land.mjs` /
   `we:scripts/merge-ai-prs.mjs` — an admin actor bypassing those scripts entirely (a raw `git push`, or
   `gh pr merge` run by hand) is not something branch protection would catch.
2. **`required_approving_review_count: 0`** — a PR merge does not actually require a human/bot approval to
   go through; `required_pull_request_reviews` being configured at all is what forces the PR path over a
   direct push for a NON-admin actor, but the approval count itself is zero.

## The incident that surfaced it (confirmed benign — recorded so it is not re-investigated)

Six PRs (`#1644, #1646, #1648, #1650, #1654, #1655`) showed as merged with no corresponding line in the
resident drain daemon's log (`~/workspace/plateau-app/.drain-daemon/daemon.log`), alongside a live
`we:scripts/merge-ai-prs.mjs --no-drain-lease --no-reconcile-labels` process that looked like a lease bypass.

Both were run down to ground truth, not left as a guess:

- The suspicious process's parent chain traced through `vitest` → `npm run test:unit` →
  `we:scripts/__tests__/drain-push-at-close.test.mjs`, which spawns a REAL `we:scripts/merge-ai-prs.mjs`
  child against its own `mkdtemp(tmpdir(), 'push-at-close-')` fixture repo — never against
  `chalbert/web-everything`. The `--this-repo`/`--no-drain-lease`/`--no-reconcile-labels` flags are exactly
  what a test harness passes to isolate a subprocess from needing production locking; nothing about it
  touched the real repo.
- `gh pr view <n> --json mergedBy` on all six unaccounted-for PRs, and on three PRs the daemon's log DID
  record, returned the SAME account (`chalbert`) for every one. The daemon-log gap is a VISIBILITY gap —
  `we:tools/drain-daemon/cli.mjs once` (a legitimate one-shot pass that takes the same real lease properly)
  logs to its own invoker's stdout, not to the resident daemon's `launchd` log path — not a second writer.
  Multiple sessions running `once` concurrently that night is the far simpler explanation than an
  unauthorized actor, and the merger-identity check confirms it.

**So nothing actually violated the invariant on 2026-08-27.** The gap this card files is that nothing
GUARANTEES that stays true — it held tonight because every actor used the disciplined path, not because
anything would have stopped one that didn't.

## Done when

1. **Executable** — a test (or a documented, run-and-recorded `gh api` check, if a live GitHub check cannot
   be unit-tested) that asserts branch protection on `main` restricts merge/push to the actor(s) the
   sole-writer design assumes, OR explicitly documents why that is intentionally not possible and what
   compensating control exists instead.
2. **The enforcement decision, carved out.** This item no longer carries the fork — it is `blockedBy`
   **[#3423](/backlog/3423-branch-protection-enforcement-of-the-sole-writer-invariant-p/)**, a prepared
   `kind: decision` card holding the (a)/(b) fork, the prior-art + fact-check research, and a recommended
   default, per the "never take an unprepared decision" agent-memory rule (a decision-shaped fork does not get answered
   inline in a story). This item unblocks once that decision is ratified.
3. **Once #3423 is ratified:** if the ruling is Fork 1(a), apply the branch-protection/ruleset change via
   `gh api` (the exact call shape is recorded on #3423's Fork 1) and re-verify with the same
   `branches/main/protection` read this card used; if the ruling is Fork 1(b) (the current recommended
   default), nothing further to apply here beyond item 1's executable check.

## Deliberately NOT in scope

- **Re-investigating the 2026-08-27 incident.** Closed above with evidence; this card is about the
  structural gap it surfaced, not the incident itself.
- **Changing `required_approving_review_count`.** That is a review-policy question or #3313's territory,
  distinct from who may merge at all.

## Lineage

Filed 2026-08-27 at the user's request, after "aren't temp ids supposed to be changed at drain time" led to
"how do you know it wasn't [an unauthorized process]" led to "we should have a blocker on CI to stop this,
no?" — a fair challenge that turned out to have a real answer: no, not structurally, only by convention.

**Carved 2026-08-31:** "Done when" item 2's (a)/(b) enforcement fork was split out to
**[#3423](/backlog/3423-branch-protection-enforcement-of-the-sole-writer-invariant-p/)** (prepared
`kind: decision`), which this item is now `blockedBy`. The fork's full research, options, and recommended
default live only there — see that card, not this one, for the enforcement call.
