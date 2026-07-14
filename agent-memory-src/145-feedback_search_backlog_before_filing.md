---
name: feedback_search_backlog_before_filing
description: Before scaffolding a new backlog card, grep backlog/ for the topic — the standing watch/program pre-files gap cards, so it may already exist
metadata:
  node_type: memory
  type: feedback
  originSessionId: 55d4eef2-164b-43eb-a69a-8aff09c78683
---

Before filing a NEW backlog item, search the existing backlog for the same topic
(`grep -ril "<keywords>" backlog/`) — the standing program/watch runs (review-program,
gap-sweep) **pre-file cards for known gaps**, so the thing you're about to file may already
exist as an open card you didn't write.

**Why:** in one session I filed two cards that each duplicated a watch-pre-filed one hours
earlier: the health/anomaly epic **#2489** duplicated **#2485**, and the evidence view **#2495**
duplicated **#2484** — both had to be reconciled after the fact (resolve the duplicate as
superseded with `--graduated-to=none` + bidirectional pointers). The handoff had even *listed*
one of them as a "recommended next" — which was literally the already-filed card.

**How to apply:** `grep -ril` the feature's keywords in `backlog/` before `backlog.mjs scaffold`;
if a matching OPEN card exists, build under IT (claim it) instead of filing a new one. If you only
notice after landing, reconcile: `backlog.mjs resolve <dup> --graduated-to=none` with a
"Superseded/Delivered by #NNN" note on the dup and a reverse pointer on the survivor. Relates to
[[106. Backlog Is The Tracker]].
