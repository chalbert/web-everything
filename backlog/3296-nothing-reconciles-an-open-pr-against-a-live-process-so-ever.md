---
bornAs: x7tu0nh
kind: story
size: 5
parent: "2612"
status: resolved
relatedTo: ["3283", "3247", "3072", "3279", "2643", "3095"]
scope: ["we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/reconcile-pass.mjs", "we:scripts/conveyor/stand-down.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs", "we:scripts/conveyor/__tests__/stand-down.test.mjs", "we:skills-src/conveyor/fix-agent-brief.md"]
dateOpened: "2026-08-26"
dateResolved: "2026-08-26"
preparedDate: "2026-08-26"
tags: [conveyor, delivery, reconcile, liveness, plateau-loop]
---

# Nothing reconciles an open PR against a live process, so every delivery stall waits for a person

Twenty-nine PRs opened since 2026-08-25, and nothing in the tree compares desired delivery state against
actual. `we:scripts/conveyor/tick-core.mjs:396` plans a fixer only for a PR **this session** launched;
`we:scripts/operations/wake.mjs:180` looks only at runs already parked on a dispatch;
`we:scripts/review-runner.mjs:39` refuses `--enforce` and clears nothing. Measured 17:34Z today: four open PRs,
seventeen live sessions, three of them blocked on a permission prompt for 211 hours. This card is the resident
reconcile pass, and its four refusals.

## What was measured — 2026-08-26 **17:34Z**, this lane, at `origin/main` `a517c8f8`

Every number below came from a command run in this lane at that timestamp. **The board moves faster than the
card does:** the filing snapshot was taken at 15:13Z against `origin/main` `435f3519`, and **six** of its
claims no longer hold. They are retracted immediately below the table rather than overwritten, because
**three** of them were wrong when written, not merely stale.

