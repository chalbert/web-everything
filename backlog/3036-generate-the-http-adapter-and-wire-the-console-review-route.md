---
bornAs: xtfu40d
kind: story
size: 3
parent: "3029"
status: resolved
dateOpened: "2026-08-08"
dateStarted: "2026-08-17"
dateResolved: "2026-08-17"
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
`suggest-next` knowledge in it. `planRoutes(declaration)` derives the route table from the **step kinds**: a
`compute`-only declaration gets `GET …/<op>` and `GET …/<op>/run` and **no other route exists**, and the fn
behind that route (`runReadOnly`) takes no store, no sinks and no judge in its signature. Conversely nothing
that can suspend is reachable by a safe method.

**Correction (2026-08-10, review of the impl PR). "Read-only is structural" was an overclaim and is withdrawn.**
This section, the PR description and three module headers said a `compute`-only declaration is *structurally*
incapable of writing — that `compute` "cannot reach the world". It is false, and there is a working exploit: a
`compute`-only declaration whose step fn closes over `writeFileSync` passes `isReadOnlyOperation`, passes
`assertReadOnlyDeclaration`, is planned a `GET …/run` route, and returns **200 with the file written**. Nothing
in `op()` or either predicate inspects a step fn's body or closure; they read the declared **kind**. Nothing
exploitable ships — `suggest-next`'s two `compute` fns only read — but the guarantee as written was wrong.

What is now claimed, and checked:

- **From the closed vocabulary, for any declaration:** a `compute`-only declaration cannot *suspend* and
  declares no *effects*, so it truly has no run-record, resume or non-GET route, and `runReadOnly` truly gets
  no store, sinks or judge.
- **From a static check, for this repo's own declarations:** the module that *declares* a read-only operation
  reaches nothing that can act — its whole import graph has zero non-relative specifiers. Its step fns hold no
  writer in lexical scope. Same technique as #3032's engine import-graph test, applied to a narrower claim;
  the shared scanner is `we:scripts/operations/__tests__/import-graph.mjs`.
- **The hole, asserted rather than implied:** injected `deps` are not covered. `suggest-next`'s own readers
  (`we:scripts/operations/suggest-next-io.mjs`) reach `node:fs` and, via `we:scripts/lib/open-pr-items.mjs`,
  `node:child_process`. They only read — a promise this repo keeps, not a property anything verifies. The check
  also covers only the operations in `we:scripts/operations/run.mjs`'s table; an ad-hoc declaration is served
  and never seen by it.

The describe route now ships `readOnlyCaveat` alongside `readOnly`, so a consumer mounting this on a public
surface is told in the payload that `readOnly` is derived from declared kinds and is not a write guarantee.

**One field was added when the plateau half landed:** each described route now carries its `kind` (`describe` ·
`start` · `read-run` · `advance` · `read-run-once`). `method`/`path`/`safe`/`summary` describe a route to a
READER; `kind` names it to a CALLER, which is what lets a consumer look a route UP rather than retyping its
path. The console is the first consumer and keys off exactly that — see the plateau half's point 5.

**"One route per operation" was not achievable and is corrected here.** A declaration that suspends needs four
(describe · start · read record · resume), because a `confirm` stop is by construction two requests. Only a
read-only declaration collapses to one executing route. The card predates the engine's suspend model.

First declared operation: `we:scripts/operations/suggest-next.mjs` (+ its io shell), which wraps
`computeSelection` (`we:scripts/readiness/engine.mjs`) and the two boundary exclusions
`we:scripts/check-readiness.mjs` applies. It re-declares the ranking; it does not re-implement it.

## Landed — the plateau half (the second PR of the couple)

`plateau:tools/dev-panel/operations-bridge.mjs` — the MOUNT, and nothing else. It hands WE's
`createNodeRequestListener` its four dependencies and gets out of the way: no route logic, no validation, no
envelope shaping, and no `review-pr` knowledge. Declaring a third operation in
`we:scripts/operations/run.mjs`'s table buys its console surface with no edit to this repo at all. The five
things the card asked for, and what each turned out to be:

1. **The listener is mounted** at `/__dev-panel/operations` on the dev-panel middleware
   (`plateau:tools/dev-panel/vite-plugin.ts`), whose `configureServer` hands over exactly the duck-typed
   `req`/`res` the adapter is written against. `resolve`/`names` come straight from `we:scripts/operations/run.mjs`
   (`resolveOperation` / `Object.keys(OPERATIONS)`), so the console and the terminal serve the identical
   operation table — verified live: the index lists all six declared operations, `review-pr` reports its four
   routes, `suggest-next` is refused a `POST …/runs` by its own derived route table, and a bad `--pr`/`lens`
   comes back as the command line's byte-identical validation message.
2. **The run store is shared** because the bridge IMPORTS WE's module rather than shelling a CLI —
   `createFileRunStore()` resolves by WE's script location, so the console lands on the same
   `we:.operations/runs/` sidecar the terminal writes (asserted live). Which WE checkout is
   `resolveWeRoot()`: the operator PRIMARY, taken from the drain daemon's own `resolveConfig().wePrimary` so
   "where is WE" keeps ONE derivation in the repo. `DEV_PANEL_WE_ROOT` overrides it; `OPERATION_RUNS_DIR`
   overrides the sidecar alone. Deliberately NOT the daemon's `weClone` — a headless drain worktree nobody
   runs `we:scripts/operations/run.mjs` from would split the sidecar in two and make the resume claim false.
