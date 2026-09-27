---
bornAs: xrf9noi
kind: task
parent: "4075"
status: resolved
scope: ["we:skills-src/conveyor/fix-agent-ci-brief.md"]
dateOpened: "2026-09-27"
dateResolved: "2026-09-27"
tags: []
---

# HIGH: ci-heal escalation can attach an old diagnosis to a newly-pushed, unexamined head

HIGH — can suppress healing on an unexamined revision. Still-open Codex advisory finding from chalbert/web-everything#2787's FINAL review round (codex-correctness/correctness, [PLAUSIBLE]), never acted on before merge (2026-09-27). Re-checked against origin/main @5e6c2868e2 (2026-09-27) — still applies as a residual race; an earlier round's DIFFERENT bug (escalation stamping a local unpushed rebase HEAD instead of the PR's published head) was already fixed in this same PR by reading headRefOid off gh pr view at escalation time.

FINDING: we:skills-src/conveyor/fix-agent-ci-brief.md's escalation commands now read the PUBLISHED head via gh pr view --json headRefOid at the moment of escalation, rather than a local rebase HEAD (the earlier bug, already fixed). But this still reads the head AFTER diagnosis, not the head the diagnosis was actually performed against: if another actor pushes a new commit to the PR while the ci-heal session is still diagnosing the PREVIOUS head, the escalation command fetches the NEW headRefOid and stamps the escalation marker against a revision that was never examined. we:scripts/conveyor/reconcile-core.mjs's escalation refusal (see the sibling still-open finding on the same PR, "waiting-on-system-fix escalations never expire") matches purely on head equality, so that new, unexamined head is now permanently treated as already-escalated/needs-human/waiting-on-system-fix until yet another push changes it again — silently suppressing healing for a revision nobody ever diagnosed.

EVIDENCE: read we:skills-src/conveyor/fix-agent-ci-brief.md directly off origin/main — every escalation command still reads $(gh pr view {{PR_NUM}} --repo {{REPO}} --json headRefOid --jq .headRefOid) at escalation time, with no capture of the head the diagnosis step actually started against and no re-check that the two match before stamping.

PREVENTION (from the reviewer, still owed): capture the published head BEFORE diagnosis begins and use that captured value for the escalation marker (or explicitly re-diagnose if the head changed during the session), plus a deterministic test that changes the remote head mid-diagnosis and asserts the new head receives no escalation marker.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/dispatch-lane.test.mjs -t "4269"` and
   `npx vitest run we:scripts/conveyor/__tests__/ci-heal-escalation-mark.test.mjs` — both fail on `origin/main`
   before this item (every escalation exit in `we:skills-src/conveyor/fix-agent-ci-brief.md` stamps `--head=`
   from a FRESH, live `gh pr view … headRefOid` read taken at escalation time) and pass after: the brief now
   captures the head ONCE, at step 0 before diagnosis begins, into `$EXAMINED_HEAD`, and every escalation exit
   stamps only that captured value.
