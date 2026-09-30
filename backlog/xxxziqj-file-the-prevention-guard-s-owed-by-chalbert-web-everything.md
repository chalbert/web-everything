---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/3996-planner-build-plan-schema-and-routing-inputs-task-type-by-ca.md"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3212's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/3996-planner-build-plan-schema-and-routing-inputs-task-type-by-ca.md` — Add a backlog lint / check:standards rule that a card with preparedDate must contain a `## Done when` section with no `TODO` text; the existing TODO skeleton is otherwise silently dropped.
2. `we:backlog/3996-planner-build-plan-schema-and-routing-inputs-task-type-by-ca.md:30` — Prepare-stamp review lens: every 'Remaining work' item must cite the existing function/row it extends and list all readers of a field being removed.
3. `we:backlog/3996-planner-build-plan-schema-and-routing-inputs-task-type-by-ca.md:44` — Add a card-prepare lens/check requiring any security-tier classification change (doc-fix allowlist, size/route inputs) to state current vs proposed set and include a negative-case test in the Test plan; ideally a unit test on isDocScopePath rejecting we:.njk/.js under src/_includes and src/_data.
4. `we:backlog/3996-planner-build-plan-schema-and-routing-inputs-task-type-by-ca.md:15` — A `check:standards` validation step that requires all backlog markdown files to contain a `## Done when` header with an executable command constraint.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3212@abc9cd6471051dcf82c9704e8b8450045795222f

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
