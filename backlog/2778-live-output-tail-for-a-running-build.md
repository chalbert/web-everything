---
bornAs: xxw8hy0
kind: story
size: 5
parent: "2551"
status: open
scope: ["plateau:src/build-runner/", "plateau:vite.config.mts", "plateau:src/backlog-view/"]
dateOpened: "2026-07-28"
tags: []
---

# Live output tail for a running build

Stream the agent reasoning, tool-calls and validation output live and render the plan-todo checklist (done/running/pending glyphs) updating as it runs. runner.observe() already emits the typed event stream (plateau:src/build-runner/events.ts) but it is not exposed over HTTP and nothing renders it: add an SSE or chunked endpoint off observe() on the backlog-api plugin and a tail view under plateau:src/backlog-view/, making the fixtured plan-todo glyphs in plateau:src/backlog-view/lane-board.ts live.

## Design

**What exists, verified on the plateau-app tree (2026-08-21).**

- `AgentRunner.observe()` — `plateau:src/build-runner/runner.ts:185`. An `AsyncIterable<RunnerEvent>`, safe
  for a late consumer (it returns an already-done iterable once `#closed`), and it removes its listener on
  `return()`. So an HTTP handler that abandons the iteration will not leak.
- `RunnerEvent` — `plateau:src/build-runner/events.ts:16-23`. Seven variants: `init`, `text`, `tool`,
  `result`, `quota-stall`, `error`, `exit`.
- **`observe()` already has exactly one consumer, and it is not a spare.** `runBuildFlow` drives it in a
  `for await` at `plateau:src/build-runner/build-action.ts:273-277`, and that loop is what drives the run to
  completion. A second consumer is legitimate — the listener set is a `Set` and each `observe()` call
  registers its own — but **do not reroute the existing loop through the new endpoint**; it owns
  `sawErrorResult` / `exitCode`.
- The seam for a live push already exists: `deps.onEvent?.(e)` (`:274`) is called for every event before the
  flow's own handling. That is the intended hook, not a new tee.
- The read surfaces to sit beside: `GET /api/backlog/build` and `GET /api/backlog/build/:runId` in the
  `backlog-api` plugin (`plateau:vite.config.mts:669-678`), both answered before repo resolution because they
  read the single WIP=1 build slot. A tail endpoint belongs in that same `isBuild` block.
- `BuildRun` (`plateau:src/build-runner/build-action.ts:59-62`, extending `BuildRunDTO` at `:42-57`) is the
  per-run **record**: it carries a single `note` string — the row's ⟳ cell — and **no event history**.
  `BuildRunStore` (`:69-108`) is the map/registry that holds many such records and enforces the WIP=1 slot.
  The event buffer belongs on the record, keyed per run; the store just owns the map.

**Two gaps the digest's "this is wiring" framing understates. Both are real work.**

1. **There is no plan-todo event.** `RunnerEvent` has no todo/plan variant, and the demuxer throws the payload
   away: `fromAssistant` (`plateau:src/build-runner/events.ts:45-57`) emits `{ type: 'tool', name, id }` and
   **drops `block.input`**. The agent's plan arrives as a `TodoWrite`-shaped `tool_use` whose `input` is the
   checklist. So making the glyphs live requires a new `RunnerEvent` variant carrying the parsed todo list,
   emitted from that function — not just a transport.
2. **The card's glyph vocabulary does not exist yet either.** `SubStep`
   (`plateau:src/backlog-view/lane-board.ts:210-213`) is `{ label, done? }` — **two** states, not the three
   (done / running / pending) this item asks for. The fixture that renders them is the demo card at
   `plateau:src/backlog-view/lane-board.ts:725`. Adding the running state is a type change plus a render
   change plus the CSS, and it must stay additive: `subSteps` is documented as omitted-or-empty on every card
   that has none and ignored outside the `build` bucket.

**Replay is required, not optional.** The console poller can attach *after* a build starts (the `GET
/api/backlog/build` endpoint exists precisely so a page reload mid-build restores the row). A tail that only
streams events arriving after connect shows a blank pane on every reload. So the run record needs a bounded
per-run event buffer — appended from the existing `onEvent` hook — that the endpoint flushes before switching
to live push. An unbounded buffer in a long-lived dev server is a leak.

**Size the bound against a measurement, do not pick a round number.** The liveness backstop is
`MAX_BUILD_MS = 30 * 60_000` (`plateau:src/build-runner/build-action.ts:146`), so a worst-case run is a
**30-minute** event stream. Before choosing the cap, count the events one real build actually emits — the
`onEvent` hook makes that a one-line tally — and record the observed figure in the buffer's docblock beside
the chosen cap, with the retention it buys at that rate. A cap chosen without that number is the failure this
note exists to prevent: too small and the replay a reloading operator gets is mostly "…truncated"; too large
and the leak is merely slower.

**Transport.** SSE over chunked: it gives reconnect and event ids for free, `EventSource` needs no client
library, and the Vite middleware already writes raw responses (`sendJson` at
`plateau:vite.config.mts:632-637` is the only helper, and it ends the response — the tail handler must not use
it). Keep the WIP=1 assumption: one live build, so one tail stream per run id.

## Done when

