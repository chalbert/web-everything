# Independent-review agent brief (template) — review ONE PR, then exit (#3279)

> **This is a TEMPLATE, not a runnable skill.** `we:scripts/operations/review-dispatch.mjs` instantiates it —
> filling the `{{PLACEHOLDERS}}` below with the PR this dispatch was asked to review — and passes the result as
> the prompt for **one background session**, started fresh (`claude --bg --session-id=<a brand-new UUID>`),
> never a subagent of whoever is reading this file. That freshness is the entire reason this brief exists:
> `we:scripts/lib/review-independence.mjs`'s self-clear refusal keys on `CLAUDE_CODE_SESSION_ID`, and a subagent
> INHERITS its parent's value — so a review "panel" spawned from inside the authoring session is still the same
> actor as far as that refusal is concerned. You, reading this, are not that — you were started as your own
> session, with your own id, by the operation named above.

## Fill these before spawning

| Placeholder | What `review-dispatch.mjs` fills it with |
|---|---|
| `{{PR}}` | the PR number to review — e.g. `1234` |
| `{{REPO}}` | the `owner/repo` the PR lives in — e.g. `chalbert/web-everything` |
| `{{SESSION_SLUG}}` | a per-dispatch lane-lease slug, e.g. `review-1234` |

---

## Your job (one sentence)

Acquire your own lane, run the mechanized review-loop against **{{REPO}}#{{PR}}** exactly once
(`review-loop-cli.mjs` — see step 2), read what it reports, and **exit** — you do not merge, you do not clear a
`review:human` park yourself, and you do not keep looping: one dispatch is one round.

## Nobody is watching this session turn by turn

That is the entire point of a mechanically dispatched reviewer. If `review-loop-cli.mjs` reports something this
brief's own arc does not cover, stop and report the structured outcome it printed — do not improvise a fix, do
not re-run it with different flags hoping for a different answer, and never resolve your own uncertainty by
asking an open-ended question in prose; there is no one positioned to read or answer it in the time this
dispatch has (the same doctrine `we:skills-src/conveyor/dispatched-agent-system-prompt.md` states for a
delivery dispatch — this is its review-side twin).

**Never write a scratch file to your own job-scratch directory, and never write one to `/tmp` either.** A
background review dispatch is not currently given the standing-identity system prompt that states this rule for
a delivery dispatch (`dispatchReview` does not pass `systemPromptFile`), so it is stated here directly instead.
The harness hands every `--bg` session a per-session scratchpad path (`~/.claude/jobs/<session-id>/tmp/`) in its
own system prompt; writing there — even into your own directory — can be categorized as touching a sensitive
file and produce a permission prompt nobody is here to answer, wedging you indefinitely. If you need anything
ephemeral on disk, put it **inside the lane clone you acquire in step 1** instead — it is already fully
Edit/Write/Bash-permitted and carries none of the sensitive-file shape.

## The arc — one command per step

### 0. Report `started` — BEFORE anything else (#3436)

The one durable trace that a review of **{{REPO}}#{{PR}}** was ever dispatched, written BEFORE step 1 can fail
for any reason — a lane-pool outage, a crash, a refused effect. Without this, a session that dies here is
indistinguishable from one that was never dispatched at all; `we:scripts/conveyor/review-status-tag.mjs`
answers "is something working right now" but nothing else answers "did the one that just finished conclude
anything" without `claude logs` archaeology (`we:backlog/3436-*.md`). A script, not a step you might skip under
stress — same reasoning as `we:scripts/conveyor/stand-down.mjs`'s own durable marker.

```bash
node scripts/operations/completion-cli.mjs report --session={{SESSION_SLUG}} --kind=review --pr={{PR}} --status=started
```

### 1. Acquire your own lane

The tool-bearing juror `review-loop-cli.mjs` spawns REFUSES to run without a lane clone of its own — never the
primary checkout, never a lane someone else is working in.

**Pass `--wait-ms` (#x3jmao3).** A pool reading "no free lane" is often a MOMENTARY capacity flicker under
real concurrent load, not genuine exhaustion — live-caught 2026-09-04, when a dispatched review's own
acquire read the pool as fully held/dirty and gave up instantly, even though it had freed up again within
minutes. `acquire --wait-ms=<N>` polls (no busy-wait) for up to `N` ms before failing, so this self-heals
without anyone having to notice and manually retry. This is still bounded, not the open-ended retry loop
this step's own next paragraph forbids — one call, one deadline.

```bash
LANE=$(node scripts/lane-pool.mjs acquire --purpose=review-loop --session={{SESSION_SLUG}} --wait-ms=30000 --adopt) && echo "$LANE"
```

If this still fails after that bounded wait, the pool genuinely has no free lane — report the completion
record and exit; do not retry in a loop yourself on top of it:

```bash
node scripts/operations/completion-cli.mjs report --session={{SESSION_SLUG}} --status=done --outcome=blocked-on-infra
```

Then report that plainly (`blocked-on-infra`, no lane available) and exit.

### 2. Run the review loop, once

```bash
node scripts/operations/review-loop-cli.mjs --pr={{PR}} --repo={{REPO}} --cwd="$LANE"
```

This runs the declared `review-pr` operation's ONE round — read the diff, judge it (correctness AND security,
two independent jurors, both spawned by the operation, neither is you), reduce their findings to a verdict, and
either:

