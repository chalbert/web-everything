---
kind: story
size: 2
status: open
scope: ["we:skills-src/conveyor/delivery-agent-brief.md", "we:scripts/guard-bash.mjs", "we:scripts/__tests__/guard-bash.test.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# Assert the delivery brief's mid-work command against the guard programmatically, not a hand-copied string

we:skills-src/conveyor/delivery-agent-brief.md's mid-work check (added by #4294) documents a fenced we:scripts/readiness/heavy-admission.mjs run -- npx vitest related command and cites we:scripts/__tests__/guard-bash.test.mjs's non-denial test by title in prose. Nothing ties the two together mechanically: the guard test hard-codes its own command string, so an edit to the brief's documented command (dropping the wrapper, dropping --run/--passWithNoTests, or renaming the cited test) leaves the guard test green while the brief now documents a shape the guard denies or a nonexistent test name. Multiple independent review lenses flagged this same gap while converging #4294 (coverage/claim-accuracy/standards-conformance). Add a test that extracts the fenced bash command from the brief (and, if present, from we:skills-src/conveyor/fix-agent-brief.md / we:skills-src/conveyor/fix-agent-ci-brief.md once we:backlog/x89yzuj-fix-briefs-mid-work-gate-command-is-a-bare-verify-lane-invoc.md lands) and asserts we:scripts/guard-bash.mjs's dispatchedAgentVerificationReason is null for it, for every dispatch kind — so a future edit to the documented command that the guard would deny fails a real test instead of silently drifting.

## Done when

1. **Executable** — a new test extracts the fenced mid-work command from
   `we:skills-src/conveyor/delivery-agent-brief.md` (a markdown-fence parse, not a hand-retyped copy) and asserts
   `we:scripts/guard-bash.mjs`'s `dispatchedAgentVerificationReason` is `null` for it, for every dispatch kind
   (`build`/`fix`/`ci-heal`). Mutate the brief's documented command in a scratch copy (e.g. drop the
   `we:scripts/readiness/heavy-admission.mjs run --` wrapper) and confirm the SAME test then reddens — proving it
   actually reads the brief rather than re-asserting a hard-coded string that happens to match today.
2. **Edge case named** — decide and state explicitly what the test does when the fenced command block is
   missing or the brief is restructured (fail loud naming the reason, vs. skip) — a silently-skipped assertion
   is worse than no assertion, since it reads as coverage that isn't there.
3. **Executable** — if `we:backlog/x89yzuj-fix-briefs-mid-work-gate-command-is-a-bare-verify-lane-invoc.md` has
   landed by the time this item is worked, extend the same extraction to
   `we:skills-src/conveyor/fix-agent-brief.md` / `we:skills-src/conveyor/fix-agent-ci-brief.md`'s own
   `{{GATE_COMMAND}}`; if it has not landed yet, this item covers the generic brief only and says so rather than
   silently skipping the fix briefs.
