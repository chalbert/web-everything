---
kind: task
parent: "2822"
status: open
dateOpened: "2026-08-02"
tags: [conveyor, prevention, human-verify, oracle]
---

# Give human-verify an observable code reader so its retirement is enforced both ways

The `human-verify` state has no observable code reader, so its retirement — when a deterministic oracle should take over — is not enforced in either direction: a slice can stay `human-verify` after an oracle exists, or drop it before one does. Give `human-verify` an observable code reader that enforces its retirement both ways.

## Gap

`human-verify` is a lifecycle marker with no code that reads it against the existence of a deterministic acceptance oracle. So the transition is unpoliced in both directions.

## Why it matters

`#deterministic-oracle-clears-slice` says `human-verify` applies **only until** a green acceptance oracle exists. Without an observable reader, two failure modes go uncaught: a slice keeps `human-verify` after its oracle lands (a human is asked to verify what a script now proves), or a slice drops `human-verify` before any oracle exists (nothing verifies it at all). An observable reader makes the retirement a two-way, checkable fact.

## Mechanical fix

Give `human-verify` an **observable code reader** that: (a) flags a slice still marked `human-verify` once its deterministic oracle exists (retire it), and (b) flags a slice that dropped `human-verify` with no oracle in place (premature retirement). Enforced in both directions.

## Provenance

Outstanding **minor** prevention from the human `/review` on **PR #982** (`we:backlog/xzc1sc5-stop-the-line-conveyor-governance-the-orchestrator-never-abs.md`), captured per the prevention-introspection discipline (#2823). Serves `#deterministic-oracle-clears-slice`. Enforcement belongs on the open conveyor-mechanization line (#2840 / #2785); this item does not reopen the resolved decision.
