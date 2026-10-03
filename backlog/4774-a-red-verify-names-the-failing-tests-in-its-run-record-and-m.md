---
bornAs: xb9ygiu
kind: story
size: 2
status: resolved
scope: ["we:scripts/verify-lane.mjs", "we:scripts/lib/lane-verify.mjs", "we:scripts/lib/verify-failures.mjs", "we:scripts/operations/verify-io.mjs", "we:scripts/operations/verify.mjs", "we:scripts/__tests__/verify-lane.test.mjs", "we:scripts/__tests__/lane-verify.test.mjs", "we:scripts/lib/__tests__/verify-failures.test.mjs", "we:scripts/operations/__tests__/verify.test.mjs", "we:scripts/operations/__tests__/verify-integration.test.mjs"]
dateOpened: "2026-10-01"
dateResolved: "2026-10-01"
preparedDate: "2026-10-01"
preparedAgainstSha: "026425e9e4a9c067851692c796ec0620879dabcb"
tags: []
---

# A red verify names the failing tests in its run record and marker

A completed red verification must identify the failing test files and test names in the persisted lane marker and the operation's returned verdict, with bounded diagnostics. A caller should be able to act without rerunning the suite merely to discover what failed. Here, “run record” means the returned operation result; adding persistent operation history is outside this change (see Progress).

## Progress

- Final verification (2026-10-01): scoped suite passed again (176/176); after tightening streaming flush order, both subprocess suites passed again (52/52). `npm run check:standards` exited 0 with 0 errors (5,086 warnings); `git diff --check` passed. The first wider lane run exposed an operation-declaration import-purity regression, fixed by keeping Node-specific normalization in the IO boundary; its HTTP-adapter/operation regression rerun passed 64/64.
- Completion blocked by execution environment: the second `node we:scripts/verify-lane.mjs` run completed with 5,911 passing tests and one failure in we:scripts/operations/__tests__/heavy-queue-io-real.test.mjs, “readProcessCommand reads a REAL command line for this test runner's own live pid”. Directly probing `ps -p $$ -o command=` returned `Operation not permitted`; we:scripts/operations/heavy-queue-io.mjs catches that denial and returns null. This file and test are outside this card's scope; neither was changed or weakened. Sandbox escalation is unavailable. The card remains open because its required green repository verification has not been achieved; rerun the lane verifier where process inspection is permitted before resolving.
- Additional live transport proof: reading this checkout's actual marker after that wider red reported status `red`, gate exit `1`, and the exact failing file above plus its full test name. A separate read-only operation check returned `ok: false`, `failed: 1`, and the identical diagnostic identity without rerunning the suite.

- Implementation before witness (2026-10-01): added the real Vitest regression in we:scripts/operations/__tests__/verify-integration.test.mjs and ran it against the unchanged implementation. Six existing tests passed; the new case failed at the diagnostic assertion because `marker.failureDetails` was absent, after successfully asserting operation outcome `fail` and marker gate exit `1`. An initial fixture URL-resolution error was corrected before this decisive probe.
- After witness: the same deliberately failing `we:named.test.mjs` fixture now records `{file: "we:named.test.mjs", name: "outer > inner > names the failure"}` in `failureDetails.tests`. Its gate exit remains `1`, marker status remains `red`, operation outcome remains `fail`, and assessed verdict remains `ok: false`; the returned check, blocking detail and subsequent read-only check carry the identity. Correcting the assertion produces `pass` and removes diagnostics from the marker and check. Temporary repositories and runner fixture files are outside the checkout and cleaned by the existing fixture harness.
- Regression/soak proof: all five scoped test files passed (176 tests), including 10 MB of newline-free output followed by 1,000 failures, split UTF-8/ANSI records, independent stdout/stderr state, deduplication, suite-only failures, escaped JSON/UTF-8 byte limits, marker-free execution, check/wait parity, overlapping finish-body isolation, foreign SHA exclusion and green clearing. The collector retains bounded line/summary/identity state and caps serialized diagnostics at 16 KiB.

- Original report: the 2026-10-01 #3311 split lane and PR #3329 reportedly produced unnamed red results, requiring manual reruns. These incidents are motivation supplied by the original card, not independently reverified historical evidence.
- Corrected premise: the marker contains SHA, timestamps, suite command and tree hash as well as status/exit code, but no structured failure identities (we:scripts/lib/lane-verify.mjs:241-280). Gate output is inherited, so failures can appear in the terminal while being absent from the final JSON (we:scripts/verify-lane.mjs:358-376,420). The operation then replaces red detail with a generic summary (we:scripts/operations/verify-io.mjs:117-118); finding shaping also enumerates fields and would drop a new diagnostic field (we:scripts/operations/verify.mjs:75-86).
- Persistence correction: verify has two compute steps (we:scripts/operations/verify.mjs:163-175). Compute-only calls settle without a persisted run record; the CLI wires a call log separately (we:scripts/operations/run.mjs:574-587). The returned envelope exposes verdict and findings (we:scripts/operations/cli-adapter.mjs:1257). Preserve the goal of actionable recorded results via the marker and returned verdict; do not introduce a persistence policy change.
- Observed preparation probe: in a disposable Git repository, invoked the real home with a custom gate printing a synthetic named FAIL line and exiting 1. The home exited 2, its final JSON was red without failure identities, and the classifier returned only a generic failed summary. Reading the marker confirmed no structured failure identities. This probes transport loss, not a real Vitest failure. The first probe used an incorrect marker filename; the corrected probe imported VERIFY_FILENAME from we:scripts/lib/lane-verify.mjs and read the actual marker.
- Scope correction: the original three-file scope omitted the marker constructor, operation IO mapping and operation tests. Include those plus a small proposed bounded collector and its tests. Existing process-level test seams are we:scripts/__tests__/verify-lane.test.mjs:20-30 and we:scripts/operations/__tests__/verify-integration.test.mjs:33-39,97-104. Only this card changes during preparation.

