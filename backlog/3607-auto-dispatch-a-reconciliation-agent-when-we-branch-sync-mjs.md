---
bornAs: x1yx2la
kind: story
size: 5
parent: "3556"
status: open
blockedBy: ["x86eyvl", "xm96s8j"]
scope: ["we:scripts/conveyor/branch-sync.mjs", "we:skills-src/conveyor/branch-sync-fix-brief.md", "we:scripts/conveyor/__tests__/branch-sync.test.mjs"]
dateOpened: "2026-09-07"
tags: []
---

# Auto-dispatch a reconciliation agent when we:branch-sync.mjs escalates

Ratified by we:backlog/3556-auto-dispatch-a-reconciliation-agent-when-we-branch-sync-mjs.md (all 4 forks). we:scripts/conveyor/branch-sync.mjs's escalation path dispatches a real reconciliation agent through the declared spawn primitives (we:scripts/operations/dispatch-lane-io.mjs#buildAgentArgv/#defaultSpawnAgent, fresh dispatch, no resumeSessionId) instead of only alerting a human. Dispatch is capped at one attempt per set of conflicting files (amended 2026-09-21 by decision #3804; it was "per distinct conflict signature") via a new configurable env-override constant (Number(process.env.WE_BRANCH_SYNC_DISPATCH_RETRY_CAP || 1), default 1), tracked in we:branch-sync.mjs's own durable state. The dispatched agent acquires its own lane and runs a new small generic brief (we:skills-src/conveyor/branch-sync-fix-brief.md). Lands on main via the normal lane -> PR -> independent-review pipeline (we:branch-sync.mjs already lives on main, confirmed byte-identical to origin/lane/mechanical-dispatcher) -- see we:backlog/3556-*.md's own Done-when for the full concrete spec.

## Done when

1. **Dispatch mechanism (Fork 1).** `we:scripts/conveyor/branch-sync.mjs`'s escalation path, on detecting a
   real unresolved merge conflict after its existing backoff/retry loop exhausts, calls
   `we:scripts/operations/dispatch-lane-io.mjs#buildAgentArgv` / `#defaultSpawnAgent` directly — the same
   primitives every other conveyor dispatch already uses — with no `resumeSessionId`, minting a fresh session
   id via `randomUUID()`. No second `spawn()`/`execFile()` implementation is added anywhere in
   `we:branch-sync.mjs`.
