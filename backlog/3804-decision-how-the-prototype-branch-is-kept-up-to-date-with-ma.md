---
bornAs: xki1xap
kind: decision
parent: "3383"
status: resolved
relatedTo: ["3772", "3443", "3556", "3607", "3464", "3797", "3803", "3805"]
scope: ["we:scripts/conveyor/branch-sync.mjs", "we:scripts/conveyor/branch-drift.mjs", "we:scripts/readiness/dispatch-plan.mjs", "we:scripts/lib/poc-branches.mjs"]
dateOpened: "2026-09-21"
dateStarted: "2026-09-21"
dateResolved: "2026-09-21"
codifiedIn: "docs/agent/platform-decisions.md#poc-branch-mechanical-sync"
preparedDate: "2026-09-21"
preparedAgainstSha: "4cd769f889f977d7f7ac67288e585c46c46e4b5b"
relatedReport: reports/2026-09-21-prototype-branch-sync-and-ci-grounding.md
tags: []
---

# Decision: how the prototype branch is kept up to date with main: cadence, conflict owner, alert path and when a slice may graduate

Rule the four points of the prototype-sync policy that #3772 leaves open. **Already ruled by the operator, 2026-09-21 (not a fork):** keep `lane/mechanical-dispatcher` up to date with `main` mechanically, by a MERGE COMMIT, never a rebase and never a force-push of the shared branch; the loop pushes fast-forward-only and only after a clean merge, and on a conflict it freezes and alerts (quoted on #3772). **Corrected 2026-09-21:** an earlier version of this card also listed "a conflict resolved on a STAGING ref and the operator fast-forwarding the shared branch" as ruled. It was not. The operator's words on #3772 give the staging ref and the operator's own fast-forward for the FIRST catch-up only (#3803); a later summary line on #3772 generalized them, and this card repeated it. Who resolves a later conflict, and who moves the shared branch afterwards, are open: Fork 2. Card 3797 is the loop that carries this out. Relates #3772, #3443, #3556 (ratified: a reconcile agent on escalation), #3607 and #3803 (the five judgment forks of the first catch-up merge).

*Prepared 2026-09-21 (session prepare-3804-and-3805).* Research topic: [/research/prototype-branch-sync-and-ci/](/research/prototype-branch-sync-and-ci/). Session report: `we:reports/2026-09-21-prototype-branch-sync-and-ci-grounding.md`. Every number below was re-measured on 2026-09-21 at 11:53 EDT; main at `d6c7f6237`, the branch at `5ab89f87b`.

## Why this is on the critical path

This card gates #3772, line 4 of the health chain in #3383's `## Priority order`. The Priority order's rule 1 says nothing may graduate before the health chain. The operator's stated priority is graduating the prototype branch to `main` (#3443), so graduation should keep moving.

## FOUND (re-verified 2026-09-21)

