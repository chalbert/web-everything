---
kind: story
size: 3
parent: "2405"
status: active
dateOpened: "2026-07-10"
tags: [gate, review, drain, gate-self]
---

# Persist a reviewed manifest baseline and diff a landed PR against it (catch a full strip OR an edit-down)

Follow-up to xuj0wtn / PR #375, which records the acted-on manifest escalation values into a durable, timestamped `gh pr comment` at the park/skip/land decision points so a post-review PR-body edit is tamper-evident. That fix closes the **edit-a-value-DOWN** variant on the land path — but only for a manifest-carrying PR. It does NOT close a full manifest **STRIP**: the land stamp fires under `c.hasManifest` in [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs), so deleting the entire `<!-- lane-manifest -->` block from the body flips `hasManifest` false, `scoreEscalation` sees nothing, the PR degrades to "no-manifest → always ready", it merges, and NO land record is written — byte-identical to an orphan PR. A strip is a stealthier suppression than the modeled edit-down. The one case the strip IS caught today: if the PR was parked during review (`review:pending`), the park comment already snapshotted the manifest values, so a later recorded-vs-live diff flags the now-missing manifest. An un-parked strip-and-merge is NOT covered.

Fully closing this needs a persisted REVIEWED BASELINE of the manifest to diff a landed PR against — a bigger design change than xuj0wtn's snapshot-at-action approach, hence a separate item. Proposal: at review time, persist the manifest values seen by the reviewer (`dismissedFindings`/`crossRepo`/`blockedBy`, plus a "manifest present" bit) into the DURABLE review/park record — the same channel xuj0wtn already writes, or the review-escalation state. Then at land, diff the PR's LIVE manifest against that baseline BEFORE `mergePr`. A mismatch — whether an escalation value was edited down OR the whole manifest was stripped so `hasManifest` flipped — refuses the auto-land and re-parks for a fresh look. Because the baseline is captured at review and the check runs at land regardless of whether the PR re-parked, this catches the strip and the edit-down uniformly, without depending on a prior park having fired in the drain window.

This upgrades xuj0wtn's best-effort tamper-EVIDENCE (a trail an honest observer diffs) toward tamper-EVIDENCE-that-gates (a deterministic land refusal), for the manifest specifically. It does not claim to defeat an actor who edits AND deletes the persisted baseline together — that residual matches the sibling gates.

Sits alongside PR #375 / xuj0wtn (the value-record it extends) and #2409 (the adjacent commit-set-drift gate — covers HEAD advancement, not body edits) under the gate-hardening epic (#2405).
