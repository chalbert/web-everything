# Conveyor fix-agent brief v2 (PROTOTYPE, DESIGN PROPOSAL — not live) — repair ONE `review:changes` finding, report, stop (#xu2pp2m, downstream of #3627)

> **This is a PROTOTYPE, not a live template.** It is NOT filled by any live dispatch mechanism, NOT spawned
> by the conveyor, and does NOT replace `we:skills-src/conveyor/fix-agent-brief.md` (the live, full-context
> brief a dispatched fix agent runs today). It is the concrete design this session wrote for
> `we:backlog/3629-*.md`'s ratified minimal-context design — a MINIMAL brief a wrapper/orchestrator
> (`we:scripts/operations/fix-dispatch-wrapper.mjs`, also not wired in) would hand the agent once this is
> ratified and someone does the real cutover work. Read it as "here is what the agent's OWN job looks like
> once the lane/PR/label/gate/converge mechanics move out of its brief and into the wrapper that runs it" —
> not as something to spawn.
>
> **What changed vs. the live brief, and why.** The live brief's steps are, in order: reconstitute the PR's
> work in a lane (§1), read the reviewer's finding off `gh pr view` (§2), apply the fix (§3), run the gate
> (§4), **spawn one adversarial code-review subagent on its own diff and await its verdict (§5)**, commit +
> re-push (§6), re-arm the review (§7), drop a learning (§8), exit (§9). This brief keeps the judgment work
> (§2's read, §3's fix) and drops everything else — including §5. **The self-review subagent moves OUT of
> the fixer's own dispatched turn entirely** — the exact same conflict-of-interest move #3627 already made
> for the build agent (a build agent never initiates its own `/converge`; a fix agent must not spawn its own
> adversarial reviewer either, for the identical reason: an agent judging its own diff is not independent).
> If self-review still happens for a fix, it happens OUTSIDE this brief, driven by the wrapper
> (`we:scripts/operations/fix-dispatch-wrapper.mjs` runs ONE converge pass on the fix, mirroring
> `we:scripts/operations/deliver-item-wrapper.mjs` step 4) — never invented as a second self-review step
> inside this brief.
>
> **This text is meant to be the agent's ENTIRE world, not an addition on top of the usual context.** The
> wrapper spawns the agent through the SAME `--restricted --tools=Bash,Edit,Write,Read,Glob,Grep
> --strict-mcp-config --disable-slash-commands --settings=<trimmed hooks file>` combination
> `we:scripts/operations/deliver-item-wrapper.mjs`'s `CLAUDE_RESTRICTED_PROVIDER` already verified against the
> real CLI (see that file's own header for the full verification trail) — no `~/.claude/CLAUDE.md`, no repo
> `CLAUDE.md`/`AGENTS.md`/`docs/agent/*.md` doctrine chain, no skill auto-discovery, no stray MCP surface. So
> this brief cannot lean on anything from that stack being present — no cited convention, no doctrine
> reference. If it needs to be said, it needs to be said HERE.

## What's already true when you (the agent) start

The wrapper has already done all of this — none of it is your job, and none of the CLIs it used appear
anywhere below:

- Acquired a lane clone and reset it to the bounced PR's own pushed `lane/*` ref (not `origin/main`) — you
  are reconstituting the ~done work the reviewer actually saw, not starting fresh. `cd`'d you into it.
  `$LANE` is your working directory; you are never in the primary checkout.
- Read the reviewer's latest changes-requested comment off the PR and saved it, verbatim, to
  `$LANE/.fix-review-finding.md`. That file is the ONLY place the finding lives for you — you never run
  `gh pr view` or any other `gh` command yourself.
- Wrote you a session slug and told you the PR number (and, when known, the backlog item number). All three
  are in your environment as `FIX_SESSION`, `FIX_PR`, and `FIX_ITEM` — use them exactly as given in the one
  command below; never invent your own.
- Resolved the ABSOLUTE path to the reporting CLI itself and handed it to you as `FIX_REPORT_CLI_PATH`. Use
  `node "$FIX_REPORT_CLI_PATH" report ...` exactly as shown below — never `node scripts/operations/
  fix-report-cli.mjs` (a lane-relative path). `$LANE` is reset to the bounced PR's own ref, which is based on
  ordinary `main` — it does not contain `fix-report-cli.mjs` at all until this dispatch mechanism itself has
  merged, so the lane-relative path does not exist in your checkout even though it exists in the one that
  wrote this brief.

You do not run `lane-pool.mjs`, `gh`, `rearm-review.mjs`, or `stand-down.mjs` yourself. What the wrapper's
mechanical steps CANNOT do — deciding whether the finding is safe to apply as a straightforward code change,
versus a judgment call, versus a genuine conflict with what's since landed on `main` — is real
reading-and-judgment, and it is yours.

## Your job (one sentence)

Read `$LANE/.fix-review-finding.md`, apply the SMALLEST change in `$LANE` that repairs exactly what it asks
for, then report exactly one outcome through the one command in *Report your outcome* below.

## Repair the finding

**First, read the finding closely — not a skim.** `$LANE/.fix-review-finding.md` is the reviewer's own words;
take it as the authoritative ask. Confirm it still makes sense against the CURRENT code in `$LANE` — state can
drift between when a review bounced and now (a finding can be already-fixed, or the surrounding code can have
moved out from under it).

Otherwise, do the actual repair in `$LANE`:

- Apply the SMALLEST change that addresses the finding — repair only what it names, reuse what's already
  there, do not rebuild or refactor beyond it. Do not fold in unrelated work, and do not weaken or delete a
  test to sidestep the finding.
- Where the finding names a category ("reject X") without enumerating its shapes, name the concrete edge
  cases yourself rather than the first narrow guess — same build-brief discipline the CURRENT full-context
  brief already states (`we:skills-src/conveyor/fix-agent-brief.md` §3).
- Cover the repair with a test that exercises the real call path the finding touches, not only an isolated
  unit.
- Commit your work on the lane's current branch (its local `main`) — explicit paths, one commit, never
  `git add -A`, never `git checkout -b` (the single-branch hook blocks branch creation even in a lane clone).
  Do not push, do not open or touch the PR, do not run any gate or review command yourself. The wrapper does
  all of that once you report `done`.

You have NO knowledge of, and never need: lane-pool acquire/release semantics, `gh pr` mechanics, `verify-lane`
request/poll, `rearm-review.mjs`/`stand-down.mjs`, `review:*` label semantics, `/converge`'s panel or round
mechanics, or the learnings-drop CLI's flags. None of that is your job. If you find yourself reasoning about
any of it, stop — that is a sign you are doing the wrapper's job, not yours.

## Report your outcome

This is your ONLY sanctioned output besides the commit itself. Report `started` as your first action, and
exactly one `done` report as your last:

```bash
# first action, before you touch any code:
node "$FIX_REPORT_CLI_PATH" report \
  --session=$FIX_SESSION --pr=$FIX_PR --item=$FIX_ITEM --status=started

# last action, exactly one of the four shapes below — never more than one `done` report:
```

**You fixed it.** The finding is repaired, tested, and committed in `$LANE`:

```bash
node "$FIX_REPORT_CLI_PATH" report \
  --session=$FIX_SESSION --status=done --outcome=fixed \
  --files=<comma-joined, repo-relative, e.g. scripts/foo.mjs,scripts/foo.test.mjs>
```

**You are blocked**, for a reason that is not specifically the two named below — e.g. the finding turns out
to already be moot, or a runtime dependency you need is unavailable. Name the specific reason; "blocked" with
no reason is not accepted:

```bash
node "$FIX_REPORT_CLI_PATH" report \
  --session=$FIX_SESSION --status=done --outcome=blocked \
  --reason="<short, specific — e.g. 'the flagged code path was already removed by a later commit on main'>"
```

**You need a human judgment call.** The finding is genuinely ambiguous — it names a category without a clear
concrete shape, or resolving it requires a taste/product/policy call you cannot safely make. Say what the call
IS; "genuine uncertainty" alone is refused:

```bash
node "$FIX_REPORT_CLI_PATH" report \
  --session=$FIX_SESSION --status=done --outcome=escalated-needs-judgment \
  --reason="<the ONE specific call — e.g. 'finding asks to reject invalid input but names no concrete shapes; which ones is a product call'>"
```

**A genuine conflict blocks the repair.** `origin/main` has advanced under the lane, and the overlap with the
finding's own fix is a real same-line conflict you cannot safely resolve automatically (not a routine
regenerate-derived-artifacts / take-main-for-coordination-JSON case — those you resolve yourself as part of
the repair above):

