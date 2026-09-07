---
bornAs: xob5py1
kind: decision
parent: "3383"
status: resolved
dateOpened: "2026-09-06"
dateStarted: "2026-09-07"
dateResolved: "2026-09-07"
codifiedIn: "docs/agent/platform-decisions.md#branch-sync-conflict-dispatched-not-scripted"
preparedDate: "2026-09-06"
tags: [conveyor, branch-sync, dispatch, reconciliation]
---

# Auto-dispatch a reconciliation agent when we:branch-sync.mjs escalates

we:scripts/conveyor/branch-sync.mjs (#3472) is the bounded-retry-then-escalate loop that keeps the
`origin/lane/mechanical-dispatcher` prototype branch synced against `origin/main`. On a real, unresolved
merge conflict it retries a few times with backoff, then ESCALATES: a durable JSON alert
(`we:.git/branch-sync-alert.json`), a macOS desktop notification, and a loud banner in its human log — but it
never dispatches anything to actually fix the conflict. A human has to notice the alert and reconcile by
hand (exactly what happened live on 2026-09-06/07: the branch drifted 124+ commits behind before anyone
looked). we:docs/agent/platform-decisions.md#parked-pr-conflict-dispatched-not-scripted (`#3544`,
ratified 2026-09-06) already settled the analogous question for a PARKED PR that drifts into a conflict:
dispatch a real agent through the existing bounce+fix pipeline rather than a bespoke script, because the
agent's output still lands through the same independent-review gate. This item asks whether/how the same
shift applies to we:scripts/conveyor/branch-sync.mjs's escalation — and finds the answer is "yes, but the
mechanism cannot be identical," because `#3544`'s whole dispatch path (`we:reconcile-finding.mjs` →
`review:changes` bounce → `we:reconcile-core.mjs`/`we:reconcile-fix-dispatch.mjs`) is keyed on a PR number and a
review label; a branch-sync escalation has neither — there is no PR, no reviewer, no comment thread, and
(per the requester's own framing) no "original builder" session to consider resuming. Four forks below.

### Recommended path at a glance

| | recommended default | main alternative | confidence |
| --- | --- | --- | --- |
| Fork 1 | **(a) call the SAME declared spawn primitives directly (we:scripts/operations/dispatch-lane-io.mjs#buildAgentArgv + #defaultSpawnAgent, fresh dispatch only, no `resumeSessionId`), with a new small generic brief template — never a bespoke inline prompt, never a second spawn implementation** | (b) hand-roll a one-off `spawn('claude', …)` call inside we:branch-sync.mjs itself | high |
| Fork 2 | **(a) the dispatched agent acquires its own lane exactly like every other dispatched agent (`we:lane-pool.mjs acquire`, its brief's own step 1) — already settled by standing doctrine ("every edit-action session runs in a lane clone... no primary exception"), not a new fork** | (b) invent a lane-less path since this isn't a normal build | high |
| Fork 3 | **(a) extend we:branch-sync.mjs's OWN existing durable JSON state (`we:.git/branch-sync-state.json`, or a sibling file it also owns) with a `dispatchedFor: <signature>` marker; dispatch AT MOST ONCE per distinct conflict signature; a later escalation carrying the SAME signature is terminal for auto-dispatch (the agent already tried and did not land a fix) and falls back to the existing human-alert path, with the notification text upgraded to say an auto-fix was already attempted** | (b) a dedicated separate retry-count file mirroring the PR-based `NEGOTIATION_ROUND_CAP`, or (c) keep re-dispatching on every re-nag interval with no cap | medium |
| Fork 4 | **(b) a new, dedicated, generic brief template (`we:skills-src/conveyor/branch-sync-fix-brief.md`), filled only with `{{BRANCH}}`/`{{BASE}}`/`{{REPO_DIR}}`-style tokens (mirrors `we:fix-agent-brief.md`'s own fill mechanism) — this counts as "the card + the generic brief" (mechanical-delivery-doctrine rule 2) even though there is no backlog card behind a branch-wide drift, because the brief itself IS the generic, non-bespoke mandate every dispatch of this kind gets, unchanged run to run** | (a) reuse `we:fix-agent-brief.md` verbatim (wrong shape — it assumes a PR number and a scope-bearing backlog item, neither of which exists here) | high |

1. **Fork 1 — dispatch mechanism: the one declared spawn implementation, not a bespoke `spawn()` call.**
   we:scripts/operations/dispatch-lane-io.mjs#buildAgentArgv already has an opt-in `resumeSessionId`
   branch (added for `#3544`) alongside its default fresh-dispatch shape (mint a session id via
   `randomUUID()`, `['--bg', '--session-id', <id>, '-n', <slug>, ..., <prompt>]`, spawned through
   `#defaultSpawnAgent`). we:branch-sync.mjs's escalation path calls this SAME function with NO
   `resumeSessionId` (the requester's own framing: there is no "original builder" concept for a
   branch-wide drift the way there is for a single PR someone specifically authored) — never a second,
   parallel `execFile('claude', …)` call invented inside we:branch-sync.mjs. This is the same
   one-spawn-implementation statute `#3544`'s Fork 1/Fork 4 both already implement within
   ([#conveyor-dispatch-calls-the-declared-operation](/docs/agent/platform-decisions.md#conveyor-dispatch-calls-the-declared-operation)).
2. **Fork 2 — lane requirement is not actually a new fork; standing doctrine already answers it.**
   The requester's own prompt flagged "should the dispatched agent still need a lane" as a possible open
   question, but it is not: this repo's ratified rule is that every edit-action session runs in an
   isolated lane clone with no primary-checkout carve-out
   ([we:docs/agent/backlog-workflow.md](/docs/agent/backlog-workflow.md), "Work in a lane, not the primary
   checkout — set it up FIRST"), and mechanical-delivery-doctrine rule 4 additionally confirms a
   prototype-branch fix still needs a lane clone even though it skips the story/PR/review ceremony. The
   dispatched agent's brief (Fork 4) therefore opens with the same "acquire your own lane" step every
   other dispatched brief already opens with, targeting `origin/lane/mechanical-dispatcher` instead of
   `origin/main` as the branch to reconcile against.
3. **Fork 3 — the genuinely open fork: retry/cap semantics with no PR to carry a durable count.**
   `#3544` Fork 3 could reuse we:scripts/conveyor/reconcile-core.mjs's existing
   `NEGOTIATION_ROUND_CAP` (counted via `countRearmComments` against a PR's own comment thread) and
   we:scripts/conveyor/stand-down.mjs's durable `STAND_DOWN_MARKER` PR comment — both PR-comment-based,
   both meaningless for a bare branch with no PR and no reviewer. we:branch-sync.mjs already owns exactly
   one piece of durable, restart-surviving state for this purpose: `we:.git/branch-sync-state.json`
   (the retry/backoff record) and `we:.git/branch-sync-alert.json` (the escalation dedup record, keyed by
   {@link conflictSignature}). The recommended default extends that existing state rather than inventing
   a second store: dispatch once per distinct conflict signature, record that a dispatch was attempted for
   this signature, and treat a LATER escalation carrying the identical signature as proof the dispatched
   agent did not resolve it — terminal for auto-dispatch (never re-dispatch a second agent at the same
   unresolved signature), always falling through to the existing human-alert behavior (which needs no
   change to fire) with an upgraded notification/log message noting an auto-fix was already tried. A
   branch-wide reconciliation dispatch is a much heavier action than a single-PR fix-agent retry (a whole
   agent session versus a scoped fix), and unlike a PR-based retry it leaves no visible per-attempt comment
   trail a human could audit — so capping at ONE attempt per signature (not the PR-based flow's 5-attempt
   cap) is the safer default until real experience says otherwise. **This is the one fork this item asks
   the operator to actually rule on** — the other three are direct, low-risk applications of already-
   ratified patterns.
4. **Fork 4 — a new, small, generic brief file, not a bespoke prompt and not a forced reuse of the
   PR-shaped `we:fix-agent-brief.md`.** Mechanical-delivery-doctrine rule 2 requires "the card + the generic
   brief, never a bespoke prompt" for anything this epic mechanizes — but `we:fix-agent-brief.md`'s own
   template assumes a `{{PR_NUM}}`, an `{{ITEM_NUM}}`, and a `{{SCOPE}}` pulled from a backlog item's
   frontmatter, none of which exist for a branch-wide drift. The recommended default authors a new,
   equally-generic template (`we:skills-src/conveyor/branch-sync-fix-brief.md`) filled only with
   `{{BRANCH}}` (`lane/mechanical-dispatcher`), `{{BASE}}` (`main`), and `{{REPO_DIR}}` (the live scratch
   checkout path) — the SAME token-fill mechanism we:scripts/operations/dispatch-lane.mjs#fillBrief
   already provides, just with a different, smaller required-token set for this one dispatch kind. The
   brief instructs: acquire your own lane (Fork 2), merge/rebase the base into the branch, resolve every
   real conflict by reading both sides, run the full test suite + `check:standards`, push directly to the
   branch per mechanical-delivery-doctrine rule 4 (no story/PR/review ceremony for a prototype-branch fix),
   and if a conflict cannot be safely resolved, write the Fork-3 stand-down marker into we:branch-sync.mjs's
   own state file rather than guessing or force-pushing a red diff, then stop and report.

**What this ruling does not settle.** The exact JSON shape of the Fork-3 state extension (a new top-level
key on the existing alert file vs. a new sibling file vs. folding it into `we:.git/branch-sync-state.json` itself)
is an implementation detail for the build, not a ruling this decision needs to pin down. Also unsettled:
whether a SUCCESSFUL auto-dispatched reconciliation should itself post any durable record beyond the
ordinary git history (a landed commit) — this item takes no position and leaves it to the build's own
judgment, consistent with how `#3544` left its own analogous implementation details to the build.

## Ruling (ratified 2026-09-07, operator)

**Ratified 2026-09-07** — the operator ratified **all four forks** as this card's own bolded recommended
defaults, with one substantive amendment to Fork 3's mechanism:

1. **Fork 1 (a) — ratified as-is.** Dispatch calls the same declared spawn primitives
   (`we:scripts/operations/dispatch-lane-io.mjs#buildAgentArgv` / `#defaultSpawnAgent`), fresh dispatch only,
   no `resumeSessionId`. Not really contested.
2. **Fork 2 (a) — ratified as-is; confirmed not a fork.** The dispatched agent acquires its own lane exactly
   like every other dispatched agent — already settled by standing doctrine
   (`we:docs/agent/backlog-workflow.md`, "Work in a lane, not the primary checkout").
3. **Fork 3 (a) — ratified, AMENDED: the cap is a configurable product setting, not a bare hardcoded `1`.**
   Dispatch at most once per distinct conflict signature is ratified as the recommended default and
   mechanism (extend `we:branch-sync.mjs`'s own durable state with a `dispatchedFor: <signature>` marker; a
   later escalation carrying the same signature is terminal for auto-dispatch and falls back to the existing
   human-alert path with an upgraded message). **The operator's amendment: the attempt cap itself is a
   configurable knob, not a bare inline `1`.** New env-override constant, following this repo's own
   established env-override convention (default baked in, overridable via `process.env`, e.g.
   `we:skills-src/batch-backlog-items/workflow-progress.mjs`'s `STALL_S = Number(process.env.WF_STALL_S ||
   180)`):
   ```js
   const DISPATCH_RETRY_CAP = Number(process.env.WE_BRANCH_SYNC_DISPATCH_RETRY_CAP || 1);
   ```
   Default stays `1` (the card's own prepared reasoning for why one attempt is the safer starting point —
   heavier than a single-PR fix-agent retry, no per-attempt comment trail to audit — is unchanged), but an
   operator can raise it as a product setting once real experience says otherwise, with no code edit. The
   dispatch-count comparison against the durable per-signature state reads this constant, not a bare literal.
4. **Fork 4 (b) — ratified as-is.** A new, small, generic brief template
   (`we:skills-src/conveyor/branch-sync-fix-brief.md`), token-filled the same way
   `we:scripts/operations/dispatch-lane.mjs#fillBrief` already fills every other brief. Not really
   contested.

**Landing-target check, done before this item was resolved (mechanical-delivery-doctrine rule 4).** The
prompt driving this ruling assumed `we:scripts/conveyor/branch-sync.mjs` might live only on
`origin/lane/mechanical-dispatcher` (the prototype branch this item's dispatch logic targets) and so could
qualify for rule 4's ceremony-free direct-push path. Checked directly: `git diff origin/main
origin/lane/mechanical-dispatcher -- we:scripts/conveyor/branch-sync.mjs` is **empty** — the file is
byte-for-byte identical on both branches; it already lives on `main` (landed via `#3472`). Rule 4's
direct-push carve-out is explicitly scoped to code that exists ONLY on the prototype branch — it does not
apply here, even though the feature being added *operates on* the prototype branch. **This build therefore
lands on `main`, through the normal lane → PR → independent-review pipeline** — the same conclusion `#3572`
reached for `makeCliMechanicalPasses` earlier tonight, and the same reasoning: operating on the prototype
branch and living on the prototype branch are different questions.

**Codifies as an extension of, not a replacement for,**
[#parked-pr-conflict-dispatched-not-scripted](/docs/agent/platform-decisions.md#parked-pr-conflict-dispatched-not-scripted)
(`#3544`) — see the new
[#branch-sync-conflict-dispatched-not-scripted](/docs/agent/platform-decisions.md#branch-sync-conflict-dispatched-not-scripted)
anchor added alongside this resolve, which composes with `#3544`'s statute the same way `#1893` composes with
(rather than replaces) `#1868` in the same doc.

## Done when

This ruling's own Done-when is the follow-on build item it authorizes, filed alongside this resolve via the
declared `file-item` operation (parent: this item), carrying the concrete spec below as its own executable
Done-when. Restated here so the ruling is self-contained:

1. **Dispatch mechanism (Fork 1).** `we:scripts/conveyor/branch-sync.mjs`'s escalation path, on detecting a
   real unresolved merge conflict after its existing backoff/retry loop exhausts, calls
   `we:scripts/operations/dispatch-lane-io.mjs#buildAgentArgv` / `#defaultSpawnAgent` directly — the same
   primitives every other conveyor dispatch already uses — with no `resumeSessionId`, minting a fresh session
   id via `randomUUID()`. No second `spawn()`/`execFile()` implementation is added anywhere in
   `we:branch-sync.mjs`.
2. **Retry cap is configurable (Fork 3, amended).** A new exported constant in `we:branch-sync.mjs`:
   `const DISPATCH_RETRY_CAP = Number(process.env.WE_BRANCH_SYNC_DISPATCH_RETRY_CAP || 1);` — read at
   call time (not module-load-cached in a way a test can't override). `we:branch-sync.mjs`'s durable state
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
5. **Landing target.** The build itself (the dispatch logic inside `we:branch-sync.mjs`, the new brief file,
   the config knob) lands on `main` via the normal lane → PR → independent-review pipeline — confirmed above,
   `we:branch-sync.mjs` already lives on `main`, not prototype-only.
6. **Executable** — a new test in `we:scripts/conveyor/__tests__/branch-sync.test.mjs` (or a sibling file)
   that fails before this item lands and passes after: on a fixture escalation, asserts (a) the dispatch call
   is made through `buildAgentArgv`/`defaultSpawnAgent` with no `resumeSessionId`, (b) a second escalation
   carrying the identical `conflictSignature` does NOT re-dispatch once the recorded attempt count reaches
   `DISPATCH_RETRY_CAP`, (c) setting `WE_BRANCH_SYNC_DISPATCH_RETRY_CAP=2` in the test environment allows a
   second distinct dispatch attempt for the same signature before falling back to the human-alert path — the
   direct proof the cap is a configurable setting, not a hardcoded `1`.
7. **Executable** — `npm run check:standards` stays green.

**What this build's Done-when does not pin down** (left to the build's own judgment, per this ruling's own
"What this ruling does not settle" above): the exact JSON shape of the state extension, and whether a
successful auto-dispatched reconciliation posts any durable record beyond ordinary git history.

**Lineage:** filed under the background mechanical dispatcher epic `#3383`, extending
[#parked-pr-conflict-dispatched-not-scripted](/docs/agent/platform-decisions.md#parked-pr-conflict-dispatched-not-scripted)
(`#3544`) from a PR-scoped conflict to a bare-branch conflict with no PR.
