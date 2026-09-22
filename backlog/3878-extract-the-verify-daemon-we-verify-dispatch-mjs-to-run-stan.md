---
bornAs: xt6vu5s
kind: story
size: 5
parent: "3383"
status: resolved
blockedBy: ["3877"]
scope: ["we:scripts/conveyor/verify-dispatch.mjs", "we:skills-src/conveyor/runner-lock.mjs", "we:skills-src/conveyor/verify-daemon.mjs"]
dateOpened: "2026-09-22"
dateStarted: "2026-09-22"
dateResolved: "2026-09-22"
tags: []
---

# Extract the Verify daemon (we:verify-dispatch.mjs) to run standalone under its own keyed lease

we:scripts/conveyor/verify-dispatch.mjs's own header justifies its blocking safety entirely on 'the runner is a SINGLETON... so there is no risk of two dispatches racing the same lane's marker' (lines 23-27) -- a property that lives in we:skills-src/conveyor/runner.mjs today, NOT in this file; it holds no lock of its own. This is the one real gap in the whole daemon split (confirmed by direct read). Blocked on #3877 (keying we:skills-src/conveyor/runner-lock.mjs's lease): take that keyed lease under its own distinct key here BEFORE wrapping we:scripts/conveyor/verify-dispatch.mjs as a standalone daemon, then drop it from we:skills-src/conveyor/runner.mjs's own mechanicalPasses list. Part of daemonizing the conveyor runner under epic #3383; see #3860 for the design context.

## Progress

Built we:skills-src/conveyor/verify-daemon.mjs — a standalone daemon (same pure-core/IO-shell shape as #3870's
Fix-dispatch daemon and #3876's Review daemon: `runDaemonLoop` + a thin `runVerifyTick` per-tick effect + an
IO shell) that ticks we:scripts/conveyor/verify-dispatch.mjs's sweep every 120s (matching every other daemon
in this epic), gated on its OWN keyed we:skills-src/conveyor/runner-lock.mjs lease
(`<conveyor:verify-daemon-lease>`, #3877's generalized `key` param) taken BEFORE the first tick ever runs.

To make that sweep tickable without exiting the daemon's own process, we:scripts/conveyor/verify-dispatch.mjs
was refactored: its scan-and-dispatch loop (previously inline in `main()`, ending in an unconditional
`process.exit`) is now an exported, exit-free `runVerifyDispatch({dryRun})` function, and `main()` is now a
thin CLI shell over it (same "export the sweep, let the CLI own exit/format" shape
we:scripts/conveyor/reconcile-fix-dispatch.mjs#runReconcileFixDispatch already established). The existing CLI
suite (we:scripts/conveyor/__tests__/verify-dispatch.test.mjs, 16 tests) drives the script end-to-end and
passes unchanged, confirming this refactor preserved behavior byte-for-byte (same `--json` body shape, same
exit codes, same log lines).

**Correction found while building (a real, load-bearing false premise in this card's own digest, plus in
we:scripts/conveyor/verify-dispatch.mjs's own file header, which the digest was itself copying from).** The
card's text says to "drop it from we:skills-src/conveyor/runner.mjs's own mechanicalPasses list" once the
standalone daemon exists — implying we:scripts/conveyor/verify-dispatch.mjs is invoked from that list today.
Confirmed false by direct read: `grep -n "verify" we:skills-src/conveyor/runner.mjs` returns zero matches, and
a full audit of every `run(...)`/`runQuiet(...)` call site in that file (the actual mechanical-pass wiring)
lists ten passes, none of them verify-dispatch. we:scripts/conveyor/verify-dispatch.mjs was never wired into
we:skills-src/conveyor/runner.mjs's `makeCliMechanicalPasses` on `main` — there was nothing to drop. So "the
runner is a SINGLETON... so there is no risk of two dispatches racing" (that file's own header, lines 23-27)
was, at best, a borrowed, code-unenforced assumption about however else the file happened to be invoked —
never a property that file itself, or `we:skills-src/conveyor/runner.mjs`, actually enforced for it. This makes the daemon's own new
keyed lease not just belt-and-suspenders but the FIRST real enforcement this pass has ever had. Documented in
full in we:scripts/conveyor/verify-dispatch.mjs's own new header note (search "CORRECTION (#3878") and in
we:skills-src/conveyor/verify-daemon.mjs's own header.

**Deviation from the card's literal wording, documented per this epic's established practice (#3870/#3876's
own cards; #3873's card states the analogous "we:skills-src/conveyor/runner.mjs is intentionally UNTOUCHED" deviation the same way).**
This PR does NOT touch we:skills-src/conveyor/runner.mjs at all — not because the rolling-cutover practice
alone forbids it (though it would), but because, per the correction above, there is no
we:skills-src/conveyor/runner.mjs mechanicalPasses entry for verify-dispatch to drop in the first place. Even
setting that finding aside, this epic's established, safer practice (#3870, #3876, #3873) is a ROLLING,
pass-by-pass cutover: stand up the new standalone daemon, prove it stable, and only THEN retire whatever else
invokes the old script, in a separate, later change — a caution that matters doubly here, specifically because
this item's whole point is that we:scripts/conveyor/verify-dispatch.mjs's safety used to rest on an unverified
borrowed assumption; retiring some other invoker of it before this daemon's own lease is proven correct in
production would trade one unverified safety story for another, not close the gap this item exists to close.

**Regression test for the `.unref()` bug that has already bitten this exact pattern three times this epic**
(#3870's we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs, #3871's we:skills-src/conveyor/pass-daemon.mjs, #3876's
we:skills-src/conveyor/review-daemon.mjs). we:skills-src/conveyor/verify-daemon.mjs's own `realSleep` is
written in the confirmed-fixed form (`setTimeout(resolve, ms)`, no `.unref()`). Added a test that spies on
`global.setTimeout`, captures the real `Timeout` object `realSleep` creates, and asserts `.hasRef() === true`.
Confirmed the test actually catches the bug: temporarily reintroducing `.unref()` on that line made the test
fail (`expected false to be true`) with all 14 other tests still green; restoring the fix made it pass again
(15/15).

## Done when

1. **Executable** — `npx vitest run we:skills-src/conveyor/__tests__/verify-daemon.test.mjs` passes (15/15):
   `runDaemonLoop`'s tick/sleep/backoff/lease-loss control flow is proven with fakes (including "a failing
   tick is isolated, never fatal" and "a lost heartbeat stops the loop immediately"); `runVerifyTick` calls its
   injected `runVerify` effect and returns/propagates its result unchanged; `buildCliDaemonEffects` uses the
   daemon's own distinct lease key (`<conveyor:verify-daemon-lease>`) and the shared 120s cadence
   (`DEFAULT_INTERVAL_MS`); and `realSleep`'s own timer stays REF'd (confirmed by reintroduction to fail
   without the fix — see Progress). Additionally, `npx vitest run
   we:scripts/conveyor/__tests__/verify-dispatch.test.mjs` still passes (16/16) unchanged, proving the
   `runVerifyDispatch` extraction preserved we:scripts/conveyor/verify-dispatch.mjs's own CLI behavior
   byte-for-byte.
