---
bornAs: xtfu40d
kind: story
size: 3
parent: "3029"
status: open
dateOpened: "2026-08-08"
scope:
  - we:scripts/operations/
  - plateau:tools/dev-panel/vite-plugin.ts
  - plateau:tools/drain-daemon/cli.mjs
  - plateau:src/backlog-view/
  - plateau:vite.config.mts
scopeRationale: "Adds the adapter generator to the new operations directory and touches the console review surface, which today lives in the dev-panel plugin and the drain-daemon CLI, not in src/; cross-locus by nature."
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

Today the console's review path is `browser → plateau:tools/dev-panel/vite-plugin.ts →
plateau:tools/drain-daemon/cli.mjs → we:scripts/review-detail.mjs` — the dev server plus two spawned processes
for a single read, with argv building and repo-arg sanitisation hand-written in the middle. The generated adapter collapses that.

**Correction (2026-08-10, while building the WE half).** This paragraph said *"Keep the sanitisation: it exists
because of a real round-trip bug (#2500)"*. That citation is wrong and the instruction is already satisfied:

- **#2500 is not that bug.** It is *"Persist the #2437 review-pipeline ledger…"* (task under #2445, resolved
  2026-07-26) — persisting an in-memory ledger to a panel-reachable artifact. It records no repo-arg
  round-trip defect.
- **The sanitisation is a plain input guard, and it already moved.** `daemonReviewDetailJson`
  (`plateau:tools/dev-panel/vite-plugin.ts`) refuses a repo that does not match `/^[\w.-]+\/[\w.-]+$/` before
  building argv. `we:scripts/operations/review-pr-io.mjs#readPr` carries the **byte-identical regex**, applied
  before its own `gh` call — #3035 moved it when it wrote the io shell. There is nothing for #3036's generator
  to add, and adding it there would be wrong: a repo-format rule is `review-pr`'s knowledge, and the adapter is
  generic over every declaration.
- **One guard did NOT move, and should not.** `daemonReviewLedgerJson` uses a *looser* rule
  (`/^[\w.-]+(?:\/[\w.-]+)?$/` plus a `.`/`..` segment refusal) because the ledger's repo vocabulary admits a
  bare constellation id (`we`, `frontierui`, `plateau-app`). That route reads the `#2437` artifact and is not
  an operation; it is unaffected by this slice.

## Acceptance

An operator can review a parked PR from the console — see the context and net diff, run the panel, read the
findings, and record a verdict — with no route or argv code written per operation. Terminal and console produce
byte-identical outcomes for the same PR, and a run suspended in one can be resumed in the other. `plateau-app`'s
`npm test` and WE's `check:standards` both green.

## Landed — the WE half (impl PR of the couple)

`we:scripts/operations/http-adapter.mjs` — generic over ANY declaration, with no `review-pr` and no
`suggest-next` knowledge in it. `planRoutes(declaration)` derives the route table from the **step kinds**, so
read-only is structural rather than conventional: a `compute`-only declaration gets `GET …/<op>` and
`GET …/<op>/run` and **no other route exists**, and the fn behind that route (`runReadOnly`) takes no store, no
sinks and no judge in its signature. Conversely nothing that can suspend or write is reachable by a safe method.

**"One route per operation" was not achievable and is corrected here.** A declaration that suspends needs four
(describe · start · read record · resume), because a `confirm` stop is by construction two requests. Only a
read-only declaration collapses to one executing route. The card predates the engine's suspend model.

First declared operation: `we:scripts/operations/suggest-next.mjs` (+ its io shell), which wraps
`computeSelection` (`we:scripts/readiness/engine.mjs`) and the two boundary exclusions
`we:scripts/check-readiness.mjs` applies. It re-declares the ranking; it does not re-implement it.

## Still needed — the plateau half (the second PR of the couple)

Nothing in this repo can do it, so it is written down rather than guessed at:

1. **Mount the listener.** `createNodeRequestListener({ resolve, names, store, judge, newRunId, basePath })`
   from `we:scripts/operations/http-adapter.mjs` takes duck-typed `req`/`res` — exactly what
   `plateau:tools/dev-panel/vite-plugin.ts` already receives from Vite's `configureServer` middleware. `resolve`
   and `names` come straight from `we:scripts/operations/run.mjs` (`resolveOperation` / `Object.keys(OPERATIONS)`),
   so the console and the terminal serve the identical operation table.
2. **Share the run store, or the "finish it in the browser" claim is false.** `createFileRunStore()`
   (`we:scripts/operations/run-store.mjs`) resolves `we:.operations/runs/` by SCRIPT location, so a plateau
   process importing it lands on the same sidecar the terminal writes — provided it imports WE's module rather
   than re-deriving the path. If the console runs from a different checkout, set `OPERATION_RUNS_DIR`.
3. **Supply a judge.** `createDefaultJudge()` spawns a real juror. The console must decide whether a browser
   click may spend one, and surface `spend` from the response (the envelope already carries it).
4. **Delete, do not wrap.** `daemonReviewDetailJson` and the `review-detail` hop through
   `plateau:tools/drain-daemon/cli.mjs` are what the mounted route replaces; leaving both is two implementations
   of one read, which is the defect this epic exists to remove.
5. **Point the review surface at `POST …/review-pr/runs`** and render the `confirm` suspend from `pending`
   (`asks`, `of`, `options`), answering with `POST …/runs/<id>/advance` `{ "value": … }`.

## Not in scope

Retiring the dev-panel review surface, or the third review page proposed in
[#2945](/backlog/2945-minimal-local-review-console-a-page-whose-accept-button-clea/) — that item should be
re-read once this lands, since a generated route may well dissolve it.