| probe | result at 17:34Z |
| --- | --- |
| `gh pr list --state open` | **4** PRs: `#1576` `review:changes`+`checking`, `#1572` `review:accepted`, `#1571` `ready-to-merge`+`review:accepted`+`checking`, `#1569` `ready-to-merge`+`review:accepted`+`checking` |
| PRs opened since `2026-08-25` (`--state all`) | **29** — `#1548`…`#1576`; 25 merged, 4 open |
| `claude agents --json` | **17** sessions. Exactly **3** carry `status: "waiting"`, `waitingFor: "permission prompt"`: `conveyor-3151` (pid 18278), `conveyor-3150` (pid 32933), `conveyor-3154` (pid 32934), started `2026-08-17T22:10–22:12Z` — **211.4 h** ago |
| those three agents' items | `#3150` `#3151` `#3154` all `status: resolved`, `dateResolved: "2026-08-17"` — the work landed another way the same day |
| field coverage across those 17 entries | union of keys is exactly `cwd, id, kind, name, pid, sessionId, startedAt, state, status, waitingFor`. `cwd`/`kind`/`name`/`sessionId`/`startedAt` on **17/17**; `pid` on **13/17**; `state` on **7/17**; `status` + `waitingFor` on **3/17**. **No `pr`, `item`, `num`, `branch` or `ref` field exists at all** |
| `process.kill(pid, 0)` over the 13 entries carrying a pid | **13 alive, 0 dead** |
| live session bound to each open PR (bound = a session whose `cwd` is a lane whose `HEAD` equals the PR's `headRefOid`) | `#1576` → `lane-37`; `#1572` → `lane-39`; `#1571` → **two** sessions in `lane-35`; `#1569` → **none** |
| `countRearmComments` (`we:scripts/conveyor/rearm-review.mjs:54`) on each open PR | `1576 → 0` (2 comments), `1572 → 0` (9), `1571 → 0` (6), `1569 → 0` (9) |
| `laneRefItemNum` (`we:scripts/conveyor/lease-reaper.mjs:89`) over the four open head refs | `null`, `null`, `null`, `null` |
| `<primary>/.conveyor/jury/*.jsonl` | 6 ledgers, newest `we#1049.jsonl` written **2026-08-05**. None of the four open PRs has one |
| `#1563`'s comment thread (merged `16:39:23Z`, so historical) | reached `## Independent review — PR #1563 — round 12` at `2026-08-26T16:04:41Z`. Round 7 was `03:16:32Z`, round 8 `14:21:20Z` — an **11 h 04 m** gap. `NEGOTIATION_ROUND_CAP = 5` (`we:scripts/lib/jury-core.mjs:545`). `countRearmComments` on its 17 comments reads **0** |
| `#1576` `review:pending` applied `17:18:24Z`, swapped to `review:changes` `17:31:38Z` | **13 m 14 s** — and the reviewer that did it was dispatched by a person, not by anything in the tree |
| `npm run check:standards` at `a517c8f8` | **1 error, 1434 warnings** (3297 backlog items). The one error is pre-existing and unrelated: a stranded hash id, `we:backlog/3323-declare-converge-pr-drive-one-bounced-pr-to-merged-asserting.md`, left by `#1575`'s land |

Both durable round sources still read **zero** for every open PR — and `#1563` proves the point harder than the
filing snapshot claimed: it ran to **twelve** rounds against a cap of five with a durable count of **0**.

### Retracted from the filing snapshot — quoted, and what is true instead

1. > "Twenty-five PRs opened since 2026-08-25"

   **Wrong when written.** The count is **29** (`#1548`…`#1576`). 25 is the number *merged*, not the number
   opened; the two were conflated.

2. > "five open PRs, twelve live sessions, none working on any of them"

   > "any live session bound to `#1563 #1569 #1570 #1571 #1572` | **none** of the 12"

   **Wrong now, and the retraction matters more than the arithmetic.** At 17:34Z three of the four open PRs
   have a live session on them: `#1576` (a reviewer in `lane-37`), `#1572` (a reviewer in `lane-39`), `#1571`
   (a CI-heal agent in `lane-35`). Only `#1569` has none. **The card's thesis survives intact and the evidence
   for it is unchanged** — nothing *derived* those three bindings; a person dispatched every one of them, which
   is exactly the defect. But "none of them is being worked" is not a fact and must not be argued from.

3. > "`#1567` (`lane/file-lease-reaper-collision`) has since **merged**. `#1570`'s live 32.6 minutes replaces it."

   `#1567` did merge (`2026-08-26T02:27:40Z`) — but `#1570` has since merged too, so its 32.6 minutes is no
   longer live either. The live figure is now `#1576`'s **13 m 14 s** from `review:pending` to `review:changes`,
   and it is a *weaker* case honestly stated: that review happened, on a human's dispatch.

4. > "already filed as [#3283](3283-…md) (merged as PR `#1567`)"

   Imprecise. PR `#1567` merged; the **item** `#3283` is still `status: open` at `a517c8f8`. A merged PR is not
   a resolved item, and this card must not treat it as one.

5. > "`npm run check:standards` | **0 errors, 1437 warnings** (3269 backlog items)"

   **Wrong when written.** Re-measured in this lane at `a517c8f8`: **1 error, 1434 warnings, 3297 items**. The
   filing figure `3269` appears to be this card's own number `3296` with two digits transposed, which is the
   signature of a count written from memory rather than run.

6. > "accept a fresh transcript mtime as liveness → reddens case 5's first fixture, and **must not** redden
   > its third (a fresh mtime with no agent entry still dispatches)"

   **Wrong when written, and it made the criterion unachievable.** The two cases are the wrong way round.
   The first fixture (now 5(a)) is a live `pid` with a **stale** mtime, so a mutant that accepts a *fresh*
   mtime as liveness never fires on it — the live `pid` refuses either way and 5(a) stays **green**. The
   third (now 5(c)) is no agent entry plus a **fresh** mtime, which is precisely what that mutant breaks, so
   5(c) is the case that goes **red**. No mutation of this family satisfies the pairing as it was written:
   the only mutant that can redden 5(a) reads liveness *from* the mtime instead of the `pid`, and that one
   reddens 5(c) as well — which the bullet's own next sentence disqualifies. The bullet now names 5(c) as
   the red case and 5(a) as the one that must stay green. This mattered because it is the single mutation
   pinning refusal 4, the card's central refusal: a builder who implemented refusal 4 **correctly** would
   have run the named mutation, seen 5(c) redden, and been told by this card that they had removed the wrong
   thing.

## The six causes, verified against the tree

Each is checked below against `a517c8f8`; three carry a correction rather than a repetition.

1. **No reviewer is ever dispatched.** `planTick`'s `decisions` (`we:scripts/conveyor/tick-core.mjs:855-866`)
   are `spawnBuilds`, `suppressedBuilds`, `spawnPrepareScope`, `spawnPrepareDecision`, `spawnFixes`,
   `spawnCiHeals`, `armWatchers`, plus `retireGuards` / `idleStop` / `statusLine` / `notes`. **There is no
   review spawn at all** — a `review:pending` PR is watched, never worked. And the two spawns that do exist are
   gated: `if (!launched.has(normNum(p.num))) continue; // only PRs THIS conveyor launched` at `:396` (fix) and
   `:495` (CI-heal). A PR opened after the batch launch is not in `launchedNums`, so it is owned by nothing.
   *Correction: the filing brief cited `#1567`, then this card cited `#1570`; both have merged. The verified
   half of this cause is the code, not the example — the code claim was re-read at `a517c8f8` and holds.*
2. **The supervisor exits while the PR is open.** The tick's bookkeeping is read from STDIN. *Correction to the
   quote this card used:* `we:scripts/conveyor/tick-core.mjs:885` does **not** read
   *"SESSION-EPHEMERAL process state, never a committed repo store"*; that was a paraphrase set in quotation
   marks. It reads *"Read all of STDIN as a string (the SESSION-EPHEMERAL bookkeeping is piped in — never a
   committed repo store)."* The substance is unaffected: `launchedNums`, `fixGuards` and `watched` are all
   `bookkeeping` fields on `planTick` (`:727-728`), so when the session ends they are gone, and every PR it
   launched becomes a PR no conveyor launched.
