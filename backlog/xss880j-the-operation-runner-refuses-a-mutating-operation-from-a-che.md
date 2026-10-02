---
kind: story
size: 3
status: open
scope: ["we:scripts/operations/run.mjs", "we:scripts/operations/__tests__/run.test.mjs", "we:scripts/operations/runner-freshness.mjs", "we:scripts/operations/__tests__/runner-freshness.test.mjs"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-02"
preparedAgainstSha: "fff15e8125add8c05a28a86a32f914cc0bb15ed5"
tags: []
---

# The operation runner refuses a mutating operation from a checkout that is behind main

Prevent the operation CLI from executing a mutating operation using an unmanaged checkout whose loaded code is behind origin/main. Refuse with the commit count and a remedy directing the caller to a lane; allow read-only operations with a one-line warning; provide an explicit, logged override. Lanes and daemon clones are exempt from this new guard. The existing dispatch guard remains independently authoritative.

## Progress

Preparation checked the current checkout at fff15e8125add8c05a28a86a32f914cc0bb15ed5 against the worker brief on main.

- **Original premise:** the reported 2026-10-02 incident involved an operator checkout 1,427 commits / three days behind main, unnamed failures during two verifies of #3432, and #3437 fixes absent from the running copy. Those incident counts and causal claims are historical reports from the original card, not reproduced evidence; no attached log here establishes them. The implementation gap is independently supported below.
- **Corrected premise:** the CLI already invokes a preflight, but only `dispatch-lane` is checked; every other name returns without a freshness check (we:scripts/operations/run.mjs:535-539, invocation at :568-573). Refusal happens before CLI stores and execution (we:scripts/operations/run.mjs:574-610). This is an extension of that boundary, not a first preflight.
- **Classification drift:** `verify` is compute-only (we:scripts/operations/verify.mjs:27-30), but its injected runner launches the verification home (we:scripts/operations/verify-io.mjs:134-148), whose normal mode writes a HEAD-keyed marker (we:scripts/verify-lane.mjs:14-16). The generic predicate only checks step kinds (we:scripts/operations/registry.mjs:463-467). Preserve the card's explicit requirement to refuse `verify`; do not silently exclude it because it has no effect step. `open-pr` has a submit effect (we:scripts/operations/open-pr.mjs:254-259).
- **Existing guard is not the requested policy:** the shared dispatcher helper fetches on every check and compares local main, potentially fast-forwarding it (we:scripts/lib/main-staleness.mjs:68-95); dispatch-lane additionally checks off-main HEAD code drift (we:scripts/operations/dispatch-lane-io.mjs:1233-1259). This card instead needs cached fetching, HEAD-based counting, and refusal without changing the working tree. Keep existing dispatch synchronization and daemon last-good behavior intact (we:scripts/lib/main-staleness.mjs:197-205, :229-240).
- **Scope corrected:** retain the runner and its real-process test; add a proposed runner-specific freshness helper and unit suite for cache/error/classification branches. No shared staleness helper, operation schema, HTTP adapter, or agent-document changes are required. Existing CLI fixtures already copy the runner's import trees and isolate run/call stores (we:scripts/operations/__tests__/run.test.mjs:20-51). Its fresh-case test uses help, which bypasses preflight (we:scripts/operations/__tests__/run.test.mjs:55-64; we:scripts/operations/run.mjs:562-565); that is not proof a fresh execution passes.

## Design

All behavior below is proposed, not a claim that it exists.

1. Add we:scripts/operations/runner-freshness.mjs with injectable Git, clock, filesystem and diagnostic seams. Integrate at the existing CLI preflight boundary in we:scripts/operations/run.mjs:568-573, before any run/call persistence or execution, including resumed calls. Resolve the **runner module's checkout**, using its module URL and Git top-level; neither process cwd nor an operation's target `--cwd` establishes which code was loaded. Help and unknown-operation handling retain their current early exits (we:scripts/operations/run.mjs:545-565).
2. Treat non-compute-only declarations as guarded and explicitly guard `verify` as required by this card, including its check mode for a simple operation-level rule. Other compute-only operations use the warning path. Reuse the existing declaration predicate rather than duplicating step-kind parsing (we:scripts/operations/registry.mjs:463-467). This is runner execution policy, not a reclassification of the operation's HTTP method or schema; keep the single-declaration rule at we:docs/agent/platform-decisions.md:3377-3393 (#operations-declared-once-callers-generated).
3. Exempt a canonical checkout root occupying a lane slot under the configured pool, using the existing pool-root derivation (we:scripts/lib/lane-pool-paths.mjs:53-67); a lane-like branch name alone is insufficient. Recognize the existing managed-daemon signal `WE_DAEMON_MANAGED_CLONE=1` (we:scripts/lib/main-staleness.mjs:197-203). Exemption skips this **new** check only: preserve `dispatch-lane`'s existing preflight and refusal. Do not grant the override power over other guards.
4. For unmanaged checkouts, count `HEAD..refs/remotes/origin/main` with Git. Ahead-only is current; divergent and detached checkouts still refuse when the count is positive. Count commits regardless of changed file type: documentation, templates, config and data can all affect an operation. Never merge, reset, stash, switch branches or rewrite tracked files.
5. Cache a successful explicit fetch of `+refs/heads/main:refs/remotes/origin/main` for five minutes in the runner checkout's Git directory. Store remote identity, fetched ref SHA and success time atomically; unrelated fetches must not refresh this cache. Missing/corrupt/future-dated cache or changed remote/ref requires another bounded fetch. A failed fetch never refreshes the success timestamp. For operations promising zero filesystem writes, keep freshness inspection read-only: inspect existing ref/cache and report uncertain freshness rather than fetch or persist a cache (the existing special case is documented at we:scripts/operations/run.mjs:574-578).
6. Positive behind count: guarded operation exits 1, naming operation, runner root, count, comparison ref and “run from a lane”; read-only operation continues with one stderr warning. Unknown freshness (failed Git/fetch, absent ref, malformed count) is never treated as zero: refuse guarded operations and warn for read-only ones. Use stderr so JSON stdout remains parseable. This new fail-closed rule does not change the existing dispatcher's offline behavior (we:scripts/operations/dispatch-lane-io.mjs:1248-1249).
7. Proposed explicit override: `WE_OPERATION_ALLOW_STALE=1` permits this guard's stale/unknown refusal only, with a mandatory stderr audit line containing operation, runner root, HEAD, reference/count or uncertainty reason. Other values do not enable it. An environment switch avoids a second per-operation argv parser. Log every use even if no persistent call log is available; refuse before stores are created otherwise (we:scripts/operations/run.mjs:568-587).

## MVP

- Implement the helper and wire all named CLI executions through it, retaining the dispatch-specific check and existing help behavior.
- Supply the declaration to the policy so the `verify` exception is explicit and tested. Cover the full registry with a classification test to expose new names and prevent accidental unguarded additions.
- Implement the five-minute fetch cache, HEAD comparison, lane/daemon exemptions, refusal/warning output and exact-value override together. No rollout into HTTP, direct imported operation calls, other CLIs or daemon synchronization.
- Keep implementation within the four scoped files, including both suites. The real-repo fixture helper is reused without changes (we:scripts/operations/__tests__/run.test.mjs:14).

## Test plan

- Proposed we:scripts/operations/__tests__/runner-freshness.test.mjs: deterministic clock/Git tests for cache hit, exact expiry, corrupt/future cache, changed origin/ref, failed fetch and count failure; verify explicit refspec and no working-tree-changing Git verbs. Test behind/ahead/diverged/detached classifications; all file types count equally. Cover module root versus cwd/target root, realpath lane boundaries, false lane-like names, managed-daemon flag, exact override values, JSON-clean stderr diagnostics, read-only zero-write handling, and continued dispatch-guard enforcement.
- Extend we:scripts/operations/__tests__/run.test.mjs with real bare-origin fixture commits. Advance origin by a known count; execute real `verify` and `open-pr` from the stale fixture and assert exit 1, named count/remedy, no run/call records and no verification marker or PR sink invocation. Sanitize inherited override/daemon/pool environment and isolate all stores. Use only fixture remotes, never production GitHub.
- Run `stale-state --json` from that stale fixture with an empty fixture backlog, an isolated `LANE_POOL_ROOT` and isolated run stores; assert the stale warning, parsed inventory verdict and zero new files. It has no required inputs (we:scripts/operations/stale-state.mjs:14-29) and reads the configured pool and backlog (we:scripts/operations/stale-state-io.mjs:56-80). `verify --mode=check` is deliberately **not** the read-only witness under this operation-level policy. For lane, daemon and override cases, use harmless fixture inputs/sink sentinels to prove preflight was passed without creating a real PR or launching the full repository's checks.
- Prove a fresh **execution**, not merely help, passes. Prove fresh cache avoids a fetch and expired cache observes the next remote commit. Include a narrow-refspec clone to ensure origin/main is really updated; the existing fixture helper explains this failure mode (we:scripts/operations/__tests__/helpers/real-repo.mjs:4-18).

## Proof plan

- Before implementation, add the stale `verify`/`open-pr` real-CLI regressions and observe that the runner does not produce the expected freshness refusal. Do not infer success from another operation validation error. After implementation, run both scoped suites and capture test names, exit codes, stderr and fixture side-effect assertions.
- Mutation witness: removing the new CLI call must fail the real-process tests. Removing only the `verify` policy exception must fail its regression. Bypassing the cache-age check must fail the expired-ref witness. Existing test commentary identifies why injected-only preflight tests miss removed wiring (we:scripts/operations/__tests__/run.test.mjs:4-7).
- Run the affected suites with Vitest, then the required lane verifier via Node at we:scripts/verify-lane.mjs and `npm run check:standards`. Record actual outcomes; passing fixture tests prove this CLI behavior, not the unreproduced historical incident.

## Done when

1. **Must refuse:** stale unmanaged `verify` and `open-pr`, and guarded operations with unknown freshness, stop before execution with actionable stderr unless the exact override is logged.
2. **Must retain caution for all inputs:** docs, config, templates and data commits count as behind just as source commits do; no code-extension filter weakens the new guard.
3. **Must permit:** fresh execution, read-only execution with a warning when stale, and lane/managed-daemon execution under their existing independent guards; override use is visible.
4. **Executable:** the added real-process cases in we:scripts/operations/__tests__/run.test.mjs fail before implementation and pass after it; the helper suite and lane verification pass.

## Follow-ups

- Separately audit compute-only readers for side effects and consider finer input-sensitive freshness policy, including `verify` check mode. Do not change step kinds, HTTP semantics or ratified operation architecture as part of this card (we:scripts/operations/registry.mjs:450-458).
- Preserve the testing lesson here: a `--help` witness bypasses the boundary, and a helper test alone cannot prove the CLI invokes it (we:scripts/operations/run.mjs:562-569; we:scripts/operations/__tests__/run.test.mjs:4-7). No shared agent-document edit.
- If historical incident attribution is needed, attach the actual invocation logs and checkout SHAs in a later investigation; the original report is not proof of the proposed mechanism.
