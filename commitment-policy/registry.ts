/**
 * `CustomCommitmentPolicyRegistry` — the standalone, dependency-free commitment-strategy table (#1112).
 *
 * Mirrors `validity-merge/registry.ts`'s `CustomValidityMergeRegistry`: named policies register here, a
 * scope resolves the one it wants, and a `default` key marks the policy a control uses when its scope names
 * none. The runtime plug fulfils the same API on `CustomRegistry` (injector-chain-resolvable,
 * nearest-scope-wins) so the policy logic has one home and cannot drift. The spec's `register` /
 * `getProvider` names are kept as the public surface.
 */
import { assertCommitmentPolicy } from './provider.js';
import type { CommitmentPolicy } from './contract.js';

/** A scope asked for a policy name that was never registered. */
export class UnknownCommitmentPolicyError extends Error {
  constructor(key: string, known: string[]) {
    super(`Unknown commitment policy "${key}" — registered policies: ${known.join(', ') || 'none'}`);
    this.name = 'UnknownCommitmentPolicyError';
  }
}

/**
 * Registry of named commitment policies. Mirrors the `CustomRegistry` API the runtime plug extends
 * (`localName` + register/get/has/keys), kept self-contained here. The first registered (or one passed
 * `asDefault`) is the policy `getProvider()` returns when called with no name.
 */
export class CustomCommitmentPolicyRegistry {
  readonly localName = 'customCommitment';
  readonly #policies = new Map<string, CommitmentPolicy>();
  #defaultKey: string | null = null;

  /**
   * Register a policy. The spec form `register('full', policy)` passes a name; the policy's own `key` must
   * agree (so the table cannot disagree with the policy's identity). The first registered (or `asDefault`)
   * becomes the default.
   */
  register(name: string, policy: CommitmentPolicy, asDefault = false): void {
    assertCommitmentPolicy(policy);
    if (policy.key !== name) {
      throw new Error(`register("${name}", …): policy.key is "${policy.key}" — name and key must agree.`);
    }
    this.#policies.set(name, policy);
    if (asDefault || this.#defaultKey === null) this.#defaultKey = name;
  }

  /** Register a policy under its own `key` (value-first, like `CustomValidityMergeRegistry.define`). */
  define(policy: CommitmentPolicy, asDefault = false): void {
    this.register(policy.key, policy, asDefault);
  }

  has(key: string): boolean {
    return this.#policies.has(key);
  }
  keys(): string[] {
    return [...this.#policies.keys()];
  }
  get(key: string): CommitmentPolicy | undefined {
    return this.#policies.get(key);
  }

  /** The key `getProvider()` returns when called with no argument. */
  get defaultKey(): string | null {
    return this.#defaultKey;
  }

  /**
   * Resolve a policy by name, falling back to the registered default when `name` is omitted. Throws
   * `UnknownCommitmentPolicyError` when the named (or default) policy is absent — never silently
   * substitutes a different commit policy.
   */
  getProvider(name?: string): CommitmentPolicy {
    const wanted = name ?? this.#defaultKey;
    if (wanted === null) throw new UnknownCommitmentPolicyError('default', this.keys());
    const policy = this.#policies.get(wanted);
    if (!policy) throw new UnknownCommitmentPolicyError(wanted, this.keys());
    return policy;
  }
}
