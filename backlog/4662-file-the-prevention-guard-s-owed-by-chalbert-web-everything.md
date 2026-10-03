---
bornAs: xf1cldc
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/pr-limit.mjs", "we:scripts/readiness/dispatch-plan.mjs", "we:scripts/readiness/already-done-refresh.mjs", "we:scripts/lib/child-failure.mjs", "we:scripts/lib/__tests__/pr-limit.test.mjs", "we:scripts/readiness/__tests__/dispatch-plan*.test.mjs", "we:scripts/readiness/__tests__/already-done-refresh.test.mjs", "we:scripts/lib/__tests__/child-failure.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "4e1d8721955409f66eb6dd80674d7ef4e03e4298"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3176's independent review

Filed mechanically on approval to retain the independent review's prevention debt. Preserve the original goal: make unavailable PR counts observable, retain budget admission, bound and scrub child diagnostics, and prove bounded already-done enrichment cannot be wedged, silently skipped by stale refs, or write through cache bypass.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3176@230098d70c6e0e3cdd602f1268c8610f2a416f46

## Progress

Preparation research corrected the original nine findings against the acquired checkout; this is partial delivery, not already-done.

- **Old premise/scope:** four source files and four exact unit-test files, with historical line references; findings 2 and 6 independently requested the same low-budget CLI guard. Finding 9 named nonexistent `we:pr-limit.test.mjs` and required `unavailable: true` for an unfetched PR head.
- **Corrected premise/scope:** retain the four source owners, include `we:scripts/readiness/__tests__/dispatch-plan*.test.mjs` to cover the existing CLI suite and planned admission/PR-limit CLI cases. The matching PR-count test is `we:scripts/lib/__tests__/pr-limit.test.mjs`. Replace historical line numbers with the current symbols below. Combine findings 2 and 6 into one admission regression; do not duplicate already-delivered guards.
- **PR counts (findings 1, 9):** `we:scripts/lib/pr-limit.mjs` now separates a missing list (`unavailable: true`, null count) from unreadable commits (`unresolved > 0`). Its `countOpenPrsForDispatch` supplies a bounded fallback; `readPrLimitHeld` in `we:scripts/readiness/dispatch-plan.mjs` counts unresolved PRs conservatively. Commits b12845fdb and 519a931c5 introduced that fallback and upper bound. `we:scripts/readiness/__tests__/dispatch-plan.test.mjs` already exercises cold-cache fallback and unresolved-count holds. The CLI currently discards `counted` and only logs thrown failures; returned unavailability is still silent. Preserve the current result contract instead of asserting the obsolete unavailable-per-head shape.
- **Removed guard (findings 2, 6):** commit 230098d70c6e0e3cdd602f1268c8610f2a416f46 explicitly removed the `deferGhPass('dispatch-plan')` early return from `main` in `we:scripts/readiness/dispatch-plan.mjs`. That returned the deferral metadata with empty `launch` and `held` arrays. The current CLI has no equivalent whole-pass admission guard. These findings are not tests of a surviving branch: restoring the named guard is part of the owed work. The existing primitive remains in `we:scripts/lib/gh-throttle.mjs`.
- **Bypass (findings 3, 8):** commit a3654f704 added the `readOnly` worker payload and age expiry. `startAlreadyDoneRefresh`, `main`, and `refreshAlreadyDone` in `we:scripts/readiness/already-done-refresh.mjs` pass and honor that flag. `we:scripts/readiness/__tests__/already-done-refresh.test.mjs` asserts cache absence; `we:scripts/readiness/__tests__/dispatch-plan-already-done-bounded-spawn.test.mjs` has an independent default-cooldown bypass case plus separate zero-cooldown coverage. Retain these guards, explicitly clearing inherited cooldown overrides in the default-cooldown fixture.
- **Lock (finding 5):** the same commit added 60-second mtime expiry, including the live-unrelated-PID test in `we:scripts/readiness/__tests__/already-done-refresh.test.mjs`. Recovery still performs unconditional unlink followed by exclusive create; release also unconditionally unlinks. Concurrent reclaimers and an old worker's cleanup can remove a replacement owner's lock. Age recovery is delivered; ownership-safe takeover remains owed.
- **Stale refs (finding 7):** `localDoneVerdict` in `we:scripts/readiness/already-done-refresh.mjs` treats complete history without a mention as negative. The enrichment loop in `we:scripts/readiness/dispatch-plan.mjs` only queues refresh when neither cached nor local evidence exists. Thus a complete but stale local snapshot excludes an item from background verification. The CLI suite currently asserts zero refresh for complete history; update that expectation as part of the fix.
- **Diagnostics (finding 4):** `childFailure` in `we:scripts/lib/child-failure.mjs` concatenates message, metadata and stderr without a byte limit or redaction. `we:scripts/lib/__tests__/child-failure.test.mjs` only checks diagnostic preservation. The background-worker catch in `we:scripts/readiness/already-done-refresh.mjs` also interpolates raw stderr.

## Design

