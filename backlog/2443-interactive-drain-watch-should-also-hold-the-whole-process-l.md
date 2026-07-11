---
bornAs: xuxiwge
kind: story
size: 3
parent: "2387"
status: open
dateOpened: "2026-07-11"
tags: []
---

# Interactive /drain watch should also hold the whole-process lease

An interactive `/drain watch` (merge-ai-prs --watch, no --hold-drain-lease) does NOT take the whole-process drain lease (#2391), so a batch push-at-close (#2395) firing afterward sees the lease free and launches a REDUNDANT second detached watch — both sweep the same PRs (numbering lock keeps lands safe, but it wastes work + double-attempts). Decide whether a long-lived interactive watch should hold the lease by default (so a concurrent close no-ops onto it — truly one drain), weighing the behavior change: a second interactive `/drain watch` would then no-op instead of running. Opt-in today (#2395) deliberately left interactive behavior unchanged.
