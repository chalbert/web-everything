# Machine-cleared merge holds — how real systems spell "wait for the reviewer" when the reviewer runs out of band

**Date**: 2026-08-17
**Point**: Prep research for decision [#2910] (amend `#blast-radius-advisory-care-not-a-gate`). A bot-set,
bot-cleared blocking **label** is a well-attested production spelling of "wait for the review"; the
non-label alternative (a merge rule reading an out-of-band findings store) exists but is *worse* on the
axis that matters; and every merge-queue-shaped system that owns its own queue has added a **wall clock**
to the hold — whose action is always *dequeue and report*, never *assume pass*.
**Research page**: `/research/machine-cleared-merge-holds/`

---

## Question

`#blast-radius-advisory-care-not-a-gate` point 1 (#2563, ratified 2026-07-18) says scored signals
"do **not** block the land on a review verdict … the review still happens (via the loop), just not a human
park." The shipped system contradicts that letter: an escalating PR carries `review:pending` from open
(`we:scripts/lib/review-escalation.mjs:658-662`) and `hasUnclearedReviewLabel` (`:1394-1427`) refuses the
merge until a verdict label arrives.

Two rulings on [#2572] tried to reconcile the two by re-reading the anchor's text; both were struck.
So the question is a **mechanism** question, and it has three parts:

1. Is a **label an automated reviewer sets and clears** a legitimate way to express a merge hold, or is a
   label inherently the "human park" the anchor bars?
2. Should such a hold be **time-bounded**, and if so what does the bound *do* when it fires?
3. Is there a **non-label** alternative — a merge decision that consults an out-of-band store of review
   results directly — and is it better?

## Recommendation

**Keep the label; bound the wait on a live reviewer; make a breach surface the wait as unsanctioned, never
merge it and never convert it into a human hold.**

> **How this landed on the item (2026-08-17).** The prepared decision [#2910] rules on *properties*, not on
> the mechanism: a machine-cleared wait is sanctioned where the panel cannot run inline, provided it is
> bounded by a live reviewer, fails closed, and surfaces a breach as unsanctioned. The label-vs-ledger choice
> is invisible across the WE/FUI boundary, so it is judged *against* those properties rather than ratified as
> a branch — and on the evidence below the label wins. That re-layering came out of the fresh-context
> two-confusion screen; the raw survey conclusions are unchanged and are stated below.

- A bot-set/bot-cleared blocking label is the mainstream spelling (Prow's `needs-rebase`, Kodiak's
  `automerge`, Bulldozer's `WIP`, Gerrit's CI `Verified` vote). The label is not the weak part of the design.
- The non-label alternative has exactly one production instance — GitHub code-scanning **merge protection**,
  a ruleset rule explicitly *not* a status check, evaluated against the code-scanning alert store — and its
  best-documented failure mode is a **permanent block waiting on a result that never posts**. It has no
  timeout. Going non-label buys nothing and costs the single-source-of-truth property.
- Gerrit is the instructive counter-example to the "second source of truth" worry: its votes live in its own
  NoteDb and submit requirements are evaluated there, so the review record and the merge decision share
  **one** store. Prow/tide splits decider from store (tide decides, GitHub labels are the record) and its own
  docs warn that GitHub's merge requirements must be kept in sync with tide's — the known cost of the split.
- Every system that **owns a merge queue** has added a wall clock: GitHub merge queue's status-check timeout
  (with "timed out awaiting a successful CI result" as a first-class removal reason) and Mergify's
  `checks_timeout`, which as of 2026-06-29 defaults to **auto** — the p95 of recent successful CI runs plus a
  margin, rather than a hardcoded constant. Plain GitHub required checks, by contrast, have **no** timeout: an
  unreported required context blocks forever.
- Crucially, **none of these timeouts lets the hold evaporate into a merge.** GitLab drops a failed MR off the
  train and re-pipelines behind it; Mergify dequeues; GitHub removes from the queue. The timeout's action is
  always *eject and report*.

## Key findings

### 1. Bot-cleared blocking labels are ordinary

| System | What the hold is | Who sets / clears | Time-bounded |
|---|---|---|---|
| GitHub commit statuses + required checks | commit status on a `context` (`pending`/`success`) | any app/bot via REST | **No** — a never-reported context blocks indefinitely |
| GitHub merge queue | queue position + checks on the `merge_group` ref | CI/bot reports; queue clears | **Yes** — configurable status-check timeout; "timed out awaiting a successful CI result" is a documented removal reason |
| GitHub code-scanning merge protection | a **ruleset rule**, explicitly not a status check; evaluated against the alert store | GitHub queries the store; the tool populates it out of band | **No** — blocks while analysis "is still in progress" |
| Prow / tide | **labels** (`lgtm`, `approved`, `do-not-merge/hold`, `needs-rebase`) + a tide status context explaining the hold | `needs-rebase` is applied *and removed* fully autonomously by a plugin | No timeout; tide re-queries on a loop |
| Mergify | queue position, with `queue_conditions` naming labels/checks/approvals | bot or human sets; Mergify clears the slot | **Yes** — `checks_timeout`, default `auto` (p95 + margin) since 2026-06-29 |
| GitLab merge trains | train position + pipeline result | GitLab CI | No timer, but **failure-driven eviction** |
| Kodiak | an `automerge` **label**, then defers to branch protection | label may be bot-set | No |
| Palantir Bulldozer | **labels** as trigger/blocker (`WIP`, `Update Me`) | human or bot | No |
| Gerrit | **label votes** (`Code-Review+2`, `Verified+1`) under submit requirements | humans *and* service users (CI accounts) vote | No |
| Zuul | gate-pipeline queue position entered on a Gerrit vote | bot votes; dequeues on failure | Speculative abort on upstream failure; no wall clock found |
| Atlantis | a directory/workspace **lock** from `plan` until merge | bot holds; human unlocks | No |
| SonarQube | quality **gate** → a status check you mark required (blocking); individual issues → PR comments (advisory) | Sonar bot posts Pass/Fail | No |

The load-bearing datum: **Prow's `needs-rebase` is applied and removed by a plugin with no human in the
loop** — a blocking label whose entire lifecycle is machine-owned. Prow additionally posts a status *context*
purely to explain the hold: the label is the state, the status is the message.

### 2. The advisory/blocking line is drawn on false-positive rate, not on who reviews

Google is the sharpest statement. Tricorder findings are **advisory** — grey comment boxes in Critique that a
developer may ignore — and the inclusion bar is numeric: an analyzer must produce **< 10% effective false
positives**, be understandable, be actionable, and have significant impact; the "Not useful" button is the
measurement instrument, and analyzers that don't improve are put on probation and disabled. Blocking lives in
a stricter tier: presubmits block a pending change, and the highest-confidence checks are promoted all the way
to **compiler errors**, which require *no* effective false positives and must report correctness issues only.

SonarQube draws the same line (deterministic quality *gate* blocks; individual issues comment), as does
GitHub's code-scanning severity threshold (gate on the confident tail, leave the rest advisory).

**Implication for #2563:** the anchor's advisory/gate split is about *which signals may summon a reviewer*,
which is the same axis the industry draws. Nothing in the prior art treats "a machine reviewer's verdict is a
merge precondition" as the *gate* side of that line — a bot-cleared hold is how the review is *delivered*,
not a risk score being gated on.

### 3. The bound is real prior art, and its action is never "merge anyway"

- Plain GitHub required checks: **no timeout**. The documented 7-day rule expires a *success*; it does not
  bound a *pending*.
- GitHub merge queue: a configurable **status-check timeout**, with removal-from-queue as the effect.
- Mergify: `checks_timeout`, and as of 2026-06-29 the default moved from off to **auto-computed** from
  observed p95 CI runtime plus a margin. This is the single most transferable design point: derive the bound
  from what the clearer actually takes, don't guess a constant.
- GitLab merge trains: failure-driven eviction with re-pipelining behind.

In every case the fired timeout **ejects and reports**. No surveyed system converts a timed-out hold into a
merge.

This reconciles cleanly with WE's own ratified removal of the *merge-anyway* timer ([#2425], `bornAs`
`x30jq9n`): what was removed was a clock **whose action was to land** ("landing unreviewed code on a clock is
never the right failure mode", `we:scripts/lib/review-escalation.mjs:2022-2024`; pinned by
`we:scripts/lib/__tests__/gate-invariants.test.mjs:119`). A clock whose action is *escalate loudly* is a
different mechanism and is not what #2425 struck.

### 4. What our own existing reports do and do not already cover

- `we:reports/2026-07-18-blast-radius-advisory-review-gating.md` settles the *advisory-vs-gate* question and
  establishes that auto-fix triggers sit in a **separate event-triggered bot, never inline in the merge
  daemon** (`:43-46`, CodeRabbit Autofix via webhook→task-queue; GitHub merge queue only *awaits* required
  checks). It also names our own stranded-park failure at `:10-15`. It does **not** survey who clears a hold,
  bots as required checks, or any time bound.
- `we:reports/2026-07-18-human-vs-ai-review-cognitive-science.md` is pure human factors — no gating-mechanism
  content at all.
- `we:reports/2026-07-10-ai-code-review-best-practices.md` supplies the only existing bound in our corpus, and
  it counts **rounds, not elapsed time** (`:38-40`: an explicit round cap + escalation on non-convergence).

So parts (1) and (2) of the question are genuinely unsurveyed ground in this repo, which is why this topic is
published rather than folded into the #2563 report.

### 5. Re-grounding the shipped system (2026-08-17)

Facts checked directly against the tree, because the item's own refs had drifted:

- `producerReviewLabel` is `we:scripts/lib/review-escalation.mjs:658-662` (the item cited `:307-311`).
- `hasUnclearedReviewLabel` is `we:scripts/lib/review-escalation.mjs:1394-1427` (the item cited `:564-569`).
- `decideReviewGate` returns `action: 'park'` for an escalated PR and makes the park **sticky on the label**,
  so a de-escalated `review:pending` PR still parks. Only `review:accepted` releases it.
- A `none`-care PR does **not** park (`producerReviewLabel` returns `null`), which the #2572 corpus measured at
  273/400 = 68% of recent merges. So "every *escalating* PR blocks" is true; "every PR blocks" is false.
- **The no-agent-spawning rule is not #2391.** #2391 is a two-lock concurrency guard
  (`we:scripts/readiness/drain-lock.mjs:1-38`, `NUMBERING_LEASE_MINUTES = 5`, `DRAIN_LEASE_MINUTES = 15`) and
  says nothing about agents. The de-scope is a 2026-07-11 red-team decision recorded only as a file header in
  the sibling repo: `plateau-app:tools/drain-daemon/daemon.mjs:9` — *"no agent spawning, no steering, no UI,
  no multi-project registry."* #2563 cited this correctly; #2572 and #2910 both re-cited it as "#2391".
  Both facts independently push the panel out of the drain process, so the conclusion stands and only the
  citation was wrong.
- **The machine clearer is built but not running.** `runAutoLandSeam` (`we:scripts/lib/auto-land-seam.mjs:274`)
  has zero production callers; `runnerShadowPlan` hard-codes `LAND_MODES.SHADOW`
  (`we:scripts/lib/review-runner-core.mjs:113`); `landMode` is `"shadow"` in
  `we:scripts/lib/review-policy.contract.json:112-115`; `enforceFlipReady` (named by
  `#enforce-flip-triple-gated`) **does not exist** in the tree; no agreement ledger exists
  (`we:scripts/converge-daemon-pass.mjs:127-129` says so in-line); and the converge daemon's launchd job
  (`com.webeverything.converge-daemon`, `we:scripts/converge-daemon-install.mjs:40-43`, 900 s interval) has
  never been installed — its shadow log holds two records, both 2026-08-09, one of them a refusal.
- Therefore **today every scored park is a human park**, cleared only by
  `we:scripts/review-set-label.mjs` or waived by the `--no-review-escalation` operator override.

## Files created/modified

| File | Action |
|---|---|
| `we:reports/2026-08-17-machine-cleared-merge-holds.md` | created (this report) |
| `we:src/_data/researchTopics/machine-cleared-merge-holds.json` | created (registry entry) |
| `we:src/_includes/research-descriptions/machine-cleared-merge-holds.njk` | created (write-up) |
| `we:backlog/2910-amend-2563-a-machine-park-is-the-only-available-spelling-of-.md` | rewritten to the prepared-fork shape |

## Sources

- GitHub REST commit statuses; "Troubleshooting required status checks" (a never-reported required context
  blocks; the 7-day rule expires a success, not a pending).
- GitHub "Managing a merge queue" (status-check timeout; removal reasons).
- GitHub code-scanning "Merge protection with rulesets" (explicitly not a status check; blocks while analysis
  is in progress). Known permanent-block failure: `github/codeql-action#1537`.
- Prow `tide` component + config docs (`lgtm`/`approved`/`do-not-merge/hold`/`needs-rebase`; the
  keep-GitHub-and-tide-in-sync warning).
- Mergify queue rules + the 2026-06-29 changelog moving `checks_timeout` to an auto-computed default.
- GitLab merge trains (failure-driven eviction).
- Kodiak config reference; Palantir Bulldozer README.
- Gerrit submit-requirements + labels documentation (service users vote; NoteDb is the single store).
- Zuul gating + Gerrit driver docs.
- Atlantis apply-requirements docs.
- SonarQube pull-request analysis docs.
- *Software Engineering at Google*, ch. 20 (Tricorder: advisory findings, the < 10% effective-false-positive
  inclusion bar, the "Not useful" button, promotion of no-false-positive checks to compiler errors).

**Not verified, stated as such:** GitHub merge queue's *default* timeout value is not stated in the official
docs (a third-party figure of 60 minutes exists and is treated as unconfirmed); Mergify's exact behaviour when
`checks_timeout` fires is inferred from the queue-rules page rather than the changelog; no GitLab merge-train
wall clock was found (absence of evidence); tide `lgtm` staleness is per-repo configurable and was not
confirmed; the Tricorder ICSE'15 PDF would not extract, so its criteria are quoted via the *SWE at Google*
rendering.
