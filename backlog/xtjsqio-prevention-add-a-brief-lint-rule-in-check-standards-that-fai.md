---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/__tests__/conveyor-brief-main-catchup-policy.test.mjs", "we:skills-src/conveyor/fix-agent-ci-brief.md", "we:scripts/__tests__/fixer-merge-ancestry.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Add a brief-lint rule in check:standards that fails when a conveyor fix brief contains git rebase, cher… (from chalbert/web-everything#3322 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/__tests__/conveyor-brief-main-catchup-policy.test.mjs:59` — Add a brief-lint rule in check:standards that fails when a conveyor fix brief contains `git rebase`, `cherry-pick`, or `--force-with-lease` outside an explicit "never" sentence. At minimum, add absence assertions to the policy test.
2. `we:skills-src/conveyor/fix-agent-ci-brief.md` — Add a deterministic check, either a check:standards rule or a policy-test assertion, that conveyor fixer briefs contain no `git push --force*` in executable bash blocks.
3. `we:scripts/__tests__/fixer-merge-ancestry.test.mjs:57` — Share the isolated Git environment with the recipe subprocess and add a deterministic regression that runs with an external Git configuration containing merge.ff=only.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3322@c7aa2fa1b44bbc78a155994aa95994e697756cac

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
