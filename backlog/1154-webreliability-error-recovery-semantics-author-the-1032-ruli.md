---
type: issue
workItem: story
size: 3
parent: "1019"
status: open
dateOpened: "2026-06-19"
tags: []
---

# webreliability error-recovery semantics — author the #1032 ruling into the contract + protocol

Author the ratified error-recovery semantics layer (decision #1032) into the WE contract. Add to we:reliability/contract.ts + the error-recovery protocol entry (we:src/_data/protocols.json): (1) the normalized failure-disposition enum `transient`/`terminal`/`deferred`, and (2) a recovery-phase discriminator as an open meta-schema (core `retrying`/`queued`/`awaiting-manual`; `circuit-open` + future `rate-limited` as registered extensions, NOT core). Then update we:src/_includes/project-webreliability.njk — reconcile the 'Error classification' row (now a normalized disposition output), resolve its open question #3 (recovery-phase surfacing), and document the composite-handler rule (single-dispatch preserved; cooperation = author-ordered composite, not protocol orchestration). Invariants unchanged: backoff math stays in handlers (opaque `delay` only); runtime handlers are FUI (#1052).
