---
kind: decision
parent: "3383"
status: open
scope: ["we:backlog/"]
dateOpened: "2026-09-13"
tags: []
---

# Define graduation criteria for a model/provider to exit probation status

The probation mechanism built under epic we:#3383 (plus #3649's recording system) has no defined threshold for graduating a model/provider out of probation. #3649's ratified Fork 4 explicitly left no numeric par band in v1. The probation principle recorded in PR #2182 (we:backlog/, commit 47a4da632) only says promotion is an explicit decision based on accumulated data, without specifying what data, how much, or what bar it must clear. Open questions to prepare: (1) volume -- fixed minimum trial count vs. requiring both successes and at least one informative failure/edge case; (2) what gets measured -- success/failure rate (review-accepted vs changes-requested), calibration accuracy (Codex's own found tendency to under-rate severity), cost/efficiency, or a combination; (3) per-role vs global -- advisory reviewer vs delivery builder vs eventual blocking/gating reviewer may need different bars; (4) per-provider/risk-class vs uniform criteria. Existing evidence to cite, not pre-decide: Codex has 3 real delivery trials so far (100% review-accepted) and a known unresolved calibration gap under-rating bug severity vs Claude in the one case tested in depth. Filed as an open decision only -- needs /prepare then /decision to ratify; not built here.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
