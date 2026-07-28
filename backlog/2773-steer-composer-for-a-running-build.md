---
bornAs: xgkz08u
kind: story
size: 3
parent: "2551"
status: open
scope: ["plateau:src/backlog-view/", "plateau:vite.config.mts"]
dateOpened: "2026-07-28"
tags: []
---

# Steer composer for a running build

Give the operator a UI to send guidance to a running agent, delivered at the next turn boundary and never dropped. The runner's steer() verb already exists (plateau:src/build-runner/runner.ts); the work is a steer-composer surface under plateau:src/backlog-view/ (sibling to queue-view) and a new POST /api/backlog/build/steer route on the backlog-api plugin (beside the existing /build/stop). Serves G1: steer at the point of work.
