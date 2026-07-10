---
kind: story
size: 2
parent: "2405"
status: active
dateOpened: "2026-07-10"
tags: [gate, review, drain, gate-self]
---

# Record acted-on manifest escalation values so a post-review PR-body edit is tamper-evident

The lane manifest rides the editable, un-reviewed PR body (xnsk54v moved the drain metadata — `repos`, `blockedBy`, `crossRepo`, `dismissedFindings` — off a committed tree file INTO the PR body, read via `extractManifestFromBody`). The residual gap: the PR body is editable by anyone with write access and is NOT part of the reviewed commit-set, so the escalation-sensitive values can be edited AFTER review with NO commit trace. `dismissedFindings` feeds `scoreEscalation` (higher ⇒ MORE review scrutiny); `crossRepo` and `blockedBy` gate the drain/merge reconcile ordering. Editing them down post-review suppresses the re-score backstop invisibly. The sibling commit-set-drift gate (#2409) does NOT catch this — a body-only edit doesn't advance HEAD, so a HEAD-vs-reviewed diff sees nothing.

This fix is BEST-EFFORT / PARTIAL tamper-evidence, NOT prevention and NOT a hard guarantee. It raises the bar and leaves a trail; it does not stop an edit. A pure helper `manifestAuditLine({ dismissedFindings, crossRepo, blockedBy })` in [we:scripts/readiness/lane-manifest.mjs](scripts/readiness/lane-manifest.mjs) returns a stable one-line record of the values the automation ACTED ON. At every decision point in [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) — park, skip, AND land (the `land` reason-comment fires on a manifest PR just BEFORE `mergePr`) — that line is folded into a DURABLE, timestamped `gh pr comment` (`buildDrainReasonComment`/`postDrainReasonComment`). Recording on the LAND path matters because the attack SUCCEEDS by editing `dismissedFindings` DOWN so the PR merges — the park/skip paths never fire in that state, so without the land record a landed tampered PR would carry no trace. The recording changes NO land/escalation decision — verdicts and labels are computed first and stay identical; it only records what was acted on. Idempotency is preserved: the dedupe keys on the audit line too, so an unchanged decision de-dupes while a changed acted-on value posts a fresh, separately-timestamped record (the tamper trail).

Honest limitations (this does NOT claim more than it delivers):
- **The evidence is itself deletable.** The record is a PR comment, editable/deletable by the same write-access actor who edits the body. So it is NOT durable against that actor removing the comment — it is a trail an honest observer can diff, not tamper-PROOF storage.
- **It records the drain-time value, not a reviewed baseline.** An edit made inside the review→drain window is only caught if a PRIOR park already recorded the higher value; a first-and-only drain pass records whatever the (possibly already-tampered) body says. This is a snapshot at the moment of action, not a diff against a signed review baseline.
- **The land-path gap is now closed** (a landed manifest PR always carries a land record), but a determined write-access actor can still edit AND delete the record together.

[we:scripts/lane-drain.mjs](scripts/lane-drain.mjs) has no equivalent escalation/reason-comment sink (it reads the manifest only for merge ordering), so the binding stays in [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) — no new comment channel invented.

Sits alongside #2409 (the adjacent commit-set-drift gate, which covers HEAD advancement but not body edits) under the gate-hardening epic (#2405).
