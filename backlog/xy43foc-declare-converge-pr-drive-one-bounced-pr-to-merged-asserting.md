---
kind: story
size: 8
parent: "3029"
status: open
relatedTo: ["3296", "3247", "3279", "3072", "3283"]
scope: ["we:scripts/operations/converge-pr.mjs", "we:scripts/operations/converge-pr-io.mjs", "we:scripts/operations/__tests__/converge-pr.test.mjs", "we:scripts/operations/run.mjs"]
dateOpened: "2026-08-26"
tags: [operations, delivery, review, convergence, plateau-loop]
---

# Declare `converge-pr` — drive ONE bounced PR to merged, asserting landability instead of assuming it

A prototype supervisor converged 14 PRs in a day and died with its session. Its read-only half is only
*proposed* — PR `#1574` is still open. The loop itself — dispatch, rounds, cap, and the steps that turn
`accepted` into `merged` — is written nowhere durable. `#3296` decides **when** a PR is owed work; nothing then
drives one PR to landed. Measured `2026-08-26T16:56:54Z`: four open PRs, one of them `review:accepted` **and**
`ready-to-merge` **and** `BEHIND`, and all four `unchecked`. This card is that operation and its five refusals.

## What was measured — this lane, `origin/main` `3f357344`, 2026-08-26T16:56:54Z

Every number below came from a command run in this lane while writing the card.

| probe | result |
| --- | --- |
| the `pr-status` operation (`we:scripts/operations/run.mjs pr-status --repo=chalbert/web-everything --json`) | `open: 4, green: 0, pending: 0, red: 0, **unchecked: 4**` |
| `gh pr list --state open --json number,labels,mergeStateStatus` | `#1574` `BEHIND/MERGEABLE` `[ready-to-merge, review:accepted, checking]`; `#1572` `BEHIND/MERGEABLE` `[review:changes, checking]`; `#1571`, `#1569` `UNKNOWN/UNKNOWN` `[review:changes, checking]` |
| `gh run list --limit 200 --jq '[.[]\|select(.conclusion=="startup_failure")]'` | 3 runs today: `32985655186`, `32984323382`, `32984219345` |
| `gh api .../actions/runs/<id>/jobs --jq .total_count` on each | **`0`, `0`, `0`** — and `created_at == updated_at` on all three |
| those runs' head shas vs `pr-status`'s | `a9f799fe` = `#1572`'s head, `ab953c4b` = `#1571`'s head — the *only* run each head ever got |
| `#1574` label timeline (`gh api .../issues/1574/timeline`) | `review:changes` `15:43:52Z` → `review:accepted` `16:37:57Z` → `ready-to-merge` `16:39:12Z` (**75 s** later) |
| `npm run check:standards` | **0 errors, 1437 warnings** (3296 backlog items) |

`unchecked: 4` is the headline. Not one open PR has a check run on the head that is there now.

## The five rules, each verified against the tree — two of the six filed are corrected

### 1 — Accepted is not landable, part 1. *Corrected: a restorer DOES exist; it just cannot fire today.*

The filing brief said `ready-to-merge` is stripped on a bounce and **nothing** restores it. Half of that holds.
`we:scripts/review-set-label.mjs:291` — a `changes` bounce removes `[pending, accepted, READY_TO_MERGE_LABEL]`.
`:274-277` — `accepted` adds `review:accepted` and removes `[pending, changes]`, and never re-adds the go-ahead.

But `we:scripts/merge-ai-prs.mjs:1707-1720` is the restorer, and it is deliberate:
`labelOnGreenVerdict` re-stamps `ready-to-merge` on a PR carrying `review:accepted` (`:1712` admits it even when
the AI-trailer heuristic reads non-AI), and the drain's reconcile applies it (`:2826-2838`), every pass and every
`--watch` interval. `review:accepted` clears the hold, so `:1718` does not refuse it
(`we:scripts/lib/review-escalation.mjs:1529-1531` says so in as many words). **So "nothing restores it" is
false.**

What survives is narrower and is still the operation's problem. The restore needs *both*
a label-scoped drain pass to run (`RECONCILE`, `we:scripts/merge-ai-prs.mjs:2535`) *and* `isRequiredCheckGreen` at `:1713`.
Neither is in the converging PR's gift, and **nothing fires on the green transition itself**. With `unchecked: 4`
measured above, `:1713` refuses for every open PR right now. So `converge-pr` must **assert** the go-ahead is on
the PR and report its absence as a state, never infer it from the accept.