1. **Executable — the event stream carries the plan.** Run, from the plateau-app checkout root:

   ```
   npx vitest run src/build-runner/events.test.ts
   ```

   It passes with a case feeding a raw stream-json `assistant` line whose content block is a `TodoWrite`
   `tool_use`, asserting a typed plan/todo event is emitted carrying the checklist items and each item's
   state. Fails on `main` — `fromAssistant` drops `block.input` entirely.
2. **Executable — the sub-step model has three states and stays additive.** Run:

   ```
   npx vitest run src/backlog-view/lane-board.test.ts
   ```

   It passes with cases asserting a card whose sub-steps include a *running* step renders a distinct glyph
   from both done and pending, **and** that a card with no `subSteps` renders byte-identically to today. The
   second half is the additivity guard the existing `subSteps` contract requires.
3. **Executable — replay before live, with a SIZED bound.** A test over the run record asserts that events
   recorded during a build are readable afterwards in order, and that the buffer is bounded — feeding more
   than the cap keeps the most recent N and renders a `…truncated` marker rather than silently dropping
   early events. Fails on `main` — `BuildRun` stores no events.
4. **Observable — the cap is measured, not guessed.** The buffer's docblock records the **observed** event
   count from at least one real build, the chosen cap, and the wall-clock retention that buys against the
   30-minute `MAX_BUILD_MS` backstop (`plateau:src/build-runner/build-action.ts:146`). A cap with no cited
   measurement beside it does not satisfy this.
5. **Observable — the endpoint exists and streams.** With the dev server running and a build in flight, a
   request to the new tail route returns a streaming response (SSE content type, no `Content-Length`) that
   emits the buffered backlog first and then live events, and closes on the run's `exit` event. Check with one
   `curl -N` against the route.
6. **Observable — the existing consumer is untouched.** `plateau:src/build-runner/build-action.ts` still owns
   the single `for await (const e of runner.observe())` loop that drives the flow, and the tail attaches via
   its own `observe()` call or via the `onEvent` hook — not by taking over that loop. One grep for
   `runner.observe()` in `plateau:src/` shows the flow's call still present.

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: verify by mutation or reversion ahead of the build) — Each Done-when item states 'Fails on main' — a reversion check confirming fromAssistant drops block.input (we:src/build-runner/events.ts:52-54), SubStep is 2-state (we:src/backlog-view/lane-board.ts:210-213), and BuildRun carries no event history (we:src/build-runner/build-action.ts:42-62) — all verified true against the live tree.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — Verified via grep: runner.observe() has exactly one production caller (we:src/build-runner/build-action.ts:273) plus tests, and SubStep/subSteps has exactly one consumer (we:src/backlog-view/lane-board.ts) — matching the card's claim that a second observe() listener is safe and that the SubStep type change has one render site to keep additive.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — Done-when #1 and #3 are genuine round-trip tests at the two new seams (raw stream-json → typed plan event; BuildRunStore write → read), not one-sided assertions.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — The additivity test (byte-identical render with no subSteps) and the buffer-bound test (truncation marker on overflow) are named, mutation-sensitive checks, not toothless ones.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Buffer truncation must render a '…truncated' marker rather than silently dropping early events, and Done-when #3 requires a named test asserting that marker appears.
- **unmeasured-impact** (NOT addressed; strategy: measure the constraint before sizing) — The card requires the per-run event buffer to be 'bounded (a ring, or a cap...)' but names no cap value and cites no measurement of a typical/worst-case build's event volume (we:src/build-runner/build-action.ts, MAX_BUILD_MS=30min) to size it against — the bound is asserted necessary but never sized.

**Corrections applied by this review:**

- The BuildRunStore citation conflates two declarations: the 'per-run record... carries a single note string' description matches the BuildRun interface at we:src/build-runner/build-action.ts:59-62 (via BuildRunDTO's note field), not the BuildRunStore class itself, which is the map/registry at we:src/build-runner/build-action.ts:69-108 that holds many BuildRun records.
- fromAssistant's citation (we:src/build-runner/events.ts:44-57) is one line early — the function (with its doc comment) actually spans lines 45-57; line 44 is a blank line.

The card is well-grounded in the live repo — its core claims (single existing observe() consumer, missing plan/todo event, two-state SubStep, note-only BuildRunStore, sendJson ending the response) all check out, and its Done-when criteria are genuine reversion/round-trip tests rather than decorative ones; only a couple of low-severity citation and sizing gaps remain.

_Recorded through the declared `review-prep` operation._

**Author response (2026-08-21).** All three points applied.

- **unmeasured-impact (was NOT addressed)** — correct: the card asserted the buffer must be bounded but never
  sized it. *Replay is required* now names `MAX_BUILD_MS = 30 * 60_000`
  (`plateau:src/build-runner/build-action.ts:146`) as the worst-case window, requires counting a real build's
  event volume via the existing `onEvent` hook before choosing the cap, and new Done-when #4 makes the
  measurement a checkable artifact in the buffer's docblock.
- **`BuildRunStore` vs `BuildRun`** — correct, and worth fixing because it changes *where the buffer lives*:
  `BuildRun` (`:59-62`, extending `BuildRunDTO` `:42-57`) is the per-run record that carries `note`;
  `BuildRunStore` (`:69-108`) is the map. The buffer belongs on the record.
- **`fromAssistant` line range** — corrected to `:45-57`.

The juror's own prose writes these plateau paths with a `we:` prefix; the files are in `plateau-app`, as this
card's own citations have them. Noting it so a later reader does not follow the juror's prefix.
