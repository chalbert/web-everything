# Research: automating merge-conflict resolution on parked PRs (#xu2krte)

Prior-art / concrete-refs survey backing `backlog/xu2krte-*`'s four forks. This is an internal
delivery-machinery decision (no browser-standard survey applies) — the research is entirely grounded in this
repo's own shipped code, read directly rather than assumed.

## Fork 1 — resuming the original builder session

- `claude --help`'s own `--bg` line, read directly (not from memory): *"With --resume <session-id>,
  continues that session in the background under the same ID, **or starts a copy and says so when the
  session is already running**."* This is a REAL mechanism, reachable by a plain `child_process` call — the
  same shape `we:scripts/operations/dispatch-lane-io.mjs#defaultSpawnAgent`/`#buildAgentArgv` (lines
  895-909) already use to spawn a FRESH agent (`--bg --session-id <fresh-uuid>`). It never emits `--resume`
  today.
- The `authored-by-actor` stamp (`we:scripts/pr-land.mjs#withAuthorStamp`, called from `composePrBody`) writes
  `<!-- authored-by-actor: <uuid> -->` as the LAST thing appended to the PR body, where `<uuid>` is
  `CLAUDE_CODE_SESSION_ID` (`we:scripts/lib/review-independence.mjs:87,112`, confirmed against the real fixture
  body in `we:scripts/__tests__/review-detail.test.mjs:15`, which shows the exact rendered stamp
  `<!-- authored-by-actor: 01f39b97-274a-4078-8eeb-e7f8d6008673 -->` sitting after the "## Gate" section).
  That UUID is the FULL `sessionId` a `claude agents --json` row carries, not the short `id` field the same
  row also carries.
- `claude agents --json`'s `state` field is independently documented, live, as unreliable for judging
  busy-vs-idle in EITHER direction: `we:backlog/3435-*.md`'s "Found live 2026-09-02" section records sessions
  reporting `working` for hours after their real work had landed, and others reporting `blocked` despite
  never having begun. `we:scripts/conveyor/session-reaper.mjs`'s own header echoes this ("the `state`/`status`
  fields... are necessary signals but not sufficient ones in either direction") and had to add an independent
  ground-truth cross-check rather than trust `state` alone.