### 2 — Accepted is not landable, part 2. *Corrected: the sweep's rescue exists but cannot reach this case.*

`we:scripts/merge-ai-prs.mjs:586` skips a `BEHIND` PR — *"BEHIND⇒needs rebase … left for its author"*. The header sentence
the brief quoted (`:34-35`, *"the sweep never force-updates someone's branch"*) is now only partly true:
`isRebaseDropCandidate` (`:609-616`) **does** rebuild a BEHIND tip. It requires `certified && v.testGreen`
(`:612`).

`#1574` is the live case: `review:accepted`, `ready-to-merge`, `BEHIND/MERGEABLE`, and `unchecked` — so not
`testGreen`, so not a candidate, so the rescue is unreachable and it sits. The author lane must rebase after
acceptance. Nothing does.

### 3 — A timed-out fixer loses everything uncommitted, by design, and the guard cannot live in `acquire`

`we:scripts/lane-pool.mjs:1077-1078` — `git checkout -B <branch> <baseRef> --quiet --force` then
`git clean -fd`. `:1070-1076` states the intent outright: `--force` is required because a bare `checkout -B`
*"REFUSES … on a dirty tracked-file conflict"*, and `acquire` *"has never gated this reset on tree cleanliness
(unlike `refreshLane`'s explicit `laneDirtyOrAhead` guard) — it must unconditionally reclaim a lane regardless of
stray edits left by a prior crashed/interrupted session"*. That guard exists (`laneDirtyOrAhead`, `:562`; its
refusal documented at `:47-51`) and is deliberately **not** on this path.

`we:skills-src/conveyor/fix-agent-brief.md:51-52` opens every round with exactly that `acquire --base={{LANE_REF}}`,
and `:104` tells the agent to commit *"one commit"* at the end. A killed fixer therefore loses its round's work to
its own successor, silently. Observed on the prototype: three fixtures, a test and four edited modules, recovered
only because someone looked. Since `acquire` must stay unconditional, **the salvage belongs to the supervisor** —
stash before re-acquiring — and the brief must say commit as you go.

### 4 — Restarting the supervisor must be idempotent, and the primitive already exists

The prototype kept a busy-map keyed by pid, which cannot see a supervisor from a previous run. Four accumulated
for one PR across two lane assignments, piling three agents into one lane clone. The repo already has the right
lock: `we:scripts/review-runner.mjs:31-35` takes an exclusive `O_EXCL`/TTL-leased singleton via
`we:scripts/readiness/file-locks.mjs`, and *"finds a LIVE lease no-ops (exit 0); a crashed run's lease
self-reclaims via the TTL"*. Key it by PR number and the second invocation is free.

### 5 — Never dispatch a fixer without findings, or against stale findings

`we:skills-src/conveyor/fix-agent-brief.md:60-71` reads the comments and takes *"the **latest** changes-requested comment as the
authoritative ask"*. Nothing compares that comment against the head it was written for. A fixer reading a review
of a tree that has since been re-sliced fixes things that no longer exist — observed when a 100-file PR shrank
to 8. The missing fact is already published: the `pr-status` operation reports `headSha` per PR
(`we:scripts/operations/pr-status.mjs`, `#3247`). Read it; do not derive a second one.

The empty half is equally live: a fixer with nothing to fix invents work, and `#3296`'s refusal 2 rules the same
way from the reconciler side.

### 6 — `ci:failed` is not always a code failure. *Sharpened: an infra failure does not present as failed at all.*

`we:scripts/operations/pr-status.mjs:73` puts `startup_failure` in `FAILING_CONCLUSIONS`, so a visible one reads
`red`. It is never visible. All three of today's `startup_failure` runs returned **`total_count: 0` jobs** with
`created_at == updated_at` — a run with no job puts no check run in the rollup, so `:73` never fires and
`pr-status` reports **`unchecked`**, which reads as *still building*, forever. Two of the four open PRs
(`#1571`, `#1572`) are in exactly that state on exactly those runs.

So the rule is stronger than filed: the discriminator is not "identical duration", it is **zero jobs and zero
elapsed**, and the wrong action is not just "send a fixer" — it is "wait". A `startup_failure` needs a **re-run**,
and grep finds no `gh run rerun` anywhere in `scripts/` or `skills-src/`.

## Design constraints, not refusals

