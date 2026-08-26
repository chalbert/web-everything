---
kind: story
size: 5
parent: "2612"
status: open
relatedTo: ["3283", "3247", "3072", "3279", "2643", "3095"]
scope: ["we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/reconcile-pass.mjs", "we:scripts/conveyor/stand-down.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs", "we:scripts/conveyor/__tests__/stand-down.test.mjs", "we:skills-src/conveyor/fix-agent-brief.md"]
dateOpened: "2026-08-26"
tags: [conveyor, delivery, reconcile, liveness, plateau-loop]
---

# Nothing reconciles an open PR against a live process, so every delivery stall waits for a person

Twenty-five PRs opened since 2026-08-25; six distinct stall causes, and a person noticed every one. Nothing
compares desired delivery state against actual. `we:scripts/conveyor/tick-core.mjs:396` plans a fixer only for
a PR **this session** launched; `we:scripts/operations/wake.mjs:51` sees only runs already parked on a
dispatch; `we:scripts/review-runner.mjs:39` refuses `--enforce` and clears nothing. Measured 15:13Z today:
five open PRs, twelve live sessions, none working on any of them — three of them blocked on a permission
prompt for **209 hours**. This card is the resident reconcile pass, and its four refusals.

## What was measured — 2026-08-26, this lane, at `origin/main` 435f3519

Every number below came from a command run in this lane while writing the card.

| probe | result |
| --- | --- |
| `gh pr list --state open` | 5 PRs: `#1570 #1571 #1572` `review:pending`, `#1569 #1563` `review:changes` |
| `claude agents --json` | 12 sessions. `conveyor-3150` / `conveyor-3151` / `conveyor-3154` are `state: blocked`, `status: "waiting"`, `waitingFor: "permission prompt"`, started `2026-08-17T22:12Z` — **209.0 h** ago |
| those three agents' items | `#3150` `#3151` `#3154` all `status: resolved`, `dateResolved: "2026-08-17"` — the work landed another way the same day |
| any live session bound to `#1563 #1569 #1570 #1571 #1572` | **none** of the 12 |
| `countRearmComments` (`we:scripts/conveyor/rearm-review.mjs:54`) on each open PR | `1563 → 0` (13 comments), `1569 → 0` (5), `1570 → 0` (1), `1571 → 0` (0), `1572 → 0` (0) |
| `<primary>/.conveyor/jury/*.jsonl` | 6 ledgers, newest `we#1049.jsonl` written **2026-08-05**. None of the five open PRs has one |
| `#1563`'s own comment thread | `## Independent review — PR #1563 — round 8` at `2026-08-26T14:20Z`; round 7 was `03:16Z` — an **11 h 04 m** gap. `NEGOTIATION_ROUND_CAP = 5` (`we:scripts/lib/jury-core.mjs:545`) |
| `#1570` `review:pending` applied | `2026-08-26T14:41:37Z`; still unreviewed at `15:14:13Z` — **32.6 min**, no live process |
| `laneRefItemNum` over the five open head refs | `null`, `null`, `null`, `null`, `null` |
| `npm run check:standards` | **0 errors, 1437 warnings** (3269 backlog items) |

So both durable round sources read **zero** for every open PR, while one of them is on its eighth round.

## The six causes, verified against the tree

Each is checked below; two of the six from the original report are corrected rather than repeated.

1. **No reviewer is ever dispatched.** `planTick`'s `decisions` (`we:scripts/conveyor/tick-core.mjs:855-866`)
   are `spawnBuilds`, `spawnPrepareScope`, `spawnPrepareDecision`, `spawnFixes`, `spawnCiHeals`,
   `armWatchers`. **There is no review spawn at all** — a `review:pending` PR is watched, never worked. And
   the two spawns that do exist are gated: `if (!launched.has(normNum(p.num))) continue; // only PRs THIS
   conveyor launched` at `:396` (fix) and `:495` (CI-heal). A PR opened after the batch launch is not in
   `launchedNums`, so it is owned by nothing. *Correction: the report cited `#1567` as the 30-minute case;
   `#1567` (`lane/file-lease-reaper-collision`) has since **merged**. `#1570`'s live 32.6 minutes replaces it.*
