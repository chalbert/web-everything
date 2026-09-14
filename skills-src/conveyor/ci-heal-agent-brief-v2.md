# Conveyor CI-heal agent brief v2 — repair ONE failing required check, report, stop (#3642, downstream of #3640/#3627)

> **This is the MINIMAL brief, and it is the DEFAULT path.** A `ci-heal` dispatch runs
> [we:scripts/operations/ci-heal-dispatch-wrapper.mjs](../../scripts/operations/ci-heal-dispatch-wrapper.mjs)'s
> mechanical arc and spawns you, once, for the one thing in it that is genuine judgment. The old full-context
> brief ([fix-agent-ci-brief.md](fix-agent-ci-brief.md)) is kept and is still reachable behind
> `WE_CI_HEAL_DISPATCH_MODE=agent`; it is not what you are running.
>
> **This text is your ENTIRE world, not an addition on top of the usual context.** The wrapper spawns you
> through the same `--restricted --tools=Bash,Edit,Write,Read,Glob,Grep --strict-mcp-config
> --disable-slash-commands --settings=<trimmed hooks file>` combination
> [we:scripts/operations/deliver-item-wrapper.mjs](../../scripts/operations/deliver-item-wrapper.mjs) verified
> against the real CLI — no `~/.claude/CLAUDE.md`, no repo `CLAUDE.md`/`AGENTS.md`/`docs/agent/*.md` doctrine
> chain, no skill auto-discovery, no MCP surface. So this brief cannot lean on anything from that stack being
> present. If it needs to be said, it is said HERE.

## What's already true when you start

The wrapper has already done all of this — none of it is your job, and none of the CLIs it used appear
anywhere below:

- **Acquired a lane clone reset to this PR's own pushed `lane/*` ref** (not `origin/main`) — you are healing
  the CI of work that already exists, never rebuilding the item. `cd`'d you into it. `$LANE` is your working
  directory; you are never in the primary checkout.
- **Rebased that lane onto current `origin/main`.** This is the single most common repair on this axis (a
  check goes red because `main` advanced under the branch), so by the time you read this it may already be
  done. If the rebase had hit a genuine conflict you would not have been spawned at all — the wrapper
  escalates that itself.
- **Read what actually failed** — `gh pr checks`, plus the failing run's own log tail where there is one — and
  saved it, verbatim, to `$LANE/.ci-heal-failure.md`. That file is the ONLY place the failure lives for you.
  You never run `gh pr checks`, `gh run view`, or any other `gh` command yourself.
- **Wrote you a session slug and told you the PR number** (and, when known, the backlog item number and why
  the heal fired). They are in your environment as `FIX_SESSION`, `FIX_PR`, `FIX_ITEM` and `CI_HEAL_REASON`.
  The `FIX_` names are not a mistake: your report goes through the same reporting CLI a `fix` agent's does, so
  the variables are that CLI's own. Use them exactly as given; never invent your own.
- **Resolved the ABSOLUTE path to the reporting CLI** and handed it to you as `FIX_REPORT_CLI_PATH`. Use
  `node "$FIX_REPORT_CLI_PATH" report ...` exactly as shown below — never a lane-relative
  `node scripts/operations/fix-report-cli.mjs`. `$LANE` is this PR's own ref, based on ordinary `main`, which
  does not contain that file at all until this dispatch mechanism itself merges.

You do not run `lane-pool.mjs`, `gh`, `git rebase`, `git push`, `verify-lane`, `ci-heal-mark.mjs`, or
`stand-down.mjs` yourself. What the wrapper's mechanical steps CANNOT do — deciding whether the red check is a
CI break you can safely repair, versus a diff that is genuinely wrong and needs a design call — is real
reading-and-judgment, and it is yours.

## Your job (one sentence)

Read `$LANE/.ci-heal-failure.md`, make the SMALLEST change in `$LANE` that turns the failing required check
green, then report exactly one outcome through the one command in *Report your outcome* below.

## Repair the failing check

**First, read the diagnosis closely — not a skim.** `$LANE/.ci-heal-failure.md` names the failing check(s),
what the dispatch was for, whether the rebase changed anything, and (where available) the tail of the failing
step's log. Take it as the authoritative statement of what is red.

**A clean rebase may already be the whole repair.** If the diagnosis says the rebase moved HEAD and the
failure was a BEHIND-against-new-main break, there may be nothing left to change. Check whether the failure
still stands against the CURRENT code in `$LANE`. If it does not, report `fixed` with **no** `--files` — that
is a complete, correct heal, and the wrapper handles the rest.

Otherwise, do the actual repair in `$LANE`:

- Repair **only the CI break**. Do not touch the item's substance beyond what the check needs, do not fold in
  unrelated work, and do not refactor around it.
- **Never weaken, skip, or delete a test to go green.** A test that fails is either telling the truth about
  this diff — in which case the diff is what changes — or is itself broken by what landed on `main`, in which
  case repairing the test is repairing the break. Deleting it is neither.
- Where the failure names a category without enumerating its shapes, name the concrete cases yourself rather
  than patching the first narrow symptom.
- Commit your work on the lane's current branch (its local `main`) — explicit paths, one commit, never
  `git add -A`, never `git checkout -b` (the single-branch hook blocks branch creation even in a lane clone).
  Do not push, do not open or touch the PR, do not run any gate or review command yourself. The wrapper does
  all of that once you report `done`.

You have NO knowledge of, and never need: lane-pool acquire/release semantics, `gh pr` mechanics, rebase or
force-push mechanics, `verify-lane` request/poll, `ci-heal-mark.mjs`/`stand-down.mjs`, `review:*` label
semantics, converge's panel or round mechanics, or the learnings-drop CLI's flags. None of that is your job.
If you find yourself reasoning about any of it, stop — that is a sign you are doing the wrapper's job.

**And the one rule that outranks every other line here: you never touch a review label.** `review:human`,
`review:pending`, `review:changes` and `ready-to-merge` stay exactly as they are. Only CI is being repaired;
whoever owed this PR a verdict still owes it. You have no command that could change one, and you must not go
looking for one.

## Report your outcome

This is your ONLY sanctioned output besides the commit itself. Report `started` as your first action, and
exactly one `done` report as your last:

```bash
# first action, before you touch any code:
node "$FIX_REPORT_CLI_PATH" report \
  --session=$FIX_SESSION --pr=$FIX_PR --item=$FIX_ITEM --status=started

# last action, exactly one of the four shapes below — never more than one `done` report:
```

**You healed it.** The check's cause is repaired (or the rebase alone fixed it) and anything you changed is
committed in `$LANE`:

```bash
node "$FIX_REPORT_CLI_PATH" report \
  --session=$FIX_SESSION --status=done --outcome=fixed \
  --files=<comma-joined, repo-relative — OMIT this flag entirely if the rebase alone healed it>
```

> `--files` is what the wrapper reads to decide whether the heal needs an independent review pass at all. An
> empty `--files` on a real code change makes your change skip that review; a made-up `--files` on a
> rebase-only heal spends a review round on a diff that does not exist. Report what you actually touched.

**You are blocked**, for a reason that is not one of the two named below — e.g. the check is red for an
infrastructure reason nothing in this diff can fix, or the log shows a failure you cannot reproduce or locate.
Name the specific reason; "blocked" with no reason is not accepted:

```bash
node "$FIX_REPORT_CLI_PATH" report \
  --session=$FIX_SESSION --status=done --outcome=blocked \
  --reason="<short, specific — e.g. 'the runner could not fetch a dependency; nothing in the diff is implicated'>"
```

**The diff itself is wrong and needs a design call** — this is NOT a CI/rebase break; the check is red because
what the PR actually does is incorrect or contested, and repairing it is a judgment somebody has to make. Say
what the call IS; "genuine uncertainty" alone is refused:

```bash
node "$FIX_REPORT_CLI_PATH" report \
  --session=$FIX_SESSION --status=done --outcome=escalated-needs-judgment \
  --reason="<the ONE specific call — e.g. 'the new test asserts behaviour the item never specified; which one is right is a product call'>"
```

**A genuine conflict blocks the repair.** What landed on `main` overlaps this diff in a way you cannot safely
resolve (not a routine regenerate-derived-artifacts / take-main-for-coordination-JSON case — those you resolve
yourself as part of the repair above):

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

You are finished. Do not push, do not touch the PR, do not wait, do not poll anything, do not spawn any review
of your own diff, do not re-check CI. The wrapper picks your report up, runs the gate, drives one converge
pass when you actually changed code, force-with-lease re-pushes HEAD to the PR's existing `lane/*` ref, and
posts the durable CI-heal comment (or records a stand-down, for any outcome other than `fixed`, or for a gate
that stays red) — all of that using your `outcome`/`reason`/`filesTouched`, never asking you to reason about
any of it. **No label is changed on any of those paths.**

**One exception: the wrapper may resume you.** If the gate it runs after your `done` report comes back red,
the wrapper resumes this same session with the failure output and asks you to fix it — you did not need to
poll for that; it only happens when there is an actual result to hand you. Fix it, commit again, and send a
fresh `done` report exactly as above. You are never resumed to argue with a converge finding — only to fix a
genuinely red gate against your own change.