- **The round cap must survive a restart**, or escalation means nothing. `NEGOTIATION_ROUND_CAP = 5`
  (`we:scripts/lib/jury-core.mjs:545`) and `deriveNegotiationOutcome` (`:589`) are the cap — reuse them, never
  re-derive. The durable-floor pattern is settled: `we:scripts/conveyor/tick-core.mjs:473-482` binds on
  `max(in-session, durable)`, and the durable side is a leading-line comment marker plus a count over it
  (`we:scripts/conveyor/rearm-review.mjs:38,54`), so the tally IS PR state and no parallel store appears.
- **`needs-human` is terminal for the loop.** `we:skills-src/conveyor/fix-agent-brief.md:70-72` — an agent that cannot safely judge
  leaves the PR `review:changes` and returns. Re-running it re-asks forever.
- **Phase comes from a live process, never a self-reported marker** — `#3296` refusal 4, and the rule PR `#1574`
  exists to enforce. A marker outlives the agent that wrote it and from then on lies in the direction that stops
  anyone looking.
- **Review and fix are separate processes.** `we:scripts/review-set-label.mjs:580-586` refuses `--to=accepted`
  only on a proven self-clear, so the fixer and the reviewer being different actors is what makes the accept
  legitimate. One process doing both cannot record its own acceptance, and must not try.

## Why it matters

`#1574` is the price, measured: accepted at `16:37:57Z`, go-ahead on at `16:39:12Z`, and it still cannot land —
`BEHIND` with no rebaser, `unchecked` with no re-runner. Every hour it waits is an hour its branch drifts further
behind `main` and the next reviewer re-reads a larger diff. The prototype cleared 14 PRs in a day and took the
knowledge with it when the session ended.

## Not in scope

- **Deciding WHICH PR is owed work** — `#3296` is that pass. This operation is what it calls, for one PR.
- **Spawning the independent reviewer session** — `#3279` declares it. This calls it; it must not hand-write a
  mandate.
- **The review loop's verdict vocabulary and its cap derivation** — `#3072`. Consume `deriveNegotiationOutcome`;
  do not restate it.
- **Deriving CI truth or a PR's phase** — `#3247` / PR `#1574`. A second derivation is the defect. If a fact is
  missing, widen those.
- **The pre-PR convergence loop.** `we:scripts/converge-cli.mjs` and `we:scripts/lib/converge-core.mjs` already
  own editor↔panel convergence over a **lane diff**. This is the post-PR sibling — a PR number, a label, a branch
  — and shares their round cap rather than forking one.
