---
bornAs: x1q7emf
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4387-review-dispatch-refuse-on-a-stale-clone-only-when-the-missed.md"]
dateOpened: "2026-09-28"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2892's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4387-review-dispatch-refuse-on-a-stale-clone-only-when-the-missed.md:15` — Add a card-template line, or a file-item lint for cards that relax a refuse/guard behaviour, requiring 'fail-closed on error' and 'non-code inputs enumerated' in the Must list.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2892@10670086483a23b3308329912b76984c4b0ce83b

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

## Follow-ups

PR #3154 incident investigation (2026-09-30): the managed daemon's
`we:.operations/completions/ci-heal-3154.json` records a heal starting at
18:11:06.875Z and finishing at 18:11:10.729Z as `not-applicable`.
`we:.operations/delivery-dispatch-logs/ci-heal-3154.log` contains only
“could not acquire a lane on the PR head.” The dispatch at line 39614 of
`we:.conveyor/fix-dispatch-daemon.log` is followed by repeated `ci-heal-escalated`
refusals. The old adapter discarded the acquire subprocess output, so these
records do **not** establish whether capacity, contention, fetch, or configuration
caused the original acquisition failure. Preserve those diagnostics on future
attempts; do not infer missing refs from an empty acquire result. The local live
origin probe during this investigation failed DNS, which likewise establishes
neither presence nor absence. The operator supplied the existing origin head
`e97e86c78ed0d502340454df53bcd3ea9b128cfa`.

The regression in
`we:scripts/conveyor/soak/breaks/ci-heal-acquire-false-escalation.mjs` uses a real
local origin and the real lane acquire subprocess with an empty pool. Restoring
the old classification reproduces false “lane ref gone” escalation. With the fix,
eight successive reconciliation/heal passes retain the acquire error, verify the
origin ref exists, return `blocked-on-infra`, and remain eligible for retry.
Deleting that fixture ref then proves the verified-absence escalation. Existing
legacy acquire-null comments are ignored by their exact old signature, so #3154
can re-enter the normal dispatch path without a new push or manual marker edit.
A genuine current-head escalation carries `review-status:needs-human`, reconciled
from its durable comment and removed after a head change.

The contention regression in
`we:scripts/__tests__/lane-pool-acquire-lock-contention.test.mjs` now installs a
live scan-lock owner before starting five concurrent contenders. It asserts
contention, an unchanged owner, no lane scan/mutation git calls, and successful
acquisition after release. Ten consecutive integration runs passed. Use this
ownership/order evidence instead of elapsed CI duration or a sleep to guess which
caller acquired the lock first. The test timeout remains a hung-process watchdog,
not the contention-performance assertion.

Validation in the restricted checkout: 241 focused unit tests passed; the new
soak replay passed; `npm run check:standards` reported zero errors. The required
`node we:scripts/verify-lane.mjs` invocation could not write its marker because
this sandbox makes `we:.git` read-only. Its markerless `run` mode, with admission
storage redirected to a disposable writable pool, executed the full selected set:
4,640 passed and six failed across
`we:scripts/operations/__tests__/clear-stuck-session-io-real.test.mjs`,
`we:scripts/operations/__tests__/http-adapter.test.mjs`, and
`we:scripts/lib/__tests__/gh-app-shim.test.mjs`.
Separate direct probes confirmed `spawnSync /bin/ps EPERM` and
`listen EPERM ... 127.0.0.1`; those failures require host permissions unavailable
here. Re-run the unchanged wider gate in an environment allowing those operations.
No shared agent documentation was edited.
