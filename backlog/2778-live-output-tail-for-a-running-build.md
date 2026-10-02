---
bornAs: xxw8hy0
kind: story
size: 5
parent: "2551"
status: open
scope: ["plateau:src/build-runner/events.ts", "plateau:src/build-runner/events.test.ts", "plateau:src/build-runner/build-action.ts", "plateau:src/build-runner/build-action.test.ts", "plateau:src/build-runner/build-stream.ts", "plateau:src/build-runner/build-stream.test.ts", "plateau:vite.config.mts", "plateau:src/main.ts", "plateau:src/backlog-view/build-tail.ts", "plateau:src/backlog-view/build-tail.test.ts", "plateau:src/backlog-view/build-tail.css", "plateau:src/backlog-view/lane-board.ts", "plateau:src/backlog-view/lane-board.test.ts", "plateau:tests/e2e/build-tail.spec.ts"]
dateOpened: "2026-07-28"
preparedDate: "2026-10-01"
preparedAgainstSha: "b1065eee26c636be110ef9a934c5801ea9e445f1"
tags: []
---

# Live output tail for a running build

Show a running Plateau build's emitted agent commentary, tool calls and validation output as a live tail, with an updating done/running/pending plan checklist on the lane board. “Reasoning” here means commentary actually emitted by the runner, not inferred or hidden reasoning. Preserve the existing build controls and lifecycle.

## Progress

Preparation probe, 2026-10-01: inspected WE and the Plateau checkout at `1debc8990f730b45bdfc0eab430f9a567f6de2c9`. No product code changed or live build dispatched. Source observations, not a claim of browser verification:

- **Old premise:** the typed stream already contains everything and nothing is exposed over HTTP. **Correction:** the parser exposes init/text/tool-name/result/quota/error/exit only; tool inputs are discarded and user tool-result messages are ignored (we:../plateau-app/src/build-runner/events.ts:16, :46, :74). Validation output and structured plan changes require additional projections. Standard error is already surfaced as error events (we:../plateau-app/src/build-runner/runner.ts:120).
- The build flow already consumes `observe()` and forwards events (we:../plateau-app/src/build-runner/build-action.ts:273). Its callback retains only a short note/session/status, truncating text to 140 characters (we:../plateau-app/src/build-runner/build-action.ts:333). HTTP GET already returns run DTOs (we:../plateau-app/vite.config.mts:753), and the queue view polls them (we:../plateau-app/src/backlog-view/queue-view.ts:472). The missing feature is a replayable event tail and live plan, not basic HTTP progress.
- **Old checklist premise:** fixtured done/running/pending glyphs need wiring. **Correction:** `SubStep` currently has only label and optional done; rendering is binary and gated on the build bucket (we:../plateau-app/src/backlog-view/lane-board.ts:202, :399). The fixture supplies plan/implement/tests (we:../plateau-app/src/backlog-view/lane-board.ts:725). Add explicit running state rather than claim it already exists.
- A late runner observer receives no completed-run history (we:../plateau-app/src/build-runner/runner.ts:185). Board refresh remounts the DOM (we:../plateau-app/src/main.ts:830). Both facts require retained run state outside the rendered board.
- **Scope correction:** replace the two broad directories with file-level product implementation and test paths, adding the actual board integration owner. New proposed files are the stream helper, tail controller/styles and browser test. No WE runtime or new standard is needed: placement follows we:docs/agent/platform-decisions.md:143 (`#constellation-placement`); preserve the runner operations and stop behavior at we:docs/agent/platform-decisions.md:3181 (`#agent-runner-cli-backend`).

Path convention: source citations above and below use WE-relative sibling paths to satisfy this job's `we:` prefix rule. Scope entries retain the canonical `plateau:` machine-readable repository identity; they all refer to plateau-app, not WE implementation.

## Design

1. Extend the existing product event projection before adding UI. Preserve emitted text and tool identity; project tool-result text with its tool-use ID and error flag, and validate structured TodoWrite input into ordered plan snapshots with explicit pending/running/done states. Never infer completion from prose, tool names, exit or elapsed time. Unknown/malformed payloads must not replace the last valid plan. No supplied plan means “No plan reported.” Tool-result text includes validation command output when the CLI emits it; do not promise token-level streaming or output absent from that source. Add captured, sanitized stream examples to the parser tests before coding the mapping.
2. Fan out from the existing build-flow callback into a per-run buffer, not a second observer on the shared runner. Retain monotonically increasing event IDs, run identity, latest plan and lifecycle. Bound retained output by bytes and event count (initial proposal: 1 MiB and 1,000 events per run); explicitly indicate truncation. Keep only a bounded set of terminal runs (initial proposal: ten), never evict the active run. Dispose disconnected subscribers and slow clients without blocking the worker. Preserve the existing DTO projection so internal buffers/listeners never serialize through polling.
3. Add a read-only SSE route at `/api/backlog/build/:runId/events`, matched before the generic run GET at we:../plateau-app/vite.config.mts:760. Unknown/expired run returns 404 before headers. Send a snapshot and retained tail, then events; `Last-Event-ID` resumes without duplicates, with an explicit reset/truncation snapshot when the cursor is outside retention. Register snapshot/replay and subscription without a lost-event window. SSE framing uses JSON payloads, IDs and heartbeats; no permissive cross-origin exposure. Detach on connection close; opening a tail never spawns, steers or stops a build.
4. Distinguish runner exit from build completion: PR opening and final status happen later (we:../plateau-app/src/build-runner/build-action.ts:341). Publish those lifecycle changes and close only after opened/failed/stopped. A terminal snapshot tells the client to close EventSource rather than reconnect indefinitely. Lost connection/restart is visible as disconnected/unavailable, never success. An old run cannot attach to the next run.
5. Mount a read-only tail alongside the board, with selection by exact run ID and backlog identity. Discover the active local build via the existing GET route; merge its latest plan only into its matching board card. The tail controller owns connection/state outside board remounts and disposes on navigation; integrate in we:../plateau-app/src/main.ts:830. Builds from other producers without this run identity show unavailable, not fabricated events. Preserve legacy `done` fixtures while adding explicit status for live steps; do not invent a percentage when no valid plan exists.
6. Render output as text, never executable HTML. Provide a named log region, keyboard-accessible selection, visible focus, textual step statuses beside glyphs, and follow-tail behavior that pauses when the user scrolls away. Batch announcements instead of announcing every fragment. Reuse existing composed interaction primitives if introducing disclosure/focus behavior; do not hand-roll a covered trait.

