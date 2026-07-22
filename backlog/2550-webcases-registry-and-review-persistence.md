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

## Scoping + open design fork (2026-07-21, before building)
Scoped the shipped code so the builder doesn't re-implement it, and surfaced one design decision that should
be settled with a human before writing part 2 — a naive reading of "persist via lane→PR" floods the PR queue.

**What already exists (do NOT rebuild):**
- Source read-path: server registry `plateau:src/backlog-view/webcases-resolver.ts` (`REGISTRY`,
  `listWebcaseSources`, `resolveWebcases`), served at `GET /api/webcases` (index → the picker datalist) and
  `?src=<id>` (one source); the "load a source" input + datalist and `repoCaseSource(ref)` fetch-by-id in
  `plateau:src/backlog-view/card-taxonomy-docs.ts`. So "browse a registered source" is largely done — the gap
  is making the registry **writable/durable** and folding the two hard-coded client sources
  (`plateau:src/main.ts` `CASE_SOURCES`) into it (the client `acme-webdocs` and server `acme` are the SAME
  source declared twice, inconsistently — collapse them).
- Review model: pure `applyReview` + `WebcasesReviewStore` in `plateau:src/backlog-view/webcases-review.ts`,
  the accept/annotate/mark-drifted/clear verbs + chips + bar wired in
  `plateau:src/backlog-view/card-taxonomy-docs.ts`, and the `/api/webcases/review` endpoint. All **in-memory**
  (lost on dev-server restart, by the shipped phase rule).

**The write machinery (why part 2 is not a small leftover):** the lane→PR write seam
(`plateau:src/backlog-view/write-action.ts` `runWriteFlow`) applies each edit by running
`plateau:scripts/backlog.mjs <verb>` in a lane clone, then opens ONE PR per call. There is no verb that
writes a webcase verdict, and the whole model is backlog-item-frontmatter-scoped in a single repo (WE). A
per-webcase review ledger — possibly in the source's OWN repo — is a new write target + a new verb + a new
in-lane applier + a durable read-back path. This is unbuilt foundation, not plumbing.

**The fork (needs a human ruling):** "a per-case verdict persists via a lane→PR write" taken literally means
**one GitHub PR per accept-click** — a review pass over the console's 37 cases would open ~37 PRs and swamp
the drain. Realistic options:
1. **Coalesced review-session PR** — batch a reviewer's verdicts and open ONE PR per session (the write store
   already has a coalesce-key concept, `num:'config'`/`pendingByNum`). Fewer PRs; needs a "flush" trigger and
   a pending-verdict buffer.
2. **A committed review ledger** written by a single coalesced lane→PR write — verdicts live in one
   JSON/MD ledger; the write updates the ledger, not per-verdict PRs. Cleanest durability; still one PR per
   flush.
3. **Per-verdict PR** as written — simplest to build, floods the queue. Only viable if verdicts are rare.
Recommendation: **option 2** (a coalesced ledger write), with the ledger in the source's repo so a product owns
its own review record. But this trades off against the console philosophy that every write is individually
lane→PR-audited — hence a human call, not a silent default. The same durable-write question governs part 1
(registering a source durably), so settle it once for both. Related: #2588's remaining review-modal work is
gated on the SAME missing "console review/label write path."