1. Preserve PR-limit policy: absent counts fail open visibly; unresolved authorship contributes to the conservative upper bound. In the CLI consume both `held` and `counted`, logging a clear `pr-limit unavailable` diagnostic when the list cannot be obtained. Keep the bounded fallback and existing overrides. Add local-only unfetched-head coverage without changing the result schema.
2. Restore the removed whole-pass `deferGhPass('dispatch-plan')` call at CLI entry, before child reads or refresh spawn. Reuse its existing admission policy and deferral metadata verbatim, adding empty `launch` and `held` arrays. Do not invent new headroom thresholds. Both original admission findings are satisfied by the same real-CLI regression.
3. Treat a local negative as snapshot-relative information, not a substitute for a fresh remote verdict: age-eligible cache misses remain refresh candidates even with complete local history. Keep cached positives authoritative, the two-ID round-robin ceiling, detached worker lifetime, and successful-verdict cooldowns. No synchronous fetch or per-item network loop in the planner.
4. Retain lock age expiry and exclusive creation, but make takeover and release ownership-safe in `we:scripts/readiness/already-done-refresh.mjs`: serialize reclaimers with an exclusive recovery reservation, re-read the lock while owning that reservation, atomically rename the expired lock aside, then create a token-bearing replacement. All claim/reclaim paths honor the reservation; worker handoff and cleanup require the matching token. Test recovery-reservation crash expiry too. An old worker must never overwrite or unlink a successor's token.
5. Extend `childFailure` with a bounded UTF-8 diagnostic (default 16 KiB, injectable `maxBytes`). Redact complete input before truncation, including message and stderr; cover credential assignments, Authorization bearer values, and recognizable provider-token forms with synthetic fixtures. Preserve useful tail text and exit/signal metadata within the cap, with a truncation marker; apply the same cap after single-line formatting. Route background-worker failures through this helper. This is targeted credential redaction, not a claim to detect every possible secret.
6. Preserve bypass end to end: readOnly reaches the worker, no verdict file is created, and an existing verdict file is unchanged. Attempts/log bookkeeping is allowed. Default-cooldown and zero-cooldown CLI cases remain independent.

## MVP

Implement the five remaining gaps: visible unavailable-count reporting, restored admission, stale-local-negative refresh eligibility, ownership-safe lock recovery, and bounded/redacted diagnostics. Extend the matching tests in the declared scope. Retain delivered conservative-count and bypass behavior. No changes to PR-limit override policy, throttle thresholds, cooldown durations, or the two-ID network ceiling are needed.

## Test plan

- `we:scripts/lib/__tests__/pr-limit.test.mjs`: inject a fresh shared PR list, an unfetched head, and failing local git; with `localOnly: true` assert zero API calls, no false human-authorship cache entry, and `unresolved: 1`. Missing shared list separately yields `unavailable: true` and null count.
- `we:scripts/readiness/__tests__/dispatch-plan.test.mjs`: retain cold fallback, cap and unresolved-upper-bound tests. Verify an unavailable count remains allowed by existing policy.
- Planned `we:scripts/readiness/__tests__/dispatch-plan-prevention.test.mjs`: run the actual CLI in a temporary backlog/queue fixture, enabling PR-limit checks explicitly. Isolate snapshot, authorship, override, throttle and planning-cache state. Cold/stale snapshots plus unavailable remote reads must produce `pr-limit unavailable`; unresolved PRs reaching the cap must hold. Low-headroom admission must emit the existing deferred metadata and empty arrays, with no child planning reads or refresh. Include an admitted control so fixture misconfiguration cannot masquerade as success.
- `we:scripts/readiness/__tests__/dispatch-plan-already-done-bounded-spawn.test.mjs`: use its local bare remote, leave complete local refs behind a newer implementation merge, and serve the matching merged PR from fake GitHub. Assert refresh eligibility, at most two searches, subsequent positive-cache replay and an `already-done` hold. Replace the old complete-history/no-refresh assertion. Clear inherited cooldown overrides for the default bypass case; await worker settlement before checking absent or unchanged verdict files. Keep zero cooldown separate.
- `we:scripts/readiness/__tests__/already-done-refresh.test.mjs`: retain live-PID expiry and readOnly cache-absence assertions; deterministically interleave two reclaimers, delayed old-owner cleanup, worker handoff, and crashed recovery reservation. Assert at most one current owner and that successor state survives.
- `we:scripts/lib/__tests__/child-failure.test.mjs`: large multibyte message/stderr, tail preservation, cap including marker and metadata, duplicate stderr, single-line formatting, and synthetic secrets in both inputs. Include a secret crossing the truncation boundary to prove scrub-before-truncate. The worker suite also checks sanitized failure logging.

## Proof plan

During implementation, run the affected Vitest files listed above (expand the scoped CLI test pattern to include the new suite), then `npm run check:standards`. Use only temporary fixture repositories and fake GitHub; do not touch the real lane pool or operator caches. Capture CLI exit code, parsed stdout, stderr, call counts and cache/lock contents after worker settlement.

Show red/green evidence for each new guard: silent unavailable output, missing admission early return, stale-ref exclusion, stale-owner takeover race, and uncapped/unscrubbed diagnostics must each fail a named regression on the pre-fix source. Removing the readOnly payload or cache-absence assertion must be caught by the independent bypass test. Existing passing tests alone do not prove the remaining work delivered. This preparation records inspected source and history, not an implementation test result; the runner owns preparation checks and stamps.

## Follow-ups

A repository-wide lint for raw stderr interpolation was suggested in finding 4. Keep that as explicit follow-up work beyond these four source owners: it needs log-sink classification and false-positive fixtures, rather than a blanket ban on reading stderr. The current story routes the identified refresh sink through the protected helper. Do not silently drop any of the nine original findings: 2/6 are consolidated, 3/8 retained, 5 partially delivered with race coverage remaining, and 9 corrected to the current unresolved-count contract.

## Done when

The affected tests and standards gate pass; each remaining gap has the failing-before/passing-after evidence above, and retained bypass, expiry, network-ceiling and conservative-count guards still pass. The implementation review names the restored admission guard and the replaced complete-history/no-refresh expectation explicitly.
