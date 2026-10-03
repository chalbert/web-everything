---
bornAs: xu5zrlg
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/health-investigate-dispatch.mjs", "we:scripts/conveyor/health-watch-core.mjs", "we:scripts/conveyor/__tests__/health-watch.test.mjs", "we:scripts/conveyor/__tests__/health-investigate-dispatch.test.mjs", "we:scripts/conveyor/__tests__/health-watch-core.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-03"
preparedAgainstSha: "abdb5171519ec9a239625d76aea8edb39a8d127f"
tags: []
---

# Prevention — classify investigation preparation failures and strengthen report regression guards

Filed mechanically on approval of chalbert/web-everything#3284. Preserve the three owed guards: definite pre-sink failure classification, single-line evidence commands, and findings arriving on the closing tick.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3284@005694098da2cd999fcf046dacdfde1389c33d93

## Progress

- Original premise/scope: wrap brief reading/filling/routing at `we:scripts/conveyor/health-investigate-dispatch.mjs:259`; normalize commands in validation or rendering at `we:scripts/conveyor/health-watch-core.mjs:589`; repair the closing-tick test at `we:scripts/conveyor/__tests__/health-watch.test.mjs:475`. Scope included both production modules and all three matching test files.
- Corrected premise: `dispatchInvestigation` now starts at `we:scripts/conveyor/health-investigate-dispatch.mjs:192`; preparation at lines 198–203 still runs without a classification boundary. Its caller at lines 295–302 records unmarked errors as indeterminate running attempts. `routeInvestigator` at line 145 intentionally catches routing-policy errors and returns null; preserve that fallback, while classifying errors from a throwing injected route before the sink.
- Validation actually lives at `we:scripts/conveyor/health-investigate-plan.mjs:206`; it trims commands but permits internal newlines. Rendering at `we:scripts/conveyor/health-watch-core.mjs:610` scrubs secrets and chooses a backtick delimiter without collapsing whitespace. The existing fence regression at `we:scripts/conveyor/__tests__/health-watch-core.test.mjs:975` covers backticks, not command newlines.
- The integration test now starts at `we:scripts/conveyor/__tests__/health-watch.test.mjs:488` and writes findings before its healthy-tick loop. Earlier ticks can attach findings before closure, masking removal of the actual closing-episode handoff at `we:scripts/conveyor/health-watch.mjs:904`. The direct closing-object test at `we:scripts/conveyor/__tests__/health-investigate-dispatch.test.mjs:479` does not cover that caller wiring.
- Corrected scope remains the five existing files in frontmatter: use render-time normalization, so no validator edit is needed; repair the integration fixture without changing the already-present handoff. Each production source has its matching test in scope. The additional modules cited here are read-only dependencies/evidence. The goal is not already delivered; these are concrete regression gaps, with no unresolved policy choice.

## Design

In `we:scripts/conveyor/health-investigate-dispatch.mjs`, import the existing `notApplied` helper from `we:scripts/operations/effect-executor.mjs:69`. Put preparation inside a catch boundary that ends before calling the dispatch sink. Move default sink construction out of parameter evaluation and into that preparation boundary, preserving explicit injected sinks. Include configuration/session preparation, brief read/fill, route selection, and sink construction; an error here proves no sink was invoked. Rethrow through `notApplied` with the original diagnostic message. Keep the sink invocation and awaited result outside this catch: an unmarked sink error remains indeterminate, since a process may have started. Preserve the default null-route fallback.

In `we:scripts/conveyor/health-watch-core.mjs`, collapse whitespace runs in the scrubbed evidence command to one space and trim it before choosing its inline-code delimiter. Preserve adaptive backtick escaping, output fencing, and privacy scrubbing. Render-time normalization also handles findings recorded before this change without rewriting stored evidence.

