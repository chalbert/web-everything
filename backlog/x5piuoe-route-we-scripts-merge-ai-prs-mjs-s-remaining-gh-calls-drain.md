---
kind: story
size: 8
status: open
blockedBy: ["3174"]
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/lib/forge-land-provider.mjs"]
dateOpened: "2026-09-07"
tags: []
---

# Route we:scripts/merge-ai-prs.mjs's remaining gh calls (drain arc, beyond the review-label fix) through named ports

Per #3174 (ratified 2026-09-07): `we:scripts/merge-ai-prs.mjs` alone holds roughly 20 raw `execFileSync('gh', …)` calls, and the review-label-arc subset of those is filed separately as the first, highest-priority spin-off (the drift fix — blocks nothing here, but land it first so both items don't touch the same lines concurrently). What remains after that fix is the DRAIN arc proper: PR-view reads for merge candidacy/state (comments, headRefOid, mergedAt, files), CI-lifecycle label ensure/edit (checking/ci:failed/blocked), and PR body reconciliation/merge writes. Per Fork 1=(c): the MUTATING calls (label ensure/edit, body edit, merge) stay inside `we:scripts/merge-ai-prs.mjs`'s own home behind an arc-fitted port (a new `we:scripts/lib/forge-drain-provider.mjs`, or composing `we:scripts/lib/forge-land-provider.mjs`'s shapes where the operation is genuinely the same one `we:scripts/pr-land.mjs` already needs — a call this item's implementer should make once that port exists) — never importable by another script. The READ-ONLY calls migrate onto the shared `we:scripts/lib/forge-reader.mjs` Fork 1 names for the read arc (filed separately), reusing `PR_STATE_FIELDS` rather than a second field list. Per Fork 2=(b): each port is fitted to its actual caller, never a repo-wide neutral `ForgeProvider`. Done-when: every bare `gh` invocation remaining in `we:scripts/merge-ai-prs.mjs` (outside the already-fixed review-label sites) sits behind a named port; argv asserted byte-identical to prior behavior, per the discipline `we:scripts/lib/__tests__/review-label-provider.test.mjs:19` already applies; `we:scripts/merge-ai-prs.mjs`'s existing tests pass unmodified in behavior. No second forge provider is stood up or tested.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
