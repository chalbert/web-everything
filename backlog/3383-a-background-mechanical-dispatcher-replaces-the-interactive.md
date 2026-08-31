---
bornAs: xyv0vbz
kind: epic
parent: "3029"
status: active
dateOpened: "2026-08-28"
dateStarted: "2026-08-31"
costTokens: "in:4258 cw:5434832 cr:788205472 out:1469575"
costUsd: 485.21
costSessions: 7
tags: []
---

# A background mechanical dispatcher replaces the interactive session as delivery supervisor

## The problem, stated plainly (2026-08-27/28, the operator's own words)

"The big problem at the moment is that much of this is handled by a costly session that is getting
super large, keeps forgetting its context and cost a lot." Delivery work — dispatching fixers and
reviewers, watching PR state, clearing stuck labels, healing CI — has run through one long
interactive session. That session IS the single point of failure: expensive per turn, its own
context degrades as it grows, nothing continues if it isn't open. `we:scripts/operator/converge.py`
(PR #1669) already proves most of the individual mechanisms work; what's missing is running them
without a person driving every step.

## The target shape (the operator's own spec)

- The session's role narrows to **queueing work** and **being notified of blocked items that need
  a person** — not driving routine progress turn by turn.
- A **mechanical dispatcher** owns queuing and capacity: it decides what runs now based on
  available capacity, not an agent's guess.
- **Subagents only edit code.** Every command they'd otherwise run themselves is delegated to the
  mechanical layer, which queues it and reports the result back — an agent never blocks waiting on
  its own shell command; it hands off and gets told the outcome.
- A **supervisor watches every agent** — progress, whether it's blocked, whether it's on track —
  and surfaces exactly that to whoever's queueing work, without anyone polling.
- Escalation is the exception path, not the default: most cases resolve mechanically (see
  `#3379`'s sibling cards — the stale-label clear, `ci:failed` healing, the ordering bug behind
  `#1659`'s stranding, the headless-reviewer polling fix); only genuinely novel cases reach an
  agent or a person at all.

## How to build it (the operator's own sequencing — deliberately NOT incremental-merge-from-day-one)

This is the opposite build strategy from `#3379`'s already-landed pieces, deliberately: those were
individually proven, low-risk, and graduated to `main` immediately. This is different in kind — an
unbuilt queue/dispatch/supervision system, not yet proven at all. Build and refine it in a
dedicated branch, alongside whatever else lands, WITHOUT the per-commit review tax that would slow
down free iteration on a design that doesn't exist yet. Once it is genuinely stable — proven over a
long stretch of real use, the way `converge.py` itself was proven tonight — split it into small,
individually reviewable pieces and move them to `main` the normal way, one at a time. Only once
everything has transferred does the real system execute from `main` instead of the branch.

**The one caveat that must not get lost in that plan:** a branch does not make the system's ACTIONS
safe, only its CODE unreviewed. The moment this dispatcher runs for real — even from a branch, even
before any of its code has landed — it is taking real actions against real PRs and real shared
state, exactly as `converge.py` already did all of tonight. "Not yet merged" is not the same
guarantee as "not yet running." Whoever builds this owes the same care to what it's allowed to
touch unattended as to the code itself, from the first real run, not just at graduation time.

## Why this card exists, not more work in the session that wrote it

This session is itself an instance of the problem this epic describes — large, deep into
compaction, expensive per turn. Building the actual dispatcher here would extend the exact pattern
this epic exists to end. Filed so a FRESH session — full budget, none of tonight's accumulated
context to carry — can pick this up and build it properly.

## Done when

1. A background process (not an interactive session) can run at least one real PR through a full
   fix → review → land cycle with zero interactive-session turns inside the loop.
2. A blocked/escalated case reaches a person or a fresh agent via an explicit notification, not
   because someone happened to poll and notice.
3. `we:scripts/operator/converge.py`'s already-proven mechanisms (independent review dispatch via a
   separate process id, `ci:failed` classification, stale-label recovery) are either subsumed by
   the new dispatcher or explicitly superseded by it — not left running in parallel indefinitely.

## Session update (2026-08-28, continued session) — five pieces built and tested, still unlanded

A follow-on session (same day) picked this back up and built five pieces toward the target shape
above, all individually unit-tested and smoke-tested against real subprocesses (not mocks) —
`check:standards` clean, 1300+ tests green as of last verification. Nothing below is landed to
`main`; it sits committed in lane-11 (`/Users/nicolasgilbert/workspace/.lanes/web-everything/lane-11`,
5 commits behind `origin/main` as of this update), deliberately, per this card's own "How to build
it" section above.

1. **Session-identity fix (#3331, resolved)** — `claude --bg` proven to ignore `--session-id`; the
   observer now reads the real handle off the CLI's own `backgrounded · <id> · <name>` stdout line
   instead. Touches `we:scripts/operations/dispatch-lane-io.mjs`, `we:scripts/operations/explore-io.mjs`,
   `we:scripts/operations/wake.mjs`.
2. **`we:scripts/operations/dispatch-lane.mjs` widened to `fix`/`ci-heal` launch kinds** — reuses
   the build-dispatch machinery.
3. **`we:scripts/operations/route-pr-outcome.mjs`** — new declared operation, thin wrapper over the
   existing `deriveReviewDisposition`, read-only, no sink — closes the gap where nothing under
   `scripts/operations/*.mjs` reached the escalation-disposition logic.
4. **`we:skills-src/conveyor/runner.mjs` now actually calls `dispatch-lane`** per surfaced decision,
   instead of only printing what it would do — the mechanization this epic's "Done when" #1 needs.
5. **`we:skills-src/conveyor/supervisor.mjs`** — a new resident process that keeps the runner above
   alive (restart on crash, backoff, JSONL log), roughly half the size of the `plateau-app`
   drain-daemon precedent because the runner already owns the hard parts. **Nothing installed to
   launchd** — deliberately left as code only; deployment is a separate, later call.

A smaller side-decision surfaced and closed independently during this work: decision #3384
("chasing a moving target" — a retry-cap counter that couldn't tell staleness from a real failure,
which once cost a real PR a human closing it by mistake) went through the full
`/prepare` → independent review → ratify → resolve cycle for real and is merged (`main`, PRs
#1674, #1675). Its own recommended fix is filed but not yet built.

**Correction (2026-08-29): #3118 IS ratified.** The "What's still not done" list below originally
opened with "Decision #3118 was never ratified... the single biggest open gap." That was wrong and
is now stale twice over — #3118 resolved on `dateResolved: 2026-08-26`, ruling (c), call the
existing `dispatch-lane` operation, never a second spawn implementation, codified at
[we:docs/agent/platform-decisions.md#conveyor-dispatch-calls-the-declared-operation](/docs/agent/platform-decisions.md#conveyor-dispatch-calls-the-declared-operation).
All five pieces built in the prior session update already presuppose exactly that answer, correctly.

**What happened since the update above:** lane-11, which held the prototype, had 4 of its 5 built
pieces — the session-identity fix, `route-pr-outcome`, the runner→`dispatch-lane` wiring, and
`we:skills-src/conveyor/supervisor.mjs` — wiped by an `acquire --lane=11` re-claim after the
original lease went TTL-stale. The explicit-lane acquire path has no dirty-tree guard (a bug filed
separately). All four were recovered byte-for-byte from Claude Code's own session transcripts — the
original session's main + subagent JSONL logs, cross-checked against its file-history backup store
(10 of 12 cross-checked files matched the backup exactly) — and re-verified: 364/364 tests green,
`check:standards` 0 errors. Everything is now pushed to a durable remote branch,
`origin/lane/mechanical-dispatcher-recovered`, not just local-only in a lane clone, so it survives
any future lane reset. lane-11 itself still holds the working copy and has an occupant declared.

**What's still not done, in priority order:**

1. **The live end-to-end test.** Nothing blocks it now — #3118 is ratified and all five pieces are
   recovered and tested. Still needs: a setup decision (a scratch clone of the recovered branch,
   named anything other than `lane-N` so `dispatch-lane`'s `assertNotALaneCheckout` guard doesn't
   refuse it, rather than lane-11 itself or requiring `main` first) and picking one specific
   low-stakes backlog item to actually dispatch. The existing `-live`-named tests
   (`we:scripts/operations/__tests__/dispatch-spawn-live.test.mjs` etc.) only prove subprocess
   plumbing against a fake `claude` stand-in on `PATH`, NOT the real CLI's behavior — the real-CLI
   uncertainty #3118 flagged (whether `--bg` really discards `--session-id`, the exact
   `backgrounded · <id> · <name>` stdout shape, whether resume-by-short-handle works) is still
   genuinely unverified, and is exactly what this live test is for.
2. **Landing lane-11's five pieces to `main`** via the normal small-PR path.
3. **The stray-run-record reaper for `dispatch-lane`** (disk hygiene for the runner's own bookkeeping
   over a long-running deployment) was designed but not built — low urgency.
4. **"Done when" #2 (a notification path for a blocked/escalated case) is still open** — nothing
   built this session addresses it directly; the supervisor's JSONL log is observability, not a
   notification.
5. **Decision #3384's own recommended fix** — the `<!-- ci-heal-committed: -->` self-report marker
   on `we:scripts/conveyor/ci-heal-mark.mjs` — is still unbuilt. The decision itself is ratified AND
   resolved; only the code is outstanding. A separate, smaller thread from this epic.

## Goal-vs-filed gap sweep (2026-08-30) — what the stated goal needs that nobody filed a card for

Prior sessions' own sweeps (see the unlanded `origin/lane/mechanical-dispatcher` branch's session updates)
audited EXISTING backlog cards against current code and found stale/resolved items — a code-vs-card pass.
This run asked the harder question instead: what does this epic's stated goal (zero interactive-session
turns inside the delivery loop) require that has no card at all, across lifecycle, deployment shape,
multi-tenancy, observability, durability, cost/billing, dispatch-surface security, testing/staging, and
operator documentation. Read this card's full text (including the unlanded branch's four further
2026-08-29/30 session updates), plus siblings #3029 and #2753, end to end.

