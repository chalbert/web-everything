---
kind: story
size: 5
status: open
dateOpened: "2026-09-30"
tags: []
---

# Settle preparation before build eligibility and avoid repeated refused dispatch scans

Builder postmortem: 33 refused dispatch reads cost 35.24 minutes; seven preparation-to-build handoffs span 91.63 minutes after last-seen liveness (exposure, not proven idle). Make terminal preparation completion authoritative and invalidate eligibility on events. Evidence and proof are in we:reports/2026-09-30-builder-postmortem.md.

## Evidence and cost

The 2026-09-30 cohort has 33 refused dispatch operations totaling **35.24 minutes** in recorded step timings. Seven preparation-to-build handoffs span **91.63 item-minutes** from last liveness observation to launch; this is exposure, not proven idle. Preparation effects remain in-flight while succeeding build effects report PRs.

Source directory is defined in the report. Preparation run ID: `dispatch-lane-5d4b6d72-bd24-4343-b4f1-ea31c6f7c927`, `effects[0].lastSeenLiveAt`; succeeding build `dispatch-lane-fcc1c84e-5a69-4e53-a177-65e66ee2ba3a`, `effects[0].startedAt`. Worker corroboration: T4331 lines 15–16 in the report source index. The report attachment enumerates all 53 dispatch records, including 33 refusals; no worker tokens are attributed to pre-spawn waits.

## Root cause and change

Terminal preparation is not authoritative in dispatch eligibility; repeated expensive reads fall back to agent-listing and clock inference. Persist completion against its original operation effect, reconcile once, invalidate eligibility on changed inputs, and put the cheap in-flight check before expensive planning. Preserve live-worker protection and uncertain-crash reconciliation. Do not merely shorten timeouts.

## Done when

Extend the existing build-dispatch policy/claim tests and preparation terminal adapter tests: a completed preparation admits the next build immediately; a positively live preparation still holds; duplicate terminal events settle once; unchanged held candidates do not rerun expensive planning. Run the targeted Vitest files through the admitted runner. Live proof: observe a prepare→build handoff with original effect settled and no repeated same-input refusal, recording actual completion and launch times. Compare refused-operation cost to this cohort.