2. **The supervisor exits while the PR is open.** The tick's bookkeeping is read from STDIN and is
   *"SESSION-EPHEMERAL process state, never a committed repo store"* (`we:scripts/conveyor/tick-core.mjs:885`).
   `launchedNums`, `fixGuards` and `watched` all live there. When the session ends they are gone, and every PR
   it launched becomes a PR no conveyor launched.
3. **An agent that stops to ASK is byte-identical to one that crashed.** This is the sharpest of the six.
   `we:skills-src/conveyor/fix-agent-brief.md:70-72` — *"do **NOT** guess — leave the PR `review:changes` (do
   not re-arm) and RETURN `#{{ITEM_NUM}} → fix escalated (finding needs human judgment)`"* — and `:88-90` says
   the same for a red gate. The refusal is correct behaviour and it writes **nothing durable**: the PR keeps
   `review:changes`, no re-arm comment is posted, and the one-line return goes to a calling session that then
   exits. Nothing on the PR distinguishes *"a fixer proved the fix wrong and stood down"* from *"a fixer
   died."* A reconciler that cannot tell them apart re-dispatches the refusal forever.
4. **An agent blocked on a permission prompt.** Root cause was untrusted lane clones —
   `we:scripts/bootstrap-session.mjs:521`: *"a background one has nobody to ask — it simply stops."* The trust
   step now exists. *Correction: it is not fixed in effect.* This session's `SessionStart` hook reported
   **3 of 44 checkouts NOT trusted**, and the three 209-hour agents above are still sitting on their prompts.
   The bootstrap closes the *cause*; nothing closes the *residue*.
