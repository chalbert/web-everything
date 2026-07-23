---
bornAs: xg1k1u9
kind: story
size: 5
parent: "2636"
status: open
blockedBy: ["2641"]
scope: ["plateau-app:src/"]
dateOpened: "2026-07-23"
tags: []
---

# Juror management page: review and manage jurors from the console

A console surface to review and manage jurors: see the live roster per PR (each juror's lens, method, charter, status, findings, verdict, round), and manage the jury config — the care→jury defaults and per-item overrides the contract holds. Not urgent, and sequenced after the jury ledger exists (the page renders that ledger as its data source). A UI surface, so the implementation is a **cross-locus** item: it lives in `plateau-app` (the console, alongside the existing `/console-board`), with the resolve in WE (#96). Read-first (observe the jury); config editing is a later refinement that must still route contract edits through the human-gated statute path, never a silent write.
