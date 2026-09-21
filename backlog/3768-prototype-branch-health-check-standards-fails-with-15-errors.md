---
bornAs: xntmgs1
kind: story
size: 5
parent: "3383"
status: open
scope: ["we:backlog/3383-a-background-mechanical-dispatcher-replaces-the-interactive.md", "we:backlog/3443-graduate-origin-lane-mechanical-dispatcher-to-main-in-small.md", "we:scripts/operations/land-advance-io.mjs", "we:scripts/operations/wip-report-io.mjs"]
dateOpened: "2026-09-20"
preparedDate: "2026-09-21"
preparedAgainstSha: "7bdbe0c8a8fdd88b715e4094456b513823489179"
relatedTo: ["3804", "3805", "3772", "3443", "3801", "3475"]
relatedReport: reports/2026-09-21-dispatch-routing-review-and-branch-health-grounding.md
blockedBy: ["xuw7mmi"]
tags: []
---

# Prototype branch health: check:standards fails with 15 errors on lane/mechanical-dispatcher, which blocks graduating anything to main

`npm run check:standards` must be clean on the tip of `lane/mechanical-dispatcher`, because nothing can graduate from the branch to `main` until it is (line 1 of #3383's `## Priority order`). On 2026-09-20 the tip showed 15 errors; the title keeps that number because the file name is the card's id. **On 2026-09-21 the tip shows 1 error.** The original 15 were fixed on the branch on 2026-09-20; one new error arrived the next morning.

*Prepared 2026-09-21 (session prepare-3801-and-3768).* Research topic: [/research/prototype-branch-health-gate/](/research/prototype-branch-health-gate/). Session report: `we:reports/2026-09-21-dispatch-routing-review-and-branch-health-grounding.md`. Reproduced on a clean lane clone of the branch tip `5ab89f87b`; the branch itself was not touched.

## Why this is on the critical path

The operator wants graduation to keep moving. The Priority order's rule 1 puts this card first in the health chain: "nothing may graduate before it". While it is red, every `poc-land` into the branch fails its only gate too (FOUND, second bullet).

## FOUND (reproduced 2026-09-21 on `5ab89f87b`)

- **The count today: `1 error(s), 1814 warning(s)`, exit 1.** The one error: `backlog/3383-…` "carries opaque token (unpronounceable ≥20-char key/secret)". The token is the Prototype Tracker Artifact's short id in three `claude.ai/artifact/<id>` URLs, in the tracker note of commit `ebaf4a149` (2026-09-21 09:17). It is not a credential. It trips the detector because this URL form has a 22-character id with no hyphens; the older `claude.ai/code/artifact/<uuid>` form, used 35 times on `main`, is split by its hyphens and passes. The note is only on the branch: `main`'s copy of the #3383 card does not contain it.
- **Why one error matters: it turns the branch's only gate red.** Statute clause 2 of `we:docs/agent/platform-decisions.md#poc-branch-declared-delivery-mode` makes the item's own tests the only gate for a landing inside the branch. `poc-land` requires `verify-lane` to pass (`we:scripts/operations/poc-land.mjs:208`). `verify-lane`'s `check:standards` half is scoped to the changed files by design, but it falls back to the whole tree whenever a changed file is under `backlog/` (`canScopeCheckStandards`, `we:scripts/lib/verify-lane-gate.mjs:73-76`). A branch lane's diff is taken against `main`'s merge base, and it always contains branch-only `backlog/` files, so in practice every `poc-land` runs the whole tree. So any error on the tip, in any file, fails every `poc-land`, and work reaches the branch by direct push with no gate at all (build-3717, for one, pushed directly with `verify-lane` not run).
- **The original 15 were all fixed on the branch on 2026-09-20, on the operator's approval** (tracker note `1cd50e7ca`, "check:standards 11 to 0 errors"):
  - C (2, locus prefixes) and E (2, real-mechanism tests): commit `6f5578531`, "scripted from the gate's own detector", plus `we:scripts/operations/__tests__/land-advance-io-real.test.mjs` and `we:scripts/operations/__tests__/wip-report-io-real.test.mjs`.
  - B (3) and D (4): commit `63e5d82ef`, the three hand-picked ids re-pointed to `main`'s #3635 to #3637.
  - A (4): commit `6df1cb317`, the duplicate #3663 copy dropped and the branch's three other cards renamed to hash ids (`x30inwx`, `xab3jh7`, `xoppas2`).
  - Today each of 3663 to 3666 appears once on the branch, and the branch has no numbered card that `main` lacks.
- **Branch-only versus drift.** Of the original 15, **11 came from drift** (A, B, D: both drains numbered cards independently after the 2026-09-14 merge base) and **4 were branch-only** (C, E). Today's 1 error is branch-only. Card 3475's 3 warnings are branch-caused in a shared file: the card is identical on both sides, but the reaper split made `we:scripts/conveyor/session-reaper.mjs` 323 lines on the branch against 488 on `main`, so its line cites (364-394) resolve on `main` and not on the branch.
- **Drift now.** 497 commits only on `main`, 256 only on the branch; a dry-run merge (`git merge-tree`) conflicts in 59 files. A local trial merge that takes the branch's side of every conflict (`-X ours`, never pushed) leaves the tree unable to run the check at all: `we:scripts/readiness/heavy-admission.mjs` throws `ReferenceError: admissionBypassReason is not defined` and `we:scripts/operations/review-pr.mjs` does not parse (a syntax error at line 2402 of the merged file). So the error count after a catch-up cannot be predicted from today's tip; the catch-up is a real reconciliation (#3804).
- **Authorship (design point 5).** The newest commits on the branch are still authored `test` with a placeholder address, the machine's git identity.
- **Errors can appear with no push at all.** `check:standards` reads `origin/main` for some checks (the stranded-hash and hand-numbered-id checks, `strandedHashesOnMain` and `handNumberedNewItems` in `we:scripts/check-standards.mjs`), so the branch's count can change whenever `main` moves. The original B and D errors were of this kind.
- **A push guard already exists to extend.** `we:.githooks/pre-push` (wired through `core.hooksPath .githooks`) runs `we:scripts/guard-prototype-tracker.mjs` on every push to a declared #3383 branch. A whole-tree `check:standards` takes about 11 seconds on this machine.

## The filed design points, settled

1. **A (renumber versus drop), 2. B and D (point at `main`'s numbers), 3. C (prefix by script), 4. E (write the tests):** done on 2026-09-20 on the operator's approval (FOUND). Not re-opened.
5. **Authorship:** settled by precedent, not a fork. The #3772 ruling forbids rewriting the shared branch (merge commits only, never a rebase or force-push), so history stays and only new commits change. Setting the machine's git identity is the operator's own configuration; it is an operator action, not agent work (Done-when 4 stays a human check).
6. **The recurrence guard:** Fork 3 below.

## Recommended path at a glance

| Fork | Default | Main alternative, and why it is excluded |
| --- | --- | --- |
| 1 — where branch errors are fixed | **(a) on the branch, as soon as they appear; the tip stays at 0** | (c) at graduation: the branch's only gate stays red for every landing until then |
| 2 — who owns a new error | **(a) split by cause: a push owns errors in the files it changed; drift reconciliation (#3804) owns every other error** | (b) the push owns every error: the next innocent pusher is blocked by errors `main` caused |
| 3 — the recurrence guard | **(a) refuse a push that adds an error in its own files, and probe the tip on every runner tick for the rest** | (b) an after-the-fact probe: the #3804 prep found an alert file unread for a week |
| 4 — how today's error is fixed | **(a) reword the note; the Artifact's URL stays in the tracker's state file** | (b) exempt `claude.ai/artifact/` URLs in the detector: a URL-shaped hole in the credential check |

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

*The contract this rules:* a push that would add an error in its own files is refused before it reaches the shared branch, and every other error on the tip is found within one runner tick and routed to its Fork 2 owner. Where each half runs is the build's detail.

*Fork-existence:* the refusal can only see what a push changed, and a probe only finds errors after they land. So the question is whether refusal is part of the guard at all, or the guard is detection only.

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

## Required, not forks

- **The tip is held at 0 errors, and every fix is made in a form valid on both `main` and the branch.** The 3475 cites move to `we:scripts/conveyor/session-reaper.mjs#<symbol>` anchors, which resolve on both sides.
- **The #3804 catch-up merge's done-bar includes 0 errors on the merged tip.** Errors that exist only because of drift are then fixed once, in the merge that resolves them (Fork 2's drift owner). Today's error is branch-only, so fixing it now is never redone by the catch-up.

### Review jury (provisional — pre-registered #2638)

Care level: `high`. This jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| correctness#2 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| security#2 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| simplicity#2 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| standards-conformance#2 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |
| claim-accuracy#2 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |

**Predicted touch-set (#2619)** under the defaults. Fix now, on the branch: `we:backlog/3383-a-background-mechanical-dispatcher-replaces-the-interactive.md` · `we:backlog/3475-automated-transcript-based-introspection-at-session-close-re.md`. The guard (Fork 3), a separate child: `we:.githooks/pre-push` · `we:scripts/guard-poc-branch-health.mjs` · `we:scripts/__tests__/guard-poc-branch-health.test.mjs` · `we:skills-src/conveyor/runner.mjs` (the probe).

## Done when

1. **Executable** — in a fresh clone of `lane/mechanical-dispatcher` at the head of this item's landing, `npm run check:standards` prints `0 error(s)` and exits 0. Before: `1 error(s), 1814 warning(s)`, exit 1 (run on `5ab89f87b`, 2026-09-21; it was 15 errors on `95aae605b`, 2026-09-20).
2. **Executable** — the same run prints no warning line for card 3475 (before: 3, its cites past the end of the branch's reaper file). Check: the output contains no line matching `warn backlog/3475`.
3. **Executable** — a listing of the backlog folder on the branch has each of the ids 3663, 3664, 3665 and 3666 exactly once. (Passes today.)
4. **Human verify** — `git log -5 --format=%an` on the branch shows the operator's real name on new commits, not the placeholder `test`.
5. **Executable, if the ruling adopts the recurrence guard** — a test of the push guard fails when a push adds one `check:standards` error in its own files, and a test of the probe raises an alert when the tip has one error the push did not cause.
