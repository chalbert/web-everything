---
bornAs: xv18rog
kind: story
size: 5
parent: "3383"
status: open
scope: ["we:scripts/lib/delivery-signals.mjs", "we:scripts/lib/__tests__/"]
dateOpened: "2026-10-03"
tags: []
---

# Delivery signals snapshot: one read-only module computing the live signals a strategy decider reads

The decider designed in card 4998 reads live signals, and several exist only scattered or not at all. Build one read-only module, we:scripts/lib/delivery-signals.mjs, with a pure core and a thin IO shell, plus a JSON CLI. Signals: ready-queue depth and age (drain labels, we:scripts/conveyor/queue-store.mjs); main red now, red minutes and red rate over 24 h, and main-CI coverage (from the main-CI card); PR CI duration p50 and p90 and the per-PR failure rate p over a rolling window (gh run list on pull_request events), with flakes split out once the flake-score card lands; Actions queue wait (we:scripts/conveyor/ci-queue-watch.mjs); open-PR file-overlap rate and the hottest shared files (we:scripts/readiness/overlap-chain.mjs); heavy-slot use and waiters (we:scripts/readiness/heavy-admission.mjs, we:scripts/readiness/heavy-queue-projection.mjs); land-serialization wait (we:scripts/readiness/conveyor-instrument.mjs); and, for a given PR, merges since its CI base and how many of them touched its files. Every signal carries its sample size and age, and a missing source reads as unknown, never zero. No policy and no writes: visibility only, useful on its own before any decider exists. Snapshot measured 2026-10-03 for the first test fixture: 85 of 100 main runs cancelled; 5 of 23 open PRs sharing a non-backlog file. Survey: we:reports/2026-10-03-delivery-strategy-survey-and-decider.md. Done when: the CLI prints every signal on the live repo; unit tests cover each pure calculation and the unknown-source case.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
