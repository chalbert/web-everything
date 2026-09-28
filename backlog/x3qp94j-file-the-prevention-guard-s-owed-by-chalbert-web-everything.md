---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:skills-src/conveyor/fix-agent-ci-brief.md", "we:scripts/conveyor/__tests__/already-landed-watch.test.mjs", "we:scripts/conveyor/__tests__/reconcile-pass.test.mjs", "we:scripts/conveyor/reconcile-pass.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2810's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:skills-src/conveyor/fix-agent-ci-brief.md` — An integration test that actually drives the brief's shell blocks through the same tool the fix agent uses (rather than only asserting on the markdown text) would catch a cross-block persistence regression; this applies to the whole brief, not just this PR's addition, so it's a backlog filing rather than a blocking gate here.
2. `we:scripts/conveyor/__tests__/already-landed-watch.test.mjs` — Parameterize the stale-main refusal test over apply:false and apply:true, asserting that readPlan, closePr, and resolveItem are never called.
3. `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs` — Use a conflicted stacked PR with capped rounds against older tips and assert that runReconcilePass returns a fix dispatch with attempts:0 after enrichment supplies a new tip; discarding the enrichment result must fail this test.
4. `we:scripts/conveyor/reconcile-pass.mjs` — A lint rule (e.g., ESLint `no-undef`) that fails the build if undefined variables are used.
5. `we:skills-src/conveyor/fix-agent-ci-brief.md` — A documentation or prompt lint rule ensuring that variables intended to be shared across blocks in agent briefs are written to a file (e.g., `echo "..." > .head`) rather than kept in the shell environment.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2810@30b6734b88485b3912ba1b727fb25d477024e535

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