In `we:scripts/conveyor/__tests__/health-watch.test.mjs`, advance healthy observations without findings until the episode is demonstrably one clean observation from closure. Assert it is still open and its report lacks the sentinel findings. Seed the running ledger entry and findings immediately before the closing tick; use the existing null handle/session fixture to avoid real agent calls. Assert that exact tick closes the episode and preserves findings exactly once, then verify the following tick does not duplicate them.

## MVP

1. Add the pre-sink boundary and table-driven classification regressions in `we:scripts/conveyor/health-investigate-dispatch.mjs` and `we:scripts/conveyor/__tests__/health-investigate-dispatch.test.mjs`.
2. Normalize rendered evidence commands and extend hostile-input rendering cases in `we:scripts/conveyor/health-watch-core.mjs` and `we:scripts/conveyor/__tests__/health-watch-core.test.mjs`.
3. Tighten the existing closing-tick integration fixture in `we:scripts/conveyor/__tests__/health-watch.test.mjs`; retain existing production handoff behavior.

## Test plan

- In `we:scripts/conveyor/__tests__/health-investigate-dispatch.test.mjs`, drive real `dispatchInvestigation` through `runInvestigations` with an injected read failure, an empty template that makes real `fillBrief` fail, and a throwing route. For each row assert zero sink calls, a `dispatch-failed` ledger entry with null session/handle and an end timestamp, no indeterminate running entry, and the diagnostic in the failed summary. Verify the failed attempt remains counted against the budget and is not retried for that episode. Exercise default sink-construction failure with a scoped mock restored after the case.
- Retain successful dispatch and null-route behavior; include an unmarked sink rejection that stays running/indeterminate and a sink rejection already marked `notApplied` that stays `dispatch-failed`. The sink cases distinguish the preparation boundary from an unsafe catch around the entire function.
- In `we:scripts/conveyor/__tests__/health-watch-core.test.mjs`, render commands containing LF, CRLF, tabs, repeated spaces, backticks, and a newline followed by a Markdown heading/fence. Assert each command occupies one physical evidence line, whitespace is normalized, delimiters still contain backticks safely, secrets remain scrubbed, and multiline output stays fenced and unflattened.
- In `we:scripts/conveyor/__tests__/health-watch.test.mjs`, assert the pre-closing clean streak from persisted state, absence of findings before the final tick, the closing transition on that tick, one recommendation/evidence occurrence, `reportedAt`, and no duplication on the next tick. Derive the clean threshold from the smell configuration instead of relying on an early-exit loop that can consume findings on earlier ticks.

## Proof plan

During implementation, run the focused Vitest suite containing `we:scripts/conveyor/__tests__/health-investigate-dispatch.test.mjs`, `we:scripts/conveyor/__tests__/health-watch-core.test.mjs`, and `we:scripts/conveyor/__tests__/health-watch.test.mjs`. Record the exact invocation and results. These probes use temporary health state and injected sinks, with no live dispatch.

Show each new guard red against the old behavior and green with its fix. Temporarily remove only the `closedEpisodes` argument at `we:scripts/conveyor/health-watch.mjs:904` and run the named closing-tick test: it must fail on lost findings. Restore the argument and rerun to green; leave no mutation diff. Similarly removing the preparation wrapper or whitespace collapse must fail the corresponding new tests. Run `npm run check:standards` for the implementation change. This preparation records source inspection only; it does not claim the future regression tests have passed.

## Follow-ups

A shared hostile-Markdown corpus across every untrusted-text renderer is a possible broader follow-up, not required for this bounded guard. Keep retries, budgets, routing fallback, validation schema, and agent permissions unchanged. No new lint or dispatch infrastructure is needed.

## Done when

- Must classify proven preparation failures as `dispatch-failed` without invoking the sink, while preserving indeterminate classification for unmarked sink failures.
- Must render hostile multiline evidence commands on one physical line without weakening escaping or scrubbing.
- Must prove the closing-tick integration test fails when the production closing-episode handoff is removed and passes when restored.
- The focused tests and standards gate pass, with mutation evidence recorded by the implementer.
