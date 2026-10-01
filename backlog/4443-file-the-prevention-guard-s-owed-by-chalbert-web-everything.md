---
bornAs: xs3q6bf
kind: story
size: 3
parent: "4075"
status: active
scope: ["we:scripts/lib/isolation-provider.mjs", "we:scripts/lib/__tests__/isolation-provider.test.mjs", "we:scripts/operations/codex-delivery-provider.mjs", "we:scripts/operations/__tests__/codex-delivery-provider.test.mjs", "we:scripts/operations/__tests__/codex-delivery-provider-sandbox.test.mjs"]
dateOpened: "2026-09-29"
dateStarted: "2026-10-01"
preparedDate: "2026-10-01"
preparedAgainstSha: "bc2058219cef9235eb00e7a03ce4c2d20fd3bbaa"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2900's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. Verify that the extra WE lane granted through `writableRoots` cannot write Git hooks under the generated `locked` profile. Use a real `codex sandbox -P locked` probe; if the grant permits that write, close it in the shared profile builder and pin the protection with regression coverage. The current builder is `we:scripts/lib/isolation-provider.mjs:356`; the delivery adapter delegates to it at `we:scripts/operations/codex-delivery-provider.mjs:367`.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2900@9990ff189a7b3724c844c7289a042e7fffd7a521

## Progress

- Preparation research against `bc2058219cef9235eb00e7a03ce4c2d20fd3bbaa`: no implementation or sandbox probe performed during this preparation.
- **Old premise/scope:** the review cited `we:scripts/operations/codex-delivery-provider.mjs:1210` and scoped only that provider and `we:scripts/operations/__tests__/codex-delivery-provider.test.mjs`. It asked whether the extra writable WE lane also permitted a hook write, with a conditional permission fix.
- **Corrected premise/scope:** the provider now delegates profile generation to `buildNativeDenyCodexArgs` in `we:scripts/lib/isolation-provider.mjs:356`. Its permission entries at lines 366–368 combine supplied denies with root-level write grants; they add no Git-metadata exclusion. Add that shared source and its existing matching test, `we:scripts/lib/__tests__/isolation-provider.test.mjs`, plus the planned live test `we:scripts/operations/__tests__/codex-delivery-provider-sandbox.test.mjs`. Retain provider scope for the fresh/resume contract and accurate comments.
- **Evidence (2026-10-01, codex-cli 0.155.1, macOS Seatbelt, `codex sandbox -P locked`):** the original profile was already safe. With a standalone WE root granted via `writableRoots`, a write under its backlog directory succeeded; creating and overwriting files under its `.git/hooks`, `mv` of `.git`, and `rm -rf .git` all returned `Operation not permitted`; an ungranted sibling write was denied. No builder permission change was made. Fixtures under `/tmp` made every write succeed (ambient temp is writable), so they must live under `$HOME`. The live suite (4 tests, `we:scripts/operations/__tests__/codex-delivery-provider-sandbox.test.mjs`) passes with `WE_TEST_SANDBOX=0 WE_CODEX_SANDBOX_TEST=1` (vitest setup otherwise strips `WE_*` and fakes HOME). Unit suites pass; `check:standards` not run by the agent. Not covered: linked-worktree `.git` files, symlink aliases.
- **Source evidence:** `we:scripts/operations/deliver-item-wrapper.mjs:1266` supplies `extraLanes` as `writableRoots`; `we:scripts/operations/codex-delivery-provider.mjs:345` accepts it and line 367 forwards it. `we:scripts/lib/__tests__/isolation-provider.test.mjs:271` covers the shared builder but has no writable-root hook protection case. `we:scripts/operations/__tests__/codex-delivery-provider.test.mjs:77` and line 139 cover fresh/resume argv with mocked process execution, not OS enforcement. The shared builder's latest history entry is `9990ff189` (#4348), the commit named by the original review. The owed regression is not present in these sources/tests; actual sandbox write behavior remains to be measured, not inferred from the map.

## Design

Keep the existing `locked` permission profile and shared `buildNativeDenyCodexArgs` interface. The invariant is that an extra writable WE lane permits its required backlog edits without permitting writes to `we:<extra-lane>/.git/hooks/x`. Apply protection in the shared builder, so fresh and resumed delivery receive the same configuration through `buildCodexDeliveryArgv`.

First reproduce the exact generated profile in a disposable pair of standalone Git repositories: an implementation cwd and an extra WE root. Use a direct child command inside `codex sandbox -P locked`, with no model involved. This measures an implementation fact, not a policy fork. If the existing profile already blocks the hook write, retain it and ship the executable regression and evidence. If the write succeeds, add a deny for `we:<extra-lane>/.git/**` alongside each extra root's write grant, using the profile's actual absolute paths. Verify the metadata root itself cannot be replaced or removed; include an exact-root deny if needed by measured CLI matching behavior. Deduplicate generated exclusions against supplied denies so the configuration never contains duplicate TOML keys.

