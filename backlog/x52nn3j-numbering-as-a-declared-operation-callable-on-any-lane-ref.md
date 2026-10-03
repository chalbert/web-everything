---
kind: story
size: 5
parent: "3383"
status: open
blockedBy: ["x2rabof"]
scope: ["we:scripts/operations/", "we:scripts/lib/number-pending-hashes-before-push.mjs", "we:scripts/readiness/drain-lock.mjs", "we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/"]
dateOpened: "2026-10-03"
tags: []
---

# Numbering as a declared operation callable on any lane ref

Build the first story #3732 files: numbering as a declared operation in we:scripts/operations/, callable on any lane ref, reading origin/main and every pushed lane/* ref and holding the mutex until the new ref is pushed. The lock fails closed. It is idempotent, refuses with named outcomes, and adapts numberPendingHashes to a lane tip rather than a checkout. It reads the where-numbering-happens setting and refuses integration-branch as unbuilt. Prerequisite for producer numbering and the write-point verify.

## Done when

1. **Executable** — a test runs the operation on a throwaway lane ref holding two hash cards and asserts both are numbered, every reference is rewritten, and `bornAs` is kept. It fails before this lands and passes after.
2. **Executable** — a crash after allocation and before the push, then a retry, yields the same numbers with no duplicate and no gap; a second run is a no-op.
3. **Executable** — allocation scans `origin/main` and every pushed `lane/*` ref, and the lock fails closed on contention (a refusal, not an unlocked run).
4. **Executable** — `we:scripts/check-standards-rules.mjs` (#2548) recognises the operation's own commit; a hand-picked NNN is still rejected.
5. Selecting the `integration-branch` setting refuses and names the value as unbuilt. Statute: `we:docs/agent/platform-decisions.md#backlog-ids-numbered-before-publish`.
