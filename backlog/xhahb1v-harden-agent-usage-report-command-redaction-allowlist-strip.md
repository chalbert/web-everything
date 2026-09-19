---
kind: task
status: open
scope: ["we:scripts/operations/agent-usage-report.mjs", "we:skills-src/inspect-agent-health/agent-health.mjs", "we:scripts/operations/__tests__/agent-usage-report.test.mjs", "we:skills-src/inspect-agent-health/__tests__/agent-health.test.mjs"]
dateOpened: "2026-09-19"
tags: []
---

# Harden agent-usage-report command redaction: allowlist, strip shell-lexer markers, cover PROJECTS_DIR-itself branch

PR #2325's independent review (accept, non-blocking) found 3 real residuals in the PR #2319 follow-up fix: (1) we:scripts/operations/agent-usage-report.mjs's summarizeCommand() redacts by a DENYLIST of flag names, so an unquoted/positional/unknown-flag value (e.g. --task=fix the SECRET bug, or a bare positional word) still persists prompt-shaped text verbatim up to 300 chars — switch to an ALLOWLIST of known non-content flags (--model,-m,--effort,--tier,--dir,--gate,--log,--timeout-ms,--json,--repo-root,--ephemeral,...) and redact every other token, plus cap the uncapped delegatedModel.model field with the existing capText() helper. (2) summarizeCommand also persists the shell lexer's internal __redirect__ sentinel and stray redirect-target text (e.g. a > /tmp/out 2>&1 suffix) verbatim — truncate the parsed argv at the first __redirect__ before summarizing. (3) we:skills-src/inspect-agent-health/agent-health.mjs's resolveTranscript() has an untested branch: calling it with target === PROJECTS_DIR itself returns a specific error, but no test defends it (confirmed by mutation: deleting that branch left all existing tests green). Add adversarial fixtures for all three (unquoted/positional task text, a command with a shell redirect, and target===PROJECTS_DIR) with sentinel-substring-absence assertions matching the pattern already used in we:scripts/operations/__tests__/agent-usage-report.test.mjs and we:skills-src/inspect-agent-health/__tests__/agent-health.test.mjs.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