- `SendMessage` (the harness's cross-session messaging tool) IS a real, already-used-live mechanism for
  handing new instructions to an independent background session — `we:backlog/3435-*.md`'s "Found live
  2026-09-03" section documents the operator's own session messaging `conveyor-3452`/`prepare-3448` directly
  and getting a reply. But it is a tool call available only to an agent turn with tool access, not to a bare
  `node` script — `we:scripts/conveyor/reconcile-fix-dispatch.mjs` and its siblings are plain mechanical
  passes with no LLM turn of their own, so they cannot invoke it. The CLI's own `--bg --resume` is the
  primitive actually reachable from that layer.
- `we:scripts/conveyor/session-reaper.mjs`'s own docblock ("WHY `id`, NOT `sessionId`") found live that
  `claude stop` matches on the SHORT `id`, not the full `sessionId` UUID — the exact inverse field mistake is
  plausible for `--resume` too, and is not verified either way here.

## Fork 2 — scope (does `review:human` get excluded)

- `we:scripts/progress-board.mjs#classifyPr` (lines 486-490): `review:changes` is checked and returns
  `'bounced'` BEFORE the `review:human` check. A PR carrying BOTH labels today already classifies as
  `bounced`, and `we:scripts/conveyor/reconcile-core.mjs`'s `OWED.bounced = 'fix'` already dispatches a fix
  agent at it via `we:scripts/conveyor/reconcile-fix-dispatch.mjs` — live, shipped behavior, not a proposal.
- `we:skills-src/conveyor/fix-agent-brief.md`'s own "Guardrails" section states plainly: `review:human` is
  NEVER touched by a fix agent. `we:scripts/conveyor/rearm-review.mjs` machine-refuses to emit
  `review:accepted` or to remove `review:human` under any circumstance (`decideSetLabel({to:'rearm'})`, backed
  by `we:scripts/review-set-label.mjs`'s INVARIANT 2). So a fix agent touching the CODE on a `review:human` PR
  never weakens the human clearance gate — the human still clears it exactly as before, independent of how
  many auto-fix cycles ran against the code underneath.

## Fork 3 — retry/failure escalation

- `we:scripts/conveyor/rearm-review.mjs#REARM_COMMENT_MARKER`/`#countRearmComments` (lines 32-62): the
  durable, restart-surviving attempt count already exists, read back off the PR's own comment thread — no
  parallel counter. `we:scripts/conveyor/reconcile-core.mjs#planReconcile` (lines 491-502) already applies it
  against `NEGOTIATION_ROUND_CAP` (5, `we:scripts/lib/jury-core.mjs`) as refusal kind `cap-exhausted`.
- `we:scripts/conveyor/stand-down.mjs#STAND_DOWN_REASONS` (lines 45-52) already carries a NAMED reason for
  this exact scenario: `conflict: 'a genuine same-line conflict with main blocked the repair'`. It is wired
  into `we:skills-src/conveyor/fix-agent-brief.md` step 3 ("if it is a genuine same-line code overlap you
  cannot safely resolve, report the completion record and stop") and the brief's own "Manual take-over" step
  3, which tells a human fixer to run `we:scripts/conveyor/stand-down.mjs` with `--reason=conflict` when they
  stop instead of resolving. `we:scripts/conveyor/reconcile-core.mjs`'s `stood-down` refusal kind is TERMINAL
  and checked FIRST (before liveness), per the file's own "THE ORDER OF THE CHECKS" note.
- `we:scripts/conveyor/reconcile-finding.mjs` is a DIFFERENT mechanism, for a different moment: it posts a
  NEW `review:changes` bounce when a mechanical pass discovers a fresh cross-cutting concern. It is the right
  tool for Fork 4's initial detection step, not for "the dispatched agent already tried and could not resolve
  it" — that is `we:scripts/conveyor/stand-down.mjs`'s job, and it already exists.

## Fork 4 — dispatch mechanism

- `we:scripts/conveyor/parked-pr-conflict-watch.mjs#planConflictLabelChange` (lines 102-108) already computes
  a `newlyDetected` boolean at exactly the moment a parked PR first drifts into `CONFLICTING` — the natural
  trigger point for a bounce, already present in the existing alert-only pass.
- `we:scripts/progress-board.mjs#classifyPr` (line 495) checks `mergeStateStatus === 'DIRTY'/'BEHIND'` (→
  `'conflicted'`) AFTER the `review:changes` check (line 488) — so relabeling a conflicted PR `review:changes`
  makes it read as `'bounced'`, not `'conflicted'`, and `we:scripts/conveyor/reconcile-core.mjs`'s
  `OWED_ELSEWHERE.conflicted` ("the branch needs a rebase — this pass does not do that") never fires for it.
- `we:scripts/conveyor/reconcile-finding.mjs` is already built for exactly this shape: "a mechanical or
  reconciliation pass... found this PR conflicts with a decision made ELSEWHERE in the repo" — a merge
  conflict against `main` fits that description precisely (the PR conflicts with whatever landed on `main`
  since it opened).
- `we:skills-src/conveyor/fix-agent-brief.md` step 3 ALREADY instructs a dispatched fix agent on how to
  handle a conflict encountered mid-repair ("resolve it the `/finish` way... or, if genuine same-line overlap,
  stop") — this decision's dispatch need only route a conflict-only bounce through the SAME brief, not invent
  a new one.
- `we:scripts/conveyor/reconcile-fix-dispatch.mjs#dispatchFix` (lines 150-171) mints a FRESH `randomUUID()`
  session id for every dispatch today, for every kind of bounce — never a resume. Fork 1's behavior change is
  additive to this function (an opt-in resume parameter), not a rewrite, and should default OFF for every
  existing (non-conflict) caller so ordinary review-finding fixes are unaffected.
