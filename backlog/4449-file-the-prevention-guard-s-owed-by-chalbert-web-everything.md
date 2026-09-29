---
bornAs: xuojjv7
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/__tests__/guard-bash.test.mjs", "we:skills-src/conveyor/delivery-agent-brief.md"]
dateOpened: "2026-09-28"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2861's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/__tests__/guard-bash.test.mjs:177` — Add a deterministic test that extracts the brief's command, requires --run and --passWithNoTests, and checks guard non-denial for each dispatch kind; fail if the command is missing. The extraction follow-up is already filed as #4368, but no implementing gate appears in this diff.
2. `we:skills-src/conveyor/delivery-agent-brief.md:188` — Add a test in `we:scripts/__tests__/guard-bash.test.mjs` asserting that `dispatchedAgentVerificationReason` rejects `vitest` invocations missing `--run` or `--watch=false`, forcing the implementation to enforce the safety mechanically instead of relying on prose.
3. `we:skills-src/conveyor/delivery-agent-brief.md:192` — A markdown lint rule that enforces all script references in agent briefs to include their full repo-relative paths when formatted as inline code.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2861@b01a9b50c1da384b10f979dafad2dd01b46994bc

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