**Two categories checked and found already covered — not filed:**
- **Deployment/hosting shape** (distributed lock vs. local file lock, shared DB vs. gitignored local state) —
  fully covered by the ratified #2626 decision + tracked #2742 migration, which explicitly names
  `we:skills-src/conveyor/runner-lock.mjs`'s split (local process guard stays local; arbitration becomes a
  DO lease iff runners go multi-host) and `we:.operations/`'s file-store-behind-a-seam design, gated on the
  #2703 trigger.
- **Multi-tenancy/access control** — deliberately NOT filed. #3049 (ratified framing, not-yet verdict)
  already holds productizing the conveyor externally at "NOT-YET, pending a real customer ask"; filing
  speculative multi-tenant access-control work now would contradict that ruling, not fill a gap in it.

**Five genuine gaps filed, each checked against the backlog first (searches cited in each card's digest):**

- **#3397** — the supervisor has no reload lifecycle, only crash-restart (lifecycle/operability).
- **#3398** — the supervisor/runner has no out-of-band alerting, only a JSONL log (observability/alerting).
- **#3400** — the ratified hosted-key-billed mode has no metering/billing/auth design (cost/billing +
  dispatch-surface security).
- **#3401** — the dispatch-loop's own code is unregistered in TRUST_CHAIN, so a dispatched agent can
  weaken it via ordinary agent-clearable review (dispatch-surface security; adjacent to #2937).
- **#3399** — no operator runbook exists for running/monitoring/recovering the dispatcher (operator
  documentation).

Each names the sibling precedent it extends (#2468/#2501 for reload, #2489/#2493 for alerting, #2909/#2937
for the trust-chain gap) — this repo already solved each problem once, for a sibling resident process, and
none of those fixes were carried over to this epic's own new machinery.

**Not filed, and why:** several concrete operational findings from the 2026-08-29 session updates (the
orphaned `conveyor-*` OS session with no process reaper, the `verify-lane` TTL-vs-long-gate-run race, the
unset-`WE_DISPATCH_AGENT_ARGS` silent hang) are real but already surfaced in this card's own learnings-pool
section, explicitly awaiting a `/harvest` pass — filing them here would duplicate that already-planned step
rather than fill an unconsidered gap.

## Goal-vs-filed gap sweep, round 2 (2026-08-30) — the two categories the round-1 sweep named but never resolved

The round-1 sweep directly above lists "durability" and "testing/staging" among the categories it swept, but
neither category is actually resolved in its own write-up — no gap filed, no existing coverage cited, unlike
every other category there. This run closed exactly those two, grounded in the shipped code:

- **Data durability and crash recovery — a real, verified gap, not speculative.** `we:skills-src/conveyor/runner.mjs`'s
  in-flight/prepare/fix guard bookkeeping lives only in the runner process's own memory (`we:scripts/conveyor/tick-core.mjs`'s
  header says so explicitly: "no parallel on-disk state store is ever created"). `we:skills-src/conveyor/supervisor.mjs`
  crash-restarts a dead runner as its only recovery path, which wipes that bookkeeping. Unlike the fix/ci-heal
  retry-cap counters (proven to bind from a durable floor across a restart, `#2643`/`#2666`), the build
  in-flight guard has no durable floor — only a 3-tick in-memory TTL. A crash in the spawn-to-claim window
  reopens the exact double-dispatch already reproduced live and still open at `#3177` (two agents on #3151/
  #3150/#3154/#2972), via the new automatic-restart path rather than #3177's manual-redispatch path. Also
  flags `#2702`'s Done-when line 19, which claims "durable guard state surviving a runner restart — delivered
  in #2699"; that claim is stale relative to the shipped runner (#2699 only made tick-core pure/stateless, it
  never added persistence, and no caller built since has added it either). Filed as a new story.
