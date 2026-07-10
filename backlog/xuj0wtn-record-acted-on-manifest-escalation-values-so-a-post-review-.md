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

This fix makes such an edit DETECTABLE (tamper-evident); prevention is out of scope. A pure helper `manifestAuditLine({ dismissedFindings, crossRepo, blockedBy })` in [we:scripts/readiness/lane-manifest.mjs](scripts/readiness/lane-manifest.mjs) returns a stable one-line record of the values the automation ACTED ON. At the drain's escalation/land decision point ([we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) — the `scoreEscalation` call and the #2313 park/skip reason-comment stamp) that line is folded into the DURABLE, timestamped `gh pr comment` (`buildDrainReasonComment`/`postDrainReasonComment`). Because the comment is separate from the body and time-stamped, a later body edit becomes detectable by diffing recorded-vs-live. The recording changes NO land/escalation decision — verdicts and labels are computed first and stay identical; it only records what was acted on. Idempotency is preserved: the dedupe now keys on the audit line too, so an unchanged decision de-dupes while a changed acted-on value posts a fresh, separately-timestamped record (the tamper trail). [we:scripts/lane-drain.mjs](scripts/lane-drain.mjs) has no equivalent escalation/reason-comment sink (it reads the manifest only for merge ordering), so the binding stays in [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) — no new comment channel invented.

Sits alongside #2409 (the adjacent commit-set-drift gate, which covers HEAD advancement but not body edits) under the gate-hardening epic (#2405).
