---
bornAs: x13aeqe
shortTitle: "Webcases viewer + review persistence"
kind: story
size: 3
parent: "2505"
status: open
blockedBy: ["2532"]
tags: [plateau-loop, console, webcases, web-docs, viewer]
dateOpened: "2026-07-18"
---

# Webcases viewer: source registry + per-case review persistence

The `/console-cases` web-docs viewer shipped (plateau-app #62–#67: source-agnostic picker, live editable
preview, preview-runtime injection, git/registry source, per-case review affordances) — those slices are
**done in code, do NOT re-file**. This story is the remaining plumbing: a durable **source registry** surface
(register/browse any product's webcases, not just the two hard-coded sources) and **persistence of per-case
review verdicts** (accept / annotate / mark-drifted) via the lane→PR write seam so a review survives reload.
Serves G5 (reviewable) and G6 (any repo's cases). Builds on [#2532] (sandbox hardening).

## Scope
- A source registry (id · label · async load) with an "add a source" input; the two current sources become
  registry entries.
- Review verdicts persisted through the write seam, not just in-memory; a reviewed case shows its verdict on
  reload.

## Acceptance
Any registered repo/product's webcases are browsable through the viewer; a per-case verdict persists across
reload via a lane→PR write; no re-implementation of the shipped viewer/preview/source slices.
