---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/git-already-done.mjs", "we:scripts/lib/__tests__/gh-cost-git-paths.test.mjs", "we:scripts/lib/gh-throttle.mjs", "we:scripts/lib/pr-limit.mjs", "we:scripts/lib/__tests__/git-already-done.test.mjs", "we:scripts/lib/__tests__/gh-throttle.test.mjs", "we:scripts/lib/__tests__/pr-limit.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3103's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/git-already-done.mjs:49` — Add a fixture test that replays a real slice of main's first-parent log (including the drain JIT-number and mark-card commits) and asserts the negative answer still succeeds, and exempt `drain:` bookkeeping subjects from the guard.
2. `we:scripts/lib/__tests__/gh-cost-git-paths.test.mjs:29` — A test that runs the reader against a real temporary git repository (the dispatch-plan test already builds one) with a nonstandard merge placed before and after the item's birth commit, and with an xhash→#N rename.
3. `we:scripts/lib/gh-throttle.mjs:319` — Change the exemption to require exactly one `query` field across -f/-F/--field/--raw-field (and the attached `--field=query=` forms), and add a table-driven adversarial argv test for classifyGhWrite. A check:standards rule that any new classifyGhWrite exemption ships a duplicate-key test would gate the class.
4. `we:scripts/lib/git-already-done.mjs:17` — Extract one shared remote-identity helper (anchored host, and slug equal to the expected repo) and use it in git-already-done and both dispatch-lane-io fallbacks. Then add a lint rule banning ad-hoc `github\.com[:/]` remote regexes outside that helper.
5. `we:scripts/lib/git-already-done.mjs:44` — Add a deterministic git-fixture regression with an implementing PR merged into a lane base and then merged into main under another title; require fallback or an equivalent already-done result and run it in the standard test gate.
6. `we:scripts/lib/pr-limit.mjs:181` — A lint rule that catches undefined variables or missing imports (e.g., `eslint` with `no-undef`).

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3103@ddf54d52bdeef81f03c00c6aa7883afacc9dcb0c

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