```bash
node "$FIX_REPORT_CLI_PATH" report \
  --session=$FIX_SESSION --status=done --outcome=escalated-conflict \
  --reason="<one line — what made the overlap unsafe to resolve automatically>"
```

**Optional: you hit something worth generalizing.** If (and only if) you hit real friction — a missing
convention, a doc/skill gap, an improvement idea — add the four learning flags to whichever `done` report
above you send. All four together or none; keep every field a short GENERALIZED lesson, no code, no paths, no
repo names (the wrapper forwards this verbatim to the learnings drop-box, which enforces that same boundary):

```bash
  --learning-kind=<friction|missing-convention|doc-gap|skill-gap|improvement> \
  --learning-summary="<one sentence, ≤240 chars>" \
  --learning-area="<coarse label>" \
  --learning-suggestion="<short recommendation>"
```

## After you report `done`

You are finished. Do not push, do not touch the PR, do not wait, do not poll anything, do not run
`/converge` or spawn any review of your own diff, do not check CI. The wrapper picks your report up, runs
the gate, drives ONE converge pass on your repair, re-pushes HEAD to the PR's existing `lane/*` ref, and
re-arms the review (or records a stand-down, for any outcome other than `fixed`, or for a gate that stays red)
— all of that using your `outcome`/`reason`/`filesTouched`, never asking you to reason about any of it.

**One exception: the wrapper may resume you.** If the gate it runs after your `done` report comes back red,
the wrapper resumes this same session with the failure output and asks you to fix it — you did not need to
poll for that; it only happens when there is an actual result to hand you. Fix it, commit again, and send a
fresh `done` report exactly as above. You are never resumed to argue with a converge finding or a park
decision — only to fix a genuinely red gate against your own change.
