---
bornAs: xy8di3v
kind: story
size: 2
parent: "3383"
status: open
scope: ["we:scripts/operations/review-dispatch.mjs", "we:skills-src/review/review-agent-brief.md", "we:scripts/operations/__tests__/review-dispatch.test.mjs"]
dateOpened: "2026-09-07"
tags: []
---

# Extend #3418's static system-prompt fix to review-dispatch -- its brief's own placeholder table still fools a dispatched reviewer into self-aborting (live: PRs #1998/#2024/#2027)

Live-confirmed 2026-09-07: 4 open PRs (chalbert/web-everything #1985/#1998/#2024/#2027) sat review:pending +
review-status:review-stalled for hours. `claude agents --json --all` shows a real review-<PR> session WAS
dispatched for all four -- so this is NOT we:backlog/3550-*.md's gap (scoped only to "no review ever
dispatched", per we:backlog/3549-*.md's ratified Fork 1). Reading each session's own transcript directly:

- review-1998, review-2024, review-2027 each read their own CORRECTLY, fully-instantiated brief
  (we:skills-src/review/review-agent-brief.md, filled by fillReviewBrief in
  we:scripts/operations/review-dispatch.mjs) and WRONGLY concluded they'd been handed a raw, un-instantiated
  template -- then stopped without running the review. Reproduced directly: running fillReviewBrief with
  PR=2024/REPO=chalbert/web-everything/SESSION_SLUG=review-2024 shows the brief's own self-documenting
  "Fill these before spawning" table (lines 12-18) gets rewritten by the SAME blind REVIEW_BRIEF_TOKEN_RE
  regex that fills the live instructions -- its "Placeholder" column ends up showing the REAL substituted
  value instead of the token name. For REPO specifically, the real value (chalbert/web-everything) is
  textually IDENTICAL to the table's own "e.g. chalbert/web-everything" illustrative example, so post-fill
  the table is genuinely indistinguishable from an unfilled template to the reading agent.
- This is exactly the failure class we:backlog/3418-*.md (resolved 2026-09-02) fixed -- but ONLY for the
  BUILD/conveyor delivery-dispatch path (we:scripts/operations/dispatch-lane-io.mjs's createDispatchSinks,
  via a static --append-system-prompt-file pointing at
  we:skills-src/conveyor/dispatched-agent-system-prompt.md). It was never extended to
  we:scripts/operations/review-dispatch.mjs's dispatchReview -- confirmed by the CURRENT
  we:skills-src/review/review-agent-brief.md's own text: "A background review dispatch is not currently
  given the standing-identity system prompt that states this rule for a delivery dispatch (dispatchReview
  does not pass systemPromptFile), so it is stated here directly instead." That in-brief prose compensation
  is exactly what just failed live three times, because the brief's own corrupted table contradicts the prose
  sitting right next to it.
- review-1985 was a DIFFERENT, unrelated failure (genuine lane-pool exhaustion, self-reported cleanly via
  we:scripts/operations/completion-cli.mjs as blocked-on-infra) -- not this bug;
  we:backlog/3492-*.md (status: active) already covers a closely related review-dispatch hard-fail gap.

Checked and ruled out as covering this: we:backlog/3550-*.md (open, different signal), we:backlog/3418-*.md
(resolved, build-only scope), we:backlog/3496-*.md / we:backlog/3494-*.md (resolved, conflict-watch,
unrelated), we:backlog/1939-*.md / we:backlog/1950-*.md (resolved, orchestrator partitioning, unrelated),
we:backlog/3596-*.md (open, different mechanism), we:backlog/2659-*.md / we:backlog/3492-*.md (cover the
review-1985 shape, not this one). we:scripts/capability-search.mjs verdict: partial, top hit was #3418
itself -- confirming it's the closest prior art, not a duplicate.

Evidence sessions (wev-scratch-dispatcher-4 checkout): review-1998 sessionId
3b938947-b9d2-4ed4-8d55-d054effbc9a9, review-2024 sessionId 78f08d6c-1e66-4c77-8ca6-ff4245246dc2,
review-2027 sessionId 8de50971-f654-4a6d-9f8b-fddef1aeb6a6 -- transcripts under
~/.claude/projects/-Users-nicolasgilbert-workspace-wev-scratch-dispatcher-4/.

Fix direction: extend #3418's landed pattern to dispatchReview -- pass a systemPromptFile (reuse
we:skills-src/conveyor/dispatched-agent-system-prompt.md, or a review-specific equivalent if its build-dispatch
wording doesn't fit) into its buildAgentArgv call, the same way createDispatchSinks already does.
Separately/optionally worth noting for whoever picks this up: fillReviewBrief/fillBrief's shared blind-
substitution mechanism could also be hardened so a brief's own self-documenting placeholder table can't be
corrupted by the same regex that fills live tokens -- the same table pattern also exists in
we:skills-src/conveyor/delivery-agent-brief.md and we:skills-src/conveyor/fix-agent-brief.md, so the
corruption risk is systemic, not review-only -- but that is a separable, larger-blast-radius concern; scope
this card to the review-dispatch system-prompt fix and let the harden-the-substitution question be its own
follow-on if warranted.


## Done when

1. **Executable** — `dispatchReview` (we:scripts/operations/review-dispatch.mjs) passes a `systemPromptFile`
   into its `buildAgentArgv` call, the same way `createDispatchSinks`
   (we:scripts/operations/dispatch-lane-io.mjs) already does for build dispatches — a unit test pins the exact
   argv shape (`--append-system-prompt-file <path>` present) the way
   we:scripts/operations/__tests__/dispatch-lane.test.mjs already pins it for the build-dispatch side per
   we:backlog/3418-*.md.
2. **Executable** — the system-prompt file's content (reused from
   we:skills-src/conveyor/dispatched-agent-system-prompt.md, or a review-specific sibling if the build-dispatch
   wording doesn't fit a review dispatch) states plainly that a dispatched review session's prompt is a real,
   fully-substituted work order, never a template artifact to second-guess — mirroring #3418's landed file.
3. **Executable** — `npx vitest run we:scripts/operations/__tests__/review-dispatch.test.mjs` passes with the
   new assertion, and the existing full-argv pin in that file is updated to expect the flag on every dispatch.
4. `npm run check:standards` stays green.