- **Merging.** `we:scripts/merge-ai-prs.mjs` is the sole writer to main (#2290). This operation makes a PR landable and
  enqueues; it never calls `gh pr merge`.
- **Fixing the broken workflow producing today's `startup_failure` runs.** This card must detect and re-run it,
  not repair it.
- **The lease reaper's ghost-lease collision** — `#3283`.

## Done when

Case 1 pins the drive; 2–6 pin one refusal each; 7 is the only thing between a green suite and an operation that
converges nothing in production.

1. **Executable, fails today** — `planConvergeStep` given `{ pr: 1572, labels: ['review:changes'], checkState:
   'red', headSha: 'a9f799fe', findings: [<one comment newer than headSha's pushedDate>], round: 1 }` returns
   exactly one action of kind `dispatch-fix`. Fails today with `ERR_MODULE_NOT_FOUND`:
   `we:scripts/operations/converge-pr.mjs` does not exist.
2. **Executable — refusal 1 (the go-ahead is asserted, never assumed).** `{ labels: ['review:accepted'],
   checkState: 'green', mergeStateStatus: 'CLEAN' }` returns one action `restore-go-ahead`. The **same** fixture
   with `checkState: 'unchecked'` returns `restore-go-ahead` too **and** a note naming `we:scripts/merge-ai-prs.mjs:1713` as
   the reason the drain's own restorer will not do it — a test that passes only by asserting the label's presence,
   never by inferring it from `review:accepted`.
3. **Executable — refusal 2 (rebase after acceptance).** `#1574`'s measured shape — `{ labels:
   ['review:accepted','ready-to-merge','checking'], mergeStateStatus: 'BEHIND', mergeable: 'MERGEABLE',
   checkState: 'unchecked' }` — returns one action `rebase-onto-main`, and the result records that
   `isRebaseDropCandidate` cannot reach it (`certified && testGreen` is false). A `CLEAN` twin returns no rebase.
   A rebase that **conflicts** returns `escalate` and leaves the PR accepted — never a force-past.
4. **Executable — refusal 3 (salvage before reset).** Given a lane path whose tree carries one modified tracked
   file and one untracked file, the round boundary stashes both (`git stash push -u`) **before** the re-acquire,
   and both are recoverable afterwards. Asserted against a real scratch repo, because
   `we:scripts/lane-pool.mjs:1077-1078`'s `--force` + `clean -fd` is precisely what makes an in-`acquire` guard impossible.
5. **Executable — refusal 4 (no findings, no stale findings).** Zero comments → no dispatch, refusal
   `{ kind: 'no-findings' }`. One findings comment whose `createdAt` precedes the head sha's `pushedDate` → no
   dispatch, refusal `{ kind: 'stale-findings', headSha, commentAt }`. The same comment made newer → dispatch.
6. **Executable — refusal 5 (infra red is a re-run, not a fixer), the zero-job shape.** A fixture built from run
   `32984323382`'s real shape — a workflow run with `conclusion: 'startup_failure'`, `jobs.total_count: 0`,
   `created_at === updated_at`, and an **empty** `statusCheckRollup` on the head — returns `rerun-ci` and
   **never** `dispatch-fix`. A second fixture with one genuinely failing job returns `dispatch-fix`. A third with
   an empty rollup and **no** run at all returns `wait-for-ci`, distinct from both — the three-valued line
   `pr-status` already draws, not a fourth derivation of it.
7. **Executable — the argv is pinned, not just the classification.** Assert the literal argv the default readers
   build: a `gh pr view` carrying `number,headRefName,labels,statusCheckRollup,mergeStateStatus,comments` in
   `--json`, and the `gh api repos/{repo}/actions/runs/{id}/jobs` path case 6 turns on. Mirrors
   `we:scripts/operations/__tests__/dispatch-lane-defaults.test.mjs:132`. Without it every case above is green on
   injected fixtures while the operation reads nothing live.
8. **Executable — the cap survives a restart.** With the in-process round tally **empty** and the PR carrying five
   durable round markers, the result is `{ kind: 'cap-exhausted', attempts: 5, cap: 5 }` and no dispatch, with
   `cap` sourced from `NEGOTIATION_ROUND_CAP` (`we:scripts/lib/jury-core.mjs:545`), not a local literal. A test that supplies an
   in-memory tally against a marker-free PR must still refuse on the PR's own count.
9. **Executable — idempotent restart.** Two `converge-pr` inits for the same PR against one lock root: the second
   exits `0`, takes no action, and holds no lease. A third, after the first's lease is aged past its TTL,
   proceeds. Uses `we:scripts/readiness/file-locks.mjs`, never a pid map.
10. **Executable — `needs-human` is terminal.** A PR carrying the stand-down marker returns zero dispatches and
    the identical result on a second call with `now` advanced by a week.
11. **Mutation** — five mutations, each named with the case it reddens and the cases it must leave green:
    - infer `ready-to-merge` from `review:accepted` instead of reading the label → reddens case 2's second
      fixture only.
    - drop the `testGreen` term from the rebase note → reddens case 3 only.
    - drop the `createdAt` vs `pushedDate` comparison → reddens case 5's stale fixture and **must not** redden its
      third (a newer comment still dispatches).
    - treat an empty `statusCheckRollup` as `wait-for-ci` unconditionally → reddens case 6's first fixture and
      **must not** redden its third. That asymmetry is the whole of refusal 5; a mutation reddening both has
      removed the wrong thing.
    - read the round count from the in-process tally → reddens case 8 only.
12. `npm run check:standards` — 0 errors and no more than 1437 warnings, the base measured in this lane at filing
    time (3296 backlog items).

## Watch for

- **Every refusal is reported with the fact it turned on.** A pass that refuses and prints one line has
  reproduced the original defect one level up. `stale-findings` must name the sha and the comment time;
  `cap-exhausted` must name the attempts and the cap.
- **`restore-go-ahead` is an assertion, not a workaround.** If the drain's restorer would have done it, say so and
  leave it; the operation exists to notice the case where it cannot, not to race it.
- **Do not become a second phase-deriver.** If a decision needs a fact `pr-status` or `classifyPr`
  (`we:scripts/progress-board.mjs:482`) does not expose, widen those. A private copy is how the board and this
  operation come to disagree about what a PR is doing.
- **Zero jobs is the signature, not zero duration alone.** A legitimately fast run can share a timestamp; a run
  with no job has provably executed nothing. Turn the refusal on the job count.
