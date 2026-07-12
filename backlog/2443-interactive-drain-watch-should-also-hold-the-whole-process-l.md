---
bornAs: xuxiwge
kind: story
size: 3
parent: "2387"
status: resolved
dateOpened: "2026-07-11"
dateStarted: "2026-07-12"
dateResolved: "2026-07-12"
tags: []
---

# Interactive /drain watch should also hold the whole-process lease

An interactive `/drain watch` (merge-ai-prs --watch, no --hold-drain-lease) does NOT take the whole-process drain lease (#2391), so a batch push-at-close (#2395) firing afterward sees the lease free and launches a REDUNDANT second detached watch — both sweep the same PRs (numbering lock keeps lands safe, but it wastes work + double-attempts). Decide whether a long-lived interactive watch should hold the lease by default (so a concurrent close no-ops onto it — truly one drain), weighing the behavior change: a second interactive `/drain watch` would then no-op instead of running. Opt-in today (#2395) deliberately left interactive behavior unchanged.

## Resolution (2026-07-12, ratified + delivered by #2449)

Decided **yes — hold by default**: the whole-process lease is now ALWAYS-ON for every full/label
sweep AND watch in [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) (`decideDrainLeaseGate`),
so an interactive `/drain watch` holds the lease and a push-at-close (or a second interactive drain)
no-ops onto it — truly one drain. The weighed behavior change is accepted and documented in the
drain SKILL: a second interactive full drain no-ops exit 0 surfacing the holder (`--only` fast
drains and `--dry-run` bypass; `--no-drain-lease` is the escape hatch). Context: the #2449 resident
daemon is now the standing lease holder, which is exactly the "concurrent close no-ops onto it"
end-state this item asked to weigh.