## Design

Keep the lane verifier as the single suite-running home, with diagnostics carried through the existing operation declaration. This follows we:docs/agent/platform-decisions.md:3377-3393 (#operations-declared-once-callers-generated); do not run a second suite in the IO adapter.

Proposed additive `failureDetails` payload: `tests` entries containing checkout-relative `file` and full `name` (null for a suite/collection failure without a test name), a short `summary`, and `truncated`. Bound the complete serialized payload to 16 KiB, at most 20 distinct entries, with individual file/name strings capped at 512 characters and summary at 2 KiB. Truncate safely before serialization and set `truncated` whenever evidence is dropped. An absent payload on a legacy marker remains valid.

Capture and forward stdout/stderr while the shell gate runs; retain bounded incremental parsing state, not the entire log. Implement the collector in proposed we:scripts/lib/verify-failures.mjs. Recognize Vitest failure-summary records, strip ANSI sequences and deduplicate file/name pairs. Handle chunk boundaries and oversized lines without unbounded memory. Unknown custom gate output or a standards/build failure gets a bounded diagnostic summary with no invented test identity. A green exit clears failure details even if its output contains failure-like text. Parsing never decides whether the gate passed.

Thread the same payload through the finish constructor, terminal JSON (including marker-free run mode), read-only check and check-with-wait output, IO classification, finding shaping, verdict checks and actionable blocking detail. Existing output boundaries are we:scripts/verify-lane.mjs:159-166,381-382,410-421 and we:scripts/operations/verify.mjs:115-120. Only expose a marker's diagnostics when it belongs to the result being reported; stale/foreign records must not be attributed to the current HEAD. Preserve exit codes, admission release, the gate-start signal, streaming visibility, SHA compare-and-set and tree/gate cache identity (we:scripts/verify-lane.mjs:303-312,369-378,392-415).

## MVP

1. Add the bounded collector and additive marker/result payload; keep legacy markers readable. Pass diagnostics from this execution explicitly, never inherit failures from an overlapping marker.
2. Preserve diagnostics through both operation layers and make the failed blocking detail name the captured files/tests. Keep pass/fail/unrun classification unchanged (we:scripts/operations/verify-io.mjs:96-126).
3. Cover each transport boundary and a real failing Vitest subprocess. No UI, new persistence store, suite-selection change or implementation work belongs in this preparation.

## Test plan

- Proposed collector tests in we:scripts/lib/__tests__/verify-failures.test.mjs: real Vitest output shapes, nested names, suite-only failures, ANSI, duplicate records, split chunks, interleaved streams, oversized lines, many failures, malformed output and UTF-8 byte limits. Unknown output must never manufacture a file/name pair.
- Extend we:scripts/__tests__/lane-verify.test.mjs and we:scripts/__tests__/verify-lane.test.mjs: red marker/JSON round trip, old markers, subsequent green clearing, marker-free run, check/wait parity, foreign SHA and overlapping-run protection. Assert bounded diagnostics do not change outcomes or exit codes.
- Extend we:scripts/operations/__tests__/verify.test.mjs: payload survives classification, shaping and assessment; blocking detail names the failure; legacy red stays fail, malformed/killed/usage results stay unrun.
- Extend we:scripts/operations/__tests__/verify-integration.test.mjs with a temporary repository and an actual one-test Vitest failure using the installed runner. Assert the same file and full test name in the disk marker, run verdict and later read-only check verdict. Then fix that temporary test and verify green without stale failure details. Keep temporary artifacts outside the working tree and clean them up.

## Proof plan

At implementation time, run the focused Vitest command over all five test files listed in scope, followed by `node we:scripts/verify-lane.mjs` and `npm run check:standards` (strip the documentation-only `we:` prefix when executing).

The decisive before/after witness is the real Vitest integration case: on the parent implementation it must fail specifically because the named-test diagnostic is absent; after implementation it must pass with the deliberately failing fixture still producing a red verification. Retain the gate exit, final operation verdict and parsed marker as evidence. Then prove that correcting the fixture produces green and clears the diagnostic. A synthetic FAIL line alone is insufficient acceptance evidence.

## Done when

- **Executable:** the new named-failure integration case in we:scripts/operations/__tests__/verify-integration.test.mjs fails against the parent and passes after the change; run with `npx vitest run we:scripts/operations/__tests__/verify-integration.test.mjs` after stripping `we:`.
- **Must:** one genuinely failing test names its file and full test name in both marker and returned verdict without another test run to discover them.
- **Must:** unsupported output reports bounded available evidence without guessed test names; diagnostics never turn red/unrun into pass, bypass a finish guard or contaminate a newer run.
- **Must:** all scoped regression tests and repository verification pass, with no unbounded output accumulation.

## Follow-ups

- The operation declaration must stay free of Node-specific imports under the read-only import-graph gate. Normalize diagnostics in the IO boundary and carry that normalized payload through the pure declaration.

- Persistent history for compute-only operations, additional runner formats and downloadable full logs are separate work; none is necessary to expose the current failure in marker and verdict.
- Testing lesson for later work: synthetic gate text proves transport, while an actual runner failure proves recognition. Keep that distinction in this card; do not edit shared agent documentation.
