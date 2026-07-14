---
bornAs: xlm5zcg
kind: story
size: 3
parent: "2445"
status: resolved
dateOpened: "2026-07-14"
dateResolved: "2026-07-14"
graduatedTo: none
tags: []
---

# Loop console: health/anomaly detection + alerting — turn the mirror into a smoke detector

> **Superseded by [#2489](/backlog/2489-loop-console-health-anomaly-detection-turn-the-mirror-into-a/)** (2026-07-14).
> Filed hours apart the same day as a near-identical duplicate; #2489 is the epic that decomposes this
> exact scope into value-first slices A–E (its slice list covers every detector below — stall/zero-merge = A,
> considered-never-merged/head-churn = B, rising-failures = C, console band = D, alerting = E), and its
> keystone [#2488](/backlog/2488-loop-console-detectanomalies-core-stall-zero-merge-with-read/)
> (`detectAnomalies`) is already built. Closed for trace rather than deleted — the grounding below is the same
> #477 evidence #2489 rests on.

The operable console (`plateau:tools/dev-panel/drain-daemon.html`, served at the `plateau:/demos/drain-daemon.html` route) shows state, not trouble. Add anomaly detection that scans the daemon journal and raises alerts when the loop is stuck: queue made no progress for N passes while ready-count > 0; a PR considered-but-never-merged across N passes; merge rate 0 while ready work waits; a PR's head SHA churning across passes; rising `failedPasses`. Surface these as an alert band on the console so an unattended loop self-reports. This turns the console from a mirror into a smoke detector.

## Grounding

On 2026-07-13/14 the daemon was DEADLOCKED for 70+ minutes in a batch-landing loop (plateau #477): heads churned, `merged` stayed flat while ready PRs sat. The console looked FINE the whole time — green badges, counters ticking. The stall was only found by CLI log-grepping. The console observed state faithfully but never flagged the trouble, because it has no notion of "this pattern is wrong."

## Detectors (starting set)

- **Queue stall** — no `merged` progress for N consecutive passes despite ready-count > 0.
- **Considered-but-never-merged** — a PR appears as a drain candidate for N passes without landing.
- **Zero merge rate with ready work** — merge rate 0 while ready-count > 0.
- **Head churn** — a PR's head SHA changes across K passes (the #477 signature).
- **Rising failures** — `failedPasses` trending up.

Derive entirely from the existing journal (`plateau:.drain-daemon/history.jsonl` + `plateau:.drain-daemon/state.json`), matching the pure-composer pattern of `buildStatusReport` — no daemon change required. Impl lives in plateau-app; WE holds zero impl (this card is the tracker).

## Out of scope (for now)

The eventual agent-RUNNER cockpit — a live agent board with steer/stop controls and output streams — is future work blocked by the deferred #2444 (agent-runner decision) and #2446 (placement). Do NOT build it here; this item is anomaly detection over the drain journal only.