- **The gap.** `git rev-list --left-right --count origin/main...origin/lane/mechanical-dispatcher` reads **485** only on main and **256** only on the branch. The merge base is `ca7e68b71` (2026-09-14 18:02 EDT). A dry-run merge (`git merge-tree --write-tree --name-only`) of main into the branch conflicts in **58** files.
- **The staging ref.** `origin/lane/mechanical-dispatcher-catchup` is still at `dd9d51bfb`. The branch tip is NOT its ancestor: **15** branch commits are missing from it. It is still cheap to refresh: merging the branch tip into it conflicts in **1** file (`we:scripts/operations/__tests__/http-adapter.test.mjs`), and merging today's main into it conflicts in **4**.
- **Duplicate backlog ids are gone.** On the branch tip, ids 3663 to 3666 each appear once, with the same slugs as on main. The duplicate-id point stays with #3772 point 3 and #3768 as a recurrence risk only.
- **The prototype's sync pass already ran live, pushed, then froze.** `we:scripts/conveyor/poc-branch-sync.mjs` (prototype only, 380 lines) is called every runner tick (`we:skills-src/conveyor/runner.mjs:512`). Its log in the primary checkout's git directory records two clean merges pushed to the shared branch on 2026-09-14: `f507994d7` (17:02 EDT) and `3d5d47b59` (18:03 EDT). Both are on the branch. At 19:04 EDT, **3 commits behind main**, it hit a conflict. After 5 attempts it escalated, kept polling, and logged "174 commit(s) behind main … A human/session should reconcile this branch by hand" (last line 2026-09-18 22:33 EDT). Its state file still reads attempt 5, signature `3e72ad5516ad`. Nobody read the alert. The earlier filing text blamed the threshold for the gap. That was wrong: **the cadence worked, but nobody owned the conflict and nobody saw the alert.**
- **Three sync actors exist.** (1) `we:scripts/conveyor/branch-sync.mjs` on main (426 lines) never pushes; it writes an alert file (`we:scripts/conveyor/branch-sync.mjs:224`) and a macOS notice (`we:scripts/conveyor/branch-sync.mjs:166`), and caps attempts at 5 (`we:scripts/conveyor/branch-sync.mjs:70`). (2) The scratch-clone loop (pid 81962, per #3797) runs (1). (3) `we:scripts/conveyor/poc-branch-sync.mjs` builds the merge with `commit-tree` and pushes it plainly (`we:scripts/conveyor/poc-branch-sync.mjs:214-220`), under `withPocLandLock`, gated on `resolveAutoSyncEnabled` (`we:scripts/lib/poc-branches.mjs:197`; kill switch `WE_POC_BRANCH_SYNC=0`). Which one survives is #3797's build detail, not this card's.
- **The drift hold.** `classifyBranchDrift` (`we:scripts/conveyor/branch-drift.mjs:83`) returns `blocked` on a dry-run conflict or more than `DEFAULT_MAX_BEHIND = 40` commits behind (`we:scripts/conveyor/branch-drift.mjs:68`). `we:scripts/readiness/dispatch-plan.mjs:430` turns that into the `branch-drift-blocked` hold, which stops only queued cards whose scope overlaps the branch's registered scope (`we:scripts/conveyor/` and `we:skills-src/conveyor/` in `we:scripts/lib/poc-branches.json`).
- **The operator queue is PR-only.** `evaluatePr` (`we:scripts/operations/operator-queue.mjs:41`) keys on PR labels, advisories and mergeability; it has no row kind for a branch. The prototype's `we:scripts/operations/turn-digest.mjs` (#3724) has a `needsOperator` field (`DIGEST_FIELDS`, `we:scripts/operations/turn-digest.mjs:65`), filled today only from the operator queue (`shapeNeedsOperator`, `we:scripts/operations/turn-digest.mjs:140`).
- **Graduation is a port onto main, not a merge of the branch.** #3443's Done-when 3 requires each slice to land as its own small PR from a lane cut from `origin/main`. Its progress log (2026-09-03) records a slice that was hand-reapplied onto main's current copy of the file, because main had changed the same file. So a graduation PR's diff is always taken against main.

## Prior art, in one paragraph

Frequent, small merges from mainline are the universal advice. Fowler: "Smaller integrations mean less work, since there's less code changes that might hold up conflicts." Trunk-based development says the same about "the painful merges" of long-lived branches. gitworkflows(7) says "merge upwards" periodically, never rebase a topic merged elsewhere, and test on "throw-away integration branches" (git.git's `seen`) that nobody bases work on. That is the staging ref. GitHub's merge queue tests every change on a temporary branch against the latest base. linux-next (cited from knowledge) is rebuilt daily and mails each conflict to the owning tree's maintainer. The alert goes to where the owner already works. Full survey on the research topic.

## Recommended path at a glance

| Fork | Default | Main alternative, and why it is excluded |
| --- | --- | --- |
| 1 — how far behind main the branch may fall | **(a) promptly: merged on the next sync pass; the 40-commit ceiling is only a backstop** — **ratified 2026-09-21** | (c) only past the ceiling: every merge is then the largest possible conflict |
| 2 — who resolves a conflict, who moves the shared branch after it, and what freezes | **(a) a dispatched reconcile agent on the staging ref (amending #3556: merge only, staging ref only); a daemon fast-forwards the shared branch once the tests are green at that exact commit; no new freeze** — **ratified 2026-09-21** | (b) you fast-forward by hand: the branch sat a week behind because nobody saw the alert, so a human step is a stall |
| 3 — where the alert goes, and where its record is kept | **(b) a line in the every-turn digest plus a row in the wip report, raised only when the operator must act, fails visible; `blockedBy` #3726, desktop notice kept until then. Record: a small file on an `ops/` branch** — **ratified 2026-09-21** | (a) a file and a desktop notice only: the live alert sat unread for a week |
| 4 — when a slice may graduate | **(a) any time; graduation slices exempt from the drift hold (amends clause 4(d)); a file main moved is ported as a diff, never copied** | (b) only from a branch level with main: 58 unrelated conflicts would stop every slice |

## Supported by default — not forks

- **The merge shape.** A merge commit, never a rebase or force-push of the shared branch; the loop pushes fast-forward-only after a clean merge and freezes and alerts on a conflict. Ruled by the operator on 2026-09-21 (#3772). The staging ref and a person's fast-forward were ruled for the first catch-up only; the staging ref for later conflicts is Fork 2's proposal.
- **The staging ref is throw-away.** It follows gitworkflows' throw-away integration branch rule: nobody bases work on it. It is refreshed by merges, like the shared branch.
- **The per-branch lock and the `autoSync` gate.** `withPocLandLock` serializes the sync with a `poc-land` landing. `resolveAutoSyncEnabled` and `WE_POC_BRANCH_SYNC=0` switch it on or off. The lock and the sync pass are on the prototype; `resolveAutoSyncEnabled` and the `autoSync: true` registry entry are on main too (`we:scripts/lib/poc-branches.mjs:197`). All of them stay.
- **The 40-commit ceiling stays as a backstop.** It keeps raising `branch-drift-blocked` for overlapping queued cards. It is not a trigger.
- **The tick length is a config value.** Fork 1 is about what triggers a merge, not how many minutes a tick lasts.
- **Duplicate backlog ids** stay on #3772 point 3; none exist today.

## Fork 1 — How far behind main the branch may fall (the lag contract)

*Fork-existence:* the policy must say how soon main's changes reach the branch; "promptly" and "in batches" cannot both be the rule. A batch-at-the-ceiling rule is broken for this job: it guarantees every merge is at least as large as the ceiling, which is the exact cost the policy exists to avoid. *What is ruled is the contract; the trigger mechanism (the runner tick today) is #3797's build choice.*

- **(a) Promptly — recommended.** Whenever main has commits the branch lacks, the next sync pass merges them, so the branch trails main by at most one pass. The 40-commit ceiling is a backstop, never the trigger. This is what `we:scripts/conveyor/poc-branch-sync.mjs` already does on each runner tick (step 2: nothing to do when main has nothing new). On 2026-09-14 it kept the branch within 5 commits of main, and the first conflict came at 3 commits behind: small, and attributable to one landing.
- **(b) In batches on a slower schedule** (for example hourly). Rejected on merit: each merge bundles more landings, so a conflict is larger and harder to attribute to the change that caused it, and the branch runs on a stale main for the whole interval.
- **(c) Only when the main-only count passes the 40-commit ceiling.** Rejected: every merge is then at least 40 commits, the largest possible conflict each time. The ceiling stays as the backstop that raises `branch-drift-blocked`.

**Accepted cost of (a), named:** a clean sync merge is pushed with no test gate, by design (the "NO TEST GATE, DELIBERATELY" section of `we:scripts/conveyor/poc-branch-sync.mjs`'s header), so the runner can run a merged tree nobody tested. The cover is #3768 design point 6 (a `check:standards` run on each push to the branch), not this card.

**Skeptic:** SURVIVES-WITH-AMENDMENT → applied. Classification attack: (a), (b) and (c) are values of one knob (minimum lag), and (a) is already built and switched on. Accepted in part: the fork is kept only because (c) is a broken value (it makes every merge the largest one), and it is now framed as the lag contract with the trigger left to #3797. Merit attack: the per-tick merge is untested; now named above as an accepted cost with its cover.
**Screen:** flagged(impl) → fixed. The first draft ruled the trigger mechanism (every tick vs hourly), which the operator never sees. Re-layered to the lag contract; the tick is a build choice.

## Fork 2 — Who resolves a conflict, and what freezes while it is open

*Fork-existence:* exactly one party must own a conflict, and the branches cannot coexist. If the agent and the operator both own it, the same conflict is resolved twice, possibly two ways. If nobody owns it, the branch drifts, which is what happened from 2026-09-14 to 2026-09-21.

- **(a) A dispatched reconcile agent on the staging ref, then a daemon promotes it once the tests are green — recommended.** The agent resolves the conflict on the staging ref; the automated sync pass, not a person, moves the shared branch. This **amends** #3556 rather than following it: #3556's ratified brief tells the agent to "merge/rebase the base into the branch" and "push directly to the branch" (`we:backlog/3556-auto-dispatch-a-reconciliation-agent-when-we-branch-sync-mjs.md`). The operator's ruling forbids the rebase, and this fork sends the push through the staging ref and a gate. Kept from #3556: a dispatched agent, one attempt per distinct conflict. Changed: merge only, never rebase, and push to the staging ref only. #3607's brief must be updated to match before it is built. The agent merges the branch tip and then main into `lane/mechanical-dispatcher-catchup` (creating it from the branch tip if it does not exist), resolves, and runs the branch's own tests. Every step is a merge commit, so earlier resolution work on the staging ref is kept and nothing is force-pushed. It never writes to the shared branch. A resolution it cannot decide on merit comes back as a decision card, as the first catch-up did with #3803.
  **The promotion.** The pass pushes the staging ref to the shared branch only when (1) the push is a true fast-forward (a plain push; git refuses anything else), (2) the branch's own tests are green at that exact commit, as the pass itself sees it, not as the agent reports it, and (3) it holds the same per-branch lock and `autoSync` gate as the clean-merge push. If the shared branch moved meanwhile, the newer commits are merged into the staging ref and the tests run again; a conflict there is a new conflict. A red result, or an agent that gave up, raises the alert (Fork 3) and nothing is pushed. The one-attempt cap per conflicting file set means a red result is not retried on its own; the alert goes to the operator, who decides the next step. If `main` moved while the agent worked, the promotion still goes ahead and the next pass takes the new `main` commits as an ordinary merge. A held lock or a switched-off `autoSync` makes the pass skip and try again on the next tick. **Why no human push is needed:** the prototype is not the trust boundary. A slice reaches `main` only through its own pull request, review and CI (#3443 Done-when 3), and clean merges already reach the shared branch with no gate. **Accepted cost, named:** a resolution that passes the tests but is wrong reaches the shared branch, and the runner may run it. Covers: nothing is force-pushed, so a wrong merge is undone by a revert commit; the tests; the review at graduation. **Residual risk:** the agent that resolves a conflict in a test file could weaken the test to make it pass. The agent's brief must send any resolution that changes a test's assertions back as a decision card.
- **(b) The same agent and staging ref, with the operator fast-forwarding by hand.** The wording this card first carried, taken from the operator's handling of the first catch-up. Rejected on merit: between turns a resolved staging ref waits for a person, nothing tells the runner it is waiting, and the live alert already sat unread for a week. It also makes the clean-merge push (a daemon) and the resolved-merge push (a person) two different paths for one branch.
- **(c) The operator alone.** Today's de facto path. Rejected on merit: the operator is not in the loop every tick, so between turns a conflict only the operator may resolve has no owner, and it grows with every landing on main (3 commits behind on 2026-09-14, a 58-file conflict today).
- **(d) The author of the conflicting change.** Rejected: the author is a finished session by the time the sync runs, and a conflict is between main's landing and the branch's change, so there is no single author to pick.
- **(e) The agent resolves and pushes to the shared branch, with no staging ref and no check but its own report.** Rejected on merit: the only check on the resolution is the agent's word. The staging ref plus tests the pass runs itself is what separates a resolution from a landing.

**Fork 2 sub-fork — what freezes while the conflict is open.**

- **(a) Only the sync merge freezes — recommended.** No new freeze is added. The pass keeps probing but merges nothing. Direct pushes to the prototype continue. Dispatched work is already held: while the drift verdict is `blocked`, `we:scripts/readiness/dispatch-plan.mjs:424-432` holds every queued card whose scope overlaps the branch's registered scope (`we:scripts/conveyor/`, `we:skills-src/conveyor/`), which is most prototype work. That hold is unchanged. Graduation slices are the one exception (Fork 4). **To stop the agent chasing a moving target:** each agent attempt is pinned to one (branch tip, main tip) pair; the one-attempt cap is keyed on the set of conflicting file paths (`git merge-tree --name-only`), not on today's signature, which hashes the whole `merge-tree` output (`conflictSignature`, `we:scripts/conveyor/branch-sync.mjs:85-88`) and so changes with every landing on either side; and the branch's newer commits are merged into the staging ref once, at the end, just before the fast-forward (evidence: 15 new branch commits cost 1 conflict today). **At most one attempt is in flight**, because there is one staging ref and one per-branch lock. Nothing is kept as a queue: each pass re-derives the open conflict from git (a dry-run merge of `main` into the branch), so whatever is still conflicting after a promotion becomes the next attempt on the next pass, and a different conflict that appears mid-attempt waits for that pass.
- **(b) Also freeze landings on the prototype until the promotion.** This would keep the staging ref a fast-forward without a refresh. Rejected on merit: it stops prototype delivery for as long as the conflict is open, although a landing whose files are not in the conflict is not endangered by it. The statute `we:docs/agent/platform-decisions.md#poc-branch-declared-delivery-mode` exists so that POC delivery is not slowed by a gate that does not protect it.
- **(c) Freeze all dispatch.** Rejected: a card outside the branch's scope is not endangered by the conflict, and the scoped hold already stops the ones that are.

```text
# Fork 2 (a): the reconcile agent's steps, on the throw-away staging ref only
git fetch origin main lane/mechanical-dispatcher
git switch -C lane/mechanical-dispatcher-catchup origin/lane/mechanical-dispatcher-catchup  # or from the branch tip if absent
git merge origin/lane/mechanical-dispatcher   # take the branch's new commits (1 conflict today)
git merge origin/main              # resolve main's conflicts here, a merge commit
<the branch's own tests>           # verify-lane on the staging ref
git push origin lane/mechanical-dispatcher-catchup   # the staging ref only; a plain push
# promotion, by the sync pass once the tests are green at this commit (by the operator, if Fork 2 (b) is ruled):
#   git push origin origin/lane/mechanical-dispatcher-catchup:lane/mechanical-dispatcher
#   (a plain push; refused unless it is a fast-forward)
```

**Skeptic:** SURVIVES-WITH-AMENDMENT → applied. Citation-scope attack: the draft called (a) "#3556's ratified shape", but #3556 ratified a rebase-or-merge and a direct push to the branch; (a) now says it amends #3556 and that #3607's brief must change. Sub-fork attack (close to refuted on its stated reason): the conflict signature re-arms after every landing, so "one attempt per signature" was unbounded; and "prototype landings continue" overclaimed, since dispatched conveyor-scope work is already held by `branch-drift-blocked`. Fixed by keying the cap on the conflicting file set, pinning each attempt to a tip pair, refreshing the staging ref once at the end, and stating the existing hold.
**Screen:** clear (Fork 2 and its sub-fork are policy the pipeline sees). Two cost-phrased rejection reasons, for (b) and for sub-fork (b), were restated on merit. The git block is an illustration, not part of the ruling.

**Update 2026-09-21 (review session, after the operator asked why they would fast-forward by hand):** option (a) changed from "the operator fast-forwards" to "a daemon promotes once the tests are green", the old (a) became (b), and (e) is the old (d). Cause: the card had read the operator's handling of the first catch-up as the steady-state ruling (see the correction at the top). **Inline red-team of the new default:** (1) *A daemon promoting an agent's own resolution is an agent clearing its own work.* That rule is about clearing a diff for `main`; the prototype is a declared POC branch and every slice still passes the pull-request path to `main`. Holds. (2) *The agent could turn a red run green.* Partly lands: the test-weakening case is now a named residual risk with a brief requirement. (3) *The branch moves while the agent works.* The pass merges the newer commits into the staging ref and re-tests; a conflict there is a new conflict under the file-set cap. Holds. (4) *It widens "fast-forward only after a clean merge" in the operator's ruling.* Yes: that sentence covers clean merges only, so this is the point the ruling left open and it needs the operator's ratification. **Not yet run:** an independent skeptic through `judgePanel` (this fork gates #3772); the four attacks above are this session's own. Fork 3's wording was adjusted to match; Fork 1 and Fork 4 are unaffected.

## Fork 3 — Where the alert goes, and where its record is kept

*Fork-existence:* the alert must land where the operator reads each turn. A place the operator does not read is broken: the live alert file sat unread from 2026-09-14 to 2026-09-21.

**When the operator is alerted (not a fork; it follows Fork 2's ruling).** Only when they must act: the reconcile agent's one attempt failed, or the tests on the resolved staging ref are red, so nothing is promoted. Nothing is raised while the agent is working. The alert fails visible: an unreadable alert record shows as "status unknown", never as "all clear".

- **(a) The alert file and a desktop notice only.** Today. Rejected: the file sits inside a checkout's git directory and the notice is transient. Nobody saw attempt 5.
- **(b) A line in the every-turn digest plus a row in the wip report — recommended.** The digest line is the push: it shows on every turn while the state lasts. The wip row is the list: attention first, with its age. Both are raised only when the operator must act, and both fail visible. **A read-only surface is not enough on its own:** the turn digest reaches a session only once #3726 (deliver the digest by hook at session start and prompt time; open, `blockedBy: 3724`) is built, and the wip report runs only when the operator asks. The live log holds 42 unseen escalation lines. So the build of (b) is `blockedBy` #3726, and until #3726 lands the desktop notice stays on as a push channel, with the #3383 Done-when 2 notification path as its replacement once that exists. *Build note, not ruled:* the natural home is a `needsOperator` row in the turn digest (`we:scripts/operations/turn-digest.mjs`, which already reports unreadable sources in `unavailable[]`) plus the wip report. `we:scripts/operations/operator-queue.mjs` is a poorer home, because its header makes it "the SOLE authority on which human-gated PRs are worth the operator's time" and it has no non-PR row.
- **(c) The wip report only.** Rejected on merit: it runs only when the operator asks, so a stuck sync waits for someone to look, exactly as the alert file did.
- **(d) A GitHub issue.** Rejected on merit: an outward-facing record for an internal branch, and not where the operator reads each turn.

**Fork 3 sub-fork — where the alert record is kept.** The surface reads it; it is separate from how the alert is shown.

- **(a) A JSON file inside the `.git` directory of the clone that runs the loop.** Today (the prototype's sync and the main version each write their own). Rejected: it belongs to one clone and moves with #3797's dedicated clone, it is invisible from other hosts, and it is deleted when the conflict clears, leaving no history.
- **(b) A small file on an `ops/` branch on origin — recommended.** The repo already keeps two such branches, `ops/pr-views` and `ops/review-requests`. The sync pass commits when an alert opens, changes state or clears, so the git history is the alert's history. It is readable from any host, survives the loss of a clone, and does not depend on which clone runs the loop. One file per branch, so writers never collide; written on a state change only, never on every tick or re-nag. If the push fails, the pass keeps a local copy and the surface shows "status unknown" (the record was not saved).
- **(c) A file in a fixed folder on the operator's machine, outside any clone.** Simpler, and it survives a clone change. Rejected on merit: it is visible on one machine only, so a VM session or another host cannot read it, and it keeps no history.
- **(d) A backlog card per alert.** Rejected on merit: a card reaches `main` only through the pull-request path, so the alert could arrive hours late; the backlog holds work items, not runtime state; and every re-opened alert would file another card.

**Attack on the ops-branch record (b):** (1) *A hidden branch is invisible.* Only if the surface fails, and the "status unknown" line covers that. (2) *A new write path with its own failure modes (auth, a race with another writer).* One file per branch removes the race; a failed push falls back to a local copy and "status unknown" says the record was not saved. Holds.

**The wording of (b)'s lines (a spec that goes with the ruling, not a fork).** Exact text; words in braces are filled in by the build. A line appears only in these states, one line per stuck branch:

| State | The line, exactly |
| --- | --- |
| `agent-failed` | ⚠ Prototype sync stuck for {age}: the reconcile agent could not resolve the merge of main into {branch} ({n} files conflict). Its report: {report}. Next: resolve it by hand on {staging}, or have a session retry the agent. |
| `gate-red` | ⚠ Prototype sync stuck for {age}: the merge into {branch} is resolved but the tests fail at {sha}, so nothing was pushed. The failing run: {run}. Next: fix the tests on {staging}; the sync pushes it once they pass. |
| `unknown` | ⚠ Prototype sync: status unknown ({reason}). Do not assume it is fine. Next: check {record}. |

`{age}` reads "20 minutes", "3 hours" or "7 days"; the age is the only escalation. `{reason}` is "the alert record could not be read" or "the alert record could not be saved". `{record}` is the record's file on the ops branch. The desktop notice uses the title "Prototype sync stuck" and the line's first sentence as its body. The wip report shows the same line plus the time the state began. Every line carries one next step and a link to the evidence. The line clears itself on the pass after the conflict clears, and the record gets a "cleared" commit. When nothing is wrong, nothing is shown: no "all clear" message.

**Skeptic:** REFUTED as first written → rewritten. Attack: the digest is prototype-only and its delivery hook (#3726) is open and unbuilt, and the wip report runs only on request, so the first draft's alert waited to be read exactly like the file that failed (42 unseen escalations in the live log). Fixed: (b) is now `blockedBy` #3726 and keeps a push channel until the digest is delivered into every session.
**Screen:** flagged(impl) → fixed. The first draft ruled which module hosts the row (turn digest vs operator queue), which the operator never sees. Re-layered to the alert contract (every-turn surface, action-only, fails visible); the module choice is a build note.
## Fork 4 — When a slice may graduate to main, and in what order

*Fork-existence:* a slice either may land while the branch is behind main, or may not; one rule must hold. Copying a ported file byte for byte from a stale branch is broken: it silently reverts whatever main changed in that file since the merge base.

- **(a) Any time, with a per-file freshness rule — recommended.** Whatever the sync state. A slice lands through the normal lane, `we:scripts/verify-lane.mjs` and pull request path to `main` (#3443 Done-when 3; statute clause 3). For each file it ports, if main has a commit to that file since the merge base, the port applies the branch's change onto main's current file; it never copies the branch's file. This is what #3443's hand-ports already do; the check makes it mechanical. **If a ported file is in the open conflict set**, the port takes the staging ref's resolution of that file when one exists; otherwise the port's version is recorded as the resolution the reconcile agent must adopt, so the same conflict is never resolved twice, two ways. Files the slice imports but does not port are covered by the graduation PR's CI on main's tree, not by the freshness check. **"Any time" needs one code change:** today a slice porting `we:scripts/conveyor/` files overlaps the drift scope and is held as `branch-drift-blocked` (`we:scripts/readiness/dispatch-plan.mjs:430`). The default exempts #3443 graduation slices (target `main`) from that hold. That amends statute clause 4(d) of `we:docs/agent/platform-decisions.md#poc-branch-declared-delivery-mode` ("a drifted branch still holds its own items") to add "except its graduation slices to the target". The exemption is safe on merit: a slice that lands a branch file on main makes main's copy match the branch, which shrinks the conflict on that file rather than growing it. **Order:** #3443's dependency order (`blockedBy`, inert pieces first). A slice does not wait for the branch's own health: its PR runs `check:standards`, `test` and `smoke` on main's tree. Consequence for the operator: the Priority order's rule 1, "nothing may graduate before the health chain", would no longer hold for slices once this is ruled.
- **(b) Only from a branch that is level with main.** The filing default. Rejected: it stops every slice while any sync is frozen. Today that means 58 conflicted files, most unrelated to the slice. It is against the operator's goal that graduation keep moving. It also fixes nothing (a) misses: the PR diff is taken against main either way.
- **(c) Any time, copying files as they are.** Rejected: a silent revert of main's edits whenever main moved the file. #3443's log records exactly this risk.
- **(d) Only after the whole branch is frozen and reconciled.** Rejected: it serializes every slice behind the slowest conflict.

```sh
# Fork 4 (a): the per-file freshness check, run in the graduation lane before the port
base=$(git merge-base origin/main origin/lane/mechanical-dispatcher)
for f in $SLICE_FILES; do
  if [ -n "$(git log --format=%h "$base"..origin/main -- "$f")" ]; then
    echo "moved on main: $f -> apply 'git diff $base origin/lane/mechanical-dispatcher -- $f' onto main's file"
  fi
done
```

**Skeptic:** REFUTED as first written → rewritten. Statute collision: clause 4(d) of `#poc-branch-declared-delivery-mode` says a drifted branch holds its own items, and `we:scripts/readiness/dispatch-plan.mjs:430` does hold graduation slices, so "any time" was false in the dispatcher today. Merit: a slice file in the open conflict set would be resolved twice, possibly two ways. Fixed: the default now exempts graduation slices from the hold and names the clause 4(d) amendment the codification must make, and conflict-set files take or set the staging resolution. Statute overlap reconciled: this is the only anchor collision found; `#repo-drain-check-contract` is untouched.
**Screen:** clear. Real policy; it overrides the Priority order's rule 1 for slices. The freshness script is an illustration; only "never copy a file main has moved" is ruled.

## Ruling

*All four forks were ratified by the operator on 2026-09-21, in the review session, each against the card's text as it stood when they said so. Codified in `we:docs/agent/platform-decisions.md#poc-branch-mechanical-sync`, which also amends clause 4(d) of `#poc-branch-declared-delivery-mode`.*

- **Fork 1: (a) promptly.** Whenever main has commits the branch lacks, the next sync pass merges them. The 40-commit ceiling stays only as a backstop. The trigger mechanism is #3797's build choice. Accepted cost as named in the fork: a clean sync merge is pushed with no test gate; the cover is #3768 design point 6.
- **Fork 2: (a) a dispatched reconcile agent on the staging ref, then the sync pass promotes it once the tests are green.** No person fast-forwards by hand. The promotion, its conditions (a true fast-forward, tests green at that exact commit as the pass sees it, the same lock and `autoSync` gate), what happens when a condition is not met, and the one-attempt-in-flight rule are as written in the fork.
- **Fork 2 sub-fork (what freezes while a conflict is open): (a) only the sync merge freezes; no new freeze.** Ratified separately, after it was laid out on its own, on 2026-09-21. Direct pushes to the prototype continue; the existing `branch-drift-blocked` hold on overlapping queued cards is unchanged; each agent attempt is pinned to one (branch tip, main tip) pair; the one-attempt cap is keyed on the conflicting file set.
- **Fork 3: (b) a line in the every-turn digest plus a row in the wip report, raised only when the operator must act, failing visible; sub-fork (b) the record is a small file on an `ops/` branch on origin.** Ratified on 2026-09-21 after the options and the exact wording were laid out. The wording under Fork 3 ("a spec that goes with the ruling") is the text the build uses. The build of the surface is `blockedBy` #3726, and the desktop notice stays on until then.
- **Fork 4: (a) any time, with a per-file freshness rule.** A slice graduates whatever the sync state; graduation slices are exempt from the `branch-drift-blocked` hold (the clause 4(d) amendment); a file `main` has moved is ported as a diff onto `main`'s current file, never copied; a ported file in the open conflict set takes the staging ref's resolution or is recorded for the reconcile agent to adopt. **Consequence, accepted by the operator:** rule 1 of the Priority order in #3383 ("nothing may graduate before the health chain") no longer holds for slices; each slice's PR runs `check:standards`, `test` and `smoke` on `main`'s tree.
- **Where the build went (Done-when 2).** Folded into existing cards: #3797 (the loop: cadence, conflict dispatch, promotion), #3607 (the reconcile agent's brief change and a promotion test, amending #3556), and #3772 (a correction: the staging ref and a person's fast-forward were ruled for the first catch-up only). Carved into new items under #3383: `3835` (the ops-branch record, digest line and wip row; `blockedBy` #3726) and `3836` (the drift-hold exemption, the freshness rule in #3443's slice procedure, and the amended Priority order rule 1).
- **Not done before ratifying:** an independent `judgePanel` skeptic on Forks 2 and 3. The operator ratified on this session's inline red-team, recorded in Fork 2's update note.

## Not in this decision

Duplicate backlog ids stay on #3772 point 3 and #3768. The loop's build details stay on 3797: which of the three sync actors survives, the dedicated clone, retiring pid 81962. The five judgment calls of the first catch-up stay on #3803.

### Review jury (provisional — pre-registered #2638)

Care level: `elevated`. This jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |

**Predicted touch-set (#2619)** for the work this decision authorizes, coarse and prefix-shaped —
`we:scripts/conveyor/poc-branch-sync.mjs` · `we:scripts/conveyor/branch-sync.mjs` ·
`we:scripts/operations/turn-digest.mjs` · `we:scripts/operations/turn-digest-io.mjs` ·
`we:skills-src/conveyor/` · `we:scripts/readiness/dispatch-plan.mjs` · `we:docs/agent/platform-decisions.md`. The first five are built on the prototype
branch. A child carved at resolve time takes its own slice: the conflict-owner dispatch (Fork 2) takes
`we:scripts/conveyor/poc-branch-sync.mjs` + `we:skills-src/conveyor/` and folds into #3607/#3797; the alert row
(Fork 3) takes `we:scripts/operations/turn-digest.mjs` + `we:scripts/operations/turn-digest-io.mjs`; the
graduation rule (Fork 4) takes `we:scripts/readiness/dispatch-plan.mjs` (the hold exemption) plus the slice
procedure in `we:backlog/3443-graduate-origin-lane-mechanical-dispatcher-to-main-in-small.md`; the codification,
including the clause 4(d) amendment, takes `we:docs/agent/platform-decisions.md`. The frontmatter `scope:` was set at filing and is not the build scope.

## Done when

1. **Executable** — `grep -l '^## Ruling' we:backlog/*prototype-branch-is-kept-up-to-date*.md` lists this card (it fails until the operator has ruled and a `## Ruling` section names the chosen option for each of the four forks).
2. The ruling's build work is carved into slices under #3383 or folded into 3797 and #3772; the loop's own acceptance, not this card, checks `git rev-list --left-right --count origin/main...origin/lane/mechanical-dispatcher` against the ruled cadence.
