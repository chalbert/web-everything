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

It reads the PR, judges the diff, reduces to a verdict, and then **suspends**. It writes nothing on this
invocation. Present its `verdict` (the findings and the reduced verdict), its `findings.read` (the escalation
reason, the disposition, the net changed-file list, any advisory comment), its `spend` (what the juror cost —
the operator is on a constrained model budget, so report the dollar figure, never omit it) and its
`pending.asks` to the operator, then stop.

`--lens=` picks which single lens judges; `--help` lists the valid ones. **One `judge` step spawns ONE juror,
so a run is single-lens** — the verdict write-up says so in words and its panel table lists only the lens that
judged. Do not describe the result as a panel verdict.

On the operator's explicit decision:

```
node scripts/operations/run.mjs review-pr --resume=<run-id> --answer=accept    # → review:accepted
node scripts/operations/run.mjs review-pr --resume=<run-id> --answer=changes   # → review:changes, back to the author lane
node scripts/operations/run.mjs review-pr --resume=<run-id> --answer=abstain   # → records nothing at all
```

Four things you no longer have to remember, because the machinery holds them:

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
