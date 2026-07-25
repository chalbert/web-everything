---
bornAs: xx9738m
kind: story
size: 2
parent: "2505"
status: open
relatedTo: ["2550"]
blockedBy: ["2550"]
tags: [plateau-loop, console, webcases, web-docs, viewer, source-registry]
dateOpened: "2026-07-25"
---

# Webcases viewer: durable source registry + add-a-source (carved from #2550)

**Part 1 of the original #2550**, carved out so it rides its own lane. #2550's Part 2 (per-case review-verdict
persistence — the coalesced "Submit review" flush → committed ledger seam) is delivered in plateau-app PR #104.
This item is the remaining half: making the **source registry** itself durable, using the *same* seam.

## Why carved
The two halves share the ratified coalesced-flush-to-committed-file seam but are independent surfaces. Part 2
built the whole write path (`runReviewWriteFlow`, the committed-file pattern, the write verb + endpoint branch,
the localStorage-buffer + Submit UX). This item **reuses that seam** for source registration, so it should land
AFTER #104 (`blockedBy: 2550`) to avoid touching the same files in parallel.

## What already exists (do NOT rebuild)
- Server registry `plateau:src/backlog-view/webcases-resolver.ts`: `REGISTRY` (a compile-time const with two
  entries — `console`, `acme`), `listWebcaseSources()` (→ the `GET /api/webcases` index / datalist), and
  `resolveWebcases(src)`.
- The "load a source" input + datalist and `repoCaseSource(ref)` fetch-by-id in
  `plateau:src/backlog-view/card-taxonomy-docs.ts` — so an *already-registered* source is browsable today; what's
  missing is durable **registration** of a new one.
- The coalesced write seam from #2550 Part 2 (PR #104): the committed-file lane→PR write flow to generalize.

## Scope
- **Durable registration.** A registered source persists across a dev-server restart: a committed registry file
  (e.g. `plateau:src/backlog-view/webcases-sources.json`) holding `{ id, label, load-ref }` entries, written
  through the same coalesced lane→PR seam #104 built (generalize `runReviewWriteFlow` to a shared file-write
  flow, or a sibling `webcase-source` write verb). The resolver `plateau:src/backlog-view/webcases-resolver.ts`
  merges the two built-in entries with the committed file.
- **Add-a-source UI.** Beyond the current fetch-by-id input: an "add a source" form (id · label · load-ref) that
  registers durably via the write seam and shows the new source in the picker on reload.
- **Fold the two hard-coded client sources.** `plateau:src/main.ts` `CASE_SOURCES` declares `CONSOLE_SOURCE` +
  an inline `acme-webdocs`; the server `REGISTRY` declares `console` + `acme` — the same logical sources declared
  twice, inconsistently. Make the server registry the single source of truth; the client derives from it.

## Acceptance
Registering a source through the add-a-source UI persists it (a committed registry file via a lane→PR write) so
it's browsable after reload; the two hard-coded sources become registry entries; the write rides the #2550 Part 2
coalesced seam (not a parallel path); no re-implementation of the shipped viewer/preview/source-read slices.
`plateau-app` `npm test` + `we:` `check:standards` pass; both themes render.
