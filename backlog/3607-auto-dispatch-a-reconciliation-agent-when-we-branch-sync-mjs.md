---
bornAs: x1yx2la
kind: story
size: 5
parent: "3556"
status: open
scope: ["we:scripts/conveyor/branch-sync.mjs", "we:skills-src/conveyor/branch-sync-fix-brief.md", "we:scripts/conveyor/__tests__/branch-sync.test.mjs"]
dateOpened: "2026-09-07"
tags: []
---

# Auto-dispatch a reconciliation agent when we:branch-sync.mjs escalates

Ratified by we:backlog/3556-auto-dispatch-a-reconciliation-agent-when-we-branch-sync-mjs.md (all 4 forks). we:scripts/conveyor/branch-sync.mjs's escalation path dispatches a real reconciliation agent through the declared spawn primitives (we:scripts/operations/dispatch-lane-io.mjs#buildAgentArgv/#defaultSpawnAgent, fresh dispatch, no resumeSessionId) instead of only alerting a human. Dispatch is capped at one attempt per distinct conflict signature via a new configurable env-override constant (Number(process.env.WE_BRANCH_SYNC_DISPATCH_RETRY_CAP || 1), default 1), tracked in we:branch-sync.mjs's own durable state. The dispatched agent acquires its own lane and runs a new small generic brief (we:skills-src/conveyor/branch-sync-fix-brief.md). Lands on main via the normal lane -> PR -> independent-review pipeline (we:branch-sync.mjs already lives on main, confirmed byte-identical to origin/lane/mechanical-dispatcher) -- see we:backlog/3556-*.md's own Done-when for the full concrete spec.

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
   (`we:.git/branch-sync-state.json` or a sibling file it owns) gains a `dispatchedFor: <signature>` /
   attempt-count record keyed by `conflictSignature`; the escalation path dispatches only while the recorded
   attempt count for the current signature is `< DISPATCH_RETRY_CAP`, and once it reaches the cap, falls
   through to the existing human-alert path unchanged except for an upgraded notification/log line noting an
   auto-fix was already attempted (naming the attempt count and the cap).
3. **Lane acquisition (Fork 2).** The dispatched agent's very first brief step is acquiring its own lane
   (`we:scripts/lane-pool.mjs acquire`) exactly like every other dispatched brief — no lane-less path.
4. **New brief file (Fork 4).** `we:skills-src/conveyor/branch-sync-fix-brief.md` — a new, generic template
   filled only with `{{BRANCH}}` (`lane/mechanical-dispatcher`), `{{BASE}}` (`main`), and `{{REPO_DIR}}` (the
   live scratch checkout path), through the existing `we:scripts/operations/dispatch-lane.mjs#fillBrief`
   mechanism. Instructs, in order: acquire a lane; merge/rebase `{{BASE}}` into `{{BRANCH}}`; resolve every
   real conflict by reading both sides; run the full test suite + `check:standards`; push directly to
   `{{BRANCH}}` (mechanical-delivery-doctrine rule 4 — no story/PR/review ceremony for a fix confined to the
   prototype branch); if a conflict cannot be safely resolved, write the Fork-3 stand-down state (not guess,
   not force-push a red diff), then stop and report.
5. **Landing target: `main`, full pipeline (lane → PR → independent review) — not a direct push to
   `origin/lane/mechanical-dispatcher`.** `we:scripts/conveyor/branch-sync.mjs` already lives on `main` today
   (confirmed byte-identical against `origin/lane/mechanical-dispatcher` — `git diff origin/main
   origin/lane/mechanical-dispatcher -- we:scripts/conveyor/branch-sync.mjs` is empty) — mechanical-delivery-
   doctrine rule 4's direct-push carve-out is scoped to code that exists ONLY on the prototype branch, and
   does not apply here merely because the feature operates on that branch.
6. **Executable** — a new test in `we:scripts/conveyor/__tests__/branch-sync.test.mjs` (or a sibling file)
   that fails before this item lands and passes after: on a fixture escalation, asserts (a) the dispatch call
   is made through `buildAgentArgv`/`defaultSpawnAgent` with no `resumeSessionId`, (b) a second escalation
   carrying the identical `conflictSignature` does NOT re-dispatch once the recorded attempt count reaches
   `DISPATCH_RETRY_CAP`, (c) setting `WE_BRANCH_SYNC_DISPATCH_RETRY_CAP=2` in the test environment allows a
   second distinct dispatch attempt for the same signature before falling back to the human-alert path — the
   direct proof the cap is a configurable setting, not a hardcoded `1`.
7. **Executable** — `npm run check:standards` stays green.

**Not pinned down by this Done-when** (left to the build's own judgment, per `we:backlog/3556-*.md`'s own
"What this ruling does not settle"): the exact JSON shape of the state extension, and whether a successful
auto-dispatched reconciliation posts any durable record beyond ordinary git history.
