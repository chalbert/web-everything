---
bornAs: xjmwxw5
kind: task
parent: "2418"
status: open
dateOpened: "2026-07-11"
tags: []
---

# Drain fetch/state helper scripts: fetch-parked, wait-green, pr-state

Three deterministic gh wrappers under we:scripts/ that the drain reruns by hand: fetch-parked <nums…> (dump {diff,title,body,files,state,checks} per PR in one call, standardizing the paths reviewers read), wait-green <pr> (poll until required test check is green/timeout), pr-state <nums…> (the one-line mergeable/state/checks view rerun ~6× by hand).
