---
bornAs: xe60hcq
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/promote-draft-pr-dispatch.mjs", "we:scripts/operations/__tests__/promote-draft-pr-dispatch.test.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2813's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/promote-draft-pr-dispatch.mjs:45` — Add a deterministic dispatcher-to-provider contract test using different checkout and target repositories, asserting that the generated ready command includes `--repo <target>`; require equivalent routing assertions for repository-scoped mutating passes.
2. `we:scripts/operations/promote-draft-pr-dispatch.mjs:59` — A unit test asserting that the `gh` args emitted by the provider include the `--repo` flag when invoked by the dispatcher across a non-default repo, or a lint rule forbidding `gh pr` commands without `--repo` in daemon-side operations.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2813@a97f60e0f2adb801f9b32a42e38995cd75ef54eb

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
