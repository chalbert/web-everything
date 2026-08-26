---
bornAs: xq0034b
kind: story
size: 2
parent: "3318"
status: open
dateOpened: "2026-08-26"
tags: []
---

# Verification is mandatory before a lane lands

requireVerified defaults false, so a lane can land without its own suite having run — 18 of 39 confirmed review findings had their input available at COMMIT time, where a suite could have caught them. lane-verify already runs test:unit plus check:standards, sha-keyed, with running-detection for the stall case; this flips the default and handles the break-glass path. Cheapest change in the programme, and it would have caught a red test sitting in the authoring lane.

Do not read this against the parent card's 21 of 39: that is WRITE time — input present the moment the bytes were authored — a different and larger measurement.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
