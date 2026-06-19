/**
 * Reliability protocol — the **runtime-impl half** (#1019, slice #1052).
 *
 * The trust-boundary guard that validates a handler's crossing answer — the runtime that fulfils the
 * contract. The pure-contract half (types/interfaces, compile-erased) is its sibling `./contract.ts`,
 * the future `@webeverything/contracts/reliability` entry; the ordered `customRecovery` registry that
 * dispatches first-accept-wins lives in `./registry.ts`, the default wiring in `./index.ts`. This file
 * re-exports the contract surface (`export type * from './contract.js'`) so importers reach the types and
 * the runtime from one site — the split is at the *file* seam, not the public surface (mirrors
 * `guard/provider.ts` / `analytics/provider.ts`).
 *
 * Like the guard plane this is a standalone, dependency-free model of the contract: the runtime
 * `customRecovery` registry fulfils the same ordered iteration a core `CustomRegistry` exposes. There is
 * **no native-first default handler** — per the ratified design the protocol ships no built-in handlers
 * (HTTP retry, circuit breaker, offline queue are impl the consuming project registers), so the default
 * registry is empty and recovery degrades to a no-recovery `null` until a handler is `define()`d.
 */
import type {
  FailureDisposition,
  RecoveryOutcome,
  RecoveryPhase,
  RecoveryResult,
} from './contract.js';

// Re-export the pure-contract surface so `./provider.js` importers reach the types and the runtime from
// one site (the split is at the file seam, see ./contract.ts).
export type * from './contract.js';

/** The closed `RecoveryOutcome` set — the only values a handler may report (used by the trust guard). */
export const RECOVERY_OUTCOMES: readonly RecoveryOutcome[] = ['retry', 'queued', 'fallback', 'abort'];

/** The closed `FailureDisposition` set (#1032 Fork 1) — the normalized recoverability values. */
export const FAILURE_DISPOSITIONS: readonly FailureDisposition[] = ['transient', 'terminal', 'deferred'];

/** A handler returned something that is not a conformant `RecoveryResult` (the only-lock contract broken). */
export class RecoveryResultError extends Error {
  constructor(key: string, why: string) {
    super(`Recovery handler "${key}" broke the RecoveryResult contract: ${why}`);
    this.name = 'RecoveryResultError';
  }
}

/**
 * Enforce the result contract at the trust boundary: every non-null answer crossing back from a handler
 * is validated here, so a misbehaving (or hostile) custom handler is caught at the seam rather than
 * driving the consumer with a malformed outcome. A `null` is the legitimate *decline* and passes through
 * untouched; a non-null answer must carry a valid `outcome` and, when present, a valid `disposition`,
 * `phase`, `delay`, and `reason`. Returns the result typed when valid; throws `RecoveryResultError`
 * otherwise. (`RecoveryPhase` is an OPEN meta-schema — any non-empty string is admitted, since registered
 * extensions like `circuit-open` widen it without a contract break.)
 */
export function assertRecoveryResult(key: string, result: unknown): RecoveryResult | null {
  if (result === null || result === undefined) return null; // the decline — pass through
  if (typeof result !== 'object') {
    throw new RecoveryResultError(key, `expected an object or null, got ${typeof result}`);
  }
  const { outcome, disposition, phase, delay, reason } = result as Record<string, unknown>;
  if (typeof outcome !== 'string' || !RECOVERY_OUTCOMES.includes(outcome as RecoveryOutcome)) {
    throw new RecoveryResultError(key, `\`outcome\` must be one of ${RECOVERY_OUTCOMES.join(' | ')}, got ${String(outcome)}`);
  }
  if (disposition !== undefined && !FAILURE_DISPOSITIONS.includes(disposition as FailureDisposition)) {
    throw new RecoveryResultError(key, `\`disposition\` must be one of ${FAILURE_DISPOSITIONS.join(' | ')} when present, got ${String(disposition)}`);
  }
  if (phase !== undefined && (typeof phase !== 'string' || phase.length === 0)) {
    throw new RecoveryResultError(key, `\`phase\` must be a non-empty string when present, got ${typeof phase}`);
  }
  if (delay !== undefined && (typeof delay !== 'number' || !Number.isFinite(delay) || delay < 0)) {
    throw new RecoveryResultError(key, `\`delay\` must be a non-negative finite number when present, got ${String(delay)}`);
  }
  if (reason !== undefined && typeof reason !== 'string') {
    throw new RecoveryResultError(key, `\`reason\` must be a string when present, got ${typeof reason}`);
  }
  // Re-project to a clean object so only contract fields cross (no extra handler-private keys leak).
  const clean: RecoveryResult = { outcome: outcome as RecoveryOutcome };
  if (disposition !== undefined) (clean as { disposition?: FailureDisposition }).disposition = disposition as FailureDisposition;
  if (phase !== undefined) (clean as { phase?: RecoveryPhase }).phase = phase as RecoveryPhase;
  if (delay !== undefined) (clean as { delay?: number }).delay = delay as number;
  if (reason !== undefined) (clean as { reason?: string }).reason = reason as string;
  return clean;
}