- **Testing/staging story — a real, verified gap, not speculative.** This epic's own text already names the
  risk ("even before any of its code has landed... it is taking real actions against real PRs and real shared
  state"), and its own "still not done" #1 above confirms the plan: the live end-to-end test is a real,
  merely low-stakes backlog item, not a fixture. No dry-run/shadow/canary mode exists in
  `we:skills-src/conveyor/runner.mjs`, `we:skills-src/conveyor/supervisor.mjs`, or
  `we:scripts/operations/dispatch-lane.mjs` (grepped for `dry-run`/`dryRun`/`canary`/`shadow mode` — none).
  Filed as a new decision (capture-only, mirroring `#3049`'s shape — no build required to close it).

Both new cards cite the existing adjacent precedent/decision they extend or correct, and were checked against
the backlog first (search terms and negative results recorded in each card's own digest).

## Follow-up: independent verification + a blind design review (2026-08-30) — for the next session

Two more passes ran after the round-1 sweep above, per the operator's own request. **Three concrete threads,
current as of round 2 landing (#3402/#3403), so nothing here has to be re-derived:**

1. **A small fix is ready to land, verified, not yet a PR.** An independent check of round 1's five filed
   items found all five genuine and non-duplicate, but flagged that #3397/#3398/#3399 describe
   we:skills-src/conveyor/supervisor.mjs, which exists only on `origin/lane/mechanical-dispatcher`, not
   `main`. A landing-order note was added to each. **Confirmed still true after round 2**:
   we:skills-src/conveyor/supervisor.mjs, the #3390 dirty-tree guard, and the #2924 destructive-reset fix
   are all still absent from `main` as of this write-up (checked directly — `git merge-base
   --is-ancestor <fix-commit> origin/main` returns false for all three).
2. **A blind Fable review of this epic's design and goals surfaced ranked concerns, most not yet actioned.**
   Read cold (no access to any gap-sweep findings), ranked by how much it mattered to the reviewer:
   (a) escalation/notification (this card's own "Done when" #2, and the filed #3398) is under-built relative
   to how often it's already needed — a real dispatch sat `blocked` for days with nobody told; (b) in-flight
   liveness is tracked via four overlapping heuristics (tick-core's session-ephemeral state, dispatch-lane's
   run records, `claude agents --json`, lane-pool acquirability) rather than one source of truth — the same
   root cause round 2's #3403 names for the build-guard bookkeeping specifically, so #3403 is this concern's
   first concrete instance, not the whole of it; (c) **#3390 and #2924 — both already fixed and tested on
   `origin/lane/mechanical-dispatcher` — are known-good fixes for bugs that are STILL LIVE on `main`** (three
   independent close-sweeps reportedly hit #3390's bug on `main` the same day its fix sat unlanded); (d) the
   "subagents never run commands, only the mechanical layer does" doctrine is being enforced piecemeal
   (`WE_DISPATCH_KIND` in guard-bash, from #3105) without ever going through this repo's own decision
   process — captured to the learnings pool (`missing-convention`,
   `~/.claude/conveyor/learnings/note-20260830-091547.jsonl`) rather than filed directly, still pending;
   (e) the supervisor's clean-exit path gives zero restart delay (an idle-stop conveyor could busy-poll), and
   the runner's own singleton lease may not survive a long `verify-dispatch` pass, mirroring an
   already-documented lane-lease TTL race.
3. **(c) above is the one with a clock on it, and it is explicitly BLOCKED, not merely unstarted.** Landing
   #3390/#2924 needs cherry-picking two commits off `origin/lane/mechanical-dispatcher` (both isolated to
   we:scripts/lane-pool.mjs + we:scripts/lib/lane-lease.mjs per this card's own third-session update above)
   onto a fresh lane against current `main`. **Do not do this unilaterally while another session is actively
   driving this epic's own working branch** — check that session's intent first (it may already plan to
   carve these out per its own "Recommended order for the next session" list above), and re-confirm the
   branch state hasn't moved past what's described here. Note also: **#3390 and #2924 carry no `parent`
   field** — they are standalone, pre-existing items, not formally part of this epic's tree. Landing them is
   not "closing a child of #3383"; it is unblocking work this epic's own branch already depends on.

None of (d) or the #3390/#2924 land are done yet. This section exists so a fresh session doesn't have to
re-run the verification or the design review to find them again.

**Update: #3390/#2924 landed since the above was written** — `PR #1710` (`lane-pool: land #3390 dirty-tree
guard + #2924 re-verify-containment fixes`), merged. (d) — the doctrine ratification — became `#3405`,
filed under this epic, still open.

## Session update (2026-08-30, night session) — a real bug landed via dogfooding, two prior claims corrected,
## two items filed and landed, the live-fire dispatch still not attempted

Picked this back up per the operator's own framing: exercise the prototype for real before trusting it to
deliver, and treat every real snag as a machinery finding, same standing instruction as the 2026-08-29
session above.

**1. Landed `#1715`, a real, repeatedly-hit bug — not part of the dispatcher branch, but found while
assessing it.** `we:scripts/operations/open-pr.mjs`'s `HOME_REASONS` table had no entry for `enqueued`/
`labelled-on-green` (`pr-land`'s `--label-on-green` terminal reasons) — both fell to `unrun`, and the sink
threw "the PR was NOT opened" for a PR that had, in fact, opened. Hit live 7 times across 2026-08-29/30, all
in the (unharvested) learnings pool. Fixed directly rather than waiting for `/harvest`, per the operator's
own steer that this was worth fixing now. **A second bug surfaced dogfooding the fix itself**: the `/pr`
skill's own "dry-run first" step threw the same misleading error for a working rehearsal — the sink's
dry-run exemption keyed off the *request* argv, not the *reported* reason. Fixed, then independent review
(`review-pr`, correctness + security lenses, both CONFIRMED) found the first version of that fix had the
SAME class of bug the other way — keying on request argv let a genuine crash during a dry-run request go
unthrown. Fixed for real (`out.reason === 'dry-run'`), with the exact test the review asked for. Both
rounds are on `main` now (`we:scripts/operations/open-pr.mjs`, `we:scripts/operations/open-pr-io.mjs`,
`we:scripts/operations/__tests__/open-pr.test.mjs`).

**2. Correction: `#3404` is NOT live on `main`, contrary to an earlier in-session claim this update
retracts.** Checked `we:skills-src/conveyor/runner.mjs`'s actual `mechanicalPasses` body on `main` directly
— it only shells `we:scripts/conveyor/infra-blocked.mjs retry` + `we:scripts/conveyor/lease-reaper.mjs`,
both fast and deterministic. The long verify-dispatch pass that makes the stale-lease-during-a-long-pass
window real (`#3105`'s work) exists only on `origin/lane/mechanical-dispatcher`. So
`#3403`/`#3404`/`#3406` all remain genuinely branch-scoped — building any of them means picking a branch
first (see the still-open branch-strategy question below).

**3. Correction: the diff-driven test-selection shrink (`#2681`/`#3372`) would NOT have helped tonight's
verify-lane flakiness, contrary to an earlier in-session claim.** `backlog/` is deliberately excluded — it's
in `we:scripts/readiness/test-selection.mjs`'s own `GLOB_FIXTURE_ROOTS` (directory-scanning tests are
invisible to the module graph the shrink relies on) and absent from `SHRINK_ALLOW_LIST`. A backlog-only diff
correctly forces the full suite; shrinking it would risk a real false-green. Not a gap — working as designed.

**4. A genuine, new finding: `we:scripts/verify-lane.mjs`'s local full-suite gate is unreliable under real
host contention.** Four consecutive local `verify-lane` runs on the SAME backlog-only diff each failed on a
DIFFERENT, unrelated, timing-sensitive integration test — `we:scripts/__tests__/lane-pool-reap-on-acquire.test.mjs`'s
TTL-backdating cases (twice), then `we:scripts/__tests__/sync-skills-deploy.test.mjs`'s symlink-cycle test
(`#3011`'s own precedent for the identical load-flake shape, recurring). Every one passed clean run in
isolation. Filed `#3411` for the specific lane-pool-reap case. This host had, at the time, this session plus
a review session plus several other lanes' dev servers all running concurrently — not a corner case for a
dispatcher whose whole point is more concurrent local agents, not fewer.

**5. An open design question, discussed with the operator but NOT ruled on or filed — flagged for the next
session, not resolved here.** `we:scripts/lib/verify-lane-gate.mjs`'s own header already argues the local
full-suite run is a LOCAL, pre-CI sanity check, not the authoritative gate — the real, required GitHub
`test` check is, and `pr-land`/the drain already wait on and refuse-on-red against that CI check
independently of the local marker. Given (a) CI proved green on this exact code while local flaked twice,
and (b) this epic's own direction is more concurrent local dispatch over time, is the full local suite
still pulling its weight as a hard land-blocker, or should it shrink to a fast-fail-only role? No card
filed — the operator wanted the immediate flake fixed (`#3411`), not this reframed yet.

**6. Two items filed and landed, both on `main`:**
   - **`#3411`** — the `we:scripts/__tests__/lane-pool-reap-on-acquire.test.mjs` TTL-backdating flake from
     finding 4.
   - **`#3412`** — wrap `we:scripts/gap-sweep-status.mjs` as a declared operation, a small additive slice of
     `#3273`'s census. Picked specifically as the live-fire dispatch target: self-contained, no hot-file
     contention beyond the two registry lines `#3273` already clears for one slice.
   Both landed via the documented `WE_LAND_UNVERIFIED=1` break-glass (operator-approved for this specific
   case) after the local gate's repeated unrelated flakes, citing CI's independent green as the real proof —
   CI itself came back green on both.

**7. The live-fire dispatch itself is STILL not attempted this session.** `#3412` is filed, ready, and
picked specifically for this purpose — but no scratch clone was set up and no real dispatch was fired.
Nothing has actually tried this since the 2026-08-29 attempt documented in this epic's own history above.
**This remains the single highest-leverage next action.**

**8. Live, current evidence of the notification gap `#3398` already names — not cleaned up this session.**
`claude agents --json` shows three `conveyor-*` background agents sitting `blocked`/`waiting for dialog
open` right now: `conveyor-3150`, `conveyor-3151` (×2, different launches), `conveyor-3154` (×2) — one at
least 22+ hours old. Found only by checking by hand. Either clean these up via `we:scripts/operations/wake.mjs
--resolve --force` (`#3353`'s documented protocol) or leave them as further, current evidence for `#3398`'s
urgency — both valid, neither done here.

**9. Branch-strategy decision still not made.** `origin/lane/mechanical-dispatcher` (has `#3105`'s
gate-delegation fix + the updated `we:skills-src/conveyor/delivery-agent-brief.md`) and
`origin/lane/mechanical-dispatcher-recovered` (has `we:skills-src/conveyor/supervisor.mjs`, the lane-pool
ref-lock + `computeFreeSlots` fixes, the runner→`dispatch-lane` wiring) remain diverged, never reconciled.
`#3403`/`#3404`/`#3406` all need this decided before any of them can be built — see correction 2 above for
why.

**10. `#3405` (doctrine ratification) and the round-3 gap-sweep capture (candidate new gaps: a
dev/local-vs-SaaS runtime-mode distinction, resource management, VM/container isolation per lane — distinct
from the already-covered billing/lock-arbitration angles) remain open, untouched beyond conversation this
session.**

**For the next session, explicitly, so none of this has to be re-derived:**
- Trust corrections 2 and 3 over anything earlier in this card that contradicts them.
- Highest-leverage next action: the live-fire dispatch against `#3412` — scratch clone (non-`lane-N` name),
  `WE_DISPATCH_AGENT_ARGS` with a real permission mode set, one real `we:skills-src/conveyor/runner.mjs
  --once --json` tick.
- The branch-strategy call (finding 9) blocks `#3403`/`#3404`/`#3406` and arguably should happen before or
  alongside the live-fire attempt, since which branch gets exercised is exactly what that decision settles.
- The three stuck `conveyor-*` agents (finding 8) are real, current, and easy to check —
  `claude agents --json` first, `we:scripts/operations/wake.mjs --resolve --force` per `#3353` to close them
  out if that's the call.

## Session update (2026-08-30, continued) — finding 9 corrected with evidence, agents cleaned, #3405 ratified

**Correction to finding 9: the branch-strategy decision was never actually a fork — `origin/lane/mechanical-
dispatcher` is a strict superset of `origin/lane/mechanical-dispatcher-recovered`, verified by diffing the
trees directly, not by re-reading commit messages.** Finding 9's framing (two branches with disjoint unique
content, needing reconciliation) does not survive a direct comparison:

- `git diff --stat origin/lane/mechanical-dispatcher origin/lane/mechanical-dispatcher-recovered` shows every
  file `-recovered` touches also exists on `mechanical-dispatcher` — most in a strictly MORE advanced form
  (e.g. `we:scripts/operations/dispatch-lane-io.mjs` on `mechanical-dispatcher` carries the `#3105`
  `WE_DISPATCH_KIND` stamp and the `#3110` attempt-tag logic; `-recovered`'s version of the same file is the
  pre-`#3105`/`#3110` version, going *to* `-recovered` from `mechanical-dispatcher` is a net 3058-line
  deletion against 147 insertions).
- `mechanical-dispatcher` also holds whole files `-recovered` never got at all:
  `we:scripts/conveyor/verify-dispatch.mjs` (164 lines), the `#3390`/`#2924` lane-pool guard tests,
  `we:.claude/commands/status.md` and `we:.claude/commands/eli5.md`.
- The 147 lines unique to `-recovered` were checked directly (not assumed) — they are all OLDER/simpler
  versions of code `mechanical-dispatcher` already improved on (the pre-`#3390` `we:scripts/lane-pool.mjs`
  without the dirty-tree guard, the pre-`#3110` `classifyDispatchPr` without the attempt-tag axis), not novel
  content.

Read together with finding 9's own claim that `-recovered` holds "the lane-pool ref-lock +
`computeFreeSlots` fixes" — that claim is now stale too: `computeFreeSlots` exists on `mechanical-dispatcher`
as well, unchanged in relevant behavior, just reached via a different commit history because `-recovered`'s
history was reconstructed from session transcripts rather than a normal rebase. **`-recovered` was a
point-in-time rescue of lane-11's wiped files, taken before the same later session layered `#3390`/`#2924`/
`#3105`/`#3110`/`#3398` onto `mechanical-dispatcher` directly — it is a strictly earlier snapshot, not a
sibling with independent value.** Confirmed with the operator (2026-08-30): use `origin/lane/mechanical-
dispatcher` going forward for `#3403`/`#3404`/`#3406` and the live-fire test; `-recovered` adds nothing and
can be deleted or left to rot once nobody needs to double-check this finding.

**`mechanical-dispatcher` is also 87 commits behind `origin/main`** (21 unique commits ahead) — not reconciled
by the above; a separate, real step. 13 files changed on both sides since the branches diverged, including
`we:scripts/lane-pool.mjs`, `we:scripts/verify-lane.mjs`, `we:scripts/lib/lane-lease.mjs`,
`we:scripts/operations/wake.mjs` — real conflict risk, because `main` already landed `#3390`/`#2924`
(PR #1710) in those exact files independently of the branch's own equivalent guards. Rebasing onto `main`
and resolving those conflicts by hand is the next step, before the live-fire dispatch (which branch gets
exercised is exactly what this settles) — in progress this session.

**Stuck `claude agents` cleanup — six found, not three, and half were stale bookkeeping, not live
processes.** `claude agents --json` showed six blocked/waiting `conveyor-*` sessions, not the three finding 8
named: `conveyor-3154` (three separate launches, oldest from 2026-08-17 — 13 days, not "22+ hours"),
`conveyor-3151` (2026-08-17), `conveyor-3` in lane-25 (2026-08-25), and `conveyor-3150`/`conveyor-3154` again
(2026-08-29). Only two carried a live `pid` in the listing — `conveyor-3150` (30175) and `conveyor-3154`
(30255), both genuinely stuck at `claude --resume ... waiting for dialog open`; `ps` confirmed both, and both
were killed directly. The other four have no `pid` in the listing at all — `claude agents --json` is
reporting stale bookkeeping for processes already gone, not agents actually waiting on anything. Left
as-is (nothing to kill); this is itself live, current evidence for the exact liveness-reading gap `#3353`
already documents (a stale/unreadable `claude agents` listing, not a code defect in the dispatcher).

**`#3405` ratified.** Fork 1 → (a) denylist by verb-class, expand as each concrete case forces it. Fork 2 →
(a) halt and surface a `missing-operation` finding. Both match the card's own stated defaults; full reasoning
recorded on `#3405` itself and codified at
`we:docs/agent/platform-decisions.md#dispatched-agent-never-runs-commands-directly`. One Done-when item
(citing this ruling from `we:scripts/guard-bash.mjs`'s header) is deferred — `#3105`'s
`dispatchedAgentVerificationReason` does not exist on `main` yet (confirmed by grep; branch-only), so the
citation belongs in the branch copy of that file or with `#3105`'s own landing, not here.

## Session update (2026-08-30/31) — the branch is rebased onto `main`; the live-fire dispatch found a real,
## severe, reproducible bug and never got past it

Continued the same session, per the operator's explicit go-ahead: `origin/lane/mechanical-dispatcher`
rebased onto `origin/main` (finding 9's own next step), then the live-fire dispatch attempted for real from a
scratch clone of the rebased branch. The dispatch never succeeded — but the reason it failed is itself the
most important finding of the night.

**1. `origin/lane/mechanical-dispatcher` is rebased onto `origin/main` and pushed.** Was 87 commits behind, 21
ahead. Two commits were pure duplicates (patch-id matched, auto-dropped by `git rebase`). Six real conflicts,
all resolved by hand and verified against the actual diff content, not guessed:
- `we:scripts/lane-pool.mjs` (the `#3390`/`#2924` fetch — merged the branch's retry-wrapped
  `fetchOriginPruneWithRetry` around the SAME `#2924` re-verify-containment logic already on `main`; both
  fixes are real and now coexist).
- `we:scripts/verify-lane.mjs` (docblock only — the branch's `#3105` `request` mode section combined with
  `main`'s `#3378` own-lease-ok nuance to the `reset` line; the code body had no conflict).
- Four separate conflicts in `backlog/3383-*.md` itself, each the same shape: two independent append-only
  histories of this same epic card that had diverged. Every one resolved by reading BOTH sides in full and
  interleaving them in chronological order — nothing dropped, nothing picked over the other — since each
  held real, non-duplicate content (the branch's own 2026-08-29 "first live dispatch attempted" session, its
  "third session — rebased onto main" session, its `#3105` build write-up, and its learnings-pool digest all
  turned out to be genuine history `main`'s copy of this card never carried, not stale duplicates of anything
  already here).
Verified post-rebase: `npm run check:standards` 0 errors (matches baseline), 115 test files / 4181 tests /
4 skipped, all green, against the full `scripts/__tests__/lane-pool*`, `scripts/operations`, `scripts/conveyor`,
`scripts/lib`, `skills-src/conveyor` suites — not just the six touched files. Pushed with
`--force-with-lease` (clean, no rejected-ref surprise).

**2. The live-fire dispatch itself, run for real, twice, from a scratch clone
(`~/workspace/wev-scratch-dispatcher`, deliberately non-`lane-N`).** `node we:scripts/conveyor/queue.mjs add
3412` queued the target, then `WE_DISPATCH_AGENT_ARGS='["--permission-mode","acceptEdits"]' node
we:skills-src/conveyor/runner.mjs --once --json` — twice, since a stray earlier `--help` invocation (no such
flag exists; it silently ran the REAL resident loop with `maxTicks: Infinity` instead of erroring, a smaller
finding of its own worth noting for whoever adds real `--help` support) left the singleton runner lease
(`~/.claude/conveyor-runner-locks/`) held by a pid that no longer existed after it was killed via `TaskStop` —
confirmed dead via `ps`, the stale `we:lock.json` removed by hand, a fresh acquire then worked cleanly.

**Attempt 1 — `#3412` unscoped, routed to `spawnPrepareScope`.** The tick's own JSON output showed
`dispatch.prepareScope: [{"num":"3412","lane":1}]`. The `.operations/runs/dispatch-lane-*.json` record for
that same call showed `"dispatching": false`, `holdReason: "the tick core did not clear this item for
dispatch — it is not in decisions.spawnBuilds, decisions.spawnPrepareScope, ..."` — the OPPOSITE of what the
runner's own tick had just surfaced, moments earlier, in the same process. Re-ran; identical result both
times — reproducible, not a race.

**Attempt 2 — `#3412` given a `scope:` field by hand (the exact files its own card text already names, matching
`#3273`'s "HOW to slice it" shape), to route it to `spawnBuilds` instead** (the path the 2026-08-29 session's
successful `#2936` dispatch actually used). Same shape, same result: `dispatch.builds: [{"num":"3412",
"lane":1}]` in the tick's own output, then `"dispatching": false`, `holdReason: "suppressed by the in-flight
build guard (an agent is already in flight for this item)"` from `dispatch-lane`'s own run record. `claude
agents --json` confirmed no `conveyor-3412` session ever existed; `we:scripts/lane-pool.mjs status` confirmed
lane-1 stayed clean/unleased. Nothing was ever actually spawned, on either attempt.

**Root cause, traced to the exact code, not left as a symptom.**
`we:skills-src/conveyor/runner.mjs`'s `makeCliDispatchPass` (the function `dispatchPass` reduces to) computes
BOTH the dispatch decision (`dispatch.builds`/`dispatch.prepareScope`) AND the updated guard bookkeeping
(`nextState.buildGuards`/`nextState.prepareGuards`) in ONE tick-core call — the new guard entry for the item
about to be dispatched (`{num, lane, spawnedTick, sawPr: false}` or the build equivalent) is already present in
`nextState` before `dispatch-lane` is ever invoked. That exact `nextState` is then written verbatim to a
bookkeeping file and handed to `dispatch-lane --num=<n> --bookkeepingFile=<file>` — whose own internal,
independent `tick-core` re-plan reads that bookkeeping as the CURRENT guard state, sees the item's guard
already live, and — correctly, by its own in-flight-duplicate-prevention logic — refuses to dispatch it a
second time. Except there was no first time: the guard the second read is honoring was written by PLANNING,
never by an actual spawn. The double-dispatch guard this epic itself calls out as load-bearing (`#3383`'s own
"Done when" #1 depends on it, and Fable's blind review flagged the SAME class of problem — "in-flight liveness
tracked via four overlapping heuristics rather than one source of truth," now with a concrete first instance)
suppresses the very first dispatch it exists to protect.

**Filed as `#3416`** (JIT-numbered at land), parented under this epic, size 5, with an executable
mutation-test Done-when reproducing the exact shape plus a bisect-or-name-it Done-when asking whether this is
long-standing or a regression introduced by `#3105`/`#3110`'s later layering on top of whatever the
2026-08-29 session's machinery actually was. **This is very possibly the reason `#3383`'s own "Done when" #1
has never been observed succeeding through THIS exact call path** — the 2026-08-29 session's one successful
live dispatch (`#2936`) predates both `#3105` and `#3110`, so it may simply never have exercised this exact
`dispatchPass`/`makeCliDispatchPass` shape at all.

**Per this line of work's own standing instruction** (improve the machinery, not deliver the item — restated
explicitly by the operator across the 2026-08-29 and tonight's sessions): this is exactly what a first live
run is for, and finding it is the success this criterion exists to produce, not a failure of tonight's
attempt. `#3412` itself is untouched (no PR, no commit beyond the local, uncommitted `scope:` add in the
scratch clone, which is not part of any landed change) — still available as the live-fire target once
`#3416` is fixed.

**For the next session:** `#3416` is now the single highest-leverage next action — fixing it is very
plausibly the unblock for this epic's own core "Done when" #1, ahead of `#3403`/`#3404`/`#3406` (which need
the branch-strategy call, already settled above, but not this bug) and ahead of `#3405`'s already-ratified
doctrine. Re-attempt the live-fire dispatch against `#3412` once `#3416` lands.

**Update: `#3416` landed on `origin/lane/mechanical-dispatcher` (`78234c18`), live-verified — a real agent
spawned for the first time all session (`conveyor-3412`). Two follow-ups from that run: `3422` (should the
dispatcher mechanically file+queue a fix item on a real delivery hiccup, gated by approval) and `3418`
(gives a dispatched agent a static system-prompt identity separate from its per-item brief — landed to
`main`, PR #1729, reviewed and merged by the operator directly).**

**A real gap surfaced answering the operator's own question tonight: `planTick` mechanizes build,
prepare-scope, prepare-decision, fix, and ci-heal — there is no sixth launch kind for independently
reviewing a `review:pending` PR.** `planFixSpawns` mechanizes the BOUNCE (a `review:changes` PR gets a fix
agent automatically), but the review verdict itself — `review:pending` → accepted/changes — only happens via
an interactive session running `/review`/`/jury`/`converge`, or a human. This is very plausibly why this
epic's own "Done when" #1 ("zero interactive-session turns inside the loop") still can't be fully met even
with `#3416` fixed: a dispatched build agent can now genuinely get a PR open, but nothing mechanized carries
it from there to landed. The operator's own framing: "id be good to be able to use the prototype soon for
this." Not filed as its own card yet — noted here for whoever picks this up next to scope properly.

## Where this stands, end of the 2026-08-30/31 session — everything above landed or resolved

All four PRs from tonight are merged: `#1726` (`#3405` ratified + finding-9 branch-strategy correction),
`#1727` (`#3416` fix confirmation + `3422` filed), `#1729` (`3418` — the dispatched-agent system
prompt), `#1731` (this review-mechanization note). Nothing from tonight is open or blocked.

**Next, in priority order:**
1. **Re-attempt the live-fire dispatch against `#3412`** now that `#3416` is fixed — the guard-suppression bug
   is gone, but the fix has not yet been exercised against a genuinely FRESH scratch clone (tonight's
   `conveyor-3412` run used one with unrelated uncommitted work already in it, which is why THAT run stalled
   on its own judgment call, not the fix). A clean re-run is what actually closes this epic's "Done when" #1.
2. **Mechanize the review step** — no `planTick` launch kind turns `review:pending` into a verdict; only an
   interactive `/review`/`/jury`/`converge` or a human does. This is very plausibly the remaining gap between
   "a dispatched agent can open a PR" and "Done when #1's full fix→review→land cycle, zero interactive turns."
   Not yet scoped as a card.
3. **`3422`** (auto-file+queue a fix on a real delivery hiccup, gated by approval) is a real, open decision
   with forks stated but not ruled on.
4. **`#3403`/`#3404`/`#3406`** can now be built — the branch-strategy question that blocked them is settled
   (`mechanical-dispatcher`, not `-recovered`), and the branch is rebased current with `main`.

## Session update (2026-08-31, follow-on session) — the live-fire dispatch finally completed end to end,
## `xk7amte` ruled and landed as `#3422`, `dispatch-abort` built and PR'd, and the real permission-mode root
## cause found

Picked this back up per the operator's own priority order from tonight's close-out. All four items touched;
one fully closed, one landed, one built-but-parked, one confirmed-unblocked-but-not-started.

### 1. The live-fire dispatch against `#3412` — DONE, for real, first time all epic

The confounded scratch clone from the prior session (`~/workspace/wev-scratch-dispatcher`, still holding a
stuck `conveyor-3412` session and unrelated uncommitted changes) was stopped and abandoned per the operator's
own framing. A genuinely fresh clone, `~/workspace/wev-scratch-dispatcher-2`, was cut from
`origin/lane/mechanical-dispatcher` — which had drifted 18 commits behind `origin/main` again since the prior
close-out, so it was rebased current first (3 real conflicts, all in files both sides had touched since
diverging — `we:scripts/operations/dispatch-lane-io.mjs`'s `#xqyyoje` system-prompt param vs. `#3331`'s
session-identity fix, and the matching test/fixture files — resolved by hand, both sides' changes kept; 1791
tests green, `check:standards` 0 errors; pushed with `--force-with-lease`). This also settles priority 4: the
branch is current with `main` again as of tonight.

**Three real, previously-undiagnosed blockers stood between "fresh clone" and an actual dispatch, each found
by hitting it directly, not guessed at:**

- **A fresh scratch clone is never in Claude Code's own trusted-directories list.** `we:scripts/bootstrap-session.mjs`'s
  `trustableDirs()` only ever trusts the primary checkout and lane-pool lanes — never an ad-hoc scratch clone,
  which is exactly what `#3353`'s own live-run protocol calls for (a checkout named anything other than
  `lane-N`). Every prior session's live-fire attempt used a clone that had, by luck, already been trusted from
  an earlier manual dialog acceptance; tonight's genuinely-fresh one had not, and the dispatched agent stalled
  on a permission-prompt dialog with nobody there to answer it. Fixed for this run by hand
  (`withTrustedDirs`), and mechanized properly below (`we:scripts/operations/dispatch-abort.mjs --trust=<dir>`).
- **Using `kill <pid>` instead of `claude stop <id>` to end a stuck dispatched agent does not actually end
  it.** `kill` stops the OS process but does not deregister the session; something (unconfirmed what —
  possibly the same machinery that backs the mobile "remote agent" view) resurrected it under a NEW pid
  minutes later, twice, across two different scratch clones. One resurrection raced a second, legitimate
  dispatch attempt onto the same lane and produced a real double-dispatch onto `lane-5` — caught and cleaned
  up by hand, no damage done (the lane was still clean when found), but a genuine near-miss of the exact
  double-dispatch hazard this epic's own "Done when" #1 depends on avoiding. `claude stop <id>` does not have
  this problem — every stop issued through it stayed stopped.
- **The real, root-cause finding: `acceptEdits` is NOT the "non-prompting permission mode" `#3353`'s own
  protocol assumed it was, for a `--bg` dispatch specifically.** Confirmed directly, not guessed: the EXACT
  bash command a dispatched agent's brief step 1 runs (`export LANE_SESSION=...; LANE=$(node
  we:scripts/lane-pool.mjs acquire ...) && cd "$LANE"`) was run via `claude -p --permission-mode acceptEdits`
  (headless foreground) against the same trusted checkout and completed with ZERO prompt. The identical
  command, via `claude --bg --permission-mode acceptEdits`, stalls every time. `bypassPermissions` was ruled
  out separately — it refuses outright on a machine that has never interactively accepted its one-time
  disclaimer (`claude --dangerously-skip-permissions`, confirmed requires a real TTY; cannot be scripted). The
  actual fix: **`--permission-mode dontAsk`**, a mode neither `#3353` nor any prior session's `WE_DISPATCH_AGENT_ARGS`
  ever tried (found by re-reading `claude --help`'s full mode list — `acceptEdits`, `auto`, `bypassPermissions`,
  `manual`, `dontAsk`, `plan` — not the two this epic had been cycling between all along). With `dontAsk`, the
  SAME scratch clone, same brief, same everything: the dispatched agent went straight to `state: "working"`,
  never touched a permission prompt.

**The dispatch, run for real:** `WE_DISPATCH_AGENT_ARGS='["--permission-mode","dontAsk"]' node
we:skills-src/conveyor/runner.mjs --once --json`, from `~/workspace/wev-scratch-dispatcher-2`, `claude 2.1.251`.
Minted handle `aec264c2`, session name `prepare-3412`, `claude agents --json` row confirmed
`{"pid":96364,"cwd":".../wev-scratch-dispatcher-2","state":"working","status":"busy"}` — never blocked.
Acquired `lane-9` via its own `lane-pool acquire` (the exact scope-lease arbitration `#3037`'s acceptance
names) roughly 90s after spawn. Ran to completion unattended: read `#3412`, predicted its `scope:`, opened
`PR #1742` ("WE #3412: author scope: for #3412") through the canonical producer, watched it go green,
confirmed `ready-to-merge`, exited without merging — per its own brief. The drain landed it: **`PR #1742`
merged.** Full cycle, dispatch to merge, zero interactive-session turns anywhere inside it.

**Honest scope of what this proves, not more.** This was a `prepare-scope` launch kind (author `scope:`
frontmatter), not `build` (an actual code fix), and the PR never parked `review:pending` — it scored
low-risk enough to self-approve straight through. So it did NOT have to cross the still-open gap named
below (item 2): nothing here proves a `build` dispatch whose PR parks for review can complete unattended.
It DOES prove, for the first time all epic, that the dispatch→spawn→lane-acquire→real-work→PR→CI→drain-land
chain works end to end with a genuinely fresh checkout and zero interactive turns — the mechanism `#3037`'s
acceptance and this epic's "Done when" #1 both depend on is real, not theoretical.

### 2. `xk7amte` ruled, landed as `#3422` — the follow-up story is `#3421`

`xk7amte` only existed on a stray, never-merged branch (`origin/lane/3416-fix-landed-and-3383-followups`) —
this epic's own "filed" claim from the prior session's close-out was premature; the card was never on `main`.
Brought over and ruled in discussion with the operator (not unilaterally): Forks (a)/(b) collapse onto one
blocking/non-blocking axis — a blocking hiccup (delivery did not proceed) gets auto-filed with a proposed
fix, gated behind approval before it lands; a non-blocking hiccup (delivery succeeded, something's still
worth noting, e.g. perf) files straight through, no gate. Routes through the existing learnings-pool/
`/harvest` pipeline rather than a parallel one, triggered mechanically at the hiccup instead of a human
`/note`. `conveyor-3412`'s own free-form-question stall (named in the card) is explicitly ruled a blocking
hiccup. Landed via `PR #1740`; JIT-numbered `xk7amte→#3422`, its follow-up build story `x39jwee→#3421`.

**A live refinement, from the same discussion, not yet written into either card.** The operator: missing
operations specifically should be Kanban-style — a missing operation raises a feature request, prepared like
any other backlog item (read the spec, predict what it touches, build it in a lane — the SAME mechanism
`#3412`'s own prepare-scope dispatch just proved end to end in section 1 above, not a new one). The
low-risk-vs-escalate call is the building/reviewing AGENT'S OWN CONFIDENCE ASSESSMENT, made during that
normal prepare/build flow, against a small set of named criteria — not a rigid rule-based classifier:
security risk, data-leak risk, performance, blast-radius/reversibility, and baseline correctness (this
session's own proposed additions to the operator's "perf, security risk, etc." + "data leak risks"). Every
built operation gets an agent review, always — the confidence call decides whether a HUMAN also has to look
at it, not whether it gets reviewed at all. High confidence + clean on every criterion → self-clears, retries
the original call, no human in the loop. Any flagged criterion or genuine uncertainty → joins a BATCHED list
of AI-authored findings for a human to clear on their own time, not a blocking interactive prompt. This
sharpens `#3422`'s own blocking-bucket ruling (which said every blocking hiccup is gated, full stop) for the
specific case where the hiccup IS a missing operation. Belongs as an addition to `#3421`'s scope, not a
reopening of `#3422`'s ruling.

**A second refinement, also from the operator, also not yet built:** independent of the confidence call,
some commands/APIs should sit on a standing blacklist that forces elevated review regardless of how
confident the agent is — the same denylist-and-grow shape `#3405` already ratified for the dispatch doctrine
generally, applied here specifically to operations that call something on the list. And a third: the
thresholds themselves (confidence bar, blacklist contents) are eventually a Plateau admin-configurable
surface, not a hardcoded constant — pre-production, keep the parameter but keep it light (a short list, a
loose bar), tighten later once there's real usage to tune against. None of this blocks building a first
version; it's the shape the config should grow into, not a prerequisite.

### 3. `we:scripts/operations/dispatch-abort.mjs` built — mechanizes the stop-then-close-out and trust-grant sequences from finding
### 1 above — PR #1737, still parked, needs a genuinely independent clearance

New declared-style operation (`we:scripts/operations/dispatch-abort.mjs`, plain-module shape matching
`we:scripts/operations/wake.mjs`'s own precedent, not the full `op()` declarative engine): `stopSession`
shells `claude stop <id>` (never `kill`); `trustCheckout` grants checkout trust via the same
`withTrustedDirs` primitive `we:scripts/bootstrap-session.mjs` already uses for lanes; `abortDispatch`
composes stop-then-close-out so `we:scripts/operations/wake.mjs`'s own `assertHandleNotLive` passes on its
own merits without `--force` in the common case. 16 tests, `check:standards` clean. Two independent-review
passes (a `code-review high` pass, then a `/jury` pass on the PR itself) found and got real fixes: a
pre-emptive `listAgents()` read that failed OPEN on a malformed listing (removed — `claude stop` on an
already-gone handle is cheap and benign, so the composition just always attempts it rather than
pre-checking); a bare `--trust` with no value that silently resolved to and trusted the CWD (now refuses,
and the refusal itself is now unit-tested — it had lived only in the untestable `IS_CLI` block); no `force`
CLI escape hatch (added); three small pieces reimplemented instead of reused from
`we:scripts/bootstrap-session.mjs`/`we:scripts/operations/wake.mjs` (now reused). **`PR #1737` is green and
fixed but still parked `review:pending`** — the producer rubric scored it blast-radius (it grants trust and
terminates sessions). This session's own attempt to clear it was refused BEFORE a juror even spent anything:
the independence check keys off `CLAUDE_CODE_SESSION_ID`, and this session authored the PR, so it cannot be
its own reviewer, full stop — not a bug, working as designed (`#2439`/`#2844`). Needs either the operator or
a genuinely different session to run `/review 1737`.

**A related, real finding for `#3383`'s "operation manager" thread, not yet built anywhere:** the operator's
own framing of what "operation manager" should mean is bigger than `we:scripts/operations/dispatch-abort.mjs`
— not a helper script, but a real execution chokepoint every command (not only dispatched-agent ones) routes
through: semantically-named operations (no detail on HOW they execute, which also buys OS-independence),
logged and telemetered even for cheap/read-only calls, tiered by cost (free-and-inline vs. CPU-scheduled vs.
mutating-and-runner-only), and — the missing-operation case above — the point where the catalog grows from
real usage rather than speculative up-front design. Discussed at length with the operator this session;
explicitly NOT a final design, and not yet captured as its own card. Whoever picks this up next should read
this section plus section 2's confidence-call/criteria/blacklist refinements before filing it, so the
discussion is not re-derived from scratch.

### For the next session, in priority order

1. **File the "operation manager" design as its own card** under this epic — capture what's above, keep it
   explicitly open/capture-only (matching `#3422`'s own shape), and continue the design conversation rather
   than treating tonight's discussion as settled.
2. **Clear or get `PR #1737` cleared** — genuinely independent review needed; this session cannot do it.
3. **Mechanize the review step** — still the single largest remaining gap between "a dispatched agent can open
   a PR" and this epic's full "Done when" #1 (a `build` dispatch, not just `prepare-scope`, completing
   unattended through a `review:pending` park). Not yet scoped as a card.
4. **`#3403`/`#3404`/`#3406`** can be built now — branch-strategy settled, branch current with `main`. Real,
   separate build work; not started this session.
5. **Pin the missing-operation risk axis** and fold it into `#3421`'s scope per section 2 above.