5. **Two agents handed the same lane** by the ghost-lease reaper — already filed as
   [#3283](3283-the-lease-reaper-reclaims-a-lane-seconds-after-it-is-acquire.md) (merged as PR `#1567`). Not
   re-filed here. It is the same root disease read from the lane side: a terminal signal about the *item* used
   as a proxy for *is anyone alive here*.
6. **A finished agent read as dead, because liveness came from a log.**
   `we:scripts/readiness/conveyor-state.mjs:639` — *"a transcript's mtime IS its last-activity clock"* — feeds
   `assessHealth` (`:376`), which flags a lane stalled when `now - lastActivity > DEFAULT_STALL_MS`
   (`:62`, 180 000 ms). A transcript stops being written when an agent **finishes** exactly as it does when an
   agent **dies**. The verdict is a file timestamp, so cause 6 is not a bug in that scan — it is what a
   timestamp can mean. Meanwhile `claude agents --json` (`we:scripts/operations/dispatch-lane-io.mjs:879`)
   returns a real `pid`, `state`, `status` and `waitingFor` per session, and nothing on the PR side reads it.

## The common thread

Every one of the six is the same shape: **a proxy standing in for a fact nobody checks.** A session's
`launchedNums` stands in for ownership. A label stands in for a process. A file mtime stands in for liveness.
A resolved card stands in for an idle lane. Six proxies, six ways to be wrong, and a person as the only
reconciler. There is no loop anywhere in the tree that asks *"this PR is bounced and nothing is working on
it — dispatch a fixer."*

## Why it matters

`#1563` is the cost, priced: open since `2026-08-25T22:00Z`, eight review rounds, an 11-hour gap between
rounds 7 and 8 that ended only because a person looked. It is not idle — it is being worked, expensively, by
hand, at a cadence set by human attention. Every hour a bounced PR waits is an hour its lane lease is held
(`#3283`), its branch drifts behind `main`, and the next reviewer re-reads a larger diff.

## What the reconciler is, and the four refusals

A periodic **one-shot** pass, not a resident process — the shape `we:scripts/converge-daemon-pass.mjs:16`
already argues for (*"a `StartInterval` job is the whole daemon, and it costs one plist"*), singleton-leased
the way `we:scripts/review-runner.mjs` leases. Folding it into the conveyor tick is refused on the evidence of
cause 2: that tick's state is session-ephemeral by construction.

One pure core, `planReconcile({ prs, agents, durableCounts, now })` → `{ dispatch[], refusals[] }`, and a thin
IO shell. Keyed by **PR number**, never item number — all five open head refs return `null` from
`laneRefItemNum` today, so an item-keyed pass sees none of them. Phase derivation is **borrowed, not
re-derived**: `classifyPr` (`we:scripts/progress-board.mjs:482`) for the label phase, the `pr-status` operation
(`we:scripts/operations/pr-status.mjs`, `#3247`) for three-valued CI truth.

The dispatch is the easy half. These four refusals are the item:

1. **`stood-down` is terminal.** An agent that stopped to ask a question is never restarted — re-running it
   re-asks the question forever and burns tokens. Requires a durable marker, because today there is none:
   a stand-down leaves the PR unchanged (`we:skills-src/conveyor/fix-agent-brief.md:70-72`). Reuse the `#2643` pattern exactly —
   a stable leading-line comment marker plus a counter over it, the way `REARM_COMMENT_MARKER` /
   `countRearmComments` (`we:scripts/conveyor/rearm-review.mjs:38,54`) already work — so the count *is* PR
   state and no parallel store appears. Written by a script the brief calls, not by prose the model must
   remember: `#3095` ruled against brief-compliance write-backs for exactly this reason.
2. **No findings, no fixer.** A PR with nothing to fix must never receive a fix agent; it will invent work.
   `#1571` and `#1572` carry **0 comments** each right now. The correct dispatch for a `review:pending` PR
   with no findings is a *review*, not a fix — and a supervisor that refused to dispatch a fixer here was
   right to refuse.
3. **The round cap survives a restart, or it is not a cap.** Derive the count from the PR, never from process
   memory. Both existing durable sources read `0` on all five open PRs while `#1563` sits at round 8 against
   a cap of 5, so this criterion is not theoretical — it is already broken in the two places it exists.
4. **Liveness comes from a live process.** `claude agents --json` gives `pid` / `state` / `status` /
   `waitingFor`. A marker, a label, or a file mtime is never sufficient — a stale "in progress" marker is how
   cause 6 happens by construction. `waitingFor: "permission prompt"` is a *fifth* state, neither alive nor
   dead: it must refuse dispatch and surface distinctly, or the 209-hour case repeats silently.

## Not in scope

- **The review loop itself** and its converged / exhausted / stuck vocabulary — `#3072`. This card decides
  *that* a review is owed; it does not run one.
- **Spawning the independent reviewer session** — `#3279` declares that operation. This card calls it.
- **Deriving a PR's phase.** `classifyPr` and the `pr-status` operation already do it; a second derivation is
  the defect, not the feature. *Correction to the filing brief: there is no open PR on `lane/pr-status-command`
  — no such ref exists on `origin` — because `#3247` landed and is `resolved` (2026-08-21). `#3252` (pr-status
  on a credential-less host) is the open remainder.*
- **Disposing a `review:pending` PR from a jury ledger** — `we:scripts/review-runner.mjs` owns that, and its
  shadow→enforce flip is `#2572` part 2. This card must not flip it.
- **The lease reaper's ghost-lease collision** — `#3283`.
- Changing any label's meaning, or adding a new label. The stand-down signal is a comment marker.

## Done when

Cases 1 and 7 pin the dispatch; 2–5 pin one refusal each; 6 is the only thing standing between a green suite
and a pass that reconciles nothing in production.

1. **Executable, fails today** — `planReconcile` given a PR fixture `{ prNumber: 1563, state: 'OPEN', labels:
   ['review:changes'], comments: [<one changes-requested comment>] }` and an agent listing with no entry bound
   to it returns exactly one `dispatch` of kind `fix`. Fails today with `ERR_MODULE_NOT_FOUND`:
   `we:scripts/conveyor/reconcile-core.mjs` does not exist.
2. **Executable — refusal 1.** The same fixture plus one comment whose leading line is the stand-down marker
   returns **zero** dispatches and one refusal `{ kind: 'stood-down' }` — and returns the identical result on
   a second call with a `now` advanced by a week (no decay, no clock, terminal). Paired: `we:scripts/conveyor/stand-down.mjs`
   posts that marker, `countStandDownComments` reads it back, and `we:skills-src/conveyor/fix-agent-brief.md`'s two escalation exits
   (`:70-72`, `:88-90`) call it before returning.
3. **Executable — refusal 2.** A `review:pending` fixture with zero comments returns no `fix` dispatch and a
   refusal `{ kind: 'no-findings' }`; the same fixture returns a `review` dispatch. Uses `#1571`'s real shape
   (0 comments) as the fixture.
4. **Executable — refusal 3.** With `durableCounts` supplied and the in-process state **empty** (a fresh
   pass, nothing carried in), a PR at or above the cap returns `{ kind: 'cap-exhausted', attempts, cap }` and
   no dispatch. Asserted with `attempts` sourced only from the PR — a test that passes an in-memory tally and
   an empty PR must still refuse to dispatch on the PR's own count, and must not be satisfiable by the tally.
5. **Executable — refusal 4, and this is the case that pins cause 6.** One fixture, two facts in conflict: an
   agent-listing entry bound to the PR with a live `pid`, **and** a transcript mtime 209 hours stale. The
   result is `{ kind: 'live-process', pid }`, not a dispatch. A second fixture with `status: 'waiting'`,
   `waitingFor: 'permission prompt'` also refuses, with its own distinct refusal kind, and appears in the
   pass's surfaced notes. A third: no agent entry at all plus a **fresh** mtime → dispatch. That third case is
   what proves no marker or timestamp can grant liveness on its own.
6. **Executable — the argv is pinned, not just the classification.** Assert the literal argv the default
   readers build: `['agents','--json']` for the session listing, and a `gh pr list` carrying `--state open`
   with `number,headRefName,labels,statusCheckRollup,mergeStateStatus,comments` in `--json`. Mirrors
   `we:scripts/operations/__tests__/dispatch-lane-defaults.test.mjs:132`. Without it every other case here is
   green on injected fixtures and the pass returns nothing live — the `#3095` defect, arriving the same way.
7. **Executable — keyed by PR number.** A fixture of the five real head refs open today
   (`lane/review-pr-override-reason`, `lane/review-corpus-replay`, `lane/programme-review-efficacy`,
   `lane/review-efficacy-watch`, `lane/prevention-cards-1556-1562`) produces **five** rows. Measured today all
   five return `null` from `laneRefItemNum`, so an item-keyed pass produces zero — this case is that
   difference, stated as a test.
8. **Mutation** — four mutations, one per refusal, each named with the case it reddens and the cases it must
   leave green:
   - drop the `stood-down` check → reddens case 2 only.
   - drop the empty-findings check → reddens case 3 only.
   - read the attempt count from the in-process tally instead of the PR → reddens case 4 only.
   - accept a fresh transcript mtime as liveness → reddens case 5's first fixture, and **must not** redden
     its third (a fresh mtime with no agent entry still dispatches). That asymmetry is the whole point of
     refusal 4; a mutation that reddens both has removed the wrong thing.
9. `npm run check:standards` — 0 errors and no more than 1437 warnings, the base measured in this lane at
   filing time.

## Watch for

- **The refusals must be reported, never silent.** A pass that refuses four PRs and prints one line has
  reproduced the original defect one level up. Every refusal carries its kind, its PR, and the fact it turned
  on.
- **`stood-down` is terminal for the reconciler, not for a person.** A human clearing the marker is the
  intended exit, and the marker's semantics must say so or it becomes a way to bury a PR.
- **Do not let the pass become a second phase-deriver.** If it needs a fact `classifyPr` or `pr-status` does
  not expose, widen those — a private copy is how the board and the reconciler come to disagree about what a
  PR is doing.

**Other items surfaced while filing this, not filed here:** nothing reaps a background session blocked on a
permission prompt (three have held one for 209 hours), and `laneRefItemNum`'s grammar matches none of today's
five open head refs.
