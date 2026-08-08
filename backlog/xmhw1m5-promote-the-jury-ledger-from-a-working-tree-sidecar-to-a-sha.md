---
kind: story
size: 5
parent: "2572"
status: open
dateOpened: "2026-08-08"
tags: []
---

# Promote the jury ledger from a working-tree sidecar to a shared store

The durable jury log lives at .conveyor/jury/ inside a working tree and is gitignored, so it is host-bound state. Ruling R7 on #2572 had to point the converge daemon at the operator primary checkout via CONVEYOR_JURY_DIR, and no other host can run a shadow pass at all. Promote it to a store any host can read so the ledger stops pinning the daemon to one machine.

## Why this is filed, and what it is NOT

Ruling R7 (#2572, 2026-08-08) scheduled the converge daemon as a **local launchd job**, and named **two**
things pinning it to the operator's Mac:

1. **Auth** — the enforce-era pass spawns the `claude` CLI on the operator's *subscription*, and #2444
   ([#agent-runner-cli-backend](../docs/agent/platform-decisions.md#agent-runner-cli-backend)) settled that
   SDK-on-subscription is broken rather than merely worse. **Not fixable here, and not what this item is about.**
2. **State** — this item. The ledger is a working-tree sidecar, and that is an accident of convenience, not a
   forced constraint.

Fixing (2) alone does not move the daemon off the Mac. It *does* mean the **shadow half** could run anywhere —
including as a scheduled CI job — because a shadow pass spends **no model context at all**: it is `gh` reads plus
a ledger fold. That is the whole prize.

## What is actually host-bound

- [`we:scripts/lib/jury-ledger.mjs:70`](../scripts/lib/jury-ledger.mjs) — `juryLogDir()` resolves
  `<REPO_ROOT>/.conveyor/jury`, anchored to the *script* location, with `CONVEYOR_JURY_DIR` as the only override.
- [`we:.gitignore`](../.gitignore) — `.conveyor/jury/` is gitignored, so it never travels with a clone. A fresh
  checkout has an **empty** ledger.
- The fold is **fail-closed**: no ledger → no roster → keep parked. So an empty ledger does not error, it silently
  reports "keep everything parked" — which looks exactly like a healthy, working daemon and is not.

That last point is why R7 had to wire `CONVEYOR_JURY_DIR` explicitly and why
[`we:scripts/converge-daemon-install.mjs`](../scripts/converge-daemon-install.mjs) refuses to install when the
configured ledger dir is missing. Those are compensations for this defect, and they should be *deleted* by this
item, not kept.

## Scope of the call

The store is the fork; do not pre-empt it here. Candidates worth pricing: a committed-but-append-only location in
the repo (cheapest, but a gitignored operational log became gitignored for reasons worth re-reading first); a
sibling git repo the daemon pulls; SQLite on a shared path; or a real remote store. The **acceptance test** is
the same whichever wins — a converge daemon running from a clone with no local `.conveyor/` produces the same
shadow disposition as one running against the primary checkout.

## Definition of done

- `juryLogDir()` resolves a store that is not a function of which working tree the reader happens to be in.
- The converge daemon needs no `CONVERGE_DAEMON_JURY_DIR` pointing at a *specific human's* checkout, and
  `installBlockers`' ledger check either goes away or checks the shared store instead.
- A shadow pass from a bare clone folds the same verdicts as one from the primary — proven, not asserted.
- Writers (the #2639 convergence loop, `appendJuryEvent`) and readers agree on the store with no env coupling.