3. **An agent that stops to ASK is byte-identical to one that crashed.** This is the sharpest of the six.
   `we:skills-src/conveyor/fix-agent-brief.md:70-72` — *"do **NOT** guess — leave the PR `review:changes` (do
   not re-arm) and RETURN `#{{ITEM_NUM}} → fix escalated (finding needs human judgment)`"* — and the red-gate
   exit says the same. *Correction: that second exit is at `:90-91`, not `:88-90`; the old citation pointed at
   the closing fence of the preceding code block.* The refusal is correct behaviour and it writes **nothing
   durable**: the PR keeps `review:changes`, no re-arm comment is posted, and the one-line return goes to a
   calling session that then exits. Nothing on the PR distinguishes *"a fixer proved the fix wrong and stood
   down"* from *"a fixer died."* A reconciler that cannot tell them apart re-dispatches the refusal forever.
4. **An agent blocked on a permission prompt.** Root cause was untrusted lane clones —
   `we:scripts/bootstrap-session.mjs:521`: *"a background one has nobody to ask — it simply stops."* The trust
   step now exists. *Correction: it is not fixed in effect.* This session's `SessionStart` hook reported
   **3 of 44 checkouts NOT trusted**, and the three permission-blocked agents above are now at **211.4 h**
   (the filing snapshot said 209.0 h; same three sessions, two hours later). The bootstrap closes the *cause*;
   nothing closes the *residue*.
