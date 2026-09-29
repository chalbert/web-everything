---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/sweep-orphan-backlog-cards.mjs", "we:scripts/operations/__tests__/sweep-orphan-backlog-cards.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2901's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/sweep-orphan-backlog-cards.mjs:420` — Add a test for bounded-retry exhaustion. Adopt a convention that for-loops with a `break` on success must be followed by an explicit exhausted-case return.
2. `we:scripts/operations/sweep-orphan-backlog-cards.mjs:470` — Before acquiring a lane, refuse if an open PR from a `lane/orphan-card-sweep-*` branch exists (`gh pr list --head`). Alternatively, use a stable branch ref so a second push fails loudly. Add a test for the re-run-while-open case.
3. `we:scripts/operations/sweep-orphan-backlog-cards.mjs:168` — When a comment states a guard on an exec call (timeout, env, cwd), require the test's exec stub to assert the whole options object. A lint or test-helper convention could enforce this.
4. `we:scripts/operations/sweep-orphan-backlog-cards.mjs:245` — A test asserting the `git fetch` command uses a refspec like `refs/heads/main:refs/remotes/origin/main` or simply `origin`.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2901@39c76fd99f3671069a724a79a9f115b16182ea40

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
