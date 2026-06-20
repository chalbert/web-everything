---
type: idea
workItem: story
size: 5
parent: "1019"
status: resolved
blockedBy: ["1051"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "fui:reliability/registry.ts"
tags: []
---

# webreliability provider — recovery-handler registry runtime in FUI

Slice B of webreliability impl epic #1019 (blockedBy slice A contract). Implement the recovery-handler registry runtime (register/resolve recovery handlers, offline-retry + resumable-transfer coordination) in FUI, conforming to the WE contract. Excludes the error-recovery protocol (decision #1032).

## Progress

Shipped the runtime-impl half (interim byte-replicated in WE, end-state FUI per the contract seam, mirroring `fui:guard/`):
- `fui:reliability/registry.ts` — `CustomRecoveryHandlerRegistry` (`localName: 'customRecovery'`): ordered `define`/`values`/`get`/`has`/`keys`/`resolve` + the **first-that-accepts** `recover(error, context)` dispatch (walks handlers in registration/priority order, short-circuits on the first non-null `RecoveryResult`, returns `null` when all decline) + `UnknownRecoveryHandlerError`. Single-dispatch per #1032 Fork 3 (composition is an author-ordered composite handler, not protocol orchestration).
- `fui:reliability/provider.ts` — re-exports the contract surface (file-seam split) + the trust-boundary `assertRecoveryResult` (validates the closed `outcome` set, the #1032 `disposition`/`phase` fields incl. open-meta-schema phase, non-negative `delay`; re-projects so handler-private keys never cross) + `RecoveryResultError`, `RECOVERY_OUTCOMES`, `FAILURE_DISPOSITIONS`.
- `fui:reliability/index.ts` — default wiring: `createDefaultRegistry()` returns an **empty** registry (the protocol ships no built-in handlers — HTTP retry / circuit breaker / offline queue are the consumer's to register).
- `fui:reliability/__tests__/registry.test.ts` (15 tests) + `we:vitest.config.ts` `reliability/**` include glob.