## MVP

One local supervised build can be followed from active-run discovery through commentary, tool calls/results, validation output, plan updates and final build status. Reload/reconnect replays retained output without duplication; truncation, missing plan and lost run are honest states. Matching lane-board checklist survives ordinary refresh. Multiple viewers do not affect worker execution or existing stop/WIP controls.

All implementation and tests belong to Plateau. Under the #4289 split check, this scope has one code repository; WE holds this preparation card only. The wrapper inspects normalized scope and refuses multiple repositories (we:scripts/operations/deliver-item-wrapper.mjs:375). No artificial WE predecessor is proposed. If implementation discovers a genuinely shared declarative contract is required, propose a separately valuable WE contract-and-conformance predecessor and a dependent Plateau consumer/test successor before expanding scope; do not hide mixed paths or change ownership to bypass admission.

## Test plan

- **Capability — expected RED on the base (new assertions not run during preparation).** Extend we:../plateau-app/src/build-runner/events.test.ts with emitted text, correlated tool results, error results, TodoWrite state replacement, malformed/unknown input and chunk boundaries. Include escaped markup and multiline output. Ground new mappings in the sanitized CLI examples, not invented payloads.
- **Capability — expected RED on the base (new assertions not run during preparation).** Extend we:../plateau-app/src/build-runner/build-action.test.ts to prove all events are retained under the correct run, DTOs exclude internal buffers, and exit → opening → terminal remains ordered; stop/failure semantics stay intact.
- **Capability — expected RED on the base (new assertions not run during preparation).** Add proposed we:../plateau-app/src/build-runner/build-stream.test.ts: real HTTP connections against the handler with an injected event producer; test incremental delivery before completion, route matching, two clients, late attachment, cursor replay/reset, retention bounds, 404, disconnect cleanup, backpressure and final closure. Exercise the helper used by the Vite route, not an independently implemented mock server.
- **Capability — expected RED on the base (new assertions not run during preparation).** Add proposed we:../plateau-app/src/backlog-view/build-tail.test.ts and extend we:../plateau-app/src/backlog-view/lane-board.test.ts: exact identity matching, all three checklist states, missing plan, repeated/remounted board, stale event rejection, navigation disposal, literal hostile text and terminal/disconnected presentation.
- **Capability — expected RED on the base (new assertions not run during preparation).** Add proposed we:../plateau-app/tests/e2e/build-tail.spec.ts, within the existing browser test collection (we:../plateau-app/playwright.config.ts:18). Verify visible incremental output/checklist changes, board refresh, reconnect, scroll preservation, keyboard access and accessible names. Fixture-driven browser coverage must be supplemented by the real HTTP proof below.

- **Preservation — expected GREEN on today and changed code; verify during implementation.** Keep existing parser text/tool-name behavior, unknown-message tolerance, legacy checklist fixtures, DTO polling and stop/WIP semantics. Mutation proof: deliberately drop text events, serialize internal buffers, render absent steps, or allow a second active build; the corresponding existing/extended assertions must fail. Do not count these as proof of the new transport. Existing guard locations: we:../plateau-app/src/build-runner/events.test.ts:1, we:../plateau-app/src/build-runner/build-action.test.ts:1, we:../plateau-app/src/backlog-view/queue-view.test.ts:267 and we:../plateau-app/src/backlog-view/lane-board.test.ts:1.

## Proof plan

Implementation acceptance, not evidence collected during this card-only preparation:

1. Run the scoped Plateau unit/integration tests and normal product gates. Use its Vite dev server for endpoint proof; the endpoint is registered in `configureServer` (we:../plateau-app/vite.config.mts:725).
2. With a controlled runner fixture producing delayed CLI-shaped output through the real parser/build callback, connect an HTTP streaming client and browser simultaneously. Record an event received before the producer exits, correlated validation output, plan transitions, and final lifecycle. Do not require an autonomous paid build or push/PR to prove read transport.
3. Disconnect/reconnect, refresh the board and page, attach a second viewer, overflow retention and complete/stop/fail the run. Record no missing/duplicated retained IDs, visible truncation, terminal closure and listener cleanup. Starting a new run must never append to the old tail.
4. Capture the board and tail with pending/running/done text, test keyboard/focus and scroll behavior, and run an accessibility scan on the rendered surface. Preserve logs/screenshots and exact tested revisions with delivery evidence; a fixture screenshot alone does not prove streaming.

## Follow-ups

- Durable archived logs, remote/conveyor producers, additional provider payload adapters and cross-process replay are separate work; this MVP is bounded in-memory observation of the existing local build seam.
- Testing lesson: parser projections and the HTTP adapter can each pass while the real event-to-board connection is absent. Require the incremental end-to-end observation above; keep this lesson here rather than editing shared agent documentation.
- If CLI examples lack structured plan events or validation results, report that concrete source gap before implementation; do not quietly replace the goal with synthetic steps or a note-only tail.