3. **The judge is byte-identical to `we:scripts/operations/run.mjs`'s**, `cwd` included: `createDefaultJudge({ cwd:
   process.env.JUDGE_LANE_CWD || null })`, and the suite pins it (a mutation to `process.cwd()` reddens).
   Unset ⇒ `assertLaneCwd` refuses the spawn and the console shows WE's own refusal, which is the correct
   outcome of a browser click with no lane behind it — a console must not hand a tool-bearing juror the dev
   server's working tree. The cost is surfaced from `spend.costUsd` and `spend.jurors` — `spend` is
   `totalJudgeSpend`'s OBJECT, not a scalar, and reading it as a number prints `$0.00` on every run — and the
   one click that costs money is its own explicit **Run the review** button rather than a side effect of
   expanding a row.
4. **Deleted, not wrapped.** `daemonReviewDetailJson`, its `/__dev-panel/drain-daemon/review-detail` route,
   `plateau:tools/drain-daemon/cli.mjs`'s `review-detail` command and its
   `buildReviewDetailArgs` are all gone, with their tests. `daemonReviewLedgerJson`
   is untouched, exactly as this card said it should be — it reads the #2437 artifact and is not an operation.
5. **The review surface points at the operation.** `plateau:tools/dev-panel/drain-daemon.html` renders the
   context from the run's own `findings.read`, the findings and verdict from its `verdict`, and the buttons
   from `pending.options` — answering the `advance` route with `{ "value": … }`. Accept is disabled when
   `pending.of === 'human'` (INVARIANT 2 as UX; `decideSetLabel` is still the guarantee). Started run ids are
   remembered per PR so re-expanding RE-READS rather than paying for a second run, and a run started in the
   terminal is finished here by pasting its id into the resume box (refused, with the mismatch named, if that
   run is a review of a different PR than the row it was pasted into).

   **And it retypes NO route.** The console resolves its start / read / resume URLs by looking each one up by
   route **`kind`** in the operation's own describe payload. That took a one-word WE change —
   `describeOperation` now carries `kind` alongside `method`/`path`/`safe`/`summary` — and it is the
   difference between a caller that is generated and a caller that merely calls something generated: without
   it the console hand-writes three per-operation route shapes in a file whose whole claim is that it has
   none, free to drift into silent 404s the moment `planRoutes` renames a segment. It now fails loudly, by
   name, instead.

**What importing rather than shelling actually costs, and the two things it changed that are not free.**
Two adversarial review rounds are folded into the section above; three of their findings are not fixes but
consequences worth carrying:

1. **The dev server's thread now runs the operation.** WE's io shells are synchronous (`review-pr`'s `read`
   step runs `gh pr view` plus a `git fetch` and three more `git` calls through `execFileSync`), so a **Run the
   review** click blocks the dev server for as long as they take — routinely 5–20s, during which nothing loads
   and HMR does not fire. The deleted `review-detail` route never did this, because it spawned a child with
   ASYNC `execFile`. That is the price of the shared run store, and for an operator-initiated review it is
   worth paying — but it is disclosed in the bridge's header rather than left to be discovered, and the same
   property makes the ungated safe-method routes a liveness risk rather than the harmless recompute they first
   looked like. Filed as its own item under this epic rather than half-done here.
2. **The console's quick-verdict gate lost a state.** The old Accept / Request-changes controls read a review
   class fetched LIVE at expand time and had a third outcome — `none`, not parked for review, which rendered no
   buttons. They now read `humanRequired` off the `parkedNow` snapshot, which a no-op drain pass carries forward
   unchanged. INVARIANT 2 is intact (and re-enforced live at write time by `we:scripts/review-set-label.mjs`);
   what is weaker is the staleness of the UI narrowing, in exactly the way the row's own badge is already stale.
3. **A remembered run can outlive the tree it judged.** The console remembers a started run per PR so
   re-expanding re-reads instead of paying for a second one — but if the lane pushes a fix and the daemon
   re-parks the PR, that re-read renders the OLD juror's findings with a live Accept, and nothing on the page
   can tell (the identity check compares which PR, never which commit, and the console never fetches the live
   head). Two things bound it, neither of them the console: the reviewed commit is stated in the basis row AND
   in the record-verdict confirm, so the operator sees what they are vouching for; and #2409's reviewed-commit
   gate in `we:scripts/merge-ai-prs.mjs` reads the accepted SHA back against the live head and refuses to merge
   a stale acceptance. A stale accept from here costs a comment and a label swap, not a bad merge.
4. **The couple lands impl-first, so there is a skew window.** The console's route lookup needs the `kind` field
   this item added to `describeOperation`, and `resolveWeRoot()` points at the operator's PRIMARY checkout — not
   at a lane. Between the plateau merge and the WE merge (or simply before the operator pulls), the review panel
   names the skew and says what to do rather than reporting a missing route that plainly exists. Verified live
   against a checkout that predates the field.

**One thing the card implied and this half did NOT do: the direct verdict endpoint stays.**
`daemonReviewSetLabel` (`POST /__dev-panel/drain-daemon/review-set-label`) and the console's quick
Accept / Request-changes controls are kept. They are not a second implementation of the operation — the
operation READS and JUDGES (one paid juror) before it can reach `confirm`, and these record a verdict the
operator already reached elsewhere, for free. Both end at the one home, `we:scripts/review-set-label.mjs`, so
there is a single writer either way. Their INVARIANT-2 gate no longer needs `review-detail`: it reads
`humanRequired` off the parked entry the status poll already carries.

**Also in this half, both small and both load-bearing.** A mutating request on the operation surface (anything
but `GET`/`HEAD`, unknown verbs included — fail-closed) clears the SAME `rejectCrossSiteControl` guard as
`control` and `review-set-label`, because a `POST` here can spend a juror and comment on a real PR. And the WE
import is LAZY: a missing or broken checkout degrades to a 503 naming the path and the fix, never a dev-server
boot crash, and the failure is not cached.

## Not in scope

Retiring the dev-panel review surface, or the third review page proposed in
[#2945](/backlog/2945-minimal-local-review-console-a-page-whose-accept-button-clea/) — that item should be
re-read once this lands, since a generated route may well dissolve it.