5. **Two agents handed the same lane** by the ghost-lease reaper — filed as
   [#3283](3283-the-lease-reaper-reclaims-a-lane-seconds-after-it-is-acquire.md), whose PR `#1567` merged
   `2026-08-26T02:27:40Z` while the item itself is still `status: open`. Not re-filed here. **It is live in this
   lane right now, and it is why row 7 of the table says `#1571` → two sessions:** `lane-35` holds both the
   session preparing this card and a CI-heal agent for `#1571`, which reset the shared checkout to `#1571`'s
   head underneath it. Same root disease read from the lane side: a terminal signal about the *item* used as a
   proxy for *is anyone alive here*.
6. **A finished agent read as dead, because liveness came from a log.**
   `we:scripts/readiness/conveyor-state.mjs:639` — *"a transcript's mtime IS its last-activity clock"* — feeds
   `assessHealth` (`:376`), which pushes a lane onto `stalled` when `now - Number(last) > stallMs`, default
   `DEFAULT_STALL_MS` (`:62`, `180_000` ms). A transcript stops being written when an agent **finishes** exactly
   as it does when an agent **dies**. The verdict is a file timestamp, so cause 6 is not a bug in that scan — it
   is what a timestamp can mean. Meanwhile `claude agents --json`
   (`we:scripts/operations/dispatch-lane-io.mjs:879`) returns a real `pid`, `state`, `status` and `waitingFor`
   per session — *on some entries only; see refusal 4* — and nothing on the PR side reads it.

## The common thread

Every one of the six is the same shape: **a proxy standing in for a fact nobody checks.** A session's
`launchedNums` stands in for ownership. A label stands in for a process. A file mtime stands in for liveness.
A resolved card stands in for an idle lane. Six proxies, six ways to be wrong, and a person as the only
reconciler. There is no loop anywhere in the tree that asks *"this PR is bounced and nothing is working on
it — dispatch a fixer."*

## Why it matters

`#1563` is the cost, priced, and it is worse than this card first said. Open `2026-08-25T22:00:51Z`, merged
`2026-08-26T16:39:23Z` — **18 h 39 m** and **twelve** review rounds, not eight, against a
`NEGOTIATION_ROUND_CAP` of 5, with an 11 h 04 m gap between rounds 7 and 8 that ended only because a person
looked. Its durable re-arm count read **0** the entire time. It was never idle — it was being worked,
expensively, by hand, at a cadence set by human attention. Every hour a bounced PR waits is an hour its lane
lease is held (`#3283`), its branch drifts behind `main`, and the next reviewer re-reads a larger diff.

## What the reconciler is, and the four refusals

A periodic **one-shot** pass, not a resident process — the shape `we:scripts/converge-daemon-pass.mjs:16`
already argues for (*"a `StartInterval` job is the whole daemon, and it costs one plist"*), singleton-leased
the way `we:scripts/review-runner.mjs` leases. Folding it into the conveyor tick is refused on the evidence of
cause 2: that tick's state is session-ephemeral by construction.

One pure core, `planReconcile({ prs, agents, durableCounts, now })` → `{ dispatch[], refusals[] }`, and a thin
IO shell. Keyed by **PR number**, never item number — all four open head refs return `null` from
`laneRefItemNum` today, so an item-keyed pass sees none of them. Phase derivation is **borrowed, not
re-derived**: `classifyPr` (`we:scripts/progress-board.mjs:482`) for the label phase, the `pr-status` operation
(`we:scripts/operations/pr-status.mjs`, `#3247`) for CI truth. *Correction to how this card described that
last one:* `pr-status` is not three-valued. `CHECK_STATES` (`we:scripts/operations/pr-status.mjs:78`) is a
frozen list of **four** — `green`, `red`, `pending`, `unchecked` — and the distinction the reconciler needs is
precisely the fourth: *"`unchecked` is NOT a flavour of `pending`"* (`:77`). The module's own prose calls itself
"three-valued" in the same breath as it freezes four values; do not inherit that error.

The dispatch is the easy half. These four refusals are the item:

1. **`stood-down` is terminal.** An agent that stopped to ask a question is never restarted — re-running it
   re-asks the question forever and burns tokens. Requires a durable marker, because today there is none: a
   stand-down leaves the PR unchanged (`we:skills-src/conveyor/fix-agent-brief.md:70-72`, `:90-91`). Reuse the
   `#2643` pattern exactly — a stable leading-line comment marker plus a counter over it, the way
   `REARM_COMMENT_MARKER` / `countRearmComments` (`we:scripts/conveyor/rearm-review.mjs:38,54`) already work —
   so the count *is* PR state and no parallel store appears. Written by a script the brief calls, not by prose
   the model must remember. *Correction: this card cited `#3095` as having "ruled against brief-compliance
   write-backs for exactly this reason." It did not.* `#3095` names the hazard — a brief-driven write-back
   *"adds a write-back responsibility to prose an LLM must obey"* — and then explicitly refuses to decide on it:
   *"do not reject the fork on the brief-compliance argument alone"*, and its ruling records that approach 2
   *"was declined on COST and SIZE rather than on merit."* So `#3095` is evidence that the hazard is recognised,
   not authority that it was ruled on. Script-not-prose stands here on its own argument.
2. **No findings, no fixer.** A PR with nothing to fix must never receive a fix agent; it will invent work.
   *Correction: this card said "`#1571` and `#1572` carry **0** comments each right now."* They no longer do —
   6 and 9 at 17:34Z. The live zero-comment case is `#1576`, measured at `17:21Z`: `review:pending`, **0**
   comments, `laneRefItemNum` `null`. The correct dispatch for a `review:pending` PR with no findings is a
   *review*, not a fix — and a supervisor that refused to dispatch a fixer here was right to refuse.
3. **The round cap survives a restart, or it is not a cap.** Derive the count from the PR, never from process
   memory. `countRearmComments` reads `0` on all four open PRs and read `0` on `#1563` through all twelve of its
   rounds against a cap of 5, so this criterion is not theoretical — it is already broken in the two places it
   exists.
4. **Liveness comes from a live process — and the listing is thinner than it looks.** *Correction: this card
   said "`claude agents --json` gives `pid` / `state` / `status` / `waitingFor`", which reads as a guarantee.*
   Measured over 17 entries: `pid` on 13, `state` on 7, `status` and `waitingFor` on 3. **A missing `pid` is not
   a dead process, and a missing `state` is not a healthy one** — every field but `cwd`, `kind`, `name`,
   `sessionId` and `startedAt` is optional, and the pass must treat absence as *unknown*, never as *idle*.
   Worse for the design: **the listing carries no `pr`, `item`, `num`, `branch` or `ref` field at all**, so the
   PR↔session binding has to be derived. The only binding available today is `cwd` → that lane's `HEAD` →
   the PR's `headRefOid`, and **that rule produced a false positive in this lane while this card was being
   prepared**: it bound the session preparing `#3296` to PR `#1571`, because a second agent had reset the shared
   `lane-35` checkout to `#1571`'s head (cause 5). So the binding is itself a proxy; the refusal must carry the
   evidence it turned on (`cwd`, `sha`, `pid`) so a false bind is visible rather than silently authoritative.
   A marker, a label, or a file mtime is never sufficient — a stale "in progress" marker is how cause 6 happens
   by construction. `waitingFor: "permission prompt"` is a *fifth* state, neither alive nor dead: it must refuse
   dispatch and surface distinctly, or the 211-hour case repeats silently.

## Not in scope

- **The review loop itself** and its converged / exhausted / stuck vocabulary — `#3072`. This card decides
  *that* a review is owed; it does not run one.
- **Spawning the independent reviewer session** — `#3279` declares that operation. This card calls it.
- **Deriving a PR's phase.** `classifyPr` and the `pr-status` operation already do it; a second derivation is
  the defect, not the feature. *Correction to the filing brief: there is no open PR on `lane/pr-status-command`
  — no such ref exists on `origin` (`git ls-remote --heads origin 'lane/pr-status*'` returns 0 of 71 refs) —
  because `#3247` landed and is `resolved` (`dateResolved: "2026-08-21"`). `#3252` (pr-status on a
  credential-less host) is the open remainder.*
- **Disposing a `review:pending` PR from a jury ledger** — `we:scripts/review-runner.mjs` owns that, and its
  shadow→enforce flip is `#2572` part 2. This card must not flip it.
- **The lease reaper's ghost-lease collision** — `#3283` (PR `#1567` merged; the item is still open).
- **Widening `claude agents --json` to carry a PR or item field.** Refusal 4 needs that binding and today has
  to derive it; adding the field is a change to a tool this repo does not own. Named, not absorbed.
- **Reaping a session blocked on a permission prompt.** This pass must *surface* the 211-hour case; clearing it
  is a separate job (see below).
- Changing any label's meaning, or adding a new label. The stand-down signal is a comment marker.

## Done when

Case 1 pins the dispatch and its key; 2–5 pin one refusal each; 6 is the only thing standing between a green
suite and a pass that reconciles nothing in production. The list runs past the usual 3–5 cap because four of
its entries are one-per-refusal and the refusals *are* the item — dropping one drops a refusal.

1. **Executable, fails today — the dispatch, keyed by PR number.** `planReconcile` given a PR fixture
   `{ prNumber: 1563, state: 'OPEN', labels: ['review:changes'], comments: [<one changes-requested comment>] }`
   and an agent listing with no entry bound to it returns exactly one `dispatch` of kind `fix`. In the same
   case, a fixture of the four real head refs open at 17:34Z today (`lane/review-slice-scopes`,
   `lane/review-pr-override-reason`, `lane/review-corpus-replay`, `lane/review-efficacy-watch`) produces
   **four** rows — measured today all four return `null` from `laneRefItemNum`, so an item-keyed pass produces
   zero, and this assertion is that difference stated as a test. Both fail today with `ERR_MODULE_NOT_FOUND`:
   `we:scripts/conveyor/reconcile-core.mjs` does not exist.
2. **Executable — refusal 1.** The `#1563` fixture plus one comment whose leading line is the stand-down marker
   returns **zero** dispatches and one refusal `{ kind: 'stood-down' }` — and returns the identical result on a
   second call with a `now` advanced by a week (no decay, no clock, terminal). Paired:
   `we:scripts/conveyor/stand-down.mjs` posts that marker, `countStandDownComments` reads it back, and
   `we:skills-src/conveyor/fix-agent-brief.md`'s two escalation exits (`:70-72`, `:90-91`) call it before
   returning.
3. **Executable — refusal 2.** A `review:pending` fixture with zero comments returns no `fix` dispatch and a
   refusal `{ kind: 'no-findings' }`; the same fixture returns a `review` dispatch. Uses `#1576`'s real shape as
   measured at `17:21Z` today — `review:pending`, 0 comments, head ref `lane/review-slice-scopes`.
4. **Executable — refusal 3.** With `durableCounts` supplied and the in-process state **empty** (a fresh pass,
   nothing carried in), a PR at or above the cap returns `{ kind: 'cap-exhausted', attempts, cap }` and no
   dispatch. Asserted with `attempts` sourced only from the PR — a test that passes an in-memory tally and an
   empty PR must still refuse to dispatch on the PR's own count, and must not be satisfiable by the tally.
5. **Executable — refusal 4, and this is the case that pins cause 6.** Four fixtures, because the listing is
   partial (measured today: `pid` on 13 of 17 entries, `state` on 7, `status`/`waitingFor` on 3, and no PR or
   ref field on any):
   - **(a)** an agent entry bound to the PR with a live `pid`, **and** a transcript mtime 211 hours stale →
     `{ kind: 'live-process', pid }`, not a dispatch.
   - **(b)** an entry with `status: 'waiting'`, `waitingFor: 'permission prompt'` → refuses, with its own
     distinct refusal kind, and appears in the pass's surfaced notes.
   - **(c)** **no** agent entry at all plus a **fresh** mtime → dispatch. This is what proves no marker or
     timestamp can grant liveness on its own.
   - **(d)** an entry bound to the PR **with `pid` absent** → refuses as *unknown*, not as *idle*, and its
     refusal carries the `cwd` and head sha the bind turned on. Absence of a field is never evidence of death,
     and the binding is a derivation the reader must be able to audit — it produced a false positive in this
     lane at 17:34Z today.
6. **Executable — the argv is pinned, not just the classification.** Assert the literal argv the default
   readers build: `['agents','--json']` for the session listing — the exact argv
   `we:scripts/operations/dispatch-lane-io.mjs:879` already builds — and a `gh pr list` carrying `--state open`
   with `number,headRefName,headRefOid,labels,statusCheckRollup,mergeStateStatus,comments` in `--json`
   (`headRefOid` is load-bearing: refusal 4's binding compares it against a lane `HEAD`). Mirrors the
   *technique* of `we:scripts/operations/__tests__/dispatch-lane-defaults.test.mjs:132`, not its flag — that
   test pins `--state all` for a different reader, and copying the flag across would hide every open PR's
   opposite failure. Without this assertion every other case here is green on injected fixtures and the pass
   returns nothing live — the `#3095` defect, arriving the same way.
7. **Mutation** — four mutations, one per refusal, each named with the case it reddens and the cases it must
   leave green:
   - drop the `stood-down` check → reddens case 2 only.
   - drop the empty-findings check → reddens case 3 only.
   - read the attempt count from the in-process tally instead of the PR → reddens case 4 only.
   - accept a fresh transcript mtime as liveness → reddens case **5(c)** only (a fresh mtime with no agent
     entry must still dispatch), and **must not** redden **5(a)** — a live `pid` refuses regardless of how
     stale the transcript is. That asymmetry is the whole point of refusal 4: freshness never grants
     liveness, and staleness never withdraws it; a mutation that reddens both has removed the wrong thing.
     For the kill to land on 5(c) alone, 5(b) and 5(d) must carry a **stale** mtime too, so what their
     refusal turns on is the entry's own fields and nothing else.
     *Correction: this bullet said the mutation "reddens case 5(a), and **must not** redden 5(c) (a fresh
     mtime with no agent entry still dispatches)". The pairing was inverted, and so stated the criterion was
     unachievable: 5(a)'s mtime is stale, so a mutant that accepts a **fresh** mtime as liveness never fires
     on it — the live `pid` still refuses and 5(a) stays green — while 5(c) is exactly the case it reddens.
     Carried in this form from the filing snapshot (`4b6e453f`), where it read "case 5's first fixture" /
     "its third"; this card relabelled the fixtures 5(a)–5(d) without re-checking the pairing.*
8. `npm run check:standards` — **no new errors and no more than 1434 warnings**, the base measured in this lane
   at `origin/main` `a517c8f8`: **1 error, 1434 warnings, 3297 backlog items**. That one error is pre-existing
   and not this card's to fix — a stranded hash id,
   `we:backlog/3323-declare-converge-pr-drive-one-bounced-pr-to-merged-asserting.md`, left by `#1575`'s land
   and cleared by the `number-stranded` verb on `we:scripts/backlog.mjs`. If it is gone by build time the bar
   is 0 errors; it must not rise.

## Watch for

- **The refusals must be reported, never silent.** A pass that refuses four PRs and prints one line has
  reproduced the original defect one level up. Every refusal carries its kind, its PR, and the fact it turned
  on — and for refusal 4, the `cwd` and sha the binding was derived from, since that derivation is itself a
  proxy that has already been observed to be wrong.
- **`stood-down` is terminal for the reconciler, not for a person.** A human clearing the marker is the
  intended exit, and the marker's semantics must say so or it becomes a way to bury a PR.
- **Do not let the pass become a second phase-deriver.** If it needs a fact `classifyPr` or `pr-status` does
  not expose, widen those — a private copy is how the board and the reconciler come to disagree about what a
  PR is doing.
- **Do not copy `pr-status`'s own "three-valued" wording.** It freezes four states and the fourth,
  `unchecked`, is the one this pass turns on.

**Other items surfaced while preparing this, not filed here:** nothing reaps a background session blocked on a
permission prompt (three have held one for 211 hours, and `claude agents --json` exposes no field that would
let a reaper key on the PR they belong to); `laneRefItemNum`'s grammar matches none of today's four open head
refs; and the lane pool hands two agents the same checkout in practice, not just in theory — `lane-35` held
both this preparing session and a CI-heal agent for `#1571` at 17:34Z today, which is `#3283` observed live
rather than argued.
