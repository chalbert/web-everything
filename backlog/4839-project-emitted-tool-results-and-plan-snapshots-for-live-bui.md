---
bornAs: xjlx8w2
kind: story
size: 2
parent: "2778"
status: open
scope: ["plateau-app:src/build-runner/events.ts", "plateau-app:src/build-runner/events.test.ts"]
dateOpened: "2026-10-02"
tags: []
---

# Project emitted tool results and plan snapshots for live build observation

Extend the existing runner event projection with correlated tool-result output and validated pending/running/done plan snapshots. Preserve emitted commentary and tool identity so read-only consumers can observe real output without inventing reasoning or completion.

## Design and source seam

First slice of #2778; carries its Design step 1 and parser Test plan. Read we:backlog/2778-live-output-tail-for-a-running-build.md for the preserved umbrella goal. Scope: exactly the two files in frontmatter (2 paths, 1 runner area); implementation belongs to plateau-app and introduces no WE contract.

Observed at plateau-app revision `f1b2d3fe48632b13eb03e44fb59ccfe50b12fbb9`: we:../plateau-app/src/build-runner/events.ts:16 defines RunnerEvent; :46 discards tool input; :74 ignores user tool-result messages. Existing fixtures at we:../plateau-app/src/build-runner/events.test.ts:4 cover text/tool identity, unknown input and chunk boundaries. The existing observer receives parser results directly via we:../plateau-app/src/build-runner/runner.ts:111 (read-only reference), making this an independently usable projection improvement.

1. Add sanitized, captured CLI examples inline in the existing parser test file before changing mappings. Project tool-result text with tool-use ID and error flag; retain commentary and tool identity in emitted order. Include validation output only when the CLI actually emits it; do not claim token-level streaming or hidden reasoning.
2. Validate structured TodoWrite input into ordered pending/running/done snapshots. Invalid or unknown payloads emit no replacement snapshot, allowing consumers to retain the latest valid plan. Never infer completion from prose, tool names, exit or elapsed time. No supplied plan is absence, not synthetic steps.
3. Preserve existing event shapes/behavior where possible, unknown-message tolerance, quota handling and arbitrary NDJSON chunk boundaries. No observer, process-control, transport or board edits in this slice.

## Test plan and done when

- Capability assertions in we:../plateau-app/src/build-runner/events.test.ts must fail on the base and pass after implementation: correlated success/error tool results, emitted multiline validation output, complete plan replacement, malformed/unknown TodoWrite input, escaped markup and split chunks.
- Run the targeted Vitest suite for that file from plateau-app. Existing text/tool-name, quota false-positive and demux tests must remain green. Mutation proof: dropping text or accepting a malformed plan must fail the relevant assertion.
- Demonstrate sanitized captured NDJSON flowing through the real parser/demuxer, yielding results and plan snapshots available to existing observers without HTTP/UI. Record exact revision and fixture provenance; these assertions have not been run as part of this backlog-only split.

## Follow-ups

If captured examples lack plan events or validation output, report that concrete source gap on this card before implementation. Do not substitute synthetic completion or weaken the parent goal. Runtime delivery and browser proof belong to #4840 and #4845, respectively; broader provider adapters and archived logs remain outside this MVP.
