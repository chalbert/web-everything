---
kind: story
size: 3
parent: "xgm2t3f"
status: open
blockedBy: ["xzbzc7n", "xqpw23c"]
dateOpened: "2026-08-08"
scope:
  - we:scripts/operations/
  - plateau:src/backlog-view/
  - plateau:vite.config.mts
scopeRationale: "Adds the adapter generator to the new operations directory and touches the console review surface; cross-locus by nature."
tags: [plateau-loop, delivery, operations, console, cross-locus]
---

# Generate the HTTP adapter and wire the console review route

Adapter generation for the HTTP caller, and the console consuming it. This is the slice where the epic's claim
stops being theoretical: the console gains the ability to *review*, not just display and accept, without anyone
writing a second implementation of review.

**Cross-locus** — the generator is WE-side, the route and the view are plateau-app-side, so it lands as a two-PR
couple, implementation first.

## Build

- **WE side:** generate an HTTP handler from a declaration — one route per operation, deriving its input
  validation from the declared input schema. No per-operation route code.
- **plateau side:** mount the generated handler and point the console's review surface at it. A run started here
  is the same run record the command-line caller produces, so a review begun in the terminal can be finished in
  the browser and the reverse.

## What it removes

Today the console's review path is `browser → dev-panel route → plateau:tools/drain-daemon/cli.mjs →
we:scripts/review-detail.mjs` — three process hops for a read, with argv building and repo-arg sanitisation
hand-written in the middle. The generated adapter collapses that. **Keep the sanitisation**: it exists because of
a real round-trip bug (#2500), so it moves into the generator rather than being dropped.

## Acceptance

An operator can review a parked PR from the console — see the context and net diff, run the panel, read the
findings, and record a verdict — with no route or argv code written per operation. Terminal and console produce
byte-identical outcomes for the same PR, and a run suspended in one can be resumed in the other. `plateau-app`'s
`npm test` and WE's `check:standards` both green.

## Not in scope

Retiring the dev-panel review surface, or the third review page proposed in
[#2945](/backlog/2945-minimal-local-review-console-a-page-whose-accept-button-clea/) — that item should be
re-read once this lands, since a generated route may well dissolve it.
