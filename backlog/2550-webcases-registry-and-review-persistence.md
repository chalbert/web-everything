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
Any registered repo/product's webcases are browsable through the viewer; per-case verdicts persist across
reload via a **coalesced "Submit review" flush** — one lane→PR writes all pending verdicts to a committed
ledger (central plateau-app file for v1, per the ruling below), and a reload rehydrates them from that ledger;
pending-but-unsubmitted verdicts survive a reload via the local buffer and show an "N unsaved" indicator; no
per-verdict PR, and no re-implementation of the shipped viewer/preview/source slices.

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

**The fork (was a human ruling; RULED 2026-07-22 — see below):** "a per-case verdict persists via a lane→PR
write" taken literally means **one GitHub PR per accept-click** — a review pass over the console's 37 cases
would open ~37 PRs and swamp the drain. The options weighed were: (1) coalesced review-session PR; (2) a
committed review ledger written by a single coalesced write; (3) per-verdict PR (floods the queue). The same
durable-write question governs part 1 (registering a source) and #2588's remaining review modal.

## RULED (2026-07-22) — coalesced flush to a committed ledger
Console durable artifacts (review verdicts, and source registrations) persist via a **coalesced per-session
flush**, NOT a write per action: a reviewer marks many verdicts (held **pending**, shown optimistically), then
one explicit **"Submit review (N)"** action opens **ONE lane→PR** that writes all pending verdicts to a
**committed ledger**. This is options 1 + 2 combined (option 1 = *when* to write, option 2 = *where*); option 3
(per-verdict PR) is rejected.

Why: it mirrors GitHub's own review model (mark lines as *pending* → **Submit review** posts them at once), so
reviewers already hold the mental model; a verdict is durable, auditable **governance** (serves G5 reviewable /
G6 any-repo), so it stays lane→PR-audited rather than moving to a lighter side-store (which would undercut the
console's "every durable write is lane→PR" thesis); and one PR per session ("reviewed 12 cases: 9 accepted, 3
flagged") is cleaner history than dozens of noisy ones while keeping the heavy seam rare.

**Build shape:**
- **Ledger location — CENTRAL in plateau-app for v1:** one file (e.g. `plateau:src/backlog-view/webcases-reviews.json`)
  keyed by `source::block::case`. Move to a **per-source ledger in each source's own repo** (a product owning
  its conformance record — the long-term model) as a follow-up when a second real source lands; the write port
  already resolves a repo per write, so the migration is localized.
- **Client:** pending verdicts buffered in `localStorage` (crash safety) with an **"N unsaved" indicator**;
  auto-flush on navigate-away; the in-memory `WebcasesReviewStore` stays as the fast optimistic session cache.
- **Read-back:** on load, hydrate standing verdicts from the **committed ledger** (the durable truth), then
  overlay any still-pending local buffer.
- **The write:** one new coalesced write verb whose lane→PR applier rewrites the ledger file in-lane (coalesce
  key like the existing `num:'config'`/`pendingByNum`), reusing `runWriteFlow`.
- **Part 1 (source registry):** registering a source rides the **same** coalesced-flush-to-committed-ledger
  seam (a registry file entry), and the two hard-coded client sources fold into it. **#2588's** review modal
  uses the same write path — settle-once, three consumers.