2. **Retry cap is configurable (Fork 3, amended).** A new exported constant in `we:branch-sync.mjs`:
   `const DISPATCH_RETRY_CAP = Number(process.env.WE_BRANCH_SYNC_DISPATCH_RETRY_CAP || 1);` — read at call
   time (not module-load-cached in a way a test can't override). `we:branch-sync.mjs`'s durable state
   (`we:.git/branch-sync-state.json` or a sibling file it owns) gains a `dispatchedFor: <file set>` /
   attempt-count record keyed by the set of conflicting file paths (`git merge-tree --name-only`), not by
   `conflictSignature`, which hashes the whole `merge-tree` output and so changes with every landing on
   either side (amended 2026-09-21 by decision #3804, Fork 2 sub-fork). Each attempt is pinned to one
   (branch tip, main tip) pair. The escalation path dispatches only while the recorded attempt count for the
   current file set is `< DISPATCH_RETRY_CAP`; once it reaches the cap, it dispatches nothing more for that
   file set and raises the `agent-failed` alert (`we:docs/agent/platform-decisions.md#poc-branch-mechanical-sync`
   point 3; the record and its surface are #3835, and the existing notification/log line stays until then),
   naming the attempt count and the cap.
3. **Lane acquisition (Fork 2).** The dispatched agent's very first brief step is acquiring its own lane
   (`we:scripts/lane-pool.mjs acquire`) exactly like every other dispatched brief — no lane-less path.
4. **New brief file (Fork 4).** `we:skills-src/conveyor/branch-sync-fix-brief.md` — a new, generic template
   filled only with `{{BRANCH}}` (`lane/mechanical-dispatcher`), `{{BASE}}` (`main`), and `{{REPO_DIR}}` (the
   live scratch checkout path), through the existing `we:scripts/operations/dispatch-lane.mjs#fillBrief`
   mechanism, plus `{{STAGING}}` (`lane/mechanical-dispatcher-catchup`, the throw-away staging ref; added
   2026-09-21 by decision #3804). Instructs, in order: acquire a lane; on `{{STAGING}}` (created from the
   `{{BRANCH}}` tip if it does not exist), merge the `{{BRANCH}}` tip and then `{{BASE}}`, by merge commits
   only, never a rebase; resolve every real conflict by reading both sides; run the full test suite +
   `check:standards`; push `{{STAGING}}` only, by a plain push, and never push `{{BRANCH}}` (the sync pass
   promotes the staging ref, Done-when 8); send any resolution that changes a test's assertions, or that it
   cannot make on merit, back as a decision card instead of pushing it; if a conflict cannot be safely
   resolved, write the Fork-3 stand-down state (not guess, not force-push a red diff), then stop and report.
   *Amended 2026-09-21 by decision #3804 (Fork 2 (a), `#poc-branch-mechanical-sync` point 2): the #3556
   brief's "merge/rebase `{{BASE}}` into `{{BRANCH}}`" and "push directly to `{{BRANCH}}`" steps are
   replaced by the steps above.*
5. **Landing target: `main`, full pipeline (lane → PR → independent review) — not a direct push to
   `origin/lane/mechanical-dispatcher`.** `we:scripts/conveyor/branch-sync.mjs` already lives on `main` today
   (confirmed byte-identical against `origin/lane/mechanical-dispatcher` — `git diff origin/main
   origin/lane/mechanical-dispatcher -- we:scripts/conveyor/branch-sync.mjs` is empty) — mechanical-delivery-
   doctrine rule 4's direct-push carve-out is scoped to code that exists ONLY on the prototype branch, and
   does not apply here merely because the feature operates on that branch.
6. **Executable** — a new test in `we:scripts/conveyor/__tests__/branch-sync.test.mjs` (or a sibling file)
   that fails before this item lands and passes after: on a fixture escalation, asserts (a) the dispatch call
   is made through `buildAgentArgv`/`defaultSpawnAgent` with no `resumeSessionId`, (b) a second escalation
   carrying the identical conflicting file set does NOT re-dispatch once the recorded attempt count reaches
   `DISPATCH_RETRY_CAP`, (c) setting `WE_BRANCH_SYNC_DISPATCH_RETRY_CAP=2` in the test environment allows a
   second distinct dispatch attempt for the same file set before falling back to the `agent-failed` alert — the
   direct proof the cap is a configurable setting, not a hardcoded `1`, (d) a second escalation whose
   `conflictSignature` differs (a landing on either side re-armed it) but whose conflicting file set is the
   same does NOT re-dispatch, (e) a session's explicit retry (the step the `agent-failed` line offers, "have
   a session retry the agent"; its form is the build's choice) dispatches exactly one more attempt for that
   file set, and without it nothing re-dispatches. (b) and (d) amended, (e) added, 2026-09-21 by decision
   #3804.
7. **Executable** — `npm run check:standards` stays green.

8. **Executable** — amended 2026-09-21 by the ratified decision #3804 (`we:docs/agent/platform-decisions.md#poc-branch-mechanical-sync`, point 2): a test shows the pass pushes a resolved staging ref to the shared branch only when the push is a true fast-forward AND the branch's tests are green at that exact commit as the pass itself runs them (never the agent's report), under the per-branch lock and the `autoSync` gate; and at most one attempt is in flight. Its cases, each on real throwaway git fixtures:
   - fast-forward and green at that commit → pushed; the remote tip equals the staging tip;
   - red at sha S → nothing pushed and the `gate-red` alert raised; on later passes with the staging ref still at S, nothing is pushed, the alert stays, and no agent is re-dispatched (a red result is not retried on its own);
   - re-promotion after a manual fix: a fix commit pushed to the staging ref after `gate-red`, green at its new tip → promoted on the next pass, and the alert clears (the promise of the `gate-red` line, "the sync pushes it once they pass");
   - the agent gave up (cap reached) → nothing pushed and the `agent-failed` alert raised;
   - the shared branch moved meanwhile with no conflict → its newer commits are merged into the staging ref once, the tests run again, and the result is promoted if green; no alert;
   - the shared branch moved and its newer commits conflict → nothing pushed; it is a new conflict under the one-attempt cap per file set, not a direct alert;
   - `main` moved while the agent worked → the promotion still goes ahead, and the next pass takes the new `main` commits as an ordinary merge;
   - lock held → no push, no alert; retried on the next pass;
   - `autoSync: false` (or `WE_POC_BRANCH_SYNC=0`) → no push, no alert.

   The promotion is carried out by the loop in #3797, whose Done-when 1 lists the same cases; one test may serve both. Two security questions about this gate are open decisions, not rules yet: what the pass checks about test and gate files before it promotes (`x86eyvl`), and how the agent is kept from pushing to the shared branch (`xm96s8j`).

*Done-when 2, 4, 6 and 8 were edited in place on 2026-09-21 to match decision #3804 (it amends #3556's brief: merge only, staging ref only, promotion by the pass, the cap keyed on the conflicting file set).*

**Not pinned down by this Done-when** (left to the build's own judgment, per `we:backlog/3556-*.md`'s own
"What this ruling does not settle"): the exact JSON shape of the state extension, and whether a successful
auto-dispatched reconciliation posts any durable record beyond ordinary git history.
