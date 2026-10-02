---
bornAs: xxa8ti1
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-02"
preparedAgainstSha: "490e7d6644d9abb0237cc628cc9f8da7a4814511"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2981's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

The remaining guards are dry-run/live WIP-count parity and conservative WIP accounting when builder attribution cannot be read. Review requests 2 and 3 describe one failure-path guard, not two separate mechanisms. Current source locations and the corrected counting contract are recorded below.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2981@bef8e3972fcde5e026e7ca0c8e8aecc08074f6df

## Progress

Preparation research on 2026-10-02 found this goal still outstanding; no implementation or stamp is made here.

- **Old premise/scope:** three review bullets cited the daemon at lines 624, 146, and 258, requested a dry-run seam plus reader-error fallback, and described counting “every open PR.” Scope paired the daemon with its existing test file.
- **Corrected premise/scope:** retain that source/test pair. The dry-run report now lives at `we:skills-src/conveyor/build-dispatch-daemon.mjs:1332`; both planning paths already call `deriveDispatchedByBuilder` (definition at line 188, tick call at line 404, report call at line 1358), but no test exercises report assembly. Readers at lines 734 and 778 still hide directory errors and skip individual unreadable records. Cover both failure modes. Requests 2 and 3 collapse into one conservative-attribution change and its tick-level regression.
- **Source evidence:** `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs:258` tests tick WIP accounting, line 281 tests worker exclusion, and line 300 tests only the shared helper. Real-reader tests at lines 1135 and 1173 explicitly expect empty arrays after ENOTDIR. These assertions preserve the old fail-open behavior; they do not prove report parity or conservative dispatch on error.
- **Counting correction:** `we:scripts/conveyor/build-dispatch-policy.mjs:252` already accepts null attribution and forms the deduplicated union of in-flight item numbers and item numbers delivered by open PRs. “Every open PR” therefore means every recognizable delivered item without the builder-ownership filter, not one WIP slot per PR or a slot for PRs with no delivery reference. Raw PR-count and scope-overlap gates remain independent. This is supporting evidence, not an additional implementation target.
- **Read-error evidence:** `we:scripts/operations/run-store.mjs:107` throws for corrupt records; the daemon catches those errors separately from directory-list errors. The live shell caches both build reads at `we:skills-src/conveyor/build-dispatch-daemon.mjs:1452`, so error status must survive that caching as well as the dry-run shell. The same readers also serve prepare-item work; preserve those callers' array contract.

## Design

Implement the review's specified fallback in `we:skills-src/conveyor/build-dispatch-daemon.mjs`. Add an opt-in status result to both readers: with `withStatus: true`, return `{ rows, readFailed }`; otherwise retain the existing array return for prepare-item and older callers. Mark `readFailed` on a thrown directory listing or individual record read, retaining all successfully read rows. Successful empty reads remain distinguishable from failures.

Have the live and dry-run build shells request status results and inject them intact. Normalize legacy array effects as successful reads inside the tick. Use the successful rows for existing in-flight and settlement bookkeeping. Derive attribution through one shared adapter: return null when either build read failed, otherwise call `deriveDispatchedByBuilder` with the two row arrays. Both planning paths must use this adapter. Do not replace failure with an empty set or discard successful in-flight rows. Update the daemon's fail-direction comments to describe this change.

Extract `buildDryRunReport` as an exported, injected assembly seam used by the actual dry-run CLI. Inject the existing external reads, route prediction, policy, focus, and clock; keep stdout formatting in the CLI shell. Return enough assembly evidence for tests to inspect the tick plan, hypothetical `ifFreed` plan, and rendered report without duplicating the planner in the test. Reuse one captured input snapshot for PRs, claims, build-reader results, fix claims, and kill-switch state across the two plans; their candidate sets may differ, but their pre-dispatch open-item union must agree. Keep the public JSON/text report shape stable.

This is a bounded daemon correction using the planner's existing null behavior. It does not change attribution on successful reads, global PR caps, or prepare-item failure policy.

## MVP

1. Add and document the opt-in reader status contract, including partial-read failure, in `we:skills-src/conveyor/build-dispatch-daemon.mjs`.
2. Carry it through live and dry-run shell caching into the shared attribution adapter and tick planner call. Preserve legacy array effects and prepare-item consumers.
3. Extract and wire the report assembly seam, sharing the captured accounting inputs between both plans.
4. Extend `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs` with real-reader error observations, live-tick no-dispatch guards, and report parity regressions. Retain existing success-path attribution tests.

## Test plan

All matching tests live in `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs`.

- Reader matrix: successful empty store, valid in-flight/settled records, ENOTDIR using a file as the run-store directory, and a corrupt dispatch record alongside a valid record. Exercise each reader with status enabled; assert failures are explicit and successful rows survive. Preserve array-mode compatibility and prepare-item tests. Restore temporary directories and environment after each case.
- Tick matrix: fail only the in-flight attribution read, only the settled read, and both. Seed open builder PRs at `maxOpenItems`, leave concurrency/global-PR/scope gates permissive, enable the tick's live branch with injected dispatch spies, and assert zero dispatch calls plus `wip-cap` holds naming the counted items. Feed real-reader failure results into at least one case rather than constructing every sentinel by hand.
- Union semantics: include duplicate PR delivery references, an in-flight item also delivered by a PR, a worker-owned PR, and a PR without an item reference. On failure count recognizable item numbers once without the ownership filter. On a successful empty read continue excluding worker PRs; on successful attribution count builder items only.
- Report seam: with the same builder/worker fixture, assert `ifFreed.openItems` equals the tick plan's open-item count and numbers, and the report's `filling` matches those numbers. Repeat on read failure and with a core-capacity-held candidate so the hypothetical path actually runs. Assert item hold reasons agree with the headline count and that assembling the report invokes no dispatch effects.

## Proof plan

During implementation, add the regression cases first and record their failure against the old behavior: errors are indistinguishable from empty success, or a capacity-full tick dispatches. For the report seam, prove the wired CLI assembly path is tested, not just the attribution helper; temporarily removing attribution from only the hypothetical planner call must fail the worker-PR parity assertion. A missing export alone is not behavioral proof.

Run the focused test command from the WE checkout (the path argument denotes `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs`):

```sh
npx vitest run skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs
```

Record before/after assertions for zero live dispatch effects at capacity and matching dry-run counts, then run `npm run check:standards`. Use temporary run stores and injected effects; no production dispatch is needed for this guard. These are implementation acceptance checks, not tests claimed as completed by this preparation.

## Done when

1. The focused test command above passes with real read-error fixtures, a capacity-full live tick that never dispatches, and the actual report assembly path covered.
2. Successful attribution still excludes worker PRs; failed attribution uses the existing unfiltered item union in both planning paths, including partial read failures.
3. The source/test scope remains complete and `npm run check:standards` passes.

## Follow-ups

No additional policy decision is needed for the requested fallback. Broader run-store recovery, prepare-item failure behavior, and new operational alerting are outside this guard. If implementation exposes a separate defect in those areas, record it separately; do not broaden this card into a run-store redesign.
