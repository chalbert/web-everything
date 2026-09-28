---
kind: story
size: 3
tier: pinned
status: active
scaffoldedBy: "unfreeze-builder"
dateScaffolded: "2026-09-28"
scope: ["we:scripts/conveyor/review-status-tag.mjs", "we:scripts/conveyor/build-dispatch-policy.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# review-status-tag: a self-reported-done ci-heal/fix/review session must not read as -stalled

LIVE INCIDENT 2026-09-28: we#2852's ci-heal-2852 session finished (fix-end recorded, completion record status:done, claim released at d4693d4a8) but we:scripts/conveyor/review-status-tag.mjs#deriveReviewStatus still read it as review-status:ci-heal-stalled, because its liveFor() matches purely on the raw claude-agents state (working/blocked) and never consults the selfReportedDone/authExpired/idleFinished enrichment we:scripts/conveyor/reconcile-core.mjs#markSelfReportedDone (et al) already writes onto the SAME agent rows (we:scripts/conveyor/reconcile-pass.mjs#defaultReadAgents already merges them in). we:scripts/conveyor/build-dispatch-policy.mjs then reads that one stale *-stalled label as a GLOBAL landing-freeze (freezeLabels), holding every unrelated queued build. Fix: (1) liveFor() must treat a row with selfReportedDone/authExpired/idleFinished as finished (not live), regardless of state — mirroring we:scripts/conveyor/reconcile-core.mjs#assessLiveness's own isFinished, but deliberately NOT excluding hung (a genuine hang IS the stalled case this label exists to surface). (2) we:scripts/conveyor/build-dispatch-policy.mjs must only let blocked:daemon-bug freeze ALL builds; a per-PR *-stalled label should only hold builds whose scope overlaps THAT PR's files via the existing scope-vs-open-prs rule, never every candidate. Also check whether (1) explains the draft-not-promoted health smell on we#2852/#2851.

## Done when

1. **Executable** — `node we:scripts/readiness/heavy-admission.mjs run -- npx vitest run we:scripts/conveyor/__tests__/review-status-tag.test.mjs we:scripts/conveyor/__tests__/build-dispatch-policy.test.mjs we:scripts/conveyor/__tests__/finished-ci-heal-does-not-freeze-builds.test.mjs` — fails on the pre-fix revision (8 assertions red: `deriveReviewStatus` still returns `ci-heal-stalled`/`review-stalled`/`fix-stalled` for a `selfReportedDone`/`authExpired`/`idleFinished` row, and `planBuildDispatch` still freezes the whole queue on a per-PR `*-stalled` label), passes after. Codex read-only design review ran in the foreground before implementation and confirmed the root cause and both fixes; findings folded in (the `hung` non-exclusion is deliberate, the `freezeLabels` rename is additive-only to avoid breaking `we:skills-src/conveyor/build-dispatch-daemon.mjs`'s dry-run display).
2. Resolved by the PR that lands `we:scripts/conveyor/review-status-tag.mjs` + `we:scripts/conveyor/build-dispatch-policy.mjs` together (both fixes are one incident, one card, per the operator's own "keep the change minimal" ask alongside card #4353's own edit to the same policy file).
