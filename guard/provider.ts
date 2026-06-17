/**
 * Guard protocol — the **runtime-impl half** (#288, graduated `guard`).
 *
 * The decision guard, the error class, the `ALLOW` value, and the **native-first default provider** —
 * the runtime that fulfils the contract. The pure-contract half (types/interfaces, compile-erased) is
 * its sibling `./contract.ts`, the future `@webeverything/contracts/guard` entry; the registry that
 * swaps providers lives in `./registry.ts`, the default wiring in `./index.ts`. This file re-exports the
 * contract surface (`export type * from './contract.js'`) so existing `./provider.js` importers keep one
 * import site for both halves; the split is at the *file* seam, not the public surface.
 *
 * Like the validity-merge and validator-resolution planes this is a standalone, dependency-free model of
 * the contract — the runtime `customGuards` plug (`plugs/webguards/`) fulfils the same shape as a core
 * `CustomRegistry`. The native-first default is **permissive** (no policy ⇒ allow), and *exit* leans on
 * the platform's own cancelable primitives rather than inventing a blocking mechanism (#288).
 */
import type {
  CustomGuardProvider,
  GuardContext,
  GuardDecision,
  GuardEvent,
  GuardRegion,
} from './contract.js';

// Re-export the pure-contract surface so `./provider.js` importers reach the types and the runtime from
// one site (the split is at the file seam, see ./contract.ts).
export type * from './contract.js';

/** A provider returned something that is not a conformant `GuardDecision` (the only-lock contract broken). */
export class GuardDecisionError extends Error {
  constructor(key: string, why: string) {
    super(`Guard provider "${key}" broke the GuardDecision contract: ${why}`);
    this.name = 'GuardDecisionError';
  }
}

/**
 * Enforce the decision contract at the trust boundary: every answer crossing back from a provider is
 * validated here, so a misbehaving (or hostile) custom provider is caught at the seam rather than
 * silently allowing a region. Returns the decision typed when valid; throws `GuardDecisionError`
 * otherwise.
 */
export function assertGuardDecision(key: string, decision: unknown): GuardDecision {
  if (decision === null || typeof decision !== 'object') {
    throw new GuardDecisionError(key, `expected an object, got ${decision === null ? 'null' : typeof decision}`);
  }
  const { allow, reason } = decision as Record<string, unknown>;
  if (typeof allow !== 'boolean') {
    throw new GuardDecisionError(key, `\`allow\` must be a boolean, got ${typeof allow}`);
  }
  if (reason !== undefined && typeof reason !== 'string') {
    throw new GuardDecisionError(key, `\`reason\` must be a string when present, got ${typeof reason}`);
  }
  return reason === undefined ? { allow } : { allow, reason };
}

/** A decision that allows the region — the native-first default's answer. */
export const ALLOW: GuardDecision = { allow: true };

/**
 * The native-first default provider: **permissive** (no policy ⇒ allow), for both entry and exit. It
 * does not invent a blocking mechanism — *exit* members lean on the platform's own cancelable
 * primitives (`beforeunload`, the Navigation API `navigate` intercept, a dialog `cancel`), and *access*
 * is allowed by default until a project override or custom provider says otherwise. Being static it
 * exposes no `subscribe` — nothing can revoke "allow".
 */
export class NativeGuardProvider implements CustomGuardProvider {
  readonly key = 'native';

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async evaluate(_region: GuardRegion, _event: GuardEvent, _context?: GuardContext): Promise<GuardDecision> {
    return ALLOW;
  }
}