- **bounce it** (`changes`) — the operation answers this UNATTENDED, on your behalf, whenever the verdict
  carries findings that still block. This posts a comment, swaps the label, and completes the run. You did not
  decide this; the operation's own ratified policy did, exactly as the automated fix-loop already bounces
  unattended today.
- **auto-clear it** (the verdict is `accept`, or `prevention-outstanding` with its named guard(s) filed) — for
  an AGENT-addressed (`review:pending`) PR, the operation itself records `review:accepted`, swaps the label,
  and completes the run — unattended, on your behalf (`#3434`). A `prevention-outstanding` verdict means every
  actual finding was already resolved and the sole remaining debt is a named "prevention" guard nobody filed;
  the operation files it to the learnings pool as it clears, so that debt is not lost even though nothing
  bounced (`#3442`). **There is nothing for you to do here** — no resume command exists to run, nothing to
  stop for. Read what it printed (it names what, if anything, it filed) and move on to step 3.
- **park for a human** (`review:human`, gate-self, or a `needs-human` verdict) — this is the SAME stop the
  interactive `/review` session would hit; nothing about being dispatched changes it, and this tier's own
  human-only ceremony (`--to=clear-human`) is UNCHANGED by any of the above — it applies to `review:human`
  only, never to `review:pending`. Report it and exit; do not attempt to clear it yourself, under any
  circumstance, no matter how obviously clean the diff looked to you while it ran.

Whatever it prints, that IS the outcome of your dispatch — read it, do not re-interpret it.

### 3. Report `done` — the completion record (#3436)

Update the SAME record step 0 started, so it now carries what step 2 actually concluded — `<outcome>` is
`bounced` / `auto-cleared` / `parked` (whichever of the three step-2 branches you hit), `<verdict>` is the
loop's own verdict word (`run.verdict.loop.outcome` in step 2's `--json` output: `converged` / `escalated` /
`exhausted`), and `<run-id>` is `run.id` from that same output:

```bash
node scripts/operations/completion-cli.mjs report --session={{SESSION_SLUG}} --status=done \
  --outcome=<outcome> --verdict=<verdict> --runId=<run-id>
```

### 4. Release your lane and exit

`$LANE` holds the lane's absolute PATH (that's what `acquire` printed to stdout in step 1), not a bare
number — do not try to extract one from it. Release by session instead, which needs no lane number at all:

```bash
node scripts/lane-pool.mjs release --all-pools --session={{SESSION_SLUG}}
```

Then exit. You opened no PR, merged nothing, and — whichever way it landed (bounced, auto-cleared, or parked
for a human) — your job for this dispatch is done either way. A later dispatch, once the PR's diff has actually
changed, is a DIFFERENT session's job, not a loop inside this one.

## What you must NEVER do, stated plainly because getting this wrong is the one failure this brief exists to
## prevent

**This is not prose alone (#3433).** `review-dispatch.mjs` bakes a `--disallowedTools` deny list into YOUR OWN
session's `claude` invocation before you ever start — the whole `gh` CLI (not just `gh pr merge`; a label edit
or a raw `gh api` call reaches the same outcomes under a different verb), `review-set-label.mjs`,
`apply-review-request.mjs`, and `run.mjs` are all refused by the harness itself, before your own judgment is
even consulted. Do not treat that as permission to test the edges of it; a refused command still means stop and
report, not "try a different phrasing."

- **Never clear a `review:human` park yourself.** Not by running a `--resume … --answer=accept` (or any other)
  command, not by re-deriving your own verdict and posting it some other way, not by convincing yourself this
  one case is obviously fine. That tier exists specifically because the review's own independence is the thing
  most in question — only a human clears it, on their own time (`--to=clear-human`). There is no exception.
  (This does NOT apply to an `accept` or `prevention-outstanding` verdict on a `review:pending` PR — the
  operation already clears those itself, unattended; see step 2.)
- **Never merge the PR, or run `gh pr merge` / `gh pr merge -X PUT` against it.** That is the drain's job, once
  the PR carries `ready-to-merge` (mechanically, for `review:pending`) or a human has cleared it (for
  `review:human`).
- **Never re-run the loop hoping for a different verdict.** One dispatch, one round. A verdict you disagree
  with is not a reason to retry it — report it and exit.
