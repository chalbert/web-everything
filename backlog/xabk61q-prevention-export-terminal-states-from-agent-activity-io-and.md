---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/item-activity.mjs", "we:scripts/operations/item-activity-io.mjs", "we:scripts/operations/__tests__/item-activity.test.mjs", "we:scripts/operations/__tests__/item-activity-io-real.test.mjs", "we:scripts/operations/agent-activity-io.mjs", "we:scripts/operations/__tests__/agent-activity-io-real.test.mjs"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-03"
preparedAgainstSha: "8b3cb25274eca9818bfec5c6fe898c85368b4fe2"
tags: []
---

# Prevention — Share terminal states for item liveness and pin Codex transcript provenance

Filed mechanically on approval of chalbert/web-everything#3634. Preserve the two owed guards: derive item liveness from the shared terminal-state set, and prove that a readable Claude-path collision cannot become a Codex juror transcript without an explicit recorded path.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3634@c08f927484927ea47c310ffccb164a573d528a45

## Progress

- Original premise/scope: the review cited `we:scripts/operations/item-activity.mjs:62` for a working/idle allowlist and `we:scripts/operations/item-activity-io.mjs:96` for the transcript guard. Scope named those two modules and two tests, including nonexistent `we:scripts/operations/__tests__/item-activity-io.test.mjs`, but omitted the owner of the terminal-state set.
- Corrected premise: the allowlist is at `we:scripts/operations/item-activity.mjs:60`. `TERMINAL_STATES` remains private at `we:scripts/operations/agent-activity-io.mjs:239`, and ingestion uses it at line 265. `we:scripts/conveyor/session-reaper.mjs:57` documents observed terminal states done/failed/stopped and nonterminal working/blocked; idle is also accepted by the current item resolver. Direct Node invocation of `selectItemActivity` during preparation returned true for working/idle, null for blocked and each terminal state, and null for missing state. Thus the shared-state guard is not already delivered.
- Corrected transcript premise: `we:scripts/operations/item-activity-io.mjs:95` already prefers recorded `transcriptFile` and permits fallback only with explicit Claude backend evidence. `we:scripts/operations/__tests__/item-activity-io-real.test.mjs` covers an explicit Codex path and absent Codex evidence, but never creates the colliding readable Claude file. This part needs a regression fixture, not a new provider policy.
- Corrected scope: retain the two item modules, replace the missing IO test with `we:scripts/operations/__tests__/item-activity-io-real.test.mjs`, and add `we:scripts/operations/agent-activity-io.mjs` plus its existing `we:scripts/operations/__tests__/agent-activity-io-real.test.mjs`. The pure selection tests remain in `we:scripts/operations/__tests__/item-activity.test.mjs`. No implementation or preparation stamp is written by this preparation.

## Design

Export the existing `TERMINAL_STATES` from `we:scripts/operations/agent-activity-io.mjs` and import that same set in `we:scripts/operations/item-activity.mjs`. Keep ingestion's terminal exclusion unchanged. For selection, completion-only rows remain `live: false`; rows with absent/null state remain `live: null`; otherwise derive `live` as `!TERMINAL_STATES.has(row.state)`. This covers blocked sessions and future nonterminal state strings without growing a positive allowlist. Completion outcome remains separate from process liveness. Importing the constant must not invoke readers or external commands.

Keep the transcript rule in `we:scripts/operations/item-activity-io.mjs`: a Codex or unspecified backend needs an explicit recorded transcript file; only explicit Claude backend evidence permits a path derived from session ID and cwd. All advertised paths still pass the existing absolute-path, readability and regular-file checks. The collision fixture must exercise nested juror telemetry, where the guarded fallback lives, rather than only top-level source rows.

## MVP

1. Export/reuse the terminal set and replace the item allowlist with the null-preserving negative membership check.
2. Extend `we:scripts/operations/__tests__/item-activity.test.mjs` with independently specified expected liveness for working, blocked, idle, done, failed and stopped; include null, omitted state, a synthetic future state, and completion-only rows. Do not derive expected values from the imported set itself.
3. Extend `we:scripts/operations/__tests__/agent-activity-io-real.test.mjs` to pin the exported terminal membership and show ingestion excludes all three terminal states while retaining working/blocked/idle.
4. Add the deterministic collision regression and positive controls to `we:scripts/operations/__tests__/item-activity-io-real.test.mjs`, using its temporary directories and injected metadata. Production transcript behavior needs no change unless the new fixture disproves the observed guard.

## Test plan

- Source/test pairing: `we:scripts/operations/item-activity.mjs` → `we:scripts/operations/__tests__/item-activity.test.mjs`; `we:scripts/operations/agent-activity-io.mjs` → `we:scripts/operations/__tests__/agent-activity-io-real.test.mjs`; `we:scripts/operations/item-activity-io.mjs` → `we:scripts/operations/__tests__/item-activity-io-real.test.mjs`.
- Create a real readable file under the injected Claude projects directory using `projectSlugFor(cwd)` and the Codex telemetry session ID. Link a stored operation run to a completion record, omit telemetry `transcriptFile`, and assert the selected Codex juror has null transcriptPath/lastEventAt/transcriptAgeMs plus a transcript-unavailable evidence gap despite that file existing. Repeat for unspecified backend.
- Positive controls: an explicit readable Codex transcript is returned even when a different Claude collision exists; explicit Claude telemetry still resolves its derived path. Keep missing-file evidence null. Use injected time for age assertions and clean every temporary directory.
- Run Vitest on the three fully qualified test paths above, resolving the `we:` prefix to this checkout. No live provider invocation, host transcript access or GitHub metadata request is necessary.

## Proof plan

Before implementing, add the liveness cases and observe the blocked/terminal expectations fail against the current selector. After the shared-set change, run all three test files and retain the result. The collision test should already pass on the guarded implementation; temporarily remove only the Claude-backend condition in `we:scripts/operations/item-activity-io.mjs` and verify that the collision assertion fails, then restore the guard and rerun. This mutation demonstrates that the fixture detects the original provenance regression rather than merely a missing file.

Run `npm run check:standards` after implementation. Review the diff to confirm one shared terminal set for these two consumers, unchanged completion/outcome semantics, and no broad state-allowlist lint. The runner owns preparation stamping and preparation checks; these are implementation proof requirements, not a claim that implementation is complete.

## Done when

- Must report known nonterminal states as live, known terminal states as not live, and absent state as unknown, while keeping completion-only runs not live.
- Must refuse a Codex/unspecified-backend guessed transcript even when the guessed Claude file is readable; explicit recorded evidence and the existing explicit-Claude fallback still work.
- Executable evidence is the three-file Vitest run described above: new liveness cases fail before the source change and pass after; the collision case fails under the targeted guard mutation and passes with the guard restored.

## Follow-ups

No new policy decision is required. A general standards rule against hand-written state allowlists remains outside this item, as the approval requested. Keep the state matrix current when provider states change; do not expand this work into session reaping, PID health, or transcript discovery for other runtimes.
