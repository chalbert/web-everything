// @webeverything/contracts/reliability — the Error Recovery protocol's pure-contract surface (#1019/#1051).
// Type-only re-export (zero runtime emit) of the canonical contract module; the runtime impl is FUI's
// (the `customRecovery` registry + the concrete HTTP-retry/circuit-breaker/offline-queue handlers — all
// impl, fui:reliability/, #1916). This is the FUI→WE arrow the relocated runtime imports so a recovery
// handler satisfies `CustomRecoveryHandler` / `RecoveryResult` without the runtime crossing the seam —
// exactly like `./analytics` and `./webpolicy`. WE keeps only `we:reliability/contract.ts` + the vectors.
export type * from '../reliability/contract';
