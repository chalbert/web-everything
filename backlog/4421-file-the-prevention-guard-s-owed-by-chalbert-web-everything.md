---
bornAs: xf403fm
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/operator-queue.mjs", "we:scripts/operations/pr-status.mjs", "we:skills-src/conveyor/fix-agent-ci-brief.md", "we:scripts/operations/__tests__/operator-queue.test.mjs", "we:scripts/operations/__tests__/pr-status.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2894's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/operator-queue.mjs:95` — Add a check:standards rule that flags direct .some/.filter/.every over statusCheckRollup outside we:scripts/lib/rollup-collapse.mjs, with an allowlist for readers that opt out.
2. `we:scripts/operations/pr-status.mjs:161` — Enforce consistent check name extraction (e.g., `c?.name || c?.context || ''`) via a shared utility function across all check-reading modules.
3. `we:skills-src/conveyor/fix-agent-ci-brief.md:218` — Write a test that validates the `we:completion-cli.mjs` invocations in the markdown instructions against the actual CLI argument parser.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2894@255541b37225fecf66af63ded9b1ecccbfb5dde5

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