Do not substitute the review's backlog-only write alternative silently: the existing API grants writable roots, and narrowing all callers to backlog edits would change that contract. This item tests and, if needed, protects Git metadata while retaining ordinary file writes. Existing supplied denies, strict configuration, doctrine suppression, and the absence of `-s` remain pinned. Omitting `writableRoots` must leave the existing argv unchanged.

## MVP

1. Add an opt-in real sandbox suite in `we:scripts/operations/__tests__/codex-delivery-provider-sandbox.test.mjs`. Initialize disposable repositories, create the hook directory and a sentinel hook outside the sandbox, and obtain configuration from the production builder rather than copying its TOML.
2. Attempt hook creation and sentinel overwrite under the unmodified generated profile. Independently attempt an allowed backlog write in the extra root and a write in an ungranted sibling. Observe both exit results and file contents from the parent process; clean up only the disposable fixture roots.
3. If the hook attempt succeeds, implement the smallest measured exclusion in `we:scripts/lib/isolation-provider.mjs` and rerun the same suite. Record both the before and after outcomes. If it is already denied, document that observation and retain the guard test without an unnecessary permission change.
4. Extend `we:scripts/lib/__tests__/isolation-provider.test.mjs` and `we:scripts/operations/__tests__/codex-delivery-provider.test.mjs` to freeze the observed profile contract and fresh/resume parity. Update the relevant source comments with the measured limits.

## Test plan

- Shared builder: cover a single extra root, multiple roots, duplicate roots/denies, paths with spaces, retained explicit denies, and unchanged output for omitted/empty extra roots. If new exclusions are required, assert their exact generated keys and absence of duplicate keys in `we:scripts/lib/__tests__/isolation-provider.test.mjs`.
- Delivery adapter: exercise nonempty `writableRoots` on both fresh and resumed argv in `we:scripts/operations/__tests__/codex-delivery-provider.test.mjs`; assert identical permission arguments, no `-s`, and no fresh-only flags on resume.
- Real sandbox: in `we:scripts/operations/__tests__/codex-delivery-provider-sandbox.test.mjs`, require successful ordinary/backlog writes and denied hook creation, hook overwrite, metadata-root removal/replacement, and ungranted sibling writes. Use fixtures outside any implicitly writable temp root, since ambient temp permissions would confound the sibling control. Record canonical paths and verify sandbox startup separately from a denied operation.
- Name the new cases with `4443` and gate the real suite behind the proposed `WE_CODEX_SANDBOX_TEST=1` switch. An explicitly requested live run must fail on a missing/unsupported CLI or unusable sandbox, not silently skip. Ordinary unit runs may skip that suite.

## Proof plan

Run `WE_CODEX_SANDBOX_TEST=1 npx vitest run -t 4443` on a host capable of running the named native sandbox profile. Capture the installed CLI version, platform, generated permission arguments, canonical fixture paths, child statuses/errors, and parent-observed bytes. A parser/startup failure or outer-sandbox denial is inconclusive, not proof of protection. The positive write control must succeed in the same environment.

If the original profile is vulnerable, preserve a failing run of the new regression against the unchanged builder and a passing run after the exclusion. If the original profile already protects metadata, preserve its passing live result and demonstrate the test can detect a hook mutation with an unsandboxed fixture-only control. Never write test hooks in an acquired lane or primary checkout. This establishes raw sandbox behavior; it does not claim independently forced model-issued tool behavior inside a delivery session.

Run the complete affected unit suites named above, then `npm run check:standards`. Record the live suite's outcome separately from mocked/unit results; a green unit suite cannot discharge this item's live-proof requirement.

## Done when

1. `WE_CODEX_SANDBOX_TEST=1 npx vitest run -t 4443` executes the real sandbox cases successfully, proving required backlog writes still work while hook creation/overwrite and metadata-root mutation do not.
2. Any demonstrated write hole is closed in the shared generated profile, with unit assertions for the measured exclusion and equal fresh/resume configuration.
3. The card contains reproducible before/after evidence (or evidence the original profile was already safe), and the affected suites and standards gate pass.

## Follow-ups

No separate feature or policy work is required to discharge this review debt. Linked-worktree Git indirection, arbitrary symlink aliases, and broader read/network isolation are outside this standalone-lane regression; record any observed gap precisely for separate tracking rather than claiming coverage. If the supported CLI cannot express an effective exclusion while preserving required writes, stop implementation and bring that measured limitation back as a concrete contract choice; do not silently adopt backlog-only access.
