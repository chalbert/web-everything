---
bornAs: xo1r3ne
kind: task
parent: "2445"
status: open
blockedBy: ["2448"]
dateOpened: "2026-07-13"
tags: []
---

# Register the resident drain daemon's own source in the trust chain

Follow-through on #2448's self-hosting design. #2448 made the coordinator self-hosting boundary a mechanism: the coordinator's own gate-critical files, once registered in TRUST_CHAIN (we:scripts/lib/gate-config.mjs), force review:human so the coordinator can never be the sole reviewer-and-lander of a change to itself. Basename matching already covers the daemon IF it hosts the merge logic under the existing filenames (we:scripts/lib/review-escalation.mjs, we:scripts/merge-ai-prs.mjs). But #2449 shipped the phase-1 daemon in plateau-app; if it copies the drain/review logic into new-named files, those are trust-chain-critical yet unregistered. Audit the shipped daemon's actual files and add each gate-deciding one to TRUST_CHAIN, with a regression test.
