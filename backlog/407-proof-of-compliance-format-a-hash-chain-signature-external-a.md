---
kind: story
size: 5
parent: "093"
status: resolved
blockedBy: ["406"]
dateOpened: "2026-06-12"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: webpolicy/proof.ts
tags: []
---

# Proof-of-compliance format — A* hash-chain + signature + external anchoring, OSCAL-aligned

Fork 2 of the #093 ruling (A*): the proof-of-compliance format. Each proof record (rule, inputs, verdict, actor, time) is an OPA-style decision-log entry anchored to a webtraces span; records are SHA-256 hash-chained (append-only) and signed; the bundle is OSCAL-aligned (machine-readable, auditor-acceptable). A* raised baseline: include lightweight EXTERNAL anchoring (periodic Merkle-root checkpoint to a running transparency log, e.g. Sigstore Rekor) so proofs are third-party verifiable — the credibility floor for the finance/healthcare/GDPR market. Full per-record inclusion proofs / blockchain are an opt-in strength dial. Blocked on #406 (needs the rule-manager emitting verdicts to record).
