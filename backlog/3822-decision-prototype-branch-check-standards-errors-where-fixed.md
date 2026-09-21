---
bornAs: xuw7mmi
kind: decision
parent: "3383"
status: open
scope: ["we:.githooks/pre-push", "we:scripts/guard-poc-branch-health.mjs", "we:backlog/3383-a-background-mechanical-dispatcher-replaces-the-interactive.md", "we:scripts/operations/tracker-refresh-state.mjs"]
dateOpened: "2026-09-21"
preparedDate: "2026-09-21"
preparedAgainstSha: "12dd24e0e934a05a442335426480f6ef7e8e880b"
relatedTo: ["3768", "3804", "3772", "3443", "3805"]
relatedReport: reports/2026-09-21-dispatch-routing-review-and-branch-health-grounding.md
tags: []
---

# Decision: prototype-branch check:standards errors: where fixed, who owns them, the recurrence guard, today's fix (#3768)

Rule the four forks that story #3768 prepared (in PR #2395) for keeping `npm run check:standards` clean on the tip of `lane/mechanical-dispatcher`. The operator reviews decisions only in decision cards (operator rule 9, 2026-09-21), so the forks move here; #3768 stays the build card and is blocked by this one. **The forks, options and bold defaults below are copied from #3768 as prepared; nothing was re-researched and no default was changed.** Research topic: [/research/prototype-branch-health-gate/](/research/prototype-branch-health-gate/). Session report: `we:reports/2026-09-21-dispatch-routing-review-and-branch-health-grounding.md`.

**The count is 1 error, not 15.** #3768's title and file name record 15 errors (measured on `95aae605b`, 2026-09-20). Those 15 were fixed on the branch on 2026-09-20. On the branch tip `5ab89f87b` (2026-09-21) the real count is `1 error(s), 1814 warning(s)`: the Prototype Tracker Artifact's 22-character id in three `claude.ai/artifact/<id>` URLs in a tracker note on the #3383 card trips the opaque-token detector. It is not a credential. Fork 4 is about that one error. The full FOUND section (the reproduction, the gate path through `we:scripts/lib/verify-lane-gate.mjs:73-76`, drift numbers) stays on #3768.

## Why this is on the critical path

The Priority order's rule 1 in #3383 puts #3768 first in the health chain: "nothing may graduate before it". While the tip is red, every `poc-land` into the branch fails its only gate too (`we:scripts/operations/poc-land.mjs:208`), so work reaches the branch by direct push with no gate.

## Recommended path at a glance

