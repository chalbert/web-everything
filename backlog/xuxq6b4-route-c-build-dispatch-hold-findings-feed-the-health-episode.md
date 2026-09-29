---
kind: story
size: 3
status: open
blockedBy: ["4465"]
scope: ["we:scripts/conveyor/build-dispatch-hold-router.mjs", "we:scripts/conveyor/health-watch.mjs", "we:scripts/conveyor/health-file-request.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# Route (c) build-dispatch hold findings feed the health-episode pipeline, not a standalone ledger

#4465's MVP writes route-(c) (unclassifiable) build-dispatch hold findings to a standalone JSON ledger (we:scripts/conveyor/build-dispatch-hold-router.mjs#appendHoldFinding) rather than the health daemon's own smell/episode model (we:scripts/conveyor/health-file-request.mjs), since that model is keyed by (smell,subject) from its OWN tick and does not fit an ad-hoc reason string from an unrelated daemon. Wire it in properly: define a smell for an unclassifiable build-dispatch hold, feed it into the health tick, retire the standalone ledger.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
