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

This fix is BEST-EFFORT / PARTIAL tamper-evidence, NOT prevention and NOT a hard guarantee. It raises the bar and leaves a trail; it does not stop an edit. A pure helper `manifestAuditLine({ dismissedFindings, crossRepo, blockedBy })` in [we:scripts/readiness/lane-manifest.mjs](scripts/readiness/lane-manifest.mjs) returns a stable one-line record of the values the automation ACTED ON. At every decision point in [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) — park, skip, AND land (the `land` reason-comment fires on a manifest PR just BEFORE `mergePr`) — that line is folded into a DURABLE, timestamped `gh pr comment` (`buildDrainReasonComment`/`postDrainReasonComment`). Recording on the LAND path matters for the **edit-a-value-DOWN** variant: the attack succeeds by editing `dismissedFindings` DOWN so the PR still merges — the park/skip paths never fire in that state, so without the land record a landed tampered PR would carry no trace. The recording changes NO land/escalation decision — verdicts and labels are computed first and stay identical; it only records what was acted on. Idempotency is preserved: the dedupe keys on the audit line too, so an unchanged decision de-dupes while a changed acted-on value posts a fresh, separately-timestamped record (the tamper trail).

**Scope of the land record — the edit-DOWN variant, NOT a full strip.** The land stamp fires only under `c.hasManifest`. So it covers an attacker editing an escalation VALUE down inside an otherwise-intact manifest. It does NOT cover a full manifest **strip** — deleting the whole `<!-- lane-manifest -->` block from the body flips `hasManifest` false, the PR degrades to "no-manifest → always ready", it merges, and NO land record is written (byte-identical to an orphan PR). A strip is a stealthier suppression than the modeled edit-down, and it is a RESIDUAL here — do not read the land record as "a landed PR always carries a record". The one case a strip IS still caught: if the PR was parked during review (`review:pending`), that park comment already recorded the manifest values, so a later recorded-vs-live diff flags the now-missing manifest. An un-parked strip-and-merge is NOT covered. Fully closing the strip needs a persisted REVIEWED BASELINE to diff a landed PR against — a bigger design change, out of scope for this size-2 story; tracked as a follow-up under #2405 alongside #2409.

Honest limitations (this does NOT claim more than it delivers):
- **The evidence is itself deletable.** The record is a PR comment, editable/deletable by the same write-access actor who edits the body. So it is NOT durable against that actor removing the comment — it is a trail an honest observer can diff, not tamper-PROOF storage.
- **It records the drain-time value, not a reviewed baseline.** An edit made inside the review→drain window is only caught if a PRIOR park already recorded the higher value; a first-and-only drain pass records whatever the (possibly already-tampered) body says. This is a snapshot at the moment of action, not a diff against a signed review baseline.
- **The edit-DOWN land gap is closed; a full manifest STRIP is not.** A landed PR whose manifest was edited-down carries a land record. But deleting the entire manifest block (`hasManifest` false) writes no land record at all unless a prior review-park already snapshotted the values. And even for the edit-down case, a determined write-access actor can edit AND delete the record together.

[we:scripts/lane-drain.mjs](scripts/lane-drain.mjs) has no equivalent escalation/reason-comment sink (it reads the manifest only for merge ordering), so the binding stays in [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) — no new comment channel invented.

Sits alongside #2409 (the adjacent commit-set-drift gate, which covers HEAD advancement but not body edits) under the gate-hardening epic (#2405).