| Fork | Default | Main alternative, and why it is excluded |
| --- | --- | --- |
| 1 — where branch errors are fixed | **(a) on the branch, as soon as they appear; the tip stays at 0** | (c) at graduation: the branch's only gate stays red for every landing until then |
| 2 — who owns a new error | **(a) split by cause: a push owns errors in the files it changed; drift reconciliation (#3804) owns every other error** | (b) the push owns every error: the next innocent pusher is blocked by errors `main` caused |
| 3 — the recurrence guard | **(a) refuse a push that adds an error in its own files, and probe the tip on every runner tick for the rest** | (b) an after-the-fact probe: the #3804 prep found an alert file unread for a week |
| 4 — how today's error is fixed | **(a) reword the note; the Artifact's URL stays in the tracker's state file** | (b) exempt `claude.ai/artifact/` URLs in the detector: a URL-shaped hole in the credential check |

## Supported by default — not forks

These are settled on #3768 and are not re-opened here.

- **#3768's design points 1 to 4** (A renumber versus drop, B and D point at `main`'s numbers, C prefix by script, E write the tests): done on 2026-09-20 on the operator's approval.
- **Design point 5, authorship:** settled by precedent. The #3772 ruling forbids rewriting the shared branch, so history stays and only new commits change. Setting the machine's git identity is an operator action, not agent work.

## Fork 1 — Where the branch's `check:standards` errors are fixed

*Fork-existence:* the branch's gate is either held at 0 on the branch, or relaxed there, or left red until graduation. The branch's one `verify-lane` gate cannot be both red and passing, so the three cannot coexist.

- **(a) On the branch, as soon as they appear; the tip stays at 0 — recommended.** Keeps statute clause 2's only gate alive: `poc-land` can pass again, and work stops needing direct pushes. This does not collide with `#gate-on-merged-tree-lane-fast-fail` (a lane gate is not the authority): for a POC branch the tip IS the merged tree that landings enter, so a clean tip is the merged-tree check for that branch. **Graduation cost:** each graduation pull request to `main` starts from a tree that already passes the same check `main`'s CI runs (`we:.github/workflows/ci.yml` runs `check:standards`), so a slice never carries someone else's error. The steady cost is small: today it is one note and three cites.
- **(b) Relax or scope the check for the branch** (a baseline where only new errors fail, or skip registered POC branches). Rejected: a baseline hides exactly the growth this card was filed for (12 to 14 to 15 in one day), and skipping the branch removes its only gate, which clause 2 forbids in spirit: the item's own validation is the gate, not nothing. It also moves the cost to graduation, where every slice meets the accumulated errors.
- **(c) Fix them at graduation, in each slice's pull request to `main`.** Rejected: `main`'s CI would catch only the errors in files a slice ports, so errors in shared files (the tracker card itself) never graduate and never get fixed, and until then every `poc-land` fails. **Graduation cost:** each slice pays for unrelated errors, and two slices touching the same shared file fix the same error twice.

**Skeptic:** SURVIVES-WITH-AMENDMENT → applied. The mechanism cite was a usage comment; the real gate is diff-scoped and runs the whole tree on a branch lane only because of its `backlog/` files (now cited). Statute overlap with `#gate-on-merged-tree-lane-fast-fail` reconciled: the POC tip is the branch's merged tree.
**Screen:** clear. (b) and (c) are rejected on merit (hidden growth, a removed gate, shared files never fixed).

## Fork 2 — Who owns a new error

*Fork-existence:* one error needs one owner; with two, each waits for the other (the week-long unread alert #3804 found is this failure).

- **(a) Split by cause — recommended.** A push owns the errors in the files it changed, and it is refused until they are fixed (Fork 3). Every other error, the ones `main` moving creates (FOUND) and the ones a catch-up merge brings, belongs to drift reconciliation: `#poc-branch-declared-delivery-mode` clause 4(d) already makes drift a per-branch reconciliation job (`we:scripts/conveyor/branch-drift.mjs`), and #3804's prepared default puts it on a dispatched reconcile agent. The #3804 catch-up's done-bar includes 0 errors on the merged tip.
- **(b) The push that lands next owns every error.** Rejected on merit: an error `main` created lands on whoever pushes next, who did not cause it and has no context for it, and every landing blocks until someone else's problem is fixed.
- **(c) The operator owns it.** Rejected: the check is mechanical and so is most of the fix; a person in the loop only adds waiting, against the operator's goal that graduation keep moving.

**Skeptic:** REFUTED → flipped. "Errors with no push come only from a merge" was false: `check:standards` reads `origin/main`, so `main` moving creates errors (B and D were this kind). The default is now split by cause, with drift owned by clause 4(d)'s reconciliation.
**Screen:** clear. The rejections are about who is blocked and who has context, not effort.

## Fork 3 — The recurrence guard (design point 6)

*The contract this rules:* a push that would add an error in its own files is refused before it reaches the shared branch, and every other error on the tip is found within one runner tick and routed to its Fork 2 owner. Where each half runs is the build's detail. *Fork-existence:* the refusal can only see what a push changed, and a probe only finds errors after they land. So the question is whether refusal is part of the guard at all, or the guard is detection only.

- **(a) Both halves: refuse at push for the pushed files, probe the tip for the rest — recommended.** The refusing half is one more guard in `we:.githooks/pre-push`, beside the tracker guard, for branches in the POC registry (`we:scripts/lib/poc-branches.mjs`). It checks the files in `remoteSha..localSha` at `localSha` (the tracker guard already reads `git show <localSha>`), refuses when the working tree is dirty or `HEAD` is not `localSha`, and counts errors only, never warnings. It stays inside `#gate-on-merged-tree-lane-fast-fail`'s scoped shape. Git documents that a non-zero pre-push exit aborts the push. **Known gaps**, which the second half covers: `--no-verify` skips the hook (`we:.githooks/pre-push:6`), and a clone without the `prepare` npm script never wires it. The probing half runs the whole-tree check on the branch tip each runner tick and raises the alert to the drift owner. **Graduation cost:** none added; it keeps Fork 1 (a) true without anyone watching.
- **(b) The probe alone.** Rejected: every error is found only after the gate is already red for every landing, including the ones a pusher could have been stopped for with full context.
- **(c) GitHub CI on pushes to the branch.** Rejected on merit: a push-triggered run starts after the push has landed, so it finds rather than refuses, like (b).

```sh
# Fork 3 (a), refusing half: one line in we:.githooks/pre-push, after the tracker guard.
# For each pushed ref in the POC registry: run check:standards scoped to the files in
# remoteSha..localSha, at localSha; exit 1 naming the errors when there are any.
printf '%s' "$payload" | node scripts/guard-poc-branch-health.mjs "$@" || exit $?
```

**Skeptic:** SURVIVES-WITH-AMENDMENT → applied. The hook is bypassable and not always wired, so the probe is part of the default, not optional. The refusing half checks the pushed commit's own files, not the working tree, which also keeps it inside `#gate-on-merged-tree-lane-fast-fail`.
**Screen:** flagged(impl) → fixed. The fork now rules the contract (refuse what a push adds, find the rest within a tick); the hook is named as the build's home. (c)'s rejection now rests on merit, not on #3805's unratified default.

## Fork 4 — How today's error is fixed: the note, or the detector

*Fork-existence:* either the card stops carrying the Artifact id, or the secret detector learns that a `claude.ai/artifact/<id>` segment is not a secret. Both make the check pass; they cannot both be the fix, because the second changes what every card may carry.

- **(a) Reword the note — recommended.** Name "the Prototype Tracker Artifact" in the card and keep its URL where `we:scripts/operations/tracker-refresh-state.mjs` already records it (its `record --url=` writes the url and id to a state file beside the page), not in the card. A card should not need an Artifact's id to be read. The tracker runbook text that told a worker to paste the URL into the note changes in the same fix, or the error comes back on the next refresh.
- **(b) Teach the detector a `claude.ai/artifact/` exemption.** Rejected on merit: an exemption shaped like a URL is a hole shaped like a URL; any 22-character key pasted after that prefix would pass the check that exists to catch published credentials (#3015). The detector also has two implementations to keep equal (`we:scripts/lib/secret-scrub.mjs` and its Rust twin under `we:scripts/rust-scan/`).

**Skeptic:** SURVIVES-WITH-AMENDMENT → applied. Verified: one error, and `#main` anchors resolve on both sides for the 3475 cites. Amended: the tracker runbook must stop pasting the URL, or the error returns; the detector's Rust twin is named.
**Screen:** flagged(prio) → fixed. The first draft's "order with the catch-up" fork was sequencing only; it is now two requirements (*Required, not forks*), and the one merit question inside it, note versus detector, became this fork.

## Order with #3804 (required, not forks)

- **The tip is held at 0 errors, and every fix is made in a form valid on both `main` and the branch.** The 3475 cites move to `we:scripts/conveyor/session-reaper.mjs#<symbol>` anchors, which resolve on both sides.
- **The #3804 catch-up merge's done-bar includes 0 errors on the merged tip.** Errors that exist only because of drift are then fixed once, in the merge that resolves them (Fork 2's drift owner). Today's error is branch-only, so fixing it now is never redone by the catch-up.

## Not in this decision

The build itself, its FOUND evidence, its review jury and its executable Done-when stay on #3768. Duplicate backlog ids stay on #3772 point 3.

## Done when

1. **Executable** — `grep -l '^## Ruling' we:backlog/*prototype-branch-check-standards-errors-where-fixed*.md` lists this card (it fails until the operator has ruled and a `## Ruling` section names the chosen option for each of the four forks).
2. #3768's `## Done when` is updated to match the ruling (item 5 is kept or dropped per Fork 3), and #3768's `blockedBy` entry on this card is cleared when the ruling lands.
