---
kind: story
size: 3
parent: "2405"
status: resolved
dateOpened: "2026-07-10"
dateStarted: "2026-07-10"
dateResolved: "2026-07-10"
graduatedTo: none
tags: [gate, review, drain, gate-self]
---

# Persist a reviewed manifest baseline and diff a landed PR against it (catch a full strip OR an edit-down)

Follow-up to 2415 / PR #375, which records the acted-on manifest escalation values into a durable, timestamped `gh pr comment` at the park/skip/land decision points so a post-review PR-body edit is tamper-evident. That fix closes the **edit-a-value-DOWN** variant on the land path — but only for a manifest-carrying PR. It does NOT close a full manifest **STRIP**: the land stamp fires under `c.hasManifest` in [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs), so deleting the entire `<!-- lane-manifest -->` block from the body flips `hasManifest` false, `scoreEscalation` sees nothing, the PR degrades to "no-manifest → always ready", it merges, and NO land record is written — byte-identical to an orphan PR. A strip is a stealthier suppression than the modeled edit-down. The one case the strip IS caught today: if the PR was parked during review (`review:pending`), the park comment already snapshotted the manifest values, so a later recorded-vs-live diff flags the now-missing manifest. An un-parked strip-and-merge is NOT covered.

Fully closing this needs a persisted REVIEWED BASELINE of the manifest to diff a landed PR against — a bigger design change than 2415's snapshot-at-action approach, hence a separate item. Proposal: at review time, persist the manifest values seen by the reviewer (`dismissedFindings`/`crossRepo`/`blockedBy`, plus a "manifest present" bit) into the DURABLE review/park record — the same channel 2415 already writes, or the review-escalation state. Then at land, diff the PR's LIVE manifest against that baseline BEFORE `mergePr`. A mismatch — whether an escalation value was edited down OR the whole manifest was stripped so `hasManifest` flipped — refuses the auto-land and re-parks for a fresh look. Because the baseline is captured at review and the check runs at land regardless of whether the PR re-parked, this catches the strip and the edit-down uniformly, without depending on a prior park having fired in the drain window.

This upgrades 2415's best-effort tamper-EVIDENCE (a trail an honest observer diffs) toward tamper-EVIDENCE-that-gates (a deterministic land refusal), for the manifest specifically. It does not claim to defeat an actor who edits AND deletes the persisted baseline together — that residual matches the sibling gates.

Sits alongside PR #375 / 2415 (the value-record it extends) and #2409 (the adjacent commit-set-drift gate — covers HEAD advancement, not body edits) under the gate-hardening epic (#2405).

## Progress

- **Status:** done (pending PR land)
- **Branch:** `lane/2414-reviewed-manifest-baseline`
- **Done:**
  - New pure module [we:scripts/lib/review-baseline-state.mjs](../scripts/lib/review-baseline-state.mjs) — captures the escalation-sensitive manifest values (`hasManifest`/`dismissedFindings`/`crossRepo`/`blockedBy`) the drain FIRST saw (first-seen-wins), and `diffBaseline` flags only the escalation-WEAKENING direction (edit-down OR strip). Mirrors `we:scripts/lib/review-park-state.mjs` (tolerant parse, `_doc` header, safe-to-lose local cache → fails open).
  - Wired into [we:scripts/merge-ai-prs.mjs](../scripts/merge-ai-prs.mjs): loads/persists a `we:.claude/skills/drain/review-baseline-state.json` cache next to the park-state; in the escalation loop captures each candidate's baseline on first sight and re-parks (HUMAN-required, durable comment) any landing PR whose LIVE manifest was weakened — catching the STRIP and the edit-DOWN uniformly, without depending on a prior park. Updated the land-path residual NOTE (the strip gap it flagged is now closed here).
  - 25 unit tests in [we:scripts/lib/__tests__/review-baseline-state.test.mjs](../scripts/lib/__tests__/review-baseline-state.test.mjs). Full suite + `check:standards` green (0 errors).
- **Next:** land via PR.
