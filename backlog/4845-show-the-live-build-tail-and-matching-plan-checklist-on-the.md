---
bornAs: xkj71ne
kind: story
size: 5
parent: "2778"
status: open
blockedBy: ["4840"]
scope: ["plateau-app:src/main.ts", "plateau-app:src/backlog-view/build-tail.ts", "plateau-app:src/backlog-view/build-tail.test.ts", "plateau-app:src/backlog-view/build-tail.css", "plateau-app:src/backlog-view/lane-board.ts", "plateau-app:src/backlog-view/lane-board.test.ts", "plateau-app:tests/e2e/build-tail.spec.ts"]
dateOpened: "2026-10-02"
tags: []
---

# Show the live build tail and matching plan checklist on the lane board

Mount an accessible read-only build tail beside the lane board and apply valid live plan snapshots only to the matching run and backlog card. Keep connection state across board refreshes, replay without duplicates, and show missing-plan, truncation, disconnection and terminal states honestly.

## Design and source seam

Final slice of #2778, blocked by #4840 (and transitively #4839); carries parent Design steps 5–6, UI Test plan and complete MVP Proof plan. Read we:backlog/2778-live-output-tail-for-a-running-build.md for umbrella acceptance. Scope: exactly 7 paths / 3 areas (app entry, backlog view, browser E2E), with no server edits.

At inspected plateau-app revision `f1b2d3fe48632b13eb03e44fb59ccfe50b12fbb9`, we:../plateau-app/src/main.ts:830 remounts the board on refresh and :844 owns initial mount/polling. The current SubStep shape at we:../plateau-app/src/backlog-view/lane-board.ts:210 and rendering at :399 are binary, gated by build bucket. Preserve tests at we:../plateau-app/src/backlog-view/lane-board.test.ts:128, :777. The proposed controller/styles sit at this existing integration seam; the proposed browser test fits the collection in read-only we:../plateau-app/playwright.config.ts:18.

1. Add proposed we:../plateau-app/src/backlog-view/build-tail.ts, we:../plateau-app/src/backlog-view/build-tail.test.ts and we:../plateau-app/src/backlog-view/build-tail.css. Integrate the controller in we:../plateau-app/src/main.ts; own state/connection outside board remounts and dispose on navigation. Reuse the landed SSE snapshot/replay semantics; do not invent a second server transport.
2. Discover active local builds with the existing GET endpoint; select exact run ID and backlog identity including repository. Merge the latest valid plan only into the matching card when we:../plateau-app/src/backlog-view/lane-board.ts renders. Other producer builds without local identity show unavailable. Reject stale events and never append new-run output to the old tail.
3. Extend SubStep with explicit pending/running/done while preserving legacy done fixtures. Display textual statuses with glyphs and “No plan reported” for absent plan; never synthesize percentage or completion. Preserve valid plan and tail state across board refreshes/page reconnect; replay/reset must not duplicate retained IDs. Show truncation and lost/disconnected/unavailable states; close EventSource on terminal state instead of reconnecting indefinitely.
4. Render text literally, including hostile markup. Provide a named log region, keyboard-accessible run selection, visible focus and batched announcements. Follow-tail pauses when a user scrolls away; new fragments and board refresh must not steal position/focus. Compose existing interaction traits if disclosure or roving focus is introduced. Preserve existing build controls and lifecycle.

## Test plan and done when

- New capability assertions in we:../plateau-app/src/backlog-view/build-tail.test.ts and extended we:../plateau-app/src/backlog-view/lane-board.test.ts: exact run/repo/item identity, three states, absent/malformed plan, stale event rejection, dedup/reset, remount preservation, navigation cleanup, hostile text, terminal and disconnected presentation. Legacy checklist fixtures and board rendering remain green.
- Add proposed we:../plateau-app/tests/e2e/build-tail.spec.ts to the existing browser collection. Exercise incremental output and checklist, ordinary board refresh, page reload/reconnect, scroll preservation, keyboard/focus, accessible names and an accessibility scan of the rendered surface. Browser fixture coverage must exercise the integrated main/board/controller path, not just isolated component markup.
- Run targeted Vitest suites for the two scoped unit test files and Playwright for the scoped browser test from plateau-app, plus normal product gates. Capability assertions should be RED on the base; preservation assertions GREEN. Mutations that render absent steps, accept another run or execute hostile markup must fail appropriate assertions.
- Complete the parent Proof plan with a controlled delayed CLI-shaped runner fixture through real parser, callback and Vite handler. Connect a browser and HTTP client simultaneously. Record receipt before exit, correlated validation output, plan transitions and final lifecycle. Disconnect/reconnect, refresh board/page, add a viewer, overflow retention and complete/stop/fail. Verify no missing/duplicate retained IDs, visible truncation, terminal close and cleanup. Starting a new run cannot append to an old tail.
- Capture pending/running/done presentation, keyboard/focus and scroll evidence with exact revisions. A fixture screenshot alone does not prove streaming. Use controlled execution; acceptance does not require paid autonomous work or a push/PR.

## Follow-ups

Keep testing lessons and exact proof artifacts on this card. If integration exposes a defect in the landed transport, track and fix it in its owning scope before accepting the browser story; do not broaden this scope past the area limit. Durable logs, remote/conveyor producers, extra provider adapters and cross-process replay remain outside #2778 MVP.
