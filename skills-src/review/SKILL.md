---
name: review
description: Review a parked pull request and record the human verdict — pull the PR's diff + the drain's escalation reasons, run the shared review core (findings + verdict), present them, and on your OK swap the review label (review:human/review:pending → review:accepted, or review:changes to bounce the fix back to the author lane). Use when the user asks to "review PR #N", "clear the parked PR", "look at the review:human PR", or give a human verdict on a drain-parked PR. NOT for reviewing your own working diff (that is /code-review) and NOT for opening a PR (that is /pr).
---

# Review a parked PR — the human verdict (#2326)

The drain (`/drain`) **parks** a blast-radius or gate-self PR with a `review:*` label and waits for an
independent verdict before it may land (#2171/#2262/#2285). `/review <PR>` is that verdict.

**The flow is a declared operation, not a procedure you follow.** `review-pr`
(`we:scripts/operations/review-pr.mjs`, #3035) declares five steps — `read` → `judge` → `reduce` → `confirm` →
`record` — and the command line is derived from that declaration (#3031's statute
[`#operations-declared-once-callers-generated`](../../docs/agent/platform-decisions.md#operations-declared-once-callers-generated)).
Your job is to **invoke it and present its output**. Do not re-derive the diff, the mandate, the verdict or the
label swap by hand: each is a step, and a hand-rolled one drifts from the console's copy (#3036) by construction.

## Run it

```
JUROR_LANE=$(node scripts/lane-pool.mjs acquire --purpose=review-juror)
node scripts/operations/run.mjs review-pr --pr=<PR> --repo=<owner/name> --cwd="$JUROR_LANE" --json
# …and when the review is done, hand the lane back (the slug is on acquire's stderr):
node scripts/lane-pool.mjs release --lane="${JUROR_LANE##*lane-}" --session=<the holder slug acquire printed>
```

**`--cwd` is REQUIRED, and it is a lane of the JUROR's own** (#3151). `review-pr`'s juror is tool-bearing — it
runs gates, reproduces defects and mutates source to test a claim — so `assertLaneCwd` refuses to spawn it
without a lane, rather than letting it inherit whatever tree you are standing in. `acquire` prints the lane's
path on stdout and its holder slug on stderr; the lane must not be the primary checkout and must not be the
lane you are driving from (`assertLaneCwd` refuses both, by inode identity rather than by spelling). It is the
juror's WORKING directory, **not** the checkout the PR is read from — `read` still runs against this repo, so
pointing it at another repo's clone does not make a cross-repo review work (#3137).

`--model=<alias>` overrides the juror's model, and `--help` lists both. (`JUDGE_LANE_CWD` in the environment
still works as a fallback — it was the ONLY way until #3151, which is why older dispatch prompts thread it by
hand.)

### On a host where `gh` cannot authenticate — stage the view first (#xhqqy9j)

`read` makes exactly one network call: `gh pr view --json`. On a cloud VM that call fails and the whole review
stops before it starts. The transport for that case is a view **staged on disk**, which `review-pr-io.mjs`
reads instead of calling `gh` whenever `WE_PR_VIEW_DIR` is set. **CI produces that view; you do not** (#xaoja7a):

```
node scripts/operations/run.mjs stage-pr-view --pr=<PR> --repo=<owner/name> --fromTransport --dir="$WE_PR_VIEW_DIR" --json
```

That pushes a `{repo, pr}` request to `ops/pr-views`, waits for `we:.github/workflows/stage-pr-view.yml` to run
`gh pr view --json` with a token and commit the answer back, and reads it with
`git show origin/ops/pr-views:…`. Expect ~1–2 minutes on a cold request. If it times out, the request is
already pushed and nothing is lost — check the `Stage PR view` run and issue the same command again. If it
refuses the view as **stale**, the PR's head moved after CI produced it: add `--refresh` to ask for a new one.

**Why you must not supply the view yourself.** `--from=<path>` still exists and is **refused on any repo whose
`ops/pr-views` branch exists**. That is not manners, it is the fix. On PR #1542 a reviewing session staged a
paraphrase of the body in its own voice plus a comment it had written itself, stamped
`authorAssociation: OWNER`, that is not on the PR at all — inside the evidence its own juror then read. A juror
weights an owner's word above a drive-by by design, so a synthesized one inverts the signal. Every completeness
check passed; completeness was never the property in question.

Those completeness checks still hold. A view assembled by hand from another API's response drops a field by
omission, and the reader DEFAULTS every field it consumes rather than failing: an absent `labels` makes a
`review:human` PR read as unlabelled and clearable, an absent `comments` hides the escalation and the last
verdict, an absent `body` loses the park's disposition. None of that throws — you get a completed review of a
PR that was never fully read. The operation refuses an **absent** field by name and believes an **explicitly
empty** one (`"labels": []` is a claim; omission is not), writes under the reader's own injective name, refuses
a view whose `headRefOid` is not the head the judged diff will come from, and stamps `_stagedFrom` into the
staged bytes so the artefact records where its evidence came from.

It reads the PR, judges the diff, reduces to a verdict, and then **suspends**. It writes nothing on this
invocation. Present its `verdict` (the findings and the reduced verdict), its `findings.read` (the escalation
reason, the disposition, the net changed-file list, any advisory comment), its `spend` (what the juror cost —
the operator is on a constrained model budget, so report the dollar figure, never omit it) and its
`pending.asks` to the operator, then stop.

**A run seats TWO jurors, and `--lens=` steers only the first (#3319).** There are two declared `judge` steps:
`judge`, whose lens comes from `--lens=` and defaults to `correctness` (`MANDATORY_LENSES[0]`), and
`judgeSecurity`, pinned to `MANDATORY_LENSES[1]` and **deliberately not reachable from the command line**. Both
run on every PR, so you will answer **two** judge suspends, not one. `--help` lists the valid lenses.

**Read `--lens=` as "what the first seat judges", never as "which single lens judges".** The older reading is
the one that burns people: pointing `--lens` at an *advisory* lens does not narrow a panel to that lens, it
**replaces the mandatory correctness seat with an advisory one**, and the run's blocking floor quietly drops. Two
sessions were caught by that in a single day, from opposite directions. If you want a specific advisory lens
looked at, ask for it in addition — not by pointing `--lens` at it.

**Two `judge` steps are still not a `judgePanel` fan-out**, and the distinction is load-bearing. `judgePanel`
(#3050) omits `allowedTools` from its per-seat call object, so every panel seat would run `--tools ''` — that is
**#3158, still open** — and today's juror is tool-bearing because, as `we:scripts/lib/judge-spawn.mjs` puts it,
*"the tools ARE the finding mechanism."* Two declared steps buy two distinct tool-bearing actors without paying
that bill.

Report the verdict as **the seats that actually judged** — the write-up's table lists what ran, not what
exists. Do not call it a panel verdict, and do not describe a run as single-lens.

On the operator's explicit decision:

```
node scripts/operations/run.mjs review-pr --resume=<run-id> --answer=accept    # → review:accepted
node scripts/operations/run.mjs review-pr --resume=<run-id> --answer=changes   # → review:changes, back to the author lane
node scripts/operations/run.mjs review-pr --resume=<run-id> --answer=changes --reason="<what must change>"   # required when the juror found nothing
node scripts/operations/run.mjs review-pr --resume=<run-id> --answer=abstain   # → records nothing at all
```

Five things you no longer have to remember, because the machinery holds them:

- **An override must say why (#3035).** When the juror returns **zero** findings and you record `changes`, you are
  bouncing on something the juror did not raise. `--reason` is then REQUIRED and the operation refuses without it;
  the reason is rendered in the durable comment, which is the only place the author lane can read it. A bounce that
  carries juror findings needs no `--reason` — those findings ARE the reason and are already rendered. See
  *Why the override refusal exists* below.
- **The stop is a suspend.** `--answer` without `--resume` is refused — you cannot answer a question that has
  not been asked, so there is no auto-proceed to resist.
- **The diff is on the net basis** vs current `main` (#2450/#2901), and the juror is told that file set as
  ground truth. `gh pr diff`'s inflated three-dot list never reaches it. A mis-shaped `exec` (#2952) is a hard
  refusal, not a quiet fallback.
- **Re-running is safe, and now provably so.** A `--resume` re-enters the effects, skips every one already
  applied, and refuses to guess at one whose outcome is unknown. No duplicate comment.
- **The label swap goes through `we:scripts/review-set-label.mjs`** — the single home (#2644), with the
  `reviewed-sha` / `reviewed-diff` / `reviewed-contribution` markers and the #2964 write ordering. `accepted` on
  a `review:human` PR is refused in `decideSetLabel`'s pure core, so the operation cannot clear a gate-self PR
  either.

### Why the override refusal exists

The write-up's panel body is composed from the JUROR's findings while `Decision:` comes from your answer, so a
reasonless override posted *"✅ pass — no blocking findings"* directly above *"Decision: `changes`"*. A bounce the
author cannot act on buys another round by construction.

Counted 2026-08-26 by sweeping the live comments on PRs #1428–#1567 (140 PRs, 479 comments) for the shape this
operation emits — the line ``**Decision:** `x` — recorded by``:

| | count | PRs |
| --- | --- | --- |
| structured verdict comments | 106 | 59 (none below #1456) |
| …recording `changes` | 44 | 15 |
| **…over `### Findings (0)`** — the case the refusal binds | **18** | **8** (#1556–#1567) |
| …under the juror's own "✅ pass" line — the wider reading | 34 | 11 (#1556–#1567) |

`--reason` rides the **same `--resume` that carries the `--answer`**, not the opening call — an override is only
knowable once the juror has returned, so that is the first moment you could state one. Passing it without an
`--answer` is refused rather than ignored: a reason silently dropped is worse than none.

`--reason` is accepted on *any* answer, and only a decision that actually departs from the juror is captioned as an
override. Pass one alongside an answer the juror agrees with and it is still rendered — under **Operator note**,
which says in words that this was not an override.

> **Retracted — three times, all in this section.**
> 1. It read *"Eleven bounces across PRs #1428–#1567 did exactly that."* Eleven was the number of PRs in the wider
>    set, not the number of bounces; and none of them occurred below #1556, so the stated range implied 128 PRs of
>    history containing none.
> 2. It read *"(108 comments, 62 PRs): 45 recorded `changes`, and 17 of those … it is 33, across 11 PRs."* Re-running
>    the sweep gives 106 / 59 / 44 / 18 / 34. The 108 came from a looser match that also swept up 7 hand-written
>    operator comments carrying a `**Decision:**` line with no `— recorded by` — an operator's own prose, not this
>    operation's output.
> 3. It implied every `--reason` rendered as **Why this was overridden**. It did, and that was the defect:
>    `--answer=accept --reason="fyi"` posted a durable claim of disagreement where there was none.

## What still needs you

**The two shapes of a `review:human` park.** Read the drain's comment to tell them apart (`deriveReviewDisposition`,
#2285) — the operation reports which in `findings.read.disposition`:
- a **sensitivity** park (`gate-self`, `{ mode: converge, autoLand: false }`) — the drain may already have pushed
  an advisory FIX to the branch. The diff you are reading can carry agent-authored trust-chain edits. Scrutinize
  them; do not rubber-stamp.
- a **deadlock** park (`non-convergence` / `mandate-conflict`, `{ mode: human }`) — the loop could not agree and
  pushed nothing. You break the tie.

**Clearing a gate-self PR — the human ceremony (#2895).** `--answer=accept` is REFUSED on a `review:human` PR,
and that is the invariant working. The only thing that removes `review:human` is:

```
node scripts/review-set-label.mjs <PR> --repo=<owner/name> --to=clear-human --actor="<operator>" --reason="<quoted instruction>" --body-file=<findings.md>
```

**Where `<findings.md>` goes, because the path is constrained (#2897).** Its contents are published to a public
PR and cannot be unpublished, so the CLI refuses a path outside the repo root, the OS temp dir, or `/tmp`.
Write it under `/tmp` — that works on every host, including a session scratchpad nested beneath it. Do NOT
route around a refusal by hand-rolling the comment: that is the bypass the single home exists to close, and
the refusal names the roots it will accept.

It is deliberately **not** a step of the operation: it demands an operator instruction quoted verbatim, which is
judgment, not a declared input. **You may run it ONLY on an explicit in-conversation instruction from the
operator naming that PR, and you must pass that instruction verbatim as `--reason`.** No instruction, or an
instruction about a different PR: hand the operator the command line and stop. Nothing in the tool checks who
ran it — #2895 ruled the unforgeable actor signal DEFERRED, so what stands in the way of a clearance nobody
asked for is that misuse takes a written lie. Do not go looking for a third route; there is none, and there is
no `--force`. Its durable comment says the clearance was a HUMAN CEREMONY, not an established-independent
review — never describe it as the latter.

**A self-cleared verdict (#2844).** `--answer=accept` also refuses when the clearing actor is provably the PR's
author. The id is `CLAUDE_CODE_SESSION_ID` and a subagent inherits its parent's, so a PR your session opened is
a self-clear by that measure. Two routes, both above the board: the human ceremony, or running the review from a
session that did not open the PR. Clearing `CLAUDE_CODE_SESSION_ID` out of the environment buys nothing — it
only downgrades the record to *"Independence NOT established"*.

**Re-accepting after a rebase.** `acceptanceCoversHead` keys on head-SHA identity, so a benign rebase invalidates
an accept. Do not re-run the panel: prove the net patch is byte-identical, then re-run the operation with a body
that says so. `reviewed-contribution` (#x9xqexm) already covers pure base movement.

**A host that cannot authenticate to GitHub — record through the operation, never by hand (#xrk6hmj).** On a
cloud VM no local process holds a GitHub credential, so the `record` effect's shell-out to
`we:scripts/review-set-label.mjs` fails and the verdict has to travel as a file on the `ops/review-requests`
branch, which `we:.github/workflows/apply-review-request.yml` applies with the real CLI. That transport has a
caller now — use it:

```
node scripts/operations/run.mjs record-verdict --runId=<run-id> --to=accepted|changes|clear-human [--operatorInstruction="<quoted instruction>"] --json
```

**There is deliberately no `--pr`.** The subject, the repo, the juror's session id and the staged write-up are
read back out of the run record the review itself wrote, because the failure mode here is not tedium — it is
retyping. A hand-assembled request restates the PR number in a fresh `JSON.stringify`, and a wrong one records
your verdict on somebody else's PR while every artefact still names yours. That is the class #1466 closed on the
reading side; this closes it on the writing side. Do not hand-roll the JSON, and do not `git checkout` the
transport branch over your lane — the operation pushes through its own worktree precisely because doing it by
hand takes your uncommitted work with it.

It refuses rather than inventing: a run that produced no verdict, a run that is not a review, and a run that
staged no write-up are all refused, because each would put a request on the transport branch indistinguishable
from a real review. `--to=clear-human` still carries every constraint of the ceremony above — the instruction
goes in `--operatorInstruction`, verbatim, and the applier refuses the target without it.

## Invariant

A **`review:human` PR is never agent-cleared.** The core may render an advisory take; the `review:accepted` label
on such a PR is applied only by a human, via the ceremony above. Since #2771/#2785 (statute
[`#review-human-declarative-leash-only`](../../docs/agent/platform-decisions.md#review-human-declarative-leash-only))
`humanRequired` fires on the **declarative leash** plus any statute edit; the gate's derivation code parks
`review:pending` for the independent committee instead. Read the label, never infer "this needs me" from the
fact that a PR touches gate machinery.

## Independence is about the ACTOR, not the git login (#2439)

In a solo constellation every PR's git login is the same PAT, so login identity is a **useless** independence
signal — do not gate on it and do not warn the operator that "this is your own PR". What matters:

- **An agent must not clear a diff it produced.** Spawning your own review subagents does not make you
  independent. Review your own working diff before the PR (`/code-review`); never relabel a PR **you** authored.
- **A human clearing an AI-lane PR is exactly the independence — clear it without hesitation.** Raise no
  author-self-accept caveat.
- **…but the machine check is coarser than that judgement**, per #2844 above. Take the refusal at face value and
  use a route, never a workaround.
