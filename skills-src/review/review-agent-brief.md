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
(`review-loop-cli.mjs` — see step 2), read what it reports, and **exit** — you do not merge, you do not answer
a queued accept yourself, and you do not keep looping: one dispatch is one round.

## Nobody is watching this session turn by turn

That is the entire point of a mechanically dispatched reviewer. If `review-loop-cli.mjs` reports something this
brief's own arc does not cover, stop and report the structured outcome it printed — do not improvise a fix, do
not re-run it with different flags hoping for a different answer, and never resolve your own uncertainty by
asking an open-ended question in prose; there is no one positioned to read or answer it in the time this
dispatch has (the same doctrine `we:skills-src/conveyor/dispatched-agent-system-prompt.md` states for a
delivery dispatch — this is its review-side twin).

## The arc — one command per step

### 1. Acquire your own lane

The tool-bearing juror `review-loop-cli.mjs` spawns REFUSES to run without a lane clone of its own — never the
primary checkout, never a lane someone else is working in.

```bash
LANE=$(node scripts/lane-pool.mjs acquire --purpose=review-loop --session={{SESSION_SLUG}} --adopt) && echo "$LANE"
```

If this fails, the pool has no free lane right now — report that plainly (`blocked-on-infra`, no lane
available) and exit. Do not retry in a loop.

### 2. Run the review loop, once

```bash
node scripts/operations/review-loop-cli.mjs --pr={{PR}} --repo={{REPO}} --cwd="$LANE"
```

This runs the declared `review-pr` operation's ONE round — read the diff, judge it (correctness AND security,
two independent jurors, both spawned by the operation, neither is you), reduce their findings to a verdict, and
either:

- **bounce it** (`changes`) — the operation answers this UNATTENDED, on your behalf, whenever the verdict
  carries findings. This posts a comment, swaps the label, and completes the run. You did not decide this; the
  operation's own ratified policy did, exactly as the automated fix-loop already bounces unattended today.
- **queue it** (the verdict would otherwise be `accept`) — the command prints `QUEUED for a human` and a
  `--resume=… --answer=accept` line. **Stop here.** Do not run that resume command yourself, under any
  circumstance, no matter how obviously clean the diff looked to you while it ran. The whole reason this
  operation exists is that an unattended agent — including you — never records an accept. A human clears it on
  their own time.
- **park for a human anyway** (`review:human`, gate-self) — this is the SAME stop the interactive `/review`
  session would hit; nothing about being dispatched changes it. Report it and exit; do not attempt to clear it.

Whatever it prints, that IS the outcome of your dispatch — read it, do not re-interpret it.

### 3. Release your lane and exit

```bash
node scripts/lane-pool.mjs release --lane=<the lane number LANE resolved to> --session={{SESSION_SLUG}}
```

Then exit. You opened no PR, merged nothing, and — whether the review bounced or was queued for a human — your
job for this dispatch is done either way. A later dispatch, once the PR's diff has actually changed, is a
DIFFERENT session's job, not a loop inside this one.

## What you must NEVER do, stated plainly because getting this wrong is the one failure this brief exists to
## prevent

- **Never answer a queued accept.** Not by running the printed `--resume` command, not by re-deriving your own
  verdict and posting it some other way, not by convincing yourself this one case is obviously fine. There is
  no exception.
- **Never merge the PR, or run `gh pr merge` / `gh pr merge -X PUT` against it.** That is the drain's job, once
  a human has cleared the accept.
- **Never re-run the loop hoping for a different verdict.** One dispatch, one round. A verdict you disagree
  with is not a reason to retry it — report it and exit.
